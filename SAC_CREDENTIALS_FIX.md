# SAC Credentials Configuration Fix

## 🔴 Current Problem

Your app is getting **401 Unauthorized** errors because:

1. **SAC_CLIENT_ID** is not set (or set to "placeholder")
2. **SAC_CLIENT_SECRET** is not set (or set to "placeholder")  
3. **SAC_MULTI_ACTION_ID** is still set to "placeholder"

## 📋 Evidence from Logs

```
[INFO] Triggering SAC Multi-Action: placeholder
[ERROR] Failed to get OAuth access token: ["Request failed with status code 401"]
[ERROR] OAuth error response: [{"status":401,"data":"Unauthorized"}]
```

## ✅ Solution: Set Environment Variables Correctly

### Step 1: Set SAC OAuth Credentials

**IMPORTANT**: Use **single quotes** (`'...'`) to prevent bash from interpreting special characters like `!` and `|`.

```bash
# Set OAuth Client ID (use SINGLE quotes!)
cf set-env ai-predictive-agent SAC_CLIENT_ID 'sb-d0a25928-2a38-4862-ab82-bc4f8529aab7!b563143|client!b655'

# Set OAuth Client Secret (get this from your SAC OAuth client configuration)
cf set-env ai-predictive-agent SAC_CLIENT_SECRET 'your-client-secret-here'
```

### Step 2: Set SAC Multi-Action ID

Replace "placeholder" with your actual Multi-Action ID from SAC:

```bash
cf set-env ai-predictive-agent SAC_MULTI_ACTION_ID 'E5280280114D3785596849C3D321B820'
```

### Step 3: Restart the App

After setting all environment variables, restart the app to apply changes:

```bash
cf restart ai-predictive-agent
```

## 🔍 How to Find Your Credentials

### SAC Client ID and Client Secret

1. Log into your SAC tenant: `https://cvs-pharmacy-q.us10.hcs.cloud.sap`
2. Go to **System** → **Administration** → **App Integration**
3. Find your OAuth client (or create a new one)
4. Copy the **Client ID** and **Client Secret**

### SAC Multi-Action ID

1. In SAC, open your Planning Model: `PRDA_PL_PLAN`
2. Go to **Multi-Actions**
3. Find the Multi-Action you want to use for forecasting
4. Copy the **Multi-Action ID** (usually a long hexadecimal string)

## 🧪 Verify Configuration

After setting the credentials and restarting, test with:

```bash
# Check recent logs
cf logs ai-predictive-agent --recent

# Look for these success messages:
# ✅ "Successfully obtained OAuth access token"
# ✅ "Multi-Action triggered successfully"
```

## ⚠️ Common Mistakes

### ❌ Using Double Quotes with Special Characters
```bash
# DON'T DO THIS - bash will try to interpret ! as history
cf set-env ai-predictive-agent SAC_CLIENT_ID "sb-xxx!b563143|client!b655"
# Result: bash: !b563143: event not found
```

### ✅ Use Single Quotes Instead
```bash
# DO THIS - single quotes prevent bash interpretation
cf set-env ai-predictive-agent SAC_CLIENT_ID 'sb-xxx!b563143|client!b655'
```

### ❌ Forgetting to Restart
```bash
# Setting env vars doesn't automatically restart the app
cf set-env ai-predictive-agent SAC_CLIENT_ID 'xxx'
# YOU MUST RESTART:
cf restart ai-predictive-agent
```

## 📝 Complete Command Sequence

Here's the complete sequence to fix your issue:

```bash
# 1. Set OAuth credentials (REPLACE WITH YOUR ACTUAL VALUES)
cf set-env ai-predictive-agent SAC_CLIENT_ID 'sb-d0a25928-2a38-4862-ab82-bc4f8529aab7!b563143|client!b655'
cf set-env ai-predictive-agent SAC_CLIENT_SECRET 'your-actual-client-secret'

# 2. Set Multi-Action ID (REPLACE WITH YOUR ACTUAL VALUE)
cf set-env ai-predictive-agent SAC_MULTI_ACTION_ID 'E5280280114D3785596849C3D321B820'

# 3. Restart the app
cf restart ai-predictive-agent

# 4. Watch the logs for success
cf logs ai-predictive-agent --recent
```

## 🎯 Expected Success Output

After correct configuration, you should see:

```
[INFO] Fetching new OAuth access token from SAC
[INFO] Using OAuth token endpoint: https://cvs-pharmacy-q.authentication.us10.hana.ondemand.com/oauth/token
[INFO] Successfully obtained OAuth access token
[INFO] Triggering SAC Multi-Action: E5280280114D3785596849C3D321B820
[INFO] Multi-Action triggered successfully
```

## 🆘 Still Getting 401 Errors?

If you still get 401 errors after setting credentials:

1. **Verify Client ID and Secret** are correct in SAC
2. **Check OAuth Client Permissions** - it needs:
   - `Planning` API access
   - `Data Import` permissions
   - Access to the `PRDA_PL_PLAN` model
3. **Check Multi-Action ID** - make sure it exists and is enabled
4. **Try getting a token manually** to verify credentials:

```bash
# Test OAuth credentials manually (replace values)
curl -X POST https://cvs-pharmacy-q.authentication.us10.hana.ondemand.com/oauth/token \
  -u 'CLIENT_ID:CLIENT_SECRET' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'grant_type=client_credentials'
```

If this returns a token, your credentials are correct. If it returns 401, the credentials are wrong.

## 📞 Need Help?

If you're still stuck:
1. Verify you have the correct OAuth client credentials from your SAC admin
2. Check that the OAuth client has the required permissions
3. Verify the Multi-Action ID is correct and enabled in SAC
