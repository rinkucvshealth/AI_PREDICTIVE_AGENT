# 🚀 DEPLOYMENT FIX FOR 401 ERROR

## Issue Identified

The deployed application was using an **outdated API endpoint** for triggering SAC Multi-Actions:

❌ **Old (deployed):** `/api/v1/multiactions/{id}/trigger`  
✅ **New (fixed):** `/api/v1/dataimport/planningModel/{modelId}/multiActions/{id}/runs`

## What Was Fixed

1. ✅ **Rebuilt application** with correct SAC Multi-Action endpoint
2. ✅ **Verified OAuth authentication** logic with multiple fallback methods
3. ✅ **Confirmed environment variables** in manifest.yml

## Deployment Steps

### Step 1: Verify Your Credentials Are Set

Before deploying, ensure these environment variables are configured in Cloud Foundry:

```bash
# Check current environment variables
cf env ai-predictive-agent

# If missing, set them (REQUIRED):
cf set-env ai-predictive-agent SAC_CLIENT_ID "your-sac-client-id"
cf set-env ai-predictive-agent SAC_CLIENT_SECRET "your-sac-client-secret"
cf set-env ai-predictive-agent OPENAI_API_KEY "sk-your-openai-key"
cf set-env ai-predictive-agent API_KEY "your-widget-api-key"

# If you set any new vars, restart the app
cf restage ai-predictive-agent
```

### Step 2: Deploy the Fixed Version

**Option A: Quick Deploy (Recommended)**

```bash
./deploy.sh
```

**Option B: Manual Deploy**

```bash
# Already done for you:
# npm install
# npm run build

# Just push to CF:
cf push
```

### Step 3: Monitor Deployment

```bash
# Watch the deployment logs
cf logs ai-predictive-agent --recent

# Or follow real-time
cf logs ai-predictive-agent
```

### Step 4: Test the Fix

Once deployed, test by:

1. Open your SAC widget: https://cvs-pharmacy-q.us10.hcs.cloud.sap
2. Enter a forecast query: "Create 6 month forecast for GL 500100"
3. Check the logs for success (no more 401 errors)

```bash
cf logs ai-predictive-agent --recent | grep -E "(INFO|ERROR)"
```

## Expected Success Output

You should see:

```
[INFO] Received forecast query: "Create 6 month forecast for GL 500100"
[INFO] Successfully interpreted forecast query
[INFO] Triggering SAC Multi-Action: E5280280114D3785596849C3D321B820
[INFO] 🔐 Starting OAuth token acquisition
[INFO] ✅ Success with Method 1: Basic Auth (Standard)
[INFO] Multi-Action triggered successfully
```

## Troubleshooting

### Still Getting 401 Errors?

1. **Check OAuth Credentials Format:**
   ```bash
   cf env ai-predictive-agent | grep -A 5 "SAC_CLIENT"
   ```
   
   Your `SAC_CLIENT_ID` should look like:
   - Standard format: `sb-xxxxx!bxxxx|client!bxxxx` (XSUAA format)
   - Or: Regular OAuth client ID from SAC

2. **Verify OAuth Token URL:**
   
   The app auto-detects it from your tenant URL:
   - Tenant: `https://cvs-pharmacy-q.us10.hcs.cloud.sap`
   - Token URL: `https://cvs-pharmacy-q.authentication.us10.hana.ondemand.com/oauth/token`
   
   If this is wrong, set manually:
   ```bash
   cf set-env ai-predictive-agent SAC_OAUTH_TOKEN_URL "https://your-tenant.authentication.region.hana.ondemand.com/oauth/token"
   cf restage ai-predictive-agent
   ```

3. **Check Multi-Action Permissions:**
   
   Ensure your OAuth client has the correct SAC API scopes:
   - `PLANNING_DATA_WRITE`
   - `PLANNING_MODEL_READ`
   - Or equivalent permissions to trigger Multi-Actions

4. **Enable Debug Logging:**
   ```bash
   cf set-env ai-predictive-agent LOG_LEVEL "debug"
   cf restage ai-predictive-agent
   ```

## Summary

- ✅ Application rebuilt with correct endpoint
- ✅ OAuth authentication methods validated
- 📦 Ready to deploy with `./deploy.sh`
- 🔍 Monitor with `cf logs ai-predictive-agent --recent`

**Next:** Run the deployment script and test!
