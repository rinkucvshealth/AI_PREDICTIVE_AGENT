import express from 'express';
import axios from 'axios';
import crypto from 'crypto';
import { config } from '../config';
import { logger } from '../utils/logger';
import { SACError } from '../types';

const router = express.Router();

function isSecureRequest(req: express.Request): boolean {
  const xfProto = (req.headers['x-forwarded-proto'] as string | undefined)?.toLowerCase();
  if (xfProto) return xfProto === 'https';
  return req.protocol === 'https';
}

function getRequestBaseUrl(req: express.Request): string {
  const xfProtoRaw = (req.headers['x-forwarded-proto'] as string | undefined) || '';
  const xfHostRaw = (req.headers['x-forwarded-host'] as string | undefined) || '';
  const xfProto = (xfProtoRaw.split(',')[0] || '').trim();
  const xfHost = (xfHostRaw.split(',')[0] || '').trim();

  const proto = xfProto || req.protocol;
  const host = xfHost || req.get('host');

  return `${proto}://${host}`;
}

function getCookie(req: express.Request, name: string): string | null {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';').map((p) => p.trim());
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx);
    const v = part.slice(idx + 1);
    if (k === name) return decodeURIComponent(v);
  }
  return null;
}

function isXSUAAClientIdFormat(clientId: string): boolean {
  // sb-xxx!bxxx|client!bxxx
  return /^sb-[^!]+!b[^|]+\|client!b.+$/.test(clientId);
}

function deriveTenantAndRegion(): { tenantName: string; region: string } {
  const tenantUrl = config.sac.tenantUrl;
  const tenantMatch = tenantUrl.match(/https:\/\/([^.]+)\.([^.]+)\./);
  const tenantName = tenantMatch ? tenantMatch[1] : '';
  const region = tenantMatch ? tenantMatch[2] : 'us10';
  return { tenantName, region };
}

function deriveOAuthTokenUrl(): { tokenUrl: string; tenantName: string; region: string } {
  const { tenantName, region } = deriveTenantAndRegion();

  const clientId = config.sac.clientId || '';
  const isXSUAA = isXSUAAClientIdFormat(clientId);

  // IMPORTANT:
  // - For authorization_code flow, SAC typically uses the Identity Authentication host
  //   (<tenant>.authentication.<region>.hana.ondemand.com) for /oauth/authorize and /oauth/token.
  // - API calls (CSRF, multiActions, etc.) must use the tenant URL (<tenant>.<region>.hcs.cloud.sap).
  // - Allow overrides via env/config to match what SAC shows in OAuth client details.
  const tokenUrl =
    (config.sac.oauthTokenUrl || '').trim() ||
    (process.env['SAC_OAUTH_TOKEN_URL'] || '').trim() ||
    `https://${tenantName}.authentication.${region}.hana.ondemand.com/oauth/token`;

  return { tokenUrl, tenantName, region };
}

function deriveOAuthAuthorizeUrl(tokenUrl: string): string {
  const override = (config.sac.oauthAuthUrl || '').trim() || (process.env['SAC_OAUTH_AUTH_URL'] || '').trim();
  if (override) return override;

  // Typical pattern: .../oauth/token -> .../oauth/authorize
  if (tokenUrl.endsWith('/oauth/token')) return tokenUrl.replace(/\/oauth\/token$/, '/oauth/authorize');

  // Fallback: best effort
  return tokenUrl.replace(/token$/, 'authorize');
}

router.get('/debug', (req, res) => {
  const { tokenUrl } = deriveOAuthTokenUrl();
  const authorizationUrl = deriveOAuthAuthorizeUrl(tokenUrl);

  const redirectUri =
    (process.env['SAC_REDIRECT_URI'] || '').trim() ||
    (config.sac.redirectUri || '').trim() ||
    `${getRequestBaseUrl(req)}/oauth/callback`;

  return res.json({
    tenantUrl: config.sac.tenantUrl,
    tokenUrl,
    authorizationUrl,
    redirectUri,
    request: {
      host: req.get('host'),
      'x-forwarded-host': req.headers['x-forwarded-host'],
      'x-forwarded-proto': req.headers['x-forwarded-proto'],
    },
    note: 'BASIS must register redirectUri EXACTLY in SAC OAuth client. Use /oauth/login after that.',
  });
});

/**
 * GET /oauth/login
 * Redirects user to SAC OAuth authorize endpoint to obtain an authorization code.
 *
 * BASIS should register Redirect URI = https://<your-app-route>/oauth/callback
 */
