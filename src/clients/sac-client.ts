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
   */
  private async getAccessToken(): Promise<string | null> {
    try {
      // Check if token is still valid (with 5 minute buffer)
      if (this.accessToken && Date.now() < this.tokenExpiry - 300000) {
        return this.accessToken;
      }

      logger.info('Fetching new OAuth access token from SAC');

      // OAuth token endpoint (adjust based on your SAC tenant configuration)
      const tokenUrl = `${this.tenantUrl}/oauth/token`;
      
      const response = await axios.post(
        tokenUrl,
        new URLSearchParams({
          grant_type: 'client_credentials',
        }),
        {
          auth: {
            username: config.sac.clientId,
            password: config.sac.clientSecret,
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      this.accessToken = response.data.access_token;
      // Set expiry time (default to 3600 seconds if not provided)
      const expiresIn = response.data.expires_in || 3600;
      this.tokenExpiry = Date.now() + (expiresIn * 1000);

      logger.info('Successfully obtained OAuth access token');
      return this.accessToken;
    } catch (error: any) {
      logger.error('Failed to get OAuth access token:', error.message);
      if (error.response) {
        logger.error('OAuth error response:', {
          status: error.response.status,
          data: error.response.data,
        });
      }
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
