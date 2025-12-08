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
    });

    // Add request interceptor to inject OAuth token
    this.axiosClient.interceptors.request.use(async (config) => {
      const token = await this.getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

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
      logger.info(`Triggering SAC Multi-Action: ${this.multiActionId}`, request.parameters);

      // SAC Multi-Action API endpoint format for Planning Models
      const endpoint = `/api/v1/dataimport/planningModel/${this.modelId}/multiActions/${this.multiActionId}/runs`;

      // Format request body for SAC Multi-Action
      const requestBody = {
        parameterValues: request.parameters,
      };

      const response = await this.axiosClient.post(endpoint, requestBody);

      logger.info('Multi-Action triggered successfully:', response.data);

      return {
        status: 'success',
        executionId: response.data.runId || response.data.id || 'unknown',
        message: 'Multi-Action execution started',
      };
    } catch (error: any) {
      logger.error('Failed to trigger Multi-Action:', error.message);
      
      if (error.response) {
        logger.error('SAC API Error:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          headers: error.response.headers,
          url: error.config?.url,
        });
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
}

// Export singleton instance
export const sacClient = new SACClient();
