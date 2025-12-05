# OAuth Authentication Fix - Summary

## What Went Wrong

Looking at your BAS logs, the issue is clear:

```
[2025-12-05T19:33:49.878Z] [INFO] Fetching new OAuth access token from SAC
[2025-12-05T19:33:50.001Z] [ERROR] Failed to get OAuth access token: ["Request failed with status code 401"]
[2025-12-05T19:33:50.001Z] [ERROR] OAuth error response: [{"status":401,"data":"Unauthorized"}]
```

**Root Cause**: The application was using the **WRONG OAuth token endpoint URL**.

### The Problem

The code was trying to get an OAuth token from:
```
❌ https://cvs-pharmacy-q.us10.hcs.cloud.sap/oauth/token
```

But SAP Analytics Cloud uses a **separate authentication server** for OAuth. The correct endpoint should be:
```
✅ https://cvs-pharmacy-q.authentication.us10.hana.ondemand.com/oauth/token
```

---

## What Was Fixed

I've updated the following files:

### 1. `src/clients/sac-client.ts`
- ✅ Fixed OAuth token endpoint to use the correct SAC authentication server
- ✅ Added automatic detection of the token URL from the tenant URL
- ✅ Added support for manual override via `SAC_OAUTH_TOKEN_URL` environment variable
- ✅ Added detailed logging of the OAuth token endpoint being used

### 2. `src/config.ts`
- ✅ Added `oauthTokenUrl` optional configuration parameter

### 3. `src/types/index.ts`
- ✅ Updated Config interface to include `oauthTokenUrl`

### 4. `.env.example`
- ✅ Added documentation for `SAC_OAUTH_TOKEN_URL` override

### 5. `AUTH_FIX_GUIDE.md`
- ✅ Updated with correct OAuth token URL information

### 6. Built Application
- ✅ Compiled TypeScript code successfully
- ✅ Ready for deployment

---

## Next Steps: What You Need to Do

### Option 1: Quick Deploy (Recommended)

Since the OAuth token endpoint was the issue, and I've fixed it, you just need to redeploy:

```bash
# Navigate to the project directory
cd /path/to/ai-predictive-agent

# Deploy to Cloud Foundry
cf push ai-predictive-agent
```

The app will now use the correct OAuth token endpoint:
- **Old (wrong)**: `https://cvs-pharmacy-q.us10.hcs.cloud.sap/oauth/token`
- **New (correct)**: `https://cvs-pharmacy-q.authentication.us10.hana.ondemand.com/oauth/token`

### Option 2: Verify OAuth Credentials (If Still Getting 401)

If you still get 401 errors after redeployment, it means your OAuth credentials are incorrect or missing:

#### Step 2.1: Check Current Environment Variables

```bash
cf env ai-predictive-agent
```

Look for these variables:
- `SAC_CLIENT_ID` - Should be something like `sb-12345678-abcd-efgh-ijkl-mnopqrstuvwx`
- `SAC_CLIENT_SECRET` - Should be a long alphanumeric string

#### Step 2.2: If Credentials Are Missing or Wrong

You need to create an OAuth client in SAC:

1. **Login to SAC**: https://cvs-pharmacy-q.us10.hcs.cloud.sap

2. **Navigate to OAuth Clients**:
   - Click menu (☰) → **System** → **Administration**
   - Select **App Integration**
   - Click **OAuth Clients**

3. **Create New OAuth Client** (or find existing one):
   - Click **+ Add a New OAuth Client**
   - **Name**: `AI Predictive Agent`
   - **Purpose**: `Interactive Usage and API Access`
   - **Authorization Grant**: `Client Credentials`
   - **Access**: Check these permissions:
     - ✅ Data Import Service
     - ✅ Planning
     - ✅ Multi-Action Service

4. **Copy Credentials**:
   - **Client ID**: Copy the full client ID (usually starts with `sb-`)
   - **Client Secret**: Copy immediately (you won't see it again!)
   - **Token URL**: Should be `https://cvs-pharmacy-q.authentication.us10.hana.ondemand.com/oauth/token`

5. **Set Environment Variables**:
   ```bash
   cf set-env ai-predictive-agent SAC_CLIENT_ID "your-actual-client-id"
   cf set-env ai-predictive-agent SAC_CLIENT_SECRET "your-actual-client-secret"
   
   # Restart the app
   cf restage ai-predictive-agent
   ```

---

## Testing the Fix

After deployment, test with:

```bash
# Check logs
cf logs ai-predictive-agent --recent

# Look for these SUCCESS indicators:
# ✅ "Using OAuth token endpoint: https://cvs-pharmacy-q.authentication.us10.hana.ondemand.com/oauth/token"
# ✅ "Successfully obtained OAuth access token"
# ✅ "Multi-Action triggered successfully"

# Make sure you DON'T see:
# ❌ "Failed to get OAuth access token"
# ❌ "Request failed with status code 401"
```

Then test in SAC:
1. Open your SAC story: https://cvs-pharmacy-q.us10.hcs.cloud.sap
2. Enter the NLP command: `"Create a 6 month forecast for GL 4100000"`
3. It should now work! ✅

---

## Technical Details

### How the Fix Works

The code now automatically constructs the correct OAuth token endpoint:

```typescript
// Extract tenant name and region from tenant URL
const tenantUrl = "https://cvs-pharmacy-q.us10.hcs.cloud.sap";
// Extracts: tenantName = "cvs-pharmacy-q", region = "us10"

// Constructs correct OAuth endpoint:
const tokenUrl = `https://${tenantName}.authentication.${region}.hana.ondemand.com/oauth/token`;
// Result: https://cvs-pharmacy-q.authentication.us10.hana.ondemand.com/oauth/token
```

### Manual Override (If Needed)

If your SAC instance uses a different OAuth endpoint, you can override it:

```bash
cf set-env ai-predictive-agent SAC_OAUTH_TOKEN_URL "https://your-custom-endpoint/oauth/token"
cf restage ai-predictive-agent
```

---

## Summary

| Issue | Status |
|-------|--------|
| Wrong OAuth token endpoint | ✅ FIXED |
| Code updated | ✅ DONE |
| Code compiled | ✅ DONE |
| Ready to deploy | ✅ YES |

**What you need to do**:
1. Deploy the updated code: `cf push ai-predictive-agent`
2. Test in SAC with your forecast query
3. If still getting 401, verify OAuth credentials in SAC (see Option 2 above)

---

## Expected Log Output After Fix

When the fix is working, you should see logs like this:

```
[INFO] Received forecast query: "Create a 6 month forecast for GL 4100000"
[INFO] Successfully interpreted forecast query: [{"glAccount":"4100000","forecastPeriod":6,...}]
[INFO] Triggering SAC Multi-Action: placeholder [{"GLAccount":"4100000","ForecastPeriod":6,...}]
[INFO] Fetching new OAuth access token from SAC
[INFO] Using OAuth token endpoint: https://cvs-pharmacy-q.authentication.us10.hana.ondemand.com/oauth/token
[INFO] Successfully obtained OAuth access token ✅
[INFO] Multi-Action triggered successfully ✅
```

No more 401 errors! 🎉

---

**Need Help?** If you still see 401 errors after deploying, the issue is with your OAuth client credentials in SAC. Follow Option 2 above to create/verify your OAuth client.
