import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
import { SACError, SACMultiActionRequest, SACMultiActionResponse } from '../types';

type SACAxiosRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  /**
   * When true, we must use a user-context OAuth flow.
   * SAP Note 3407120: Multi Action API does NOT support client_credentials tokens.
   */
  _requireUserContext?: boolean;
};

/**
 * SAC API Client for interacting with SAP Analytics Cloud
 */
export class SACClient {
  private axiosClient: AxiosInstance;
  private tenantUrl: string;
  private modelId: string;
  private multiActionId: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private csrfToken: string | null = null;
  private cookies: string[] = [];

  constructor() {
    this.tenantUrl = config.sac.tenantUrl;
    this.modelId = config.sac.modelId;
    this.multiActionId = config.sac.multiActionId;

    // Create axios client for SAC API calls
    this.axiosClient = axios.create({
      baseURL: this.tenantUrl,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        // Required headers to bypass SAC approuter and access API directly
        'X-Requested-With': 'XMLHttpRequest', // Indicates this is an API request, not browser
        'X-CSRF-Token': 'Fetch', // Pre-fetch CSRF token
      },
      timeout: 60000, // 60 second timeout for multi-actions
      withCredentials: true, // Enable cookie handling
    });

    // Add request interceptor to inject OAuth token
    this.axiosClient.interceptors.request.use(async (cfg) => {
      const requestConfig = cfg as SACAxiosRequestConfig;
      const requireUserContext = Boolean(requestConfig._requireUserContext);
      const token = await this.getAccessToken({ allowClientCredentials: !requireUserContext });
      if (token) {
        requestConfig.headers.Authorization = `Bearer ${token}`;
      } else {
        const message = requireUserContext
          ? 'No user-context OAuth token available. Multi-Action API does NOT support client_credentials. Configure one of: SAC_REFRESH_TOKEN, SAC_SAML_ASSERTION, SAC_AUTHORIZATION_CODE+SAC_REDIRECT_URI, or SAC_USERNAME+SAC_PASSWORD.'
          : 'No OAuth token available - request will fail with 401';
        logger.error(`⚠️  ${message}`);

        // Fail fast for Multi-Action requests to avoid confusing SAC 401s.
        if (requireUserContext) {
          throw new SACError(message);
        }
      }
      return requestConfig;
    });

    // Add response interceptor to handle 401 and retry with fresh token
    this.axiosClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config as SACAxiosRequestConfig;
        
