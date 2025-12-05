# 🚨 QUICK FIX: SAC 401 Unauthorized Error

## Root Cause Found ✅

**You are using BTP/XSUAA credentials instead of SAC OAuth credentials!**

Your current credentials:
```
SAC_CLIENT_ID: sb-d0a25928-2a38-4862-ab82-bc4f8529aab7!b563143|client!b655
```

This format (`sb-...|client!b...`) indicates **BTP platform credentials**, which **DO NOT work** with SAC's Multi-Action API.

---

## The Fix (15 minutes)

### Step 1: Create SAC OAuth Client

1. Login to SAC: https://cvs-pharmacy-q.us10.hcs.cloud.sap
2. Go to: **Menu → System → Administration → App Integration → OAuth Clients**
3. Click **"Add a New OAuth Client"**
4. Configure:
   - **Name**: `AI Predictive Agent`
   - **Grant Type**: ✅ **Client Credentials** (REQUIRED!)
   - **Scopes**: ✅ Select:
     - Data Import Service
     - Planning
     - Multi-Action Service
5. Click **Save**
6. **⚠️ CRITICAL**: Copy the **Client ID** and **Secret** (shown only once!)

### Step 2: Update Cloud Foundry

```bash
# Replace with your NEW SAC OAuth credentials
cf set-env ai-predictive-agent SAC_CLIENT_ID "<your-new-sac-client-id>"
cf set-env ai-predictive-agent SAC_CLIENT_SECRET "<your-new-sac-secret>"

# Restart app
cf restart ai-predictive-agent
```

### Step 3: Verify Fix

```bash
# Watch logs - should see OAuth success
cf logs ai-predictive-agent --recent

# Look for these ✅:
# [INFO] Fetching new OAuth access token from SAC
# [INFO] Successfully obtained OAuth access token
# [INFO] Multi-Action triggered successfully
```

### Step 4: Test

Test a forecast from SAC widget:
```
"Create 6 month forecast for GL 500100"
```

**Expected**: Success response, no 401 errors! 🎉

---

## Why This Happened

| What You Have | What You Need |
|--------------|---------------|
| BTP/XSUAA credentials | SAC OAuth credentials |
| Created in: BTP Cockpit | Created in: SAC Admin |
| Format: `sb-xxx!bxx\|client!bxx` | Format: Simple alphanumeric |
| Works with: BTP services | Works with: SAC APIs ✅ |

**SAC's Multi-Action API ONLY accepts OAuth credentials created in SAC itself.**

---

## Need Help?

### Run Diagnostic Script
```bash
./diagnose-oauth.sh
```

### Check Detailed Instructions
See: `SAC_OAUTH_FIX_INSTRUCTIONS.md`

### Still Getting 401?

**Check OAuth Client in SAC**:
- Status: Must be **Enabled**
- Grant Type: Must have **Client Credentials** ✅
- Scopes: Must have **Data Import, Planning, Multi-Action** ✅

**Enable Debug Logging**:
```bash
cf set-env ai-predictive-agent LOG_LEVEL debug
cf restart ai-predictive-agent
cf logs ai-predictive-agent
```

---

## Summary

🔴 **Problem**: Using BTP credentials → SAC rejects with 401  
🟢 **Solution**: Create SAC OAuth credentials → Success!

**Action**: Follow Step 1-4 above → Should work in 15 minutes!

---

**Need SAC Admin Access?** Contact your SAC administrator to create the OAuth client for you.
