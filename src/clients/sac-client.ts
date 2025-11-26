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

  constructor() {
    this.tenantUrl = config.sac.tenantUrl;
    this.modelId = config.sac.modelId;
    this.multiActionId = config.sac.multiActionId;

    // Create axios client with SAC credentials
    this.axiosClient = axios.create({
      baseURL: this.tenantUrl,
      auth: {
        username: config.sac.username,
        password: config.sac.password,
      },
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 60000, // 60 second timeout for multi-actions
    });

    logger.info(`SAC Client initialized for tenant: ${this.tenantUrl}`);
  }

  /**
   * Test connection to SAC
   */
  async testConnection(): Promise<boolean> {
    try {
      logger.info('Testing SAC connection...');
      
      // Try to access the API endpoint (adjust based on actual SAC API)
      const response = await this.axiosClient.get('/api/v1/models');
      
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

      // SAC Multi-Action API endpoint (adjust based on actual SAC API)
      // This is a placeholder - actual endpoint may vary
      const endpoint = `/api/v1/multiactions/${this.multiActionId}/trigger`;

      const response = await this.axiosClient.post(endpoint, request);

      logger.info('Multi-Action triggered successfully:', response.data);

      return {
        status: 'success',
        executionId: response.data.executionId || response.data.id,
        message: 'Multi-Action execution started',
      };
    } catch (error: any) {
      logger.error('Failed to trigger Multi-Action:', error.message);
      
      if (error.response) {
        logger.error('SAC API Error:', {
          status: error.response.status,
          data: error.response.data,
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