        // If 401 and we haven't retried yet, invalidate token and retry
        if (error.response?.status === 401 && !originalRequest._retry) {
          logger.warn('⚠️  Received 401 Unauthorized - invalidating token and retrying...');
          originalRequest._retry = true;
          
          // Force token refresh
          this.accessToken = null;
          this.tokenExpiry = 0;
          
          const requireUserContext = Boolean(originalRequest._requireUserContext);
          const token = await this.getAccessToken({ allowClientCredentials: !requireUserContext });
          if (token) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return this.axiosClient(originalRequest);
          }
        }
        
        return Promise.reject(error);
      }
    );

    logger.info(`SAC Client initialized for tenant: ${this.tenantUrl}`);
  }

  /**
   * Get OAuth access token
   * 
   * ✅ SUPPORTS SAC MULTI-ACTION REQUIREMENTS:
   *    - Interactive Usage (via Refresh Token)
   *    - SAML Bearer Assertion
   *    - Authorization Code flow (with refresh token)
   * 
   * ❌ DEPRECATED: client_credentials flow (causes 401 on Multi-Action execution)
   * 
   * Reference: SAP Help Documentation (help.sap.com)
   */
  private async getAccessToken(options?: { allowClientCredentials?: boolean }): Promise<string | null> {
    try {
      const allowClientCredentials = options?.allowClientCredentials ?? true;
      // Check if token is still valid (with 5 minute buffer)
      if (this.accessToken && Date.now() < this.tokenExpiry - 300000) {
        logger.info('Using cached OAuth token');
        return this.accessToken;
      }

      logger.info('========================================');
      logger.info('🔐 Starting OAuth token acquisition');
      logger.info('========================================');

      // Validate OAuth client configuration
      if (!config.sac.clientId || config.sac.clientId === 'placeholder') {
        logger.error('❌ SAC_CLIENT_ID is missing or not configured');
        logger.error('Please set SAC_CLIENT_ID environment variable');
        return null;
      }

      if (!config.sac.clientSecret || config.sac.clientSecret === 'placeholder') {
        logger.error('❌ SAC_CLIENT_SECRET is missing or not configured');
        logger.error('Please set SAC_CLIENT_SECRET environment variable');
        return null;
      }

      // Log credential format (masked)
      const clientIdMasked = config.sac.clientId.substring(0, 20) + '...' + config.sac.clientId.substring(config.sac.clientId.length - 10);
      logger.info(`Client ID format: ${clientIdMasked}`);
      
      // Detect XSUAA format (sb-xxx!bxxx|client!bxxx)
      const isXSUAAFormat = /^sb-[^!]+!b[^|]+\|client!b.+$/.test(config.sac.clientId);
      logger.info(`Credential type: ${isXSUAAFormat ? 'XSUAA (BTP-integrated)' : 'SAC-native OAuth'}`);

      // SAC OAuth token endpoint - extract tenant and region from tenant URL
      // e.g., https://cvs-pharmacy-q.us10.hcs.cloud.sap
      const tenantMatch = this.tenantUrl.match(/https:\/\/([^.]+)\.([^.]+)\./);
      const tenantName = tenantMatch ? tenantMatch[1] : '';
      const region = tenantMatch ? tenantMatch[2] : 'us10';
      
      // Default to SAC direct OAuth endpoint (for SAC-native OAuth clients)
      // For XSUAA, it will auto-detect and use the authentication subdomain
      const tokenUrl = config.sac.oauthTokenUrl || 
        (isXSUAAFormat 
          ? `https://${tenantName}.authentication.${region}.hana.ondemand.com/oauth/token`
          : `https://${tenantName}.${region}.hcs.cloud.sap/oauth/token`);
      
      logger.info(`OAuth token endpoint: ${tokenUrl}`);
      logger.info(`Tenant: ${tenantName}, Region: ${region}`);

      // Try authentication methods in priority order (SAC-recommended methods first)
      const methods: Array<{ name: string; method: (tokenUrl: string, tenantName: string, region: string) => Promise<string | null> }> = [
        { name: 'Method 1: Refresh Token (Interactive Usage) ✅ RECOMMENDED', method: this.tryRefreshToken.bind(this) },
        { name: 'Method 2: SAML Bearer Assertion ✅ RECOMMENDED', method: this.trySAMLBearer.bind(this) },
        { name: 'Method 3: Authorization Code (Interactive Usage)', method: this.tryAuthorizationCode.bind(this) },
        { name: 'Method 5: Password Grant (BASIS Team) ✅ WORKS', method: this.tryPasswordGrant.bind(this) },
      ];

      // SAP Note 3407120: Multi Action API does NOT support client_credentials.
      if (allowClientCredentials) {
        methods.push({ name: 'Method 4: Client Credentials (Fallback) ⚠️ DEPRECATED', method: this.tryClientCredentials.bind(this) });
      } else {
        logger.info('Skipping client_credentials flow (user-context required for this request)');
      }

      for (const { name, method } of methods) {
        try {
          logger.info(`Attempting ${name}...`);
          const token = await method(tokenUrl, tenantName, region);
          if (token) {
            logger.info(`✅ Success with ${name}`);
            logger.info('========================================');
            return token;
          }
        } catch (error: any) {
          logger.warn(`Failed ${name}:`, error.message);
          // Continue to next method
        }
      }

      logger.error('❌ All OAuth authentication methods failed');
      logger.error('');
      logger.error('📖 CONFIGURATION REQUIRED:');
      logger.error('   To fix 401 errors on Multi-Action execution, you need:');
      logger.error('');
      logger.error('   Option 1: Refresh Token (Easiest)');
      logger.error('     1. Get OAuth client from SAC admin (Interactive Usage type)');
      logger.error('     2. Perform initial login to get refresh token');
      logger.error('     3. Set SAC_REFRESH_TOKEN environment variable');
      logger.error('');
      logger.error('   Option 2: SAML Bearer Assertion');
      logger.error('     1. Configure SAML trust between Identity Provider and SAC');
      logger.error('     2. Set SAC_SAML_ASSERTION environment variable');
      logger.error('');
      logger.error('   See: CHECKLIST_IMPLEMENTATION_SUMMARY.md for detailed instructions');
      logger.error('========================================');
      return null;

    } catch (error: any) {
      logger.error('Failed to get OAuth access token:', error.message);
      if (error.response) {
        logger.error('OAuth error response:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          headers: error.response.headers,
        });
      }
      logger.error('========================================');
      return null;
    }
  }

  /**
   * Method 1: Refresh Token (Interactive Usage) ✅ RECOMMENDED
   * For OAuth clients with "Interactive Usage" purpose
   */
  private async tryRefreshToken(tokenUrl: string, tenantName: string, region: string): Promise<string | null> {
    // Check if refresh token is available
    const refreshToken = process.env['SAC_REFRESH_TOKEN'];
    if (!refreshToken) {
      logger.info('  ✗ No refresh token available (SAC_REFRESH_TOKEN not set)');
      return null;
    }

    logger.info('  → Using Refresh Token flow (Interactive Usage)');
    logger.info('  → Grant type: refresh_token');
    
    const credentials = Buffer.from(`${config.sac.clientId}:${config.sac.clientSecret}`).toString('base64');
    
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    const response = await axios.post(
      tokenUrl,
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`,
        },
        timeout: 30000,
      }
    );

    return this.processTokenResponse(response);
  }

  /**
   * Method 2: SAML Bearer Assertion ✅ RECOMMENDED
   * For SAML-based authentication with user context
   */
  private async trySAMLBearer(tokenUrl: string, tenantName: string, region: string): Promise<string | null> {
    // Check if SAML assertion is available
    const samlAssertion = process.env['SAC_SAML_ASSERTION'];
    if (!samlAssertion) {
      logger.info('  ✗ No SAML assertion available (SAC_SAML_ASSERTION not set)');
      return null;
    }

    logger.info('  → Using SAML Bearer Assertion flow');
    logger.info('  → Grant type: urn:ietf:params:oauth:grant-type:saml2-bearer');
    
    const credentials = Buffer.from(`${config.sac.clientId}:${config.sac.clientSecret}`).toString('base64');
    
    const params = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:saml2-bearer',
      assertion: samlAssertion,
      client_id: config.sac.clientId,
    });

    const response = await axios.post(
      tokenUrl,
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`,
        },
        timeout: 30000,
      }
    );

    return this.processTokenResponse(response);
  }

  /**
   * Method 3: Authorization Code (Interactive Usage)
   * For OAuth clients with authorization_code grant type
   * Requires SAC_AUTHORIZATION_CODE to be set from initial interactive login
   */
  private async tryAuthorizationCode(tokenUrl: string, tenantName: string, region: string): Promise<string | null> {
    // Check if authorization code is available
    const authCode = process.env['SAC_AUTHORIZATION_CODE'];
    const redirectUri = process.env['SAC_REDIRECT_URI'];
    
    if (!authCode) {
      logger.info('  ✗ No authorization code available (SAC_AUTHORIZATION_CODE not set)');
      return null;
    }

    if (!redirectUri) {
      logger.info('  ✗ No redirect URI configured (SAC_REDIRECT_URI not set)');
      return null;
    }

    logger.info('  → Using Authorization Code flow (Interactive Usage)');
    logger.info('  → Grant type: authorization_code');
    
    const credentials = Buffer.from(`${config.sac.clientId}:${config.sac.clientSecret}`).toString('base64');
    
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code: authCode,
      redirect_uri: redirectUri,
    });

    const response = await axios.post(
      tokenUrl,
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`,
        },
        timeout: 30000,
      }
    );

    return this.processTokenResponse(response);
  }

  /**
   * Method 4: Client Credentials (Fallback) ⚠️ DEPRECATED
   * 
   * WARNING: This flow is NOT recommended for SAC Multi-Action execution
   * It provides service-to-service authentication without user context
   * Will cause 401 Unauthorized errors on Multi-Action execution
   * 
   * Only kept as fallback for backward compatibility
   */
  private async tryClientCredentials(tokenUrl: string, tenantName: string, region: string): Promise<string | null> {
    logger.warn('  ⚠️  WARNING: Using client_credentials flow (deprecated for Multi-Actions)');
    logger.info('  → This may cause 401 errors on Multi-Action execution');
    logger.info('  → Grant type: client_credentials');
    
    const credentials = Buffer.from(`${config.sac.clientId}:${config.sac.clientSecret}`).toString('base64');
    
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
    });

    const response = await axios.post(
      tokenUrl,
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`,
        },
        timeout: 30000,
      }
    );

    // Warn about potential issues
    const token = this.processTokenResponse(response);
    if (token) {
      logger.warn('');
      logger.warn('⚠️  CLIENT_CREDENTIALS TOKEN ACQUIRED');
      logger.warn('━'.repeat(70));
      logger.warn('This token may NOT work for Multi-Action execution.');
      logger.warn('If you get 401 errors, you need to use one of:');
      logger.warn('  1. Refresh Token (set SAC_REFRESH_TOKEN)');
      logger.warn('  2. SAML Bearer Assertion (set SAC_SAML_ASSERTION)');
      logger.warn('  3. Authorization Code (set SAC_AUTHORIZATION_CODE + SAC_REDIRECT_URI)');
      logger.warn('');
      logger.warn('See: CHECKLIST_IMPLEMENTATION_SUMMARY.md');
      logger.warn('━'.repeat(70));
      logger.warn('');
    }

    return token;
  }

  /**
   * Method 5: Password Grant (Resource Owner Password Credentials)
   * 
   * ✅ WORKS: Provides user-context authentication for Multi-Actions
   * ⚠️  SECURITY: Stores user credentials in environment variables
   * 
   * Suggested by BASIS team as working solution.
   * Use for quick fix, then migrate to Refresh Token for production.
   */
  private async tryPasswordGrant(tokenUrl: string, tenantName: string, region: string): Promise<string | null> {
    // Check if username and password are available
    const username = process.env['SAC_USERNAME'];
    const password = process.env['SAC_PASSWORD'];
    
    if (!username || !password) {
      logger.info('  ✗ No username/password available (SAC_USERNAME or SAC_PASSWORD not set)');
      return null;
    }

    logger.info('  → Using Password Grant flow (Resource Owner Password Credentials)');
    logger.info('  → Grant type: password');
    logger.info('  → Username: ' + username.substring(0, 3) + '***' + (username.includes('@') ? '@' + username.split('@')[1] : ''));
    
    const credentials = Buffer.from(`${config.sac.clientId}:${config.sac.clientSecret}`).toString('base64');
    
    const params = new URLSearchParams({
      grant_type: 'password',
      username: username,
      password: password,
    });

    const response = await axios.post(
      tokenUrl,
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`,
        },
        timeout: 30000,
      }
    );

    const token = this.processTokenResponse(response);
    
    if (token) {
      logger.info('');
      logger.info('✅ PASSWORD GRANT TOKEN ACQUIRED');
      logger.info('━'.repeat(70));
      logger.info('User context: ' + username);
      logger.info('This token WILL work for Multi-Action execution! ✅');
      logger.info('⚠️  SECURITY NOTE: Consider using Refresh Token for production');
      logger.info('━'.repeat(70));
      logger.info('');
    }

    return token;
  }

  /**
   * Decode JWT token to analyze scopes and claims
   */
  private decodeJWT(token: string): any {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      return payload;
    } catch (error) {
      return null;
    }
  }

  /**
   * Analyze token scopes to detect permission issues
   */
  private analyzeTokenScopes(token: string): void {
    try {
      const payload = this.decodeJWT(token);
      if (!payload) return;

      const scopes = payload.scope || [];
      const scopeArray = Array.isArray(scopes) ? scopes : scopes.split(' ');

      // Check for Multi-Action execution scopes
      const hasMultiActionScope = scopeArray.some((s: string) => 
        s.includes('multiaction') || 
        s.includes('planning.write') || 
        s.includes('fpa.planning') ||
        s.includes('data.write')
      );

      // Detect XSUAA-only scopes (common issue)
      const hasOnlyXSUAAScopes = scopeArray.every((s: string) => 
        s.includes('uaa.') || 
        s.includes('approuter') || 
        s.includes('dmi-api-proxy')
      );

      if (!hasMultiActionScope && hasOnlyXSUAAScopes) {
        logger.warn('');
        logger.warn('⚠️  WARNING: Token Analysis Detected Potential Issue ⚠️');
        logger.warn('━'.repeat(70));
        logger.warn('Token has XSUAA scopes but lacks Multi-Action execution scopes.');
        logger.warn('This will cause 401 Unauthorized errors on Multi-Action execution.');
        logger.warn('');
        logger.warn('Current Scopes:', scopeArray.join(', '));
        logger.warn('');
        logger.warn('🔧 SOLUTION: Create SAC-native OAuth client');
        logger.warn('   Location: SAC → System → Administration → OAuth Clients');
        logger.warn('   Required Scopes: Planning API, Multi-Action Execution');
        logger.warn('   Documentation: See AUTHORIZATION_ROOT_CAUSE_ANALYSIS.md');
        logger.warn('━'.repeat(70));
        logger.warn('');
      }
    } catch (error) {
      // Silently ignore token analysis errors
    }
  }

  /**
   * Process OAuth token response
   */
  private processTokenResponse(response: any): string | null {
    if (response.data && response.data.access_token) {
      this.accessToken = response.data.access_token;
      
      // Set expiry time (default to 3600 seconds if not provided)
      const expiresIn = response.data.expires_in || 3600;
      this.tokenExpiry = Date.now() + (expiresIn * 1000);

      // Log token info (masked)
      if (this.accessToken) {
        const tokenPreview = this.accessToken.substring(0, 20) + '...';
        logger.info(`  ✓ Token acquired: ${tokenPreview}`);
        logger.info(`  ✓ Expires in: ${expiresIn} seconds`);
        logger.info(`  ✓ Token type: ${response.data.token_type || 'Bearer'}`);
        
        if (response.data.scope) {
          logger.info(`  ✓ Scopes: ${response.data.scope}`);
        }

        // Analyze token scopes for permission issues
        this.analyzeTokenScopes(this.accessToken);
      }

      return this.accessToken;
    }

    logger.warn('  ✗ No access_token in response');
    return null;
  }

  /**
   * Fetch CSRF token from SAC
   * SAC requires CSRF tokens for POST/PUT/DELETE operations
   * Tries multiple endpoints as fallback
   */
  private async fetchCsrfToken(requireUserContext: boolean = false): Promise<string | null> {
    try {
      logger.info('🔒 Fetching CSRF token from SAC...');
      
      // Try multiple endpoints to fetch CSRF token
      const csrfEndpoints = [
        // SAP Note 3407120: Use <tenant-url>/api/v1/csrf (NOT *.authentication.*)
        '/api/v1/csrf',
        `/api/v1/dataimport/planningModel/${this.modelId}`,
        '/api/v1/dataimport/planningModel',
        '/api/v1/models',
        `/api/v1/multiactions/${this.multiActionId}`,
      ];

      for (const endpoint of csrfEndpoints) {
        try {
          logger.info(`  → Trying CSRF endpoint: ${endpoint}`);
          
          // Make a HEAD or GET request to fetch CSRF token
          // SAC returns CSRF token in the x-csrf-token header when requested with x-csrf-token: Fetch
          const response = await this.axiosClient.get(endpoint, {
            headers: {
              'x-csrf-token': 'Fetch',
            },
            // Ensure we use a user-context token for Multi Action API flows.
            // Note: axios allows custom config properties; interceptor reads this.
            ...(requireUserContext ? ({ _requireUserContext: true } as any) : {}),
            validateStatus: (status) => status < 500, // Accept 4xx responses
          });

          const csrfToken = response.headers['x-csrf-token'];
          const setCookieHeader = response.headers['set-cookie'];

          if (csrfToken) {
            // Store cookies for subsequent requests
            if (setCookieHeader) {
              this.cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
              logger.info(`  ✓ Stored ${this.cookies.length} cookie(s) for session`);
            }

            this.csrfToken = csrfToken;
            logger.info(`  ✓ CSRF token acquired: ${csrfToken.substring(0, 20)}...`);
            
            return csrfToken;
          }
        } catch (error: any) {
          logger.warn(`  ✗ Failed to fetch CSRF from ${endpoint}: ${error.message}`);
          // Continue to next endpoint
        }
      }

      logger.warn('⚠️  Could not fetch CSRF token from any endpoint');
      logger.warn('Will attempt request without CSRF token');
      return null;
    } catch (error: any) {
      logger.error('Failed to fetch CSRF token:', error.message);
      return null;
    }
  }

  /**
   * Test connection to SAC
   */
  async testConnection(): Promise<boolean> {
    try {
      logger.info('Testing SAC connection...');
      
      // Try to access the API endpoint (adjust based on actual SAC API)
      await this.axiosClient.get('/api/v1/models');
      
      logger.info('SAC connection successful');
      return true;
    } catch (error: any) {
      logger.error('SAC connection test failed:', error.message);
      throw new SACError(`SAC connection failed: ${error.message}`);
    }
  }

  /**
   * Trigger a Multi-Action in SAC
   * @param request Multi-Action parameters
   * @returns Multi-Action execution response
   */
  async triggerMultiAction(request: SACMultiActionRequest): Promise<SACMultiActionResponse> {
    try {
      logger.info('========================================');
      logger.info(`🎯 Triggering SAC Multi-Action`);
      logger.info('========================================');
      logger.info(`Multi-Action ID: ${this.multiActionId}`);
      logger.info(`Model ID: ${this.modelId}`);
      logger.info(`Parameters:`, request.parameters);

      // Fetch CSRF token before making the POST request (SAP Note 3407120 recommends /api/v1/csrf)
      // Also ensure we use a user-context OAuth token (Multi Action API does NOT support client_credentials).
      const csrfToken = await this.fetchCsrfToken(true);

      // SAC Multi-Action API Endpoint (Based on SAP Help Documentation)
      // Format: /api/v1/multiActions/<packageId>:<objectId>/executions
      // Reference: https://help.sap.com
      
      const endpoints = [
        {
          name: 'Multi-Action Executions API (SAP Recommended)',
          url: `/api/v1/multiActions/${this.multiActionId}/executions`,
          body: {
            parameterValues: request.parameters,
          },
        },
        {
          name: 'Data Import Job (Fallback)',
          url: `/api/v1/dataimport/planningModel/${this.modelId}/jobs`,
          body: {
            type: 'MULTIACTION',
            multiActionId: this.multiActionId,
            parameters: request.parameters,
          },
        },
        {
          name: 'Planning Model Multi-Action Runs (Fallback)',
          url: `/api/v1/dataimport/planningModel/${this.modelId}/multiActions/${this.multiActionId}/runs`,
          body: {
            parameterValues: request.parameters,
          },
        },
      ];

      // Prepare headers with CSRF token, cookies, and browser-like headers
      // This combination proved to work in testing (gets past 403 to actual SAC processing)
      const headers: any = {
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json, text/plain, */*',
      };
      
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
        logger.info(`  ✓ Using CSRF token in request`);
      } else {
        logger.warn(`  ⚠️  No CSRF token available, proceeding without it`);
      }

      // Add cookies to the request (CRITICAL for authentication)
      if (this.cookies.length > 0) {
        headers['Cookie'] = this.cookies.map(cookie => {
          // Extract just the key=value part before the first semicolon
          return cookie.split(';')[0];
        }).join('; ');
        logger.info(`  ✓ Using ${this.cookies.length} session cookie(s)`);
      }
      
      // Add browser-like headers to help SAC process the request
      headers['Origin'] = this.tenantUrl;
      headers['Referer'] = this.tenantUrl + '/';

      // Try each endpoint in order
      let lastError: any = null;
      
      for (const endpoint of endpoints) {
        try {
          logger.info(`Attempting endpoint: ${endpoint.name}`);
          logger.info(`  URL: ${this.tenantUrl}${endpoint.url}`);
          logger.info(`  Body:`, JSON.stringify(endpoint.body, null, 2));
          
          const response = await this.axiosClient.post(
            endpoint.url,
            endpoint.body,
            { headers, _requireUserContext: true } as any
          );
          
          logger.info(`✅ Multi-Action triggered successfully via ${endpoint.name}`);
          logger.info('Response:', response.data);
          logger.info('========================================');

          return {
            status: 'success',
            executionId: response.data.runId || response.data.id || response.data.jobId || 'unknown',
            message: `Multi-Action execution started via ${endpoint.name}`,
          };
        } catch (error: any) {
          const status = error.response?.status;
          logger.warn(`❌ ${endpoint.name} failed: ${status || error.message}`);
          lastError = error;
          
          // Log detailed error for 500 errors (SAC internal errors)
          if (status === 500) {
            logger.error('  → SAC Internal Server Error (500) Details:');
            if (error.response?.data) {
              logger.error('  → Response Body:', JSON.stringify(error.response.data, null, 2));
            }
            logger.warn('  → This usually means: user lacks permission, Multi-Action script error, or invalid parameters');
            logger.warn('  → Trying next endpoint...');
            continue;
          }
          
          // Don't retry on certain error codes
          if (status === 403 || status === 401) {
            logger.warn('  → Authentication/Authorization error, trying next endpoint...');
            continue;
          }
          
          if (status === 404) {
            logger.warn('  → Endpoint not found, trying next endpoint...');
            continue;
          }
          
          // For other errors, continue to next endpoint
          continue;
        }
      }
      
      // If all endpoints failed, throw the last error
      logger.error('❌ All Multi-Action endpoints failed');
      throw lastError || new Error('All Multi-Action endpoints failed');
    } catch (error: any) {
      logger.error('========================================');
      logger.error('❌ Failed to trigger Multi-Action');
      logger.error('========================================');
      logger.error('Error message:', error.message);
      
      if (error.response) {
        logger.error('Response Details:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          headers: error.response.headers,
        });
        logger.error('Request Details:', {
          method: error.config?.method,
          url: error.config?.url,
          baseURL: error.config?.baseURL,
          fullURL: `${error.config?.baseURL}${error.config?.url}`,
          headers: {
            ...error.config?.headers,
            Authorization: error.config?.headers?.Authorization ? 
              error.config.headers.Authorization.substring(0, 30) + '...' : 'Not set',
            'x-csrf-token': error.config?.headers?.['x-csrf-token'] ? 
              error.config.headers['x-csrf-token'].substring(0, 20) + '...' : 'Not set',
          },
        });

        // Provide specific guidance for 401 errors
        if (error.response.status === 401) {
          logger.error('');
          logger.error('🔍 401 UNAUTHORIZED ERROR - CHECKLIST ANALYSIS');
          logger.error('━'.repeat(70));
          logger.error('Authentication succeeded (got OAuth token) ✅');
          logger.error('But authorization failed (insufficient permissions) ❌');
          logger.error('');
          logger.error('LIKELY CAUSES:');
          logger.error('  1. ❌ Using client_credentials OAuth flow (machine-to-machine)');
          logger.error('     ✅ REQUIRED: Interactive Usage or SAML Bearer Assertion');
          logger.error('  2. ❌ OAuth client lacks Multi-Action execution scopes');
          logger.error('  3. ❌ Token is not for a real SAC user with permissions');
          logger.error('  4. ❌ Multi-Action is not enabled for external API access');
          logger.error('     ✅ REQUIRED: Multi-Action setting "Allow External API Access"');
          logger.error('');
          logger.error('🔧 SOLUTION: Create SAC-native OAuth client');
          logger.error('   Location: SAC → System → Administration → OAuth Clients');
          logger.error('   Purpose: Interactive Usage and API Access (NOT client_credentials)');
          logger.error('   Required Scopes:');
          logger.error('     • Data Import Service API');
          logger.error('     • Planning Model API');
          logger.error('     • Multi-Action Execution');
          logger.error('     • Read/Write Planning Data');
          logger.error('   Assign to: Technical user with permissions to:');
          logger.error('     • Access model: ' + this.modelId);
          logger.error('     • Execute multi-action: ' + this.multiActionId);
          logger.error('');
          logger.error('📌 SAP Note 3407120 checkpoint:');
          logger.error('   - Use CSRF endpoint: <tenant-url>/api/v1/csrf');
          logger.error('   - Multi Action API does NOT support client_credentials tokens');
          logger.error('📖 References:');
          logger.error('   • AUTHORIZATION_ROOT_CAUSE_ANALYSIS.md');
          logger.error('   • BASIS_TEAM_ACTION_GUIDE.md');
          logger.error('   • SAP Help: help.sap.com');
          logger.error('━'.repeat(70));
          logger.error('');
        }
      } else if (error.request) {
        logger.error('No response received from server');
        logger.error('Request:', error.request);
      }
      logger.error('========================================');

      // Include SAC response details in the thrown error (helps troubleshooting 401/403/404).
      if (error?.response) {
        let responseBodyPreview = '';
        try {
          const data = error.response.data;
          if (typeof data === 'string') {
            responseBodyPreview = data.slice(0, 2000);
          } else if (data !== undefined) {
            responseBodyPreview = JSON.stringify(data).slice(0, 2000);
          }
        } catch {
          // ignore
        }

        const details = [
          `status=${error.response.status}`,
          error.response.statusText ? `statusText=${error.response.statusText}` : null,
          responseBodyPreview ? `body=${responseBodyPreview}` : null,
        ].filter(Boolean).join(' ');

        throw new SACError(`Failed to trigger Multi-Action: ${error.message} (${details})`);
      }

      throw new SACError(`Failed to trigger Multi-Action: ${error.message}`);
    }
  }

  /**
   * Check Multi-Action execution status
   * @param executionId Execution ID from trigger response
   * @returns Execution status
   */
  async checkMultiActionStatus(executionId: string): Promise<SACMultiActionResponse> {
    try {
      logger.info(`Checking Multi-Action status: ${executionId}`);

      // SAC Multi-Action status endpoint (placeholder)
      const endpoint = `/api/v1/multiactions/executions/${executionId}`;

      const response = await this.axiosClient.get(endpoint);

      return {
        status: response.data.status || 'running',
        message: response.data.message,
      };
    } catch (error: any) {
      logger.error('Failed to check Multi-Action status:', error.message);
      throw new SACError(`Failed to check status: ${error.message}`);
    }
  }

  /**
   * Get Planning Model details
   * @returns Model information
   */
  async getModelInfo(): Promise<any> {
    try {
      logger.info(`Getting model info for: ${this.modelId}`);

      const endpoint = `/api/v1/models/${this.modelId}`;
      const response = await this.axiosClient.get(endpoint);

      return response.data;
    } catch (error: any) {
      logger.error('Failed to get model info:', error.message);
      throw new SACError(`Failed to get model info: ${error.message}`);
    }
  }

  /**
   * Discover available SAC API endpoints
   * Tests various endpoints to find what's available in the environment
   */
  async discoverEndpoints(): Promise<any> {
    logger.info('🔍 Starting endpoint discovery...');
    logger.info('========================================');

    const endpointsToTest = [
      // Multi-Action endpoints
      { name: 'Multi-Actions List', path: '/api/v1/multiActions', method: 'GET' },
      { name: 'Multi-Action Details', path: `/api/v1/multiActions/${this.multiActionId}`, method: 'GET' },
      { name: 'Multi-Action Executions', path: `/api/v1/multiActions/${this.multiActionId}/executions`, method: 'GET' },
      
      // Planning Model endpoints
      { name: 'Planning Models List', path: '/api/v1/dataimport/planningModel', method: 'GET' },
      { name: 'Planning Model Details', path: `/api/v1/dataimport/planningModel/${this.modelId}`, method: 'GET' },
      { name: 'Planning Model Jobs', path: `/api/v1/dataimport/planningModel/${this.modelId}/jobs`, method: 'GET' },
      { name: 'Planning Model Multi-Actions', path: `/api/v1/dataimport/planningModel/${this.modelId}/multiActions`, method: 'GET' },
      { name: 'Planning Model Multi-Action Runs', path: `/api/v1/dataimport/planningModel/${this.modelId}/multiActions/${this.multiActionId}/runs`, method: 'GET' },
      
      // Model endpoints
      { name: 'Models List', path: '/api/v1/models', method: 'GET' },
      { name: 'Model Details', path: `/api/v1/models/${this.modelId}`, method: 'GET' },
      
      // Data Import endpoints
      { name: 'Data Import Service', path: '/api/v1/dataimport', method: 'GET' },
      
      // Stories/Applications endpoints
      { name: 'Stories List', path: '/api/v1/stories', method: 'GET' },
      { name: 'Applications List', path: '/api/v1/applications', method: 'GET' },
    ];

    const results = [];

    for (const endpoint of endpointsToTest) {
      try {
        logger.info(`Testing: ${endpoint.name} (${endpoint.method} ${endpoint.path})`);
        
        const response = await this.axiosClient.request({
          method: endpoint.method.toLowerCase() as any,
          url: endpoint.path,
          validateStatus: () => true, // Accept all status codes
          timeout: 10000,
        });

        const status = response.status;
        const available = status >= 200 && status < 400;
        
        results.push({
          name: endpoint.name,
          path: endpoint.path,
          method: endpoint.method,
          status,
          available,
          message: available ? '✅ Available' : 
                  status === 401 ? '🔒 Requires authentication/authorization' :
                  status === 404 ? '❌ Not found' :
                  status === 403 ? '🚫 Forbidden' :
                  `⚠️ Status ${status}`,
          responsePreview: available && response.data ? 
            JSON.stringify(response.data).substring(0, 200) + (JSON.stringify(response.data).length > 200 ? '...' : '') :
            null,
        });

        logger.info(`  → Status: ${status} - ${results[results.length - 1].message}`);
        
      } catch (error: any) {
        results.push({
          name: endpoint.name,
          path: endpoint.path,
          method: endpoint.method,
          status: error.response?.status || 'error',
          available: false,
          message: `❌ Error: ${error.message}`,
          error: error.message,
        });
        logger.info(`  → Error: ${error.message}`);
      }
    }

    logger.info('========================================');
    logger.info('🔍 Discovery Summary:');
    const availableCount = results.filter(r => r.available).length;
    logger.info(`  ✅ Available: ${availableCount}/${results.length}`);
    logger.info(`  ❌ Not Available: ${results.length - availableCount}/${results.length}`);
    logger.info('========================================');

    return {
      summary: {
        total: results.length,
        available: availableCount,
        notAvailable: results.length - availableCount,
      },
      endpoints: results,
      recommendations: this.generateEndpointRecommendations(results),
    };
  }

  /**
   * Generate recommendations based on discovery results
   */
  private generateEndpointRecommendations(results: any[]): string[] {
    const recommendations = [];

    const multiActionEndpoints = results.filter(r => r.name.toLowerCase().includes('multi-action'));
    const availableMultiAction = multiActionEndpoints.filter(r => r.available);

    if (availableMultiAction.length === 0) {
      recommendations.push('⚠️ No Multi-Action endpoints are available. Check:');
      recommendations.push('   1. Multi-Action ID is correct: ' + this.multiActionId);
      recommendations.push('   2. Multi-Action exists in SAC');
      recommendations.push('   3. Multi-Action has "Allow External API Access" enabled');
      recommendations.push('   4. User has permissions to execute the Multi-Action');
    } else {
      recommendations.push('✅ Found working Multi-Action endpoints:');
      availableMultiAction.forEach(e => recommendations.push(`   • ${e.path}`));
    }

    const modelEndpoints = results.filter(r => r.name.toLowerCase().includes('model') && r.available);
    if (modelEndpoints.length > 0) {
      recommendations.push('✅ Model endpoints are working - model ID is correct');
    }

    const authIssues = results.filter(r => r.status === 401 || r.status === 403);
    if (authIssues.length > 0) {
      recommendations.push(`⚠️ ${authIssues.length} endpoint(s) have auth issues - check OAuth scopes`);
    }

    return recommendations;
  }

  /**
   * List all Multi-Actions in the planning model
   */
  async listMultiActions(): Promise<any> {
    try {
      logger.info('📋 Listing Multi-Actions...');
      logger.info('========================================');

      // Try different endpoints to list Multi-Actions
      const endpoints = [
        `/api/v1/multiActions`,
        `/api/v1/dataimport/planningModel/${this.modelId}/multiActions`,
        `/api/v1/models/${this.modelId}/multiActions`,
      ];

      for (const endpoint of endpoints) {
        try {
          logger.info(`Trying: ${endpoint}`);
          const response = await this.axiosClient.get(endpoint, {
            validateStatus: (status) => status === 200,
          });

          logger.info(`✅ Success! Found Multi-Actions at: ${endpoint}`);
          logger.info('Multi-Actions:', JSON.stringify(response.data, null, 2));
          logger.info('========================================');

          return {
            endpoint,
            multiActions: response.data,
            count: Array.isArray(response.data) ? response.data.length : 
                   response.data.multiActions ? response.data.multiActions.length : 'unknown',
          };
        } catch (error: any) {
          logger.info(`  → Failed (${error.response?.status || error.message}), trying next...`);
          continue;
        }
      }

      logger.warn('❌ Could not find Multi-Actions list endpoint');
      logger.info('========================================');
      
      return {
        error: 'No Multi-Actions list endpoint found',
        suggestion: 'The Multi-Action API might not be enabled or accessible in this environment',
      };
    } catch (error: any) {
      logger.error('Failed to list Multi-Actions:', error.message);
      throw new SACError(`Failed to list Multi-Actions: ${error.message}`);
    }
  }

  /**
   * Test Multi-Action POST with different header combinations
   * Helps diagnose why POST returns 404 while GET returns 200
   */
  async testMultiActionPost(): Promise<any> {
    try {
      logger.info('🧪 Testing Multi-Action POST request...');
      logger.info('========================================');

      const testEndpoint = `/api/v1/multiActions/${this.multiActionId}/executions`;
      const testBody = {
        parameterValues: {
          GLAccount: "500100",
          ForecastPeriod: 6,
          VersionName: "Test_POST"
        }
      };

      // Get CSRF token and cookies first
      const csrfToken = await this.fetchCsrfToken(true);
      
      const headerCombinations = [
        {
          name: 'Standard API Headers',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          }
        },
        {
          name: 'With CSRF Token',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'x-csrf-token': csrfToken || 'Fetch',
          }
        },
        {
          name: 'With Cookies',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'x-csrf-token': csrfToken || 'Fetch',
            'Cookie': this.cookies.map(c => c.split(';')[0]).join('; '),
          }
        },
        {
          name: 'Browser-like Headers',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
            'X-Requested-With': 'XMLHttpRequest',
            'x-csrf-token': csrfToken || 'Fetch',
            'Cookie': this.cookies.map(c => c.split(';')[0]).join('; '),
            'Origin': this.tenantUrl,
            'Referer': this.tenantUrl + '/',
          }
        },
      ];

      const results = [];

      for (const combo of headerCombinations) {
        try {
          logger.info(`Testing: ${combo.name}`);
          logger.info(`  Headers: ${JSON.stringify(combo.headers, null, 2)}`);
          
          const response = await this.axiosClient.post(
            testEndpoint,
            testBody,
            {
              headers: combo.headers,
              _requireUserContext: true,
              validateStatus: () => true, // Accept all status codes
            } as any
          );

          const isHtmlResponse = typeof response.data === 'string' && response.data.includes('<html>');
          
          results.push({
            name: combo.name,
            status: response.status,
            statusText: response.statusText,
            isHtmlRedirect: isHtmlResponse,
            success: response.status >= 200 && response.status < 300 && !isHtmlResponse,
            message: isHtmlResponse ? '❌ Got HTML redirect (approuter intercepted)' :
                    response.status >= 200 && response.status < 300 ? '✅ SUCCESS!' :
                    response.status === 404 ? '❌ 404 Not Found' :
                    response.status === 401 ? '❌ 401 Unauthorized' :
                    response.status === 403 ? '❌ 403 Forbidden' :
                    `⚠️ Status ${response.status}`,
            responsePreview: typeof response.data === 'string' ? 
              response.data.substring(0, 200) + '...' :
              JSON.stringify(response.data).substring(0, 200) + '...',
          });

          logger.info(`  Result: ${results[results.length - 1].message}`);
          
        } catch (error: any) {
          results.push({
            name: combo.name,
            status: error.response?.status || 'error',
            error: error.message,
            message: `❌ Error: ${error.message}`,
          });
          logger.info(`  Result: Error - ${error.message}`);
        }
      }

      logger.info('========================================');
      logger.info('🧪 POST Test Summary:');
      const successCount = results.filter(r => r.success).length;
      logger.info(`  ✅ Success: ${successCount}/${results.length}`);
      logger.info('========================================');

      return {
        endpoint: testEndpoint,
        testBody,
        results,
        summary: {
          total: results.length,
          success: successCount,
          failed: results.length - successCount,
        },
        recommendation: successCount > 0 ? 
          `✅ Found working header combination: ${results.find(r => r.success)?.name}` :
          '❌ No header combination worked. May need different API approach.',
      };
    } catch (error: any) {
      logger.error('POST test failed:', error.message);
      throw new SACError(`POST test failed: ${error.message}`);
    }
  }
}

// Export singleton instance
export const sacClient = new SACClient();
