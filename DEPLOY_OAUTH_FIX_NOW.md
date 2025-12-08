# Deploy OAuth 401 Fix - Quick Start

## What Was Fixed

I've enhanced the SAC client with comprehensive diagnostic logging and automatic error recovery:

### 1. **Automatic 401 Recovery** ✅
- Detects 401 Unauthorized errors
- Automatically invalidates cached token
- Retries request with fresh OAuth token
- Reduces manual intervention needed

### 2. **Dual Endpoint Support** ✅
- Primary: `/api/v1/dataimport/planningModel/{modelId}/multiActions/{actionId}/runs`
- Fallback: `/api/v1/multiactions/{actionId}/trigger`
- Automatically tries alternative if primary returns 404
- Adapts to different SAC API versions

### 3. **Enhanced Diagnostic Logging** ✅
- Shows OAuth token acquisition process
- Displays full request URLs and bodies
- Logs response details on errors
- Helps identify permission issues quickly

## Deploy Now

### Option 1: Use Deployment Script (Recommended)

```bash
./deploy-oauth-fix.sh
```

### Option 2: Manual Deployment

```bash
# Rebuild the application
npm run build

# Deploy to Cloud Foundry
cf push

# Check logs
cf logs ai-predictive-agent --recent
```

## After Deployment

### Step 1: Test the Widget

1. Open your SAC story
2. Trigger the widget with: "Create 6 month forecast for GL 500100"
3. Observe the response

### Step 2: Check Enhanced Logs

```bash
cf logs ai-predictive-agent --recent
```

#### What to Look For:

**✅ Good Signs:**
```
🔐 Starting OAuth token acquisition
========================================
Client ID format: sb-d0a25928-2a38-48...
Credential type: XSUAA (BTP-integrated)
Attempting Method 1: Basic Auth (Standard)...
✅ Success with Method 1: Basic Auth (Standard)
  ✓ Token acquired: eyJhbGciOiJSUzI1Ni...
  ✓ Expires in: 3600 seconds

🎯 Triggering SAC Multi-Action
========================================
Multi-Action ID: E5280280114D3785596849C3D321B820
Model ID: PRDA_PL_PLAN
Full URL: https://cvs-pharmacy-q.us10.hcs.cloud.sap/api/v1/dataimport/...
✅ Multi-Action triggered successfully
```

**⚠️ Warning Signs:**
```
⚠️ Received 401 Unauthorized - invalidating token and retrying...
```
This means token was acquired but invalid. Check OAuth client scopes in SAC.

**❌ Bad Signs:**
```
❌ All OAuth authentication methods failed
```
This means credentials are wrong or OAuth endpoint is incorrect.

```
❌ Failed to trigger Multi-Action
Response Details: { status: 401, statusText: "Unauthorized" }
```
After retry still fails = credentials don't have Multi-Action API permissions.

## Troubleshooting

### Issue 1: Still Getting 401 After Retry

**Cause:** OAuth client doesn't have Multi-Action API scopes

**Fix:**
1. Go to SAC: Admin → App Integration → OAuth Clients
2. Find your OAuth client: `sb-d0a25928-2a38-4862-ab82-bc4f8529aab7!b563143|client!b655`
3. Check assigned scopes/roles
4. Should include: `SAC_PLANNING_API`, `SAC_MULTIACTION`, or similar
5. Add missing scopes and save
6. Restart the app: `cf restart ai-predictive-agent`

### Issue 2: OAuth Token Acquisition Fails

**Cause:** Credentials incorrect or OAuth URL wrong

**Fix:**
1. Verify credentials in SAC match what's deployed:
   ```bash
   cf env ai-predictive-agent
   ```
2. If different, update:
   ```bash
   cf set-env ai-predictive-agent SAC_CLIENT_ID "your-actual-client-id"
   cf set-env ai-predictive-agent SAC_CLIENT_SECRET "your-actual-client-secret"
   cf restart ai-predictive-agent
   ```

### Issue 3: Both Endpoints Return 404

**Cause:** Multi-Action ID or Model ID is incorrect

**Fix:**
1. Verify Multi-Action ID in SAC:
   - Open your story
   - Go to Multi-Action settings
   - Copy the exact ID
2. Update if needed:
   ```bash
   cf set-env ai-predictive-agent SAC_MULTI_ACTION_ID "your-actual-multiaction-id"
   cf restart ai-predictive-agent
   ```

### Issue 4: Different Error Code (403, 500, etc.)

**Cause:** Various - check specific error message in logs

**Common 403 Causes:**
- User doesn't have permission to execute Multi-Action
- OAuth client limited to specific resources
- Cross-tenant access issue

**Fix:** Check detailed error logs for specific message

## Test OAuth Separately

To test OAuth independently of the app:

```bash
# Set environment variables
export SAC_CLIENT_ID="sb-d0a25928-2a38-4862-ab82-bc4f8529aab7!b563143|client!b655"
export SAC_CLIENT_SECRET="9a81d84e-1277-4ccb-95fd-7db0f60f15e7\$KytCvQeVWDy5JrXqAS0fLrKFhPn9s1xumtyXc9jNgeA="
export SAC_TENANT_URL="https://cvs-pharmacy-q.us10.hcs.cloud.sap"
export SAC_OAUTH_TOKEN_URL="https://cvs-pharmacy-q.authentication.us10.hana.ondemand.com/oauth/token"
export SAC_MODEL_ID="PRDA_PL_PLAN"
export SAC_MULTI_ACTION_ID="E5280280114D3785596849C3D321B820"

# Run diagnostic test
npx ts-node test-oauth-debug.ts
```

This will test:
1. All three OAuth authentication methods
2. Direct Multi-Action API call with acquired token
3. Shows detailed request/response for each attempt

## Expected Outcome

After this fix, you should see:

1. **First Request:**
   - OAuth token acquired successfully
   - Multi-Action call succeeds
   
2. **Subsequent Requests:**
   - Uses cached OAuth token
   - Multi-Action calls succeed
   
3. **If Token Expires:**
   - Gets 401
   - Automatically refreshes token
   - Retries and succeeds

## Still Not Working?

If you still get 401 errors after deploying this fix, the issue is definitely with:

1. **OAuth Client Configuration in SAC**
   - Missing required scopes
   - Incorrect client credentials
   - Client not active or expired

2. **Multi-Action Configuration**
   - Multi-Action ID incorrect
   - Multi-Action not published
   - Multi-Action restricted to specific users

3. **SAC API Version Mismatch**
   - Your SAC version might use different endpoint
   - Check SAC API documentation for your version

**Contact SAP Support** with:
- Complete logs from `cf logs ai-predictive-agent --recent`
- OAuth client ID (NOT secret)
- Multi-Action ID
- SAC tenant URL

They can verify the correct configuration and API endpoint for your SAC version.

## Files Changed

- `src/clients/sac-client.ts` - Enhanced OAuth handling and logging
- `test-oauth-debug.ts` - New diagnostic tool
- `OAUTH_401_FIX.md` - Detailed troubleshooting guide
- `deploy-oauth-fix.sh` - Deployment automation script

---

**Ready to deploy? Run:** `./deploy-oauth-fix.sh`
