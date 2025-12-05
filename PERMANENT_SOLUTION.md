# PERMANENT SOLUTION - Stop 401 Errors Forever

## 🎯 Executive Summary

**Problem:** Application fails with 401 Unauthorized when calling SAC Multi-Action API  
**Root Cause:** SAC OAuth credentials are set to "placeholder" instead of real values  
**Permanent Fix:** Set correct SAC OAuth credentials in Cloud Foundry environment  
**Time Required:** 5-10 minutes  

---

## 🔴 Current Status (What's Failing)

```
✅ App deploys successfully
✅ OpenAI integration works (queries are interpreted correctly)
❌ SAC authentication fails (401 Unauthorized)
❌ Multi-Action cannot be triggered
```

From your logs:
```
[INFO] Successfully interpreted forecast query: {"glAccount":"500100","forecastPeriod":6,...}
[INFO] Triggering SAC Multi-Action: E5280280114D3785596849C3D321B820
❌ [ERROR] Failed to trigger Multi-Action: ["Request failed with status code 401"]
❌ [ERROR] SAC API Error: {"status":401,"statusText":"Unauthorized"...}
```

**Why?** The app is trying to get an OAuth token using placeholder credentials:
- `SAC_CLIENT_ID = "placeholder"` ❌
- `SAC_CLIENT_SECRET = "placeholder"` ❌

---

## ✅ THE PERMANENT SOLUTION

### Step 1: Get Real SAC OAuth Credentials (One-Time Setup)

You need to create an OAuth client in SAC. This is a one-time setup that gives your app permanent access.

**How to create OAuth client in SAC:**

1. **Login to SAC:**  
   https://cvs-pharmacy-q.us10.hcs.cloud.sap

2. **Navigate to App Integration:**
   - Click **System** (☰ menu)
   - Go to **Administration**
   - Select **App Integration**

3. **Create OAuth Client:**
   - Click **"Add a New OAuth Client"**
   - Fill in:
     - **Name:** `AI-Predictive-Agent`
     - **Purpose:** `Interactive Usage and API Access`
     - **Grant Type:** `Client Credentials` ← IMPORTANT
     - **Token Lifetime:** `3600` seconds
     - **Scope:**
       - ☑️ Planning
       - ☑️ Data Import
       - ☑️ Multi Actions
   - Click **Add**

