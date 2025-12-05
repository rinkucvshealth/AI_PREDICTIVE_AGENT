# QUICK FIX GUIDE - SAC 401 Unauthorized Error

## 🚨 The Problem
You're getting **401 Unauthorized** from SAC because the OAuth credentials are still "placeholder".

## ⚡ FASTEST FIX (5 minutes)

### Step 1: Get SAC OAuth Credentials

**Option A - If you have SAC admin access:**
1. Go to https://cvs-pharmacy-q.us10.hcs.cloud.sap
2. Navigate: **System** → **Administration** → **App Integration**
3. Click **"Add a New OAuth Client"**
4. Configure:
   - Name: `AI-Predictive-Agent`
   - Grant Type: `Client Credentials`
   - Scopes: Check `Planning` and `Data Import`
5. Click **Add** - YOU'LL SEE CLIENT ID AND SECRET (only shown once!)
6. **COPY BOTH VALUES IMMEDIATELY**

**Option B - If you don't have SAC admin access:**
Ask your SAC administrator to create an OAuth client and share the credentials with you.

---

### Step 2: Set the Credentials in Cloud Foundry

**On your local terminal (where CF CLI is installed):**

```bash
# Set SAC OAuth Client ID
cf set-env ai-predictive-agent SAC_CLIENT_ID "paste-actual-client-id-here"

# Set SAC OAuth Client Secret
cf set-env ai-predictive-agent SAC_CLIENT_SECRET "paste-actual-client-secret-here"

# Restart the app
cf restart ai-predictive-agent

# Watch the logs to verify
cf logs ai-predictive-agent --recent
```

**Expected Success Logs:**
```
[INFO] Fetching new OAuth access token from SAC
[INFO] Using OAuth token endpoint: https://cvs-pharmacy-q.authentication.us10.hana.ondemand.com/oauth/token
[INFO] Successfully obtained OAuth access token
[INFO] Triggering SAC Multi-Action: E5280280114D3785596849C3D321B820
[INFO] Multi-Action triggered successfully
```

---

### Step 3: Test It
1. Open SAC: https://cvs-pharmacy-q.us10.hcs.cloud.sap
2. Open your story with the AI Predictive Agent widget
3. Type: `"Create 6 month forecast for GL 500100"`
4. Should work! ✅

---

## 🔍 Verification Commands

```bash
# Check if credentials are set (should NOT show "placeholder")
cf env ai-predictive-agent | grep SAC_CLIENT_ID
cf env ai-predictive-agent | grep SAC_CLIENT_SECRET

# Watch for errors
cf logs ai-predictive-agent --recent | grep ERROR

# Check app status
cf app ai-predictive-agent
```

---

## ❌ Still Not Working?

### Check 1: OAuth Token URL
The app auto-generates the OAuth URL. If it's wrong, manually set it:

```bash
# For US10 region (your case)
cf set-env ai-predictive-agent SAC_OAUTH_TOKEN_URL "https://cvs-pharmacy-q.authentication.us10.hana.ondemand.com/oauth/token"

# For EU10 region
cf set-env ai-predictive-agent SAC_OAUTH_TOKEN_URL "https://your-tenant.authentication.eu10.hana.ondemand.com/oauth/token"

cf restart ai-predictive-agent
```

### Check 2: OAuth Client Permissions
Make sure your OAuth client in SAC has these permissions:
- ✅ Planning Model access
- ✅ Data Import API access
- ✅ Multi-Action execution rights

### Check 3: Multi-Action Access
In SAC, verify:
1. Multi-Action ID `E5280280114D3785596849C3D321B820` exists
2. It's associated with Planning Model `PRDA_PL_PLAN`
3. The OAuth client has permission to execute it

### Check 4: Network/Firewall
If still failing, check if Cloud Foundry can reach SAC:
```bash
cf ssh ai-predictive-agent
curl -v https://cvs-pharmacy-q.us10.hcs.cloud.sap
```

---

## 🆘 Emergency Fallback - Hardcode Temporarily

**⚠️ NOT RECOMMENDED FOR PRODUCTION - For testing only**

If you need to test quickly and CF CLI isn't available:

1. Edit `manifest.yml`:
```yaml
env:
  SAC_CLIENT_ID: "your-real-client-id"
  SAC_CLIENT_SECRET: "your-real-client-secret"
```

2. Deploy:
```bash
cf push
```

**IMPORTANT:** Remove credentials from `manifest.yml` after testing! Use `cf set-env` instead.

---

## 📞 Need More Help?

Share these outputs:
```bash
cf logs ai-predictive-agent --recent > app-logs.txt
cf env ai-predictive-agent > app-env.txt
cf app ai-predictive-agent > app-status.txt
```

Look for specific error messages in `app-logs.txt`.

---

## ✅ Success Indicators

You'll know it's working when you see:
- ✅ No more "401 Unauthorized" errors
- ✅ Logs show "Successfully obtained OAuth access token"
- ✅ Logs show "Multi-Action triggered successfully"
- ✅ Widget in SAC processes forecast requests
- ✅ No more "placeholder" in credential values
