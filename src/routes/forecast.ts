import express from 'express';
import { interpretForecastQuery } from '../clients/openai-client';
import { sacClient } from '../clients/sac-client';
import { logger } from '../utils/logger';
import { ForecastRequest, ForecastResponse } from '../types';
import { config } from '../config';

const router = express.Router();

/**
 * POST /api/forecast/query
 * Main endpoint for natural language forecast requests
 * Simplified: Multi-Action now uses hardcoded parameters, only needs version name
 */
router.post('/query', async (req: express.Request, res: express.Response) => {
  try {
    const { query, sessionId }: ForecastRequest = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required and must be a non-empty string',
      } as ForecastResponse);
    }

    logger.info(`Received forecast query: "${query}"`);

    // Step 1: Interpret the query using OpenAI (just to validate it's a forecast request)
    const interpretation = await interpretForecastQuery(query);

    if (!interpretation) {
      return res.status(500).json({
        success: false,
        summary: 'Failed to interpret your forecast request. Please try rephrasing.',
        error: 'Query interpretation failed',
      } as ForecastResponse);
    }

    logger.info('Query validated as forecast request');

    // Step 2: Trigger SAC Multi-Action (no parameters - all hardcoded in SAC)
    const multiActionRequest = {
      parameters: {},  // No parameters needed - all values hardcoded in Multi-Action
    };

    logger.info('Triggering SAC Multi-Action (no parameters - all values hardcoded)');

    const multiActionResponse = await sacClient.triggerMultiAction(multiActionRequest);

    // Step 3: Return response
    const summary = `Forecast initiated successfully! Multi-Action is running with hardcoded parameters.`;

    return res.json({
      success: true,
      summary,
      details: {
        versionName: '01_JAN',  // Hardcoded in Multi-Action
        multiActionStatus: multiActionResponse.status,
        executionId: multiActionResponse.executionId,
      },
      sessionId: sessionId || 'default',
    } as ForecastResponse);

  } catch (error: any) {
    logger.error('Error processing forecast query:', error);
    return res.status(500).json({
      success: false,
      summary: 'An error occurred while processing your forecast request.',
      error: error.message || 'Internal server error',
    } as ForecastResponse);
  }
});

/**
 * GET /api/forecast/test-sac
 * Test SAC connectivity
 */
router.get('/test-sac', async (_req: express.Request, res: express.Response) => {
  try {
    logger.info('Testing SAC connection...');
    
    const isConnected = await sacClient.testConnection();
    
    return res.json({
      success: true,
      message: 'SAC connection successful',
      connected: isConnected,
      tenant: config.sac.tenantUrl,
      model: config.sac.modelId,
    });
  } catch (error: any) {
    logger.error('SAC connection test failed:', error);
    return res.status(500).json({
      success: false,
      message: 'SAC connection failed',
      error: error.message,
    });
  }
});

/**
 * GET /api/forecast/model-info
 * Get Planning Model information
 */
router.get('/model-info', async (_req: express.Request, res: express.Response) => {
  try {
    logger.info('Fetching model info...');
    
    const modelInfo = await sacClient.getModelInfo();
    
    return res.json({
      success: true,
      model: modelInfo,
    });
  } catch (error: any) {
    logger.error('Failed to get model info:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get model info',
      error: error.message,
    });
  }
});

/**
 * GET /api/forecast/discover-endpoints
 * Diagnostic endpoint to discover available SAC API endpoints
 */
router.get('/discover-endpoints', async (_req: express.Request, res: express.Response) => {
  try {
    logger.info('🔍 Discovering available SAC API endpoints...');
    
    const results = await sacClient.discoverEndpoints();
    
    return res.json({
      success: true,
      message: 'Endpoint discovery completed',
      results,
    });
  } catch (error: any) {
    logger.error('Endpoint discovery failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Endpoint discovery failed',
      error: error.message,
    });
  }
});

/**
 * GET /api/forecast/list-multiactions
 * List all Multi-Actions available in the planning model
 */
router.get('/list-multiactions', async (_req: express.Request, res: express.Response) => {
  try {
    logger.info('📋 Listing Multi-Actions...');
    
    const multiActions = await sacClient.listMultiActions();
    
    return res.json({
      success: true,
      multiActions,
    });
  } catch (error: any) {
    logger.error('Failed to list Multi-Actions:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to list Multi-Actions',
      error: error.message,
    });
  }
});

/**
 * POST /api/forecast/test-multiaction-post
 * Test POST request to Multi-Action endpoint with various header combinations
 */
router.post('/test-multiaction-post', async (_req: express.Request, res: express.Response) => {
  try {
    logger.info('🧪 Testing Multi-Action POST request...');
    
    const result = await sacClient.testMultiActionPost();
    
    return res.json({
      success: true,
      result,
    });
  } catch (error: any) {
    logger.error('Multi-Action POST test failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Multi-Action POST test failed',
      error: error.message,
    });
  }
});

export default router;
