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
   * Get OAuth access token using client credentials flow
   * Supports multiple authentication methods with fallback
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

      // Validate credentials before attempting OAuth
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
      logger.info(`Credential type: ${isXSUAAFormat ? 'XSUAA (BTP-integrated)' : 'Standard SAC OAuth'}`);

      // SAC OAuth token endpoint - extract tenant and region from tenant URL
      // e.g., https://cvs-pharmacy-q.us10.hcs.cloud.sap
      // becomes: https://cvs-pharmacy-q.authentication.us10.hana.ondemand.com/oauth/token
      const tenantMatch = this.tenantUrl.match(/https:\/\/([^.]+)\.([^.]+)\./);
      const tenantName = tenantMatch ? tenantMatch[1] : '';
      const region = tenantMatch ? tenantMatch[2] : 'us10';
      
      const tokenUrl = config.sac.oauthTokenUrl || 
        `https://${tenantName}.authentication.${region}.hana.ondemand.com/oauth/token`;
      
      logger.info(`OAuth token endpoint: ${tokenUrl}`);
      logger.info(`Tenant: ${tenantName}, Region: ${region}`);

      // Try multiple authentication methods
      const methods = [
        { name: 'Method 1: Basic Auth (Standard)', method: this.tryBasicAuth.bind(this) },
        { name: 'Method 2: Basic Auth with Resource (XSUAA)', method: this.tryBasicAuthWithResource.bind(this) },
        { name: 'Method 3: Client Credentials in Body', method: this.tryBodyCredentials.bind(this) },
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
   * Method 1: Standard Basic Auth
   */
  private async tryBasicAuth(tokenUrl: string, tenantName: string, region: string): Promise<string | null> {
    const credentials = Buffer.from(`${config.sac.clientId}:${config.sac.clientSecret}`).toString('base64');
    
    logger.info('  → Using Basic Auth header');
    logger.info(`  → Body: grant_type=client_credentials`);
    
    const response = await axios.post(
      tokenUrl,
      new URLSearchParams({
        grant_type: 'client_credentials',
      }),
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
   * Method 2: Basic Auth with Resource Parameter (XSUAA)
   */
  private async tryBasicAuthWithResource(tokenUrl: string, tenantName: string, region: string): Promise<string | null> {
    const credentials = Buffer.from(`${config.sac.clientId}:${config.sac.clientSecret}`).toString('base64');
    const audience = `https://${tenantName}.authentication.${region}.hana.ondemand.com`;
    
    logger.info('  → Using Basic Auth with resource parameter');
    logger.info(`  → Resource: ${audience}`);
    
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      resource: audience,
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
   * Method 3: Client Credentials in POST Body
   */
  private async tryBodyCredentials(tokenUrl: string, tenantName: string, region: string): Promise<string | null> {
    logger.info('  → Using client credentials in POST body');
    
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.sac.clientId,
      client_secret: config.sac.clientSecret,
    });

    const response = await axios.post(
      tokenUrl,
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 30000,
      }
    );

    return this.processTokenResponse(response);
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

      // Try the Planning Model-specific endpoint first (recommended for planning models)
      // If that fails with 404, try the generic multi-action endpoint
      
      let endpoint = `/api/v1/dataimport/planningModel/${this.modelId}/multiActions/${this.multiActionId}/runs`;
      let requestBody: any = {
        parameterValues: request.parameters,
      };

      logger.info(`Endpoint (Primary): ${this.tenantUrl}${endpoint}`);
      logger.info(`Request Body:`, JSON.stringify(requestBody, null, 2));

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

      try {
        const response = await this.axiosClient.post(endpoint, requestBody, { headers });
        
        logger.info('✅ Multi-Action triggered successfully (Primary endpoint)');
        logger.info('Response:', response.data);
        logger.info('========================================');

        return {
          status: 'success',
          executionId: response.data.runId || response.data.id || 'unknown',
          message: 'Multi-Action execution started',
        };
      } catch (primaryError: any) {
        // If we get 404, try the alternative generic endpoint
        if (primaryError.response?.status === 404) {
          logger.warn('Primary endpoint returned 404, trying alternative endpoint...');
          
          endpoint = `/api/v1/multiactions/${this.multiActionId}/trigger`;
          requestBody = request.parameters; // Generic endpoint may expect parameters directly
          
          logger.info(`Endpoint (Alternative): ${this.tenantUrl}${endpoint}`);
          logger.info(`Request Body:`, JSON.stringify(requestBody, null, 2));
          
          const response = await this.axiosClient.post(endpoint, requestBody, { headers });
          
          logger.info('✅ Multi-Action triggered successfully (Alternative endpoint)');
          logger.info('Response:', response.data);
          logger.info('========================================');

          return {
            status: 'success',
            executionId: response.data.runId || response.data.id || 'unknown',
            message: 'Multi-Action execution started',
          };
        }
        
        // If we get 403 and have CSRF token, try without CSRF token as fallback
        if (primaryError.response?.status === 403 && csrfToken) {
          logger.warn('Primary endpoint returned 403 with CSRF token, trying without CSRF...');
          
          // Remove CSRF token and cookies
          const headersWithoutCsrf: any = {};
          
          try {
            const response = await this.axiosClient.post(endpoint, requestBody, { headers: headersWithoutCsrf });
            
            logger.info('✅ Multi-Action triggered successfully (without CSRF token)');
            logger.info('Response:', response.data);
            logger.info('========================================');

            return {
              status: 'success',
              executionId: response.data.runId || response.data.id || 'unknown',
              message: 'Multi-Action execution started',
            };
          } catch (noCsrfError: any) {
            logger.error('Failed even without CSRF token');
            // Fall through to throw the original error
          }
        }
        
        // If not 404 or 403, or if fallbacks failed, re-throw the original error
        throw primaryError;
      }
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
