import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
import { SACError, SACMultiActionRequest, SACMultiActionResponse } from '../types';

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
      },
      timeout: 60000, // 60 second timeout for multi-actions
      withCredentials: true, // Enable cookie handling
    });

    // Add request interceptor to inject OAuth token
    this.axiosClient.interceptors.request.use(async (config) => {
      const token = await this.getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        logger.error('⚠️  No OAuth token available - request will fail with 401');
      }
      return config;
    });

    // Add response interceptor to handle 401 and retry with fresh token
    this.axiosClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        // If 401 and we haven't retried yet, invalidate token and retry
        if (error.response?.status === 401 && !originalRequest._retry) {
          logger.warn('⚠️  Received 401 Unauthorized - invalidating token and retrying...');
          originalRequest._retry = true;
          
          // Force token refresh
          this.accessToken = null;
          this.tokenExpiry = 0;
          
          const token = await this.getAccessToken();
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
  private async getAccessToken(): Promise<string | null> {
    try {
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
      const methods = [
        { name: 'Method 1: Refresh Token (Interactive Usage) ✅ RECOMMENDED', method: this.tryRefreshToken.bind(this) },
        { name: 'Method 2: SAML Bearer Assertion ✅ RECOMMENDED', method: this.trySAMLBearer.bind(this) },
        { name: 'Method 3: Authorization Code (Interactive Usage)', method: this.tryAuthorizationCode.bind(this) },
        { name: 'Method 4: Client Credentials (Fallback) ⚠️ DEPRECATED', method: this.tryClientCredentials.bind(this) },
      ];

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
  private async fetchCsrfToken(): Promise<string | null> {
    try {
      logger.info('🔒 Fetching CSRF token from SAC...');
      
      // Try multiple endpoints to fetch CSRF token
      const csrfEndpoints = [
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

      // Fetch CSRF token before making the POST request (optional)
      const csrfToken = await this.fetchCsrfToken();

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

      // Prepare headers with CSRF token and cookies (if available)
      const headers: any = {};
      
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
        logger.info(`  ✓ Using CSRF token in request`);
      } else {
        logger.warn(`  ⚠️  No CSRF token available, proceeding without it`);
      }

      // Add cookies to the request
      if (this.cookies.length > 0) {
        headers['Cookie'] = this.cookies.map(cookie => {
          // Extract just the key=value part before the first semicolon
          return cookie.split(';')[0];
        }).join('; ');
        logger.info(`  ✓ Using ${this.cookies.length} session cookie(s)`);
      }

      // Try each endpoint in order
      let lastError: any = null;
      
      for (const endpoint of endpoints) {
        try {
          logger.info(`Attempting endpoint: ${endpoint.name}`);
          logger.info(`  URL: ${this.tenantUrl}${endpoint.url}`);
          logger.info(`  Body:`, JSON.stringify(endpoint.body, null, 2));
          
          const response = await this.axiosClient.post(endpoint.url, endpoint.body, { headers });
          
          logger.info(`✅ Multi-Action triggered successfully via ${endpoint.name}`);
          logger.info('Response:', response.data);
          logger.info('========================================');

          return {
            status: 'success',
            executionId: response.data.runId || response.data.id || response.data.jobId || 'unknown',
            message: `Multi-Action execution started via ${endpoint.name}`,
          };
        } catch (error: any) {
          logger.warn(`❌ ${endpoint.name} failed: ${error.response?.status || error.message}`);
          lastError = error;
          
          // Don't retry on certain error codes
          if (error.response?.status === 403 || error.response?.status === 401) {
            logger.warn('  → Authentication/Authorization error, trying next endpoint...');
            continue;
          }
          
          if (error.response?.status === 404) {
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
}

// Export singleton instance
export const sacClient = new SACClient();
