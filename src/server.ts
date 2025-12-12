import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { config } from './config';
import { logger } from './utils/logger';
import forecastRouter from './routes/forecast';
import oauthRouter from './routes/oauth';

const app = express();

// Trust proxy for Cloud Foundry
app.set('trust proxy', true);

// CORS configuration
const corsOptions = {
  origin: [
    config.sac.tenantUrl,
    config.server.allowedOrigin,
  ].filter(Boolean),
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());

// Rate limiting - simplified configuration
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false }  // Disable trust proxy validation for development
});

app.use('/api/', limiter);

// API key authentication middleware
const apiKeyAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Skip authentication for local development
  if (config.app.nodeEnv === 'development') {
    logger.debug('Skipping API key authentication for local development');
    return next();
  }

  // Skip authentication if API_KEY is not configured or is placeholder
  if (!config.server.apiKey || config.server.apiKey === 'placeholder' || config.server.apiKey === '') {
    logger.debug('API key authentication disabled (no API_KEY configured)');
    return next();
  }

  // If API key is configured, validate it
  const apiKey = req.headers['x-api-key'] as string;
  if (!apiKey || apiKey !== config.server.apiKey) {
    logger.warn(`Unauthorized API access attempt from ${req.ip}, API Key: ${apiKey ? 'Invalid' : 'Missing'}`);
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid API key',
    });
  }

  next();
};

// Apply API key auth to all API routes
app.use('/api/', apiKeyAuth);

// API routes
app.use('/api/forecast', forecastRouter);

// OAuth helper routes (for acquiring refresh tokens via Authorization Code flow)
app.use('/oauth', oauthRouter);

// Serve widget files (no authentication required for SAC to load them)
// In production (CF), files are in ../public relative to dist/
// In development, files are in ./public relative to src/
const widgetPath = path.join(__dirname, '../public/widget');
logger.info(`Widget files path: ${widgetPath}`);

app.use('/widget', express.static(widgetPath, {
  setHeaders: (res, filePath) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    // Set correct content type based on file extension
    if (filePath.endsWith('.json')) {
      res.set('Content-Type', 'application/json');
    } else if (filePath.endsWith('.js')) {
      res.set('Content-Type', 'application/javascript');
    }
    
    logger.debug(`Serving widget file: ${filePath}`);
  }
}));

// Debug endpoint to check if widget files exist
app.get('/widget/debug', (_req, res) => {
  const fs = require('fs');
  const widgetDir = path.join(__dirname, '../public/widget');
  
  try {
    const files = fs.readdirSync(widgetDir);
    res.json({
      widgetPath: widgetDir,
      filesExist: files,
      __dirname: __dirname,
      cwd: process.cwd()
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message,
      widgetPath: widgetDir,
      __dirname: __dirname,
      cwd: process.cwd()
    });
  }
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'AI Predictive Agent',
  });
});

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    name: 'SAC Predictive Scenario AI Agent',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      forecast: '/api/forecast/query',
      testSAC: '/api/forecast/test-sac',
      modelInfo: '/api/forecast/model-info',
    },
    config: {
      sacTenant: config.sac.tenantUrl,
      modelId: config.sac.modelId,
      environment: config.app.nodeEnv,
    },
  });
});

// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Express error:', err);
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

// Start server
const PORT = config.server.port;

app.listen(PORT, () => {
  logger.info(`🚀 SAC Predictive Agent running on port ${PORT}`);
  logger.info(`📊 SAC Tenant: ${config.sac.tenantUrl}`);
  logger.info(`📁 Model: ${config.sac.modelId}`);
  logger.info(`🌍 Environment: ${config.app.environmentLabel} (NODE_ENV=${config.app.nodeEnv})`);
  logger.info(`🔗 API: http://localhost:${PORT}/api/forecast/query`);
});

export default app;
