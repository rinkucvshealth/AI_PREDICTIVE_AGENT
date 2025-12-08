# OAuth 401 Error - Diagnostic Fix

## Problem Summary

The application is getting `401 Unauthorized` errors when calling the SAC Multi-Action API. The logs show:
- OAuth token acquisition logs are not appearing
- The Multi-Action API call fails with 401
- The error occurs consistently on every request

## Root Cause Analysis

After analyzing the code and logs, the issue is likely one of these:

### 1. **Stale OAuth Token** (Most Likely)
The OAuth token might be cached in memory but is no longer valid. When the app restarts, it gets a new instance but the first token acquisition might be failing.

### 2. **Invalid Credentials or Scopes**
The OAuth credentials might not have the necessary scopes to call the Multi-Action API for Planning Models.

### 3. **Incorrect API Endpoint**
The Multi-Action endpoint might have changed or the format might be incorrect for your SAC tenant.

## Changes Made

I've updated `/workspace/src/clients/sac-client.ts` with:

### 1. **Enhanced Error Logging**
- Added detailed request/response logging for Multi-Action calls
- Shows full URL, headers (masked), and request body
- Logs token status before each request

### 2. **Automatic Token Refresh on 401**
- Added response interceptor that detects 401 errors
- Automatically invalidates cached token and retries with fresh token
- Logs when token refresh is triggered

### 3. **Request Validation**
- Warns when no OAuth token is available before making requests
- Helps identify if token acquisition is failing silently

## Next Steps

### Step 1: Rebuild and Redeploy

```bash
# In your local environment where you have CF CLI
cd /path/to/AI_PREDICTIVE_AGENT

# Rebuild the application
npm run build

# Deploy to Cloud Foundry
cf push
```

### Step 2: Test and Check Logs

```bash
# Test the widget in SAC
# Then immediately check logs:
cf logs ai-predictive-agent --recent
```

### Step 3: Look for New Diagnostic Information

The logs will now show:
```
========================================
🔐 Starting OAuth token acquisition
========================================
Client ID format: sb-d0a25928-2a38-48...
Credential type: XSUAA (BTP-integrated)
OAuth token endpoint: https://cvs-pharmacy-q.authentication.us10.hana.ondemand.com/oauth/token
Tenant: cvs-pharmacy-q, Region: us10
Attempting Method 1: Basic Auth (Standard)...
```

And for the Multi-Action call:
```
========================================
🎯 Triggering SAC Multi-Action
========================================
Multi-Action ID: E5280280114D3785596849C3D321B820
Model ID: PRDA_PL_PLAN
Full URL: https://cvs-pharmacy-q.us10.hcs.cloud.sap/api/v1/dataimport/planningModel/PRDA_PL_PLAN/multiActions/E5280280114D3785596849C3D321B820/runs
Request Body: { "parameterValues": { ... } }
```

## Potential Fixes Based on Logs

### If OAuth Token Acquisition Fails:

**Problem:** You see "❌ All OAuth authentication methods failed"

**Solutions:**
1. Verify credentials are correct:
   ```bash
   cf env ai-predictive-agent
   # Check SAC_CLIENT_ID and SAC_CLIENT_SECRET
   ```

2. Try getting token manually:
   ```bash
   # Test OAuth endpoint directly
   curl -X POST https://cvs-pharmacy-q.authentication.us10.hana.ondemand.com/oauth/token \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -H "Authorization: Basic <base64_encoded_credentials>" \
     -d "grant_type=client_credentials"
   ```

3. Check if credentials need to be regenerated in SAC:
   - Go to SAC Admin → App Integration → OAuth Clients
   - Verify client exists and has correct scopes
   - Regenerate if needed

### If OAuth Succeeds but Multi-Action Fails:

**Problem:** Token is acquired but Multi-Action still returns 401

**Possible Issues:**

1. **Missing Scopes:** The OAuth client might not have Multi-Action API scopes
   - Required scope: Usually something like `SAC_PLANNING_API` or `SAC_MULTIACTION`
   - Fix: Update OAuth client in SAC to include these scopes

2. **Wrong API Endpoint:** The endpoint format might be different for your SAC version
   - Current: `/api/v1/dataimport/planningModel/{modelId}/multiActions/{actionId}/runs`
   - Alternative: `/api/v1/multiactions/{actionId}/trigger`
   
   If the alternative is correct, update `src/clients/sac-client.ts` line 285:
   ```typescript
   // Change from:
   const endpoint = `/api/v1/dataimport/planningModel/${this.modelId}/multiActions/${this.multiActionId}/runs`;
   
   // To:
   const endpoint = `/api/v1/multiactions/${this.multiActionId}/trigger`;
   ```

3. **Model ID or Multi-Action ID Incorrect:**
   - Verify in SAC that `PRDA_PL_PLAN` is the correct model ID
   - Verify that `E5280280114D3785596849C3D321B820` is the correct Multi-Action ID

### If You See "⚠️ Received 401 Unauthorized - invalidating token and retrying..."

This means the token was acquired but became invalid. The app will automatically retry with a fresh token. If it still fails after retry, the credentials likely don't have the right permissions.

## Alternative: Use SAC Service Binding

If OAuth client credentials continue to fail, consider using BTP Service Binding instead:

1. Create SAC service instance in BTP Cockpit
2. Bind service to your app:
   ```bash
   cf bind-service ai-predictive-agent <sac-service-instance-name>
   cf restage ai-predictive-agent
   ```
3. Update code to read credentials from `VCAP_SERVICES`

## Testing OAuth Separately

I've created a test script at `/workspace/test-oauth-debug.ts` that you can run locally to test OAuth:

```bash
# Set environment variables
export SAC_CLIENT_ID="sb-d0a25928-2a38-4862-ab82-bc4f8529aab7!b563143|client!b655"
export SAC_CLIENT_SECRET="9a81d84e-1277-4ccb-95fd-7db0f60f15e7\$KytCvQeVWDy5JrXqAS0fLrKFhPn9s1xumtyXc9jNgeA="
export SAC_TENANT_URL="https://cvs-pharmacy-q.us10.hcs.cloud.sap"
export SAC_OAUTH_TOKEN_URL="https://cvs-pharmacy-q.authentication.us10.hana.ondemand.com/oauth/token"
export SAC_MODEL_ID="PRDA_PL_PLAN"
export SAC_MULTI_ACTION_ID="E5280280114D3785596849C3D321B820"

# Run test
npx ts-node test-oauth-debug.ts
```

This will test all three OAuth methods and then try calling the Multi-Action API directly.

## Contact SAC Support

If all else fails, you may need to contact SAP Support with:
1. SAC tenant URL
2. OAuth client ID (not secret)
3. Required API endpoint: Multi-Action API for Planning Models
4. Error logs showing 401

They can verify:
- OAuth client configuration
- Required scopes for Multi-Action API
- Correct API endpoint format for your SAC version

## Summary

The changes I made will:
1. ✅ Automatically retry on 401 with fresh token
2. ✅ Provide detailed diagnostic logs
3. ✅ Show exact URLs, headers, and request bodies
4. ✅ Help identify if issue is OAuth or API permissions

**Next:** Redeploy and check logs with the enhanced diagnostics.
