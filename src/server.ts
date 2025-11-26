import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { logger } from './utils/logger';
import forecastRouter from './routes/forecast';

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

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// API key authentication middleware
const apiKeyAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Skip authentication for local development
  if (config.app.nodeEnv === 'development') {
    logger.debug('Skipping API key authentication for local development');
    return next();
  }

  const apiKey = req.headers['x-api-key'] as string;
  if (!apiKey || apiKey !== config.server.apiKey) {
    logger.warn(`Unauthorized API access attempt from ${req.ip}`);
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'AI Predictive Agent',
  });
});

// Root endpoint
app.get('/', (req, res) => {
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
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
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
  logger.info(`🌍 Environment: ${config.app.nodeEnv}`);
  logger.info(`🔗 API: http://localhost:${PORT}/api/forecast/query`);
});

export default app;
