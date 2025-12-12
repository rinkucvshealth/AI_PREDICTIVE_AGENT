import * as dotenv from 'dotenv';
import * as path from 'path';
import { Config } from './types';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

function inferEnvironmentLabelFromTenantUrl(tenantUrl: string): string {
  try {
    const hostname = new URL(tenantUrl).hostname.toLowerCase();
    // Common patterns: "-q" (QA), "-p" (prod), "dev", "test"
    if (hostname.includes('-q.') || hostname.includes('-qa.') || hostname.includes('qa')) return 'QA';
    if (hostname.includes('-t.') || hostname.includes('-test.') || hostname.includes('test')) return 'TEST';
    if (hostname.includes('-d.') || hostname.includes('-dev.') || hostname.includes('dev')) return 'DEV';
    if (hostname.includes('-p.') || hostname.includes('-prod.') || hostname.includes('prod')) return 'PROD';
    return (process.env['NODE_ENV'] || 'unknown').toUpperCase();
  } catch {
    return (process.env['NODE_ENV'] || 'unknown').toUpperCase();
  }
}

function validateConfig(): Config {
  const requiredEnvVars = [
    'SAC_TENANT_URL',
    'SAC_CLIENT_ID',
    'SAC_CLIENT_SECRET',
    'SAC_MODEL_ID',
    'OPENAI_API_KEY',
    'API_KEY'
  ];

  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  if (missing.length > 0) {
    console.warn(`⚠️  Missing environment variables: ${missing.join(', ')}`);
    console.warn('Using placeholder values - update before deployment!');
  }

  return {
    sac: {
      tenantUrl: process.env['SAC_TENANT_URL'] || 'https://cvs-pharmacy-q.us10.hcs.cloud.sap',
      clientId: process.env['SAC_CLIENT_ID'] || 'placeholder',
      clientSecret: process.env['SAC_CLIENT_SECRET'] || 'placeholder',
      oauthTokenUrl: process.env['SAC_OAUTH_TOKEN_URL'], // Optional: Override OAuth token endpoint
      modelId: process.env['SAC_MODEL_ID'] || 'PRDA_PL_PLAN',
      multiActionId: process.env['SAC_MULTI_ACTION_ID'] || 'MULTIACTIONS:t.2:E5280280114D3785596849C3D321B820',
      storyId: process.env['SAC_STORY_ID'],
      // OAuth Flow Options (for Interactive Usage / SAML Bearer Assertion)
      refreshToken: process.env['SAC_REFRESH_TOKEN'],
      samlAssertion: process.env['SAC_SAML_ASSERTION'],
      authorizationCode: process.env['SAC_AUTHORIZATION_CODE'],
      redirectUri: process.env['SAC_REDIRECT_URI'],
    },
    openai: {
      apiKey: process.env['OPENAI_API_KEY'] || 'placeholder',
    },
    server: {
      port: parseInt(process.env['PORT'] || '3002', 10),
      apiKey: process.env['API_KEY'] || 'placeholder',
      allowedOrigin: process.env['ALLOWED_ORIGIN'] || '*',
    },
    app: {
      nodeEnv: process.env['NODE_ENV'] || 'development',
      // Prefer explicit label when provided; otherwise infer from tenant URL.
      environmentLabel:
        (process.env['APP_ENV'] || process.env['ENVIRONMENT'] || '').trim().toUpperCase() ||
        inferEnvironmentLabelFromTenantUrl(process.env['SAC_TENANT_URL'] || 'https://cvs-pharmacy-q.us10.hcs.cloud.sap'),
      logLevel: process.env['LOG_LEVEL'] || 'info',
      defaultForecastPeriod: parseInt(process.env['DEFAULT_FORECAST_PERIOD'] || '6', 10),
      defaultVersionPrefix: process.env['DEFAULT_VERSION_PREFIX'] || 'Forecast',
    },
  };
}

export const config = validateConfig();

// Log configuration (hide sensitive data)
console.log('📋 Configuration loaded:');
console.log(`   SAC Tenant: ${config.sac.tenantUrl}`);
console.log(`   SAC Model: ${config.sac.modelId}`);
console.log(`   Environment: ${config.app.environmentLabel} (NODE_ENV=${config.app.nodeEnv})`);
console.log(`   Port: ${config.server.port}`);
