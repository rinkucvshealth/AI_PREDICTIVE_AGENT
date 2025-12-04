# Code Changes - OAuth 2.0 Implementation

## Overview
This document shows the exact code changes made to fix the 401 Unauthorized error by implementing OAuth 2.0 authentication.

---

## 1. SAC Client Changes (`src/clients/sac-client.ts`)

### Authentication Method

**BEFORE (Basic Auth):**
```typescript
constructor() {
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
    timeout: 60000,
  });
}
```

**AFTER (OAuth 2.0):**
```typescript
constructor() {
  this.accessToken = null;
  this.tokenExpiry = 0;
  
  this.axiosClient = axios.create({
    baseURL: this.tenantUrl,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    timeout: 60000,
  });

  // Add request interceptor to inject OAuth token
  this.axiosClient.interceptors.request.use(async (config) => {
    const token = await this.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
}
```

### New OAuth Token Management

**ADDED:**
```typescript
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

    // OAuth token endpoint
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
```

### Multi-Action Endpoint

**BEFORE:**
```typescript
async triggerMultiAction(request: SACMultiActionRequest) {
  const endpoint = `/api/v1/multiactions/${this.multiActionId}/trigger`;
  const response = await this.axiosClient.post(endpoint, request);
}
```

**AFTER:**
```typescript
async triggerMultiAction(request: SACMultiActionRequest) {
  // SAC Multi-Action API endpoint format for Planning Models
  const endpoint = `/api/v1/dataimport/planningModel/${this.modelId}/multiActions/${this.multiActionId}/runs`;

  // Format request body for SAC Multi-Action
  const requestBody = {
    parameterValues: request.parameters,
  };

  const response = await this.axiosClient.post(endpoint, requestBody);
}
```

---

## 2. Configuration Changes (`src/config.ts`)

### Environment Variables

**BEFORE:**
```typescript
const requiredEnvVars = [
  'SAC_TENANT_URL',
  'SAC_USERNAME',
  'SAC_PASSWORD',
  'SAC_MODEL_ID',
  'OPENAI_API_KEY',
  'API_KEY'
];
```

**AFTER:**
```typescript
const requiredEnvVars = [
  'SAC_TENANT_URL',
  'SAC_CLIENT_ID',
  'SAC_CLIENT_SECRET',
  'SAC_MODEL_ID',
  'OPENAI_API_KEY',
  'API_KEY'
];
```

### Configuration Object

**BEFORE:**
```typescript
sac: {
  tenantUrl: process.env['SAC_TENANT_URL'] || 'https://cvs-pharmacy-q.us10.hcs.cloud.sap',
  username: process.env['SAC_USERNAME'] || 'placeholder',
  password: process.env['SAC_PASSWORD'] || 'placeholder',
  modelId: process.env['SAC_MODEL_ID'] || 'PRDA_PL_PLAN',
  multiActionId: process.env['SAC_MULTI_ACTION_ID'] || 'placeholder',
  storyId: process.env['SAC_STORY_ID'],
}
```

**AFTER:**
```typescript
sac: {
  tenantUrl: process.env['SAC_TENANT_URL'] || 'https://cvs-pharmacy-q.us10.hcs.cloud.sap',
  clientId: process.env['SAC_CLIENT_ID'] || 'placeholder',
  clientSecret: process.env['SAC_CLIENT_SECRET'] || 'placeholder',
  modelId: process.env['SAC_MODEL_ID'] || 'PRDA_PL_PLAN',
  multiActionId: process.env['SAC_MULTI_ACTION_ID'] || 'E5280280114D3785596849C3D321B820',
  storyId: process.env['SAC_STORY_ID'],
}
```

---

## 3. Type Definitions (`src/types/index.ts`)

### Config Interface

**BEFORE:**
```typescript
export interface Config {
  sac: {
    tenantUrl: string;
    username: string;
    password: string;
    modelId: string;
    multiActionId: string;
    storyId?: string;
  };
  // ... rest of config
}
```

**AFTER:**
```typescript
export interface Config {
  sac: {
    tenantUrl: string;
    clientId: string;
    clientSecret: string;
    modelId: string;
    multiActionId: string;
    storyId?: string;
  };
  // ... rest of config
}
```

