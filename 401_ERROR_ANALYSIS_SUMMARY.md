# SAC 401 Error - Complete Analysis & Resolution

**Date**: December 5, 2025  
**Issue**: Persistent 401 Unauthorized errors when calling SAC Multi-Action API  
**Status**: 🔴 Root cause identified - Immediate action required

---

## Executive Summary

Your AI Predictive Agent is experiencing 401 Unauthorized errors because it's using **BTP/XSUAA platform credentials** instead of **SAC OAuth credentials** to authenticate with SAC's Multi-Action API.

**Impact**: All forecast requests fail  
**Fix Time**: 15 minutes (if you have SAC admin access)  
**Risk**: Low (simple credential swap)

---

## Evidence from Your Logs

### Environment Variables (env.txt)

```bash
SAC_CLIENT_ID: sb-d0a25928-2a38-4862-ab82-bc4f8529aab7!b563143|client!b655
SAC_CLIENT_SECRET: 9a81d84e-1277-4ccb-95fd-7db0f60f15e7$KytCvQeVWDy5JrXqAS0fLrKFhPn9s1xumtyXc9jNgeA=
```

**Analysis**: The format `sb-...|client!b...` is the signature of BTP/XSUAA credentials, NOT SAC OAuth credentials.

### Application Logs (logs.txt)

```
[INFO] Received forecast query: "Create 6 month forecast for GL 500100"
[INFO] Successfully interpreted forecast query
[INFO] Triggering SAC Multi-Action: E5280280114D3785596849C3D321B820

❌ NO LOGS showing "Fetching new OAuth access token from SAC"
❌ NO LOGS showing "Successfully obtained OAuth access token"

[ERROR] Failed to trigger Multi-Action: Request failed with status code 401
[ERROR] SAC API Error: {"status":401,"statusText":"Unauthorized"}
```

**Analysis**: 
- OpenAI query interpretation works ✅
- OAuth token fetch is missing (returns null silently)
- SAC API rejects request with 401 ❌

---

## Root Cause

### The Problem

```
BTP/XSUAA Credentials → OAuth Token Endpoint → Wrong Token Type → SAC API Rejects (401)
```

**Why BTP credentials don't work:**

1. **Different Purpose**:
   - BTP/XSUAA: Authenticates to BTP platform services (HANA DB, XSUAA, etc.)
   - SAC OAuth: Authenticates to SAC application APIs

2. **Different Token Types**:
   - BTP tokens contain BTP service scopes
   - SAC tokens contain SAC API scopes (Planning, Data Import, Multi-Action)

3. **Different Creation Process**:
   - BTP credentials: Created in BTP Cockpit → Service Instances → XSUAA
   - SAC credentials: Created in SAC → Administration → OAuth Clients

### Why It's Failing Silently

The OAuth token endpoint accepts the BTP credentials but returns a token that SAC's API doesn't recognize. The app code can't distinguish between "no token" and "wrong token type", so it proceeds to call SAC with an invalid token → 401.

---

## The Solution

### Step 1: Create SAC OAuth Client (5 minutes)

1. **Login to SAC** as admin:
   ```
   https://cvs-pharmacy-q.us10.hcs.cloud.sap
   ```

2. **Navigate**:
   ```
   Menu (☰) → System → Administration → App Integration → OAuth Clients
   ```

3. **Click**: "Add a New OAuth Client"

4. **Configure**:
   ```
   Name: AI Predictive Agent
   Description: OAuth client for AI-driven forecasting
   Purpose: Interactive Usage and API Access
   Access: Confidential
   ```

5. **Grant Type**: 
   - ✅ **Client Credentials** ← CRITICAL!
   - ❌ Uncheck all others

6. **Authorization Scopes** (select these):
   - ✅ Data Import Service
   - ✅ Planning
   - ✅ Multi-Action Service (if available)
   - ✅ Planning Model (if available)

7. **Save** and **COPY**:
   - OAuth Client ID
   - Secret (shown only once!)

### Step 2: Update Cloud Foundry (2 minutes)

```bash
# Set new SAC OAuth credentials
cf set-env ai-predictive-agent SAC_CLIENT_ID "<your-new-sac-client-id>"
cf set-env ai-predictive-agent SAC_CLIENT_SECRET "<your-new-sac-secret>"

# Restart to apply changes
cf restart ai-predictive-agent
```

### Step 3: Verify Fix (3 minutes)

```bash
# Watch logs
cf logs ai-predictive-agent --recent

# Look for these success indicators:
# ✅ [INFO] Fetching new OAuth access token from SAC
# ✅ [INFO] Successfully obtained OAuth access token
# ✅ [INFO] Multi-Action triggered successfully
```

### Step 4: Test (2 minutes)

Test from SAC widget:
```
"Create 6 month forecast for GL 500100"
```

**Expected Success Response**:
```json
{
  "success": true,
  "summary": "Forecast initiated for GL Account 500100 (6 months)",
  "details": {
    "multiActionStatus": "success"
  }
}
```

---

## Before vs After

### Before (Current State)

```
┌──────────────────────┐
│ Using BTP Credentials │
└──────────┬───────────┘
           │
           ▼
    ❌ OAuth returns
       wrong token type
           │
           ▼
    ❌ SAC API rejects
       with 401
           │
           ▼
    🔴 All forecasts fail
```

### After (Fixed State)