4. **CRITICAL - Save Credentials:**
   - A popup will show **Client ID** and **Client Secret**
   - **COPY BOTH VALUES IMMEDIATELY** - they're shown only once!
   - Store them securely (you'll need them in Step 2)

**Don't have SAC admin access?**  
→ Ask your SAC administrator to create the OAuth client and share credentials with you.

---

### Step 2: Set Credentials in Cloud Foundry (Permanent Storage)

These credentials will be stored securely in Cloud Foundry and persist across deployments.

**On your terminal where CF CLI is installed:**

```bash
# Set SAC OAuth Client ID
cf set-env ai-predictive-agent SAC_CLIENT_ID "your-actual-client-id-here"

# Set SAC OAuth Client Secret  
cf set-env ai-predictive-agent SAC_CLIENT_SECRET "your-actual-client-secret-here"

# Restart app to pick up new credentials
cf restart ai-predictive-agent
```

**Replace** `"your-actual-client-id-here"` and `"your-actual-client-secret-here"` with the values from Step 1.

---

### Step 3: Verify It's Working

```bash
# Watch the logs
cf logs ai-predictive-agent --recent
```

**Success looks like:**
```
[INFO] Fetching new OAuth access token from SAC
[INFO] Using OAuth token endpoint: https://cvs-pharmacy-q.authentication.us10.hana.ondemand.com/oauth/token
[INFO] Successfully obtained OAuth access token ✅
[INFO] Triggering SAC Multi-Action: E5280280114D3785596849C3D321B820
[INFO] Multi-Action triggered successfully ✅
```

**No more 401 errors!** ✅

---

## 🧪 Test the Full Flow

1. **Open SAC Story:**  
   https://cvs-pharmacy-q.us10.hcs.cloud.sap

2. **Load the AI Widget:**  
   Your story should have the AI Predictive Agent custom widget

3. **Test a Forecast:**
   ```
   "Create 6 month forecast for GL 500100"
   ```

4. **Expected Result:**
   - Widget shows "Processing..."
   - Multi-Action executes in SAC
   - Forecast is created
   - Success message appears ✅

---

## 🔒 Why This is Permanent

Once you set credentials with `cf set-env`:
- ✅ They persist across app restarts
- ✅ They persist across deployments (`cf push`)
- ✅ They're encrypted in Cloud Foundry
- ✅ They're not in your code/git
- ✅ You never need to set them again (unless you recreate the OAuth client)

**Best Practice:** Don't put credentials in `manifest.yml` or `.env` files that get committed to git.

---

## 🛠️ Troubleshooting

### Still getting 401 after setting credentials?

#### Issue 1: OAuth Token URL is Wrong

Your tenant is in **US10** region. The OAuth endpoint should be:
```
https://cvs-pharmacy-q.authentication.us10.hana.ondemand.com/oauth/token
```

If it's different, set it manually:
```bash
cf set-env ai-predictive-agent SAC_OAUTH_TOKEN_URL "https://cvs-pharmacy-q.authentication.us10.hana.ondemand.com/oauth/token"
cf restart ai-predictive-agent
```

#### Issue 2: OAuth Client Missing Scopes

Go back to SAC → App Integration → Edit your OAuth client  
Make sure these scopes are checked:
- ☑️ Planning
- ☑️ Data Import
- ☑️ Multi Actions

#### Issue 3: Multi-Action Permissions

The OAuth client needs permission to:
1. Access Planning Model: `PRDA_PL_PLAN`
2. Execute Multi-Action: `E5280280114D3785596849C3D321B820`

Check in SAC:
- Model permissions
- Multi-Action permissions
- Share settings

#### Issue 4: Wrong Credentials

Double-check you copied the credentials correctly:
```bash
# Verify they're set (will show first few characters)
cf env ai-predictive-agent | grep SAC_CLIENT_ID
cf env ai-predictive-agent | grep SAC_CLIENT_SECRET
```

If they still say "placeholder", the `cf set-env` commands didn't work. Try again.

---

## 📊 Verification Checklist

Before considering this fixed, verify:

- [ ] OAuth client created in SAC
- [ ] Client ID and Secret copied correctly
- [ ] `cf set-env` commands executed successfully
- [ ] App restarted with `cf restart`
- [ ] Logs show "Successfully obtained OAuth access token"
- [ ] No more 401 errors in logs
- [ ] Widget can process forecast requests
- [ ] Multi-Actions execute successfully in SAC

---

## 🚀 Next Deployments

Once credentials are set, future deployments are simple:

```bash
# Just push code changes
cf push

# Credentials are already there!
# No need to set them again
```

The credentials persist until you explicitly remove them with:
```bash
cf unset-env ai-predictive-agent SAC_CLIENT_ID
cf unset-env ai-predictive-agent SAC_CLIENT_SECRET
```

---

## 📋 Quick Command Reference

```bash
# Set credentials (do this once)
cf set-env ai-predictive-agent SAC_CLIENT_ID "your-id"
cf set-env ai-predictive-agent SAC_CLIENT_SECRET "your-secret"
cf restart ai-predictive-agent

# Check credentials are set
cf env ai-predictive-agent | grep SAC_CLIENT

# View logs
cf logs ai-predictive-agent --recent

# Check app status
cf app ai-predictive-agent

# Future deployments (credentials already set)
cf push
```

---

## 🎓 What You Learned

1. **Cloud Foundry Environment Variables** are the proper way to store credentials
2. **OAuth Client Credentials Flow** is how the app authenticates with SAC
3. **Placeholder values** must be replaced with real credentials before production
4. **`cf set-env`** stores credentials permanently and securely

---

## ✅ Success Criteria

You'll know the solution is permanent when:
- ✅ No 401 errors in logs
- ✅ OAuth token is obtained successfully
- ✅ Multi-Actions trigger without errors
- ✅ Widget works in SAC
- ✅ Solution survives app restarts
- ✅ Solution survives redeployments

---

## 📞 Still Need Help?

If this doesn't work:

1. **Check OAuth client exists in SAC:**
   - System → Administration → App Integration
   - Find "AI-Predictive-Agent" client
   - Verify it has correct scopes

2. **Share diagnostic info:**
   ```bash
   cf logs ai-predictive-agent --recent > logs.txt
   cf env ai-predictive-agent > env.txt
   ```

3. **Test OAuth manually:**
   ```bash
   # Replace with your actual credentials
   curl -X POST https://cvs-pharmacy-q.authentication.us10.hana.ondemand.com/oauth/token \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -H "Authorization: Basic $(echo -n 'CLIENT_ID:CLIENT_SECRET' | base64)" \
     -d "grant_type=client_credentials"
   ```

   Should return:
   ```json
   {
     "access_token": "eyJ...",
     "token_type": "Bearer",
     "expires_in": 3600
   }
   ```

---

## 🎉 Conclusion

This is a **one-time setup**. Once you set the SAC OAuth credentials correctly:
- The 401 errors will stop permanently
- The app will work reliably
- Future deployments won't need credential changes
- You can focus on using the app, not fixing it

**The fix is simple:** Replace placeholder credentials with real ones using `cf set-env`.

That's it! 🚀