### Auth Config Interface

**BEFORE:**
```typescript
export interface SACAuthConfig {
  tenantUrl: string;
  username: string;
  password: string;
  clientId?: string;
  clientSecret?: string;
}
```

**AFTER:**
```typescript
export interface SACAuthConfig {
  tenantUrl: string;
  clientId: string;
  clientSecret: string;
}
```

---

## 4. Environment Template (`.env.example`)

### SAC Configuration

**BEFORE:**
```bash
# SAC Connection
SAC_TENANT_URL=https://cvs-pharmacy-q.us10.hcs.cloud.sap
SAC_USERNAME=your_sac_username
SAC_PASSWORD=your_sac_password

# SAC Planning Model Configuration
SAC_MODEL_ID=PRDA_PL_PLAN
SAC_MULTI_ACTION_ID=your_multi_action_id
```

**AFTER:**
```bash
# SAC Connection (OAuth 2.0)
SAC_TENANT_URL=https://cvs-pharmacy-q.us10.hcs.cloud.sap
SAC_CLIENT_ID=your_oauth_client_id
SAC_CLIENT_SECRET=your_oauth_client_secret

# SAC Planning Model Configuration
SAC_MODEL_ID=PRDA_PL_PLAN
SAC_MULTI_ACTION_ID=E5280280114D3785596849C3D321B820
```

---

## 5. Cloud Foundry Environment Variables

### Required Changes

**REMOVE (Old):**
```bash
cf unset-env ai-predictive-agent SAC_USERNAME
cf unset-env ai-predictive-agent SAC_PASSWORD
```

**ADD (New):**
```bash
cf set-env ai-predictive-agent SAC_CLIENT_ID "your-oauth-client-id"
cf set-env ai-predictive-agent SAC_CLIENT_SECRET "your-oauth-client-secret"
cf set-env ai-predictive-agent SAC_MULTI_ACTION_ID "E5280280114D3785596849C3D321B820"
```

---

## Key Improvements

### Security
- ✅ OAuth 2.0 client credentials (more secure than user credentials)
- ✅ Short-lived tokens (automatically refreshed)
- ✅ No user passwords in environment variables
- ✅ Follows SAC API best practices

### Reliability
- ✅ Automatic token refresh with caching
- ✅ 5-minute buffer prevents token expiry issues
- ✅ Better error handling and logging
- ✅ Correct API endpoint format

### Maintainability
- ✅ Cleaner separation of concerns
- ✅ Reusable token management
- ✅ Detailed error logging for debugging
- ✅ Type-safe configuration

---

## Testing

### Before Deployment (Local)
```bash
# Build and test
npm run build
npm test  # If tests exist
```

### After Deployment (Production)
```bash
# Check logs for OAuth success
cf logs ai-predictive-agent --recent | grep -i oauth

# Test API endpoint
curl -X POST https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/api/forecast/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Create 6 month forecast for GL 500100"}'
```

---

## Migration Path

1. **Obtain OAuth Credentials** → Create OAuth client in SAC
2. **Set Environment Variables** → Update Cloud Foundry config
3. **Deploy Code** → Push updated application
4. **Verify** → Test and monitor logs
5. **Cleanup** → Remove old username/password variables

---

## Rollback Procedure

If needed, revert to previous commit and redeploy:

```bash
git log --oneline -5  # View recent commits
git checkout <previous-commit-hash>
npm run build
cf push ai-predictive-agent
```

**Note**: Reverting code won't fix the 401 error as basic auth is not supported by SAC API. OAuth implementation is required for long-term solution.

---

## Summary

| Aspect | Before | After |
|--------|--------|-------|
| **Auth Method** | Basic Auth (username/password) | OAuth 2.0 (client credentials) |
| **Token Management** | None | Automatic with caching |
| **API Endpoint** | Incorrect placeholder | Correct SAC API format |
| **Security** | User credentials in env vars | Client credentials (more secure) |
| **Error Handling** | Basic | Enhanced with detailed logging |
| **Status** | ❌ 401 Unauthorized | ✅ Ready for OAuth credentials |

---

**Build Status**: ✅ Successful  
**Type Check**: ✅ Passed  
**Ready for Deployment**: ✅ Yes (pending OAuth credentials)  