router.get('/login', async (req, res) => {
  try {
    if (!config.sac.clientId || config.sac.clientId === 'placeholder') {
      return res.status(400).json({ error: 'Missing SAC_CLIENT_ID' });
    }
    if (!config.sac.clientSecret || config.sac.clientSecret === 'placeholder') {
      return res.status(400).json({ error: 'Missing SAC_CLIENT_SECRET' });
    }

    const { tokenUrl } = deriveOAuthTokenUrl();
    const authorizationUrl = deriveOAuthAuthorizeUrl(tokenUrl);

    // Prefer explicit redirect URI, otherwise infer from current request.
    const redirectUri =
      (process.env['SAC_REDIRECT_URI'] || '').trim() ||
      (config.sac.redirectUri || '').trim() ||
      `${getRequestBaseUrl(req)}/oauth/callback`;

    // Optional scope (often not required if scopes are defined on the SAC OAuth client)
    const scope = (process.env['SAC_OAUTH_SCOPE'] || '').trim();

    const state = crypto.randomBytes(16).toString('hex');
    res.cookie('sac_oauth_state', state, {
      httpOnly: true,
      secure: isSecureRequest(req),
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000, // 10 minutes
      path: '/oauth',
    });

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.sac.clientId,
      redirect_uri: redirectUri,
      state,
    });

    if (scope) params.set('scope', scope);

    const redirectTo = `${authorizationUrl}?${params.toString()}`;
    logger.info(`Redirecting to SAC OAuth authorize URL (host only): ${new URL(authorizationUrl).host}`);
    return res.redirect(302, redirectTo);
  } catch (error: any) {
    logger.error('Failed to start OAuth login:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to start OAuth login' });
  }
});

/**
 * GET /oauth/callback
 * Exchanges authorization code for tokens and displays the refresh token for copy/paste.
 */
router.get('/callback', async (req, res) => {
  try {
    const errorParam = (req.query['error'] as string | undefined) || '';
    const errorDescription = (req.query['error_description'] as string | undefined) || '';
    if (errorParam) {
      return res.status(400).send(`OAuth error: ${errorParam}${errorDescription ? ` - ${errorDescription}` : ''}`);
    }

    const code = req.query['code'] as string | undefined;
    const state = req.query['state'] as string | undefined;
    if (!code) {
      return res.status(400).send('Missing "code" in OAuth callback.');
    }

    const expectedState = getCookie(req, 'sac_oauth_state');
    if (!expectedState || !state || state !== expectedState) {
      return res.status(400).send('Invalid OAuth state. Please restart the flow via /oauth/login.');
    }

    if (!config.sac.clientId || config.sac.clientId === 'placeholder') {
      return res.status(400).send('Missing SAC_CLIENT_ID.');
    }
    if (!config.sac.clientSecret || config.sac.clientSecret === 'placeholder') {
      return res.status(400).send('Missing SAC_CLIENT_SECRET.');
    }

    const { tokenUrl } = deriveOAuthTokenUrl();
    const redirectUri =
      (process.env['SAC_REDIRECT_URI'] || '').trim() ||
      (config.sac.redirectUri || '').trim() ||
      `${getRequestBaseUrl(req)}/oauth/callback`;

    const credentials = Buffer.from(`${config.sac.clientId}:${config.sac.clientSecret}`).toString('base64');
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    });

    logger.info('Exchanging authorization code for tokens...');
    const response = await axios.post(tokenUrl, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      timeout: 30000,
    });

    const accessToken = response.data?.access_token as string | undefined;
    const refreshToken = response.data?.refresh_token as string | undefined;
    const expiresIn = response.data?.expires_in as number | undefined;
    const scope = response.data?.scope as string | undefined;

    // Do NOT log token values.
    logger.info(`OAuth token exchange successful. refresh_token=${refreshToken ? 'present' : 'missing'}`);

    if (!refreshToken) {
      throw new SACError(
        'Token exchange succeeded but refresh_token is missing. Ensure the SAC OAuth client supports Interactive Usage / refresh tokens.'
      );
    }

    // Simple HTML response for copy/paste convenience.
    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>SAC OAuth Tokens</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; margin: 24px; }
      code, pre { background: #f6f8fa; padding: 12px; border-radius: 8px; display: block; overflow-x: auto; }
      .muted { color: #57606a; }
    </style>
  </head>
  <body>
    <h2>SAC OAuth token exchange successful</h2>
    <p class="muted">Copy the refresh token below and set it as <code>SAC_REFRESH_TOKEN</code> in your app environment.</p>

    <h3>Refresh Token</h3>
    <pre>${refreshToken}</pre>

    <h3>Environment variable</h3>
    <pre>SAC_REFRESH_TOKEN=${refreshToken}</pre>

    <h3>Token details (non-sensitive)</h3>
    <pre>${JSON.stringify({ expiresIn, scope, hasAccessToken: Boolean(accessToken) }, null, 2)}</pre>
  </body>
</html>`;

    return res.status(200).send(html);
  } catch (error: any) {
    logger.error('OAuth callback failed:', error.message);
    return res.status(500).send(`OAuth callback failed: ${error.message || 'Unknown error'}`);
  }
});

export default router;
