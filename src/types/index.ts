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
    versionName: string;
    multiActionStatus: string;
    executionId?: string;
    glAccount?: string;
    forecastPeriod?: number;
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
    // No parameters needed - all values are hardcoded in the Multi-Action
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
    oauthTokenUrl?: string;
    oauthAuthUrl?: string;
    modelId: string;
    multiActionId: string;
    storyId?: string;
    // OAuth Flow Options (for Interactive Usage / SAML Bearer Assertion)
    refreshToken?: string;
    samlAssertion?: string;
    authorizationCode?: string;
    redirectUri?: string;
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
    /**
     * Human-friendly environment label (e.g., QA/PROD).
     * This is intentionally separate from NODE_ENV which is often "production" in Cloud Foundry.
     */
    environmentLabel: string;
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
