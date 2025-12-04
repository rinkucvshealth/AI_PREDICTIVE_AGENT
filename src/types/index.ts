/**
 * Type definitions for SAC Predictive Agent
 */

export interface ForecastRequest {
  query: string;
  sessionId?: string;
  context?: any;
}

export interface ForecastResponse {
  success: boolean;
  summary: string;
  details?: {
    glAccount: string;
    forecastPeriod: number;
    versionName: string;
    multiActionStatus: string;
    startDate?: string;
    endDate?: string;
  };
  error?: string;
  sessionId?: string;
}

export interface ParsedForecastQuery {
  glAccount: string;
  forecastPeriod: number; // in months
  versionName?: string;
  startDate?: string;
  confidence?: number;
}

export interface SACMultiActionRequest {
  parameters: {
    GLAccount: string;
    ForecastPeriod: number;
    VersionName: string;
    [key: string]: any;
  };
}

export interface SACMultiActionResponse {
  status: 'success' | 'failed' | 'running';
  message?: string;
  executionId?: string;
  error?: string;
}

export interface SACAuthConfig {
  tenantUrl: string;
  clientId: string;
  clientSecret: string;
}

export interface Config {
  sac: {
    tenantUrl: string;
    clientId: string;
    clientSecret: string;
    modelId: string;
    multiActionId: string;
    storyId?: string;
  };
  openai: {
    apiKey: string;
  };
  server: {
    port: number;
    apiKey: string;
    allowedOrigin: string;
  };
  app: {
    nodeEnv: string;
    logLevel: string;
    defaultForecastPeriod: number;
    defaultVersionPrefix: string;
  };
}

export class OpenAIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenAIError';
  }
}

export class SACError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SACError';
  }
}