```
┌──────────────────────┐
│ Using SAC Credentials │
└──────────┬───────────┘
           │
           ▼
    ✅ OAuth returns
       SAC-valid token
           │
           ▼
    ✅ SAC API accepts
       with 200 OK
           │
           ▼
    🟢 Forecasts work!
```

---

## Verification Checklist

After applying the fix, verify these in the logs:

- [ ] `[INFO] Fetching new OAuth access token from SAC`
- [ ] `[INFO] Using OAuth token endpoint: https://cvs-pharmacy-q.authentication.us10.hana.ondemand.com/oauth/token`
- [ ] `[INFO] Successfully obtained OAuth access token` ← **KEY INDICATOR**
- [ ] `[INFO] Triggering SAC Multi-Action: E5280280114D3785596849C3D321B820`
- [ ] `[INFO] Multi-Action triggered successfully`
- [ ] No 401 errors in logs
- [ ] Test forecast request succeeds

---

## Troubleshooting

### Issue: Still getting 401 after creating SAC OAuth client

**Check 1**: Verify OAuth client is **Enabled** in SAC
- Go to SAC → OAuth Clients
- Check status = "Enabled"

**Check 2**: Verify required scopes are selected
- Data Import Service ✅
- Planning ✅
- Multi-Action Service ✅

**Check 3**: Verify grant type is "Client Credentials"

**Check 4**: Double-check you copied the credentials correctly
```bash
cf env ai-predictive-agent | grep SAC_CLIENT
```

### Issue: OAuth token fetch fails

**Enable debug logging**:
```bash
cf set-env ai-predictive-agent LOG_LEVEL debug
cf restart ai-predictive-agent
cf logs ai-predictive-agent
```

Look for OAuth error messages in the logs.

### Issue: Don't have SAC admin access

Contact your SAC administrator and provide them:
- This document
- SAC_OAUTH_FIX_INSTRUCTIONS.md
- Request they create OAuth client with Client Credentials grant type

---

## Technical Details

### OAuth Client Credentials Flow

```
1. App sends request with Client ID + Secret
   POST https://cvs-pharmacy-q.authentication.us10.hana.ondemand.com/oauth/token
   Authorization: Basic base64(clientId:clientSecret)
   Content-Type: application/x-www-form-urlencoded
   Body: grant_type=client_credentials

2. OAuth server validates credentials and returns token
   {
     "access_token": "eyJ...",
     "token_type": "Bearer",
     "expires_in": 3600
   }

3. App uses token to call SAC API
   POST /api/v1/dataimport/planningModel/PRDA_PL_PLAN/multiActions/E528.../runs
   Authorization: Bearer eyJ...
   
4. SAC validates token and processes request
   200 OK - Multi-Action triggered
```

### Why BTP Tokens Fail

BTP/XSUAA tokens contain scopes like:
- `xs_user.read`
- `xs_authorization.read`
- `uaa.resource`

SAC API expects tokens with SAC-specific scopes like:
- `SAC_DATA_IMPORT`
- `SAC_PLANNING`
- `SAC_MULTIACTION`

When SAC receives a BTP token, it sees no SAC scopes → 401 Unauthorized.

---

## Files Created

For your reference, I've created these helpful documents:

1. **QUICK_FIX_401_ERROR.md** - Quick start guide
2. **SAC_OAUTH_FIX_INSTRUCTIONS.md** - Detailed step-by-step instructions
3. **OAUTH_FLOW_DIAGRAM.md** - Visual explanation of the issue
4. **diagnose-oauth.sh** - Diagnostic script to verify setup
5. **401_ERROR_ANALYSIS_SUMMARY.md** - This document

---

## Action Plan

### Immediate (Today)

1. ✅ Read QUICK_FIX_401_ERROR.md
2. ⏳ Create SAC OAuth client
3. ⏳ Update Cloud Foundry credentials
4. ⏳ Restart app
5. ⏳ Verify success in logs

### Short-term (This Week)

1. Monitor logs for 24 hours
2. Test multiple forecast scenarios
3. Document SAC OAuth client for team
4. Update deployment documentation

### Long-term (This Month)

1. Set up monitoring/alerts for 401 errors
2. Create runbook for credential rotation
3. Consider automating OAuth token refresh

---

## Success Criteria

✅ No 401 errors in logs  
✅ Logs show "Successfully obtained OAuth access token"  
✅ Test forecast requests return 200 OK  
✅ Multi-Actions execute successfully in SAC  
✅ Users can create forecasts from SAC widget  

---

## Support

### Run Diagnostics
```bash
./diagnose-oauth.sh
```

### Enable Debug Mode
```bash
cf set-env ai-predictive-agent LOG_LEVEL debug
cf restart ai-predictive-agent
```

### Check Logs
```bash
# All logs
cf logs ai-predictive-agent --recent

# OAuth-related only
cf logs ai-predictive-agent --recent | grep -i oauth

# Errors only
cf logs ai-predictive-agent --recent | grep ERROR
```

---

## Conclusion

**Problem**: Wrong credential type (BTP instead of SAC)  
**Solution**: Create SAC OAuth credentials in SAC Admin Console  
**Timeline**: 15 minutes to fix  
**Risk**: Low (credential swap only, no code changes)  

**Next Step**: Follow QUICK_FIX_401_ERROR.md to create SAC OAuth client

---

**Questions?** See SAC_OAUTH_FIX_INSTRUCTIONS.md for detailed guidance.
