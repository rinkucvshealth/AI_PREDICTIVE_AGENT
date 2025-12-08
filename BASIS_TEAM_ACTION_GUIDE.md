# 🚨 URGENT: SAC OAuth Client Setup - BASIS Team Action Guide

## Problem Statement

**Current Situation**: Application gets 401 Unauthorized when executing SAC Multi-Actions  
**Root Cause**: Using XSUAA OAuth client instead of SAC-native OAuth client  
**Impact**: Application cannot trigger forecasts - business functionality blocked  
**Fix Time**: ~15 minutes  

## ⚡ Quick Fix Steps

### Step 1: Access SAC Administration (2 minutes)

1. Open browser and navigate to:
   ```
   https://cvs-pharmacy-q.us10.hcs.cloud.sap
   ```

2. Login with SAC Administrator credentials

3. Navigate to:
   ```
   Main Menu (☰) → System → Administration → App Integration → OAuth Clients
   ```

### Step 2: Create New OAuth Client (5 minutes)

Click **"Add a New OAuth Client"** button

#### Configuration Details:

**Basic Information:**
```
Name: AI Predictive Agent
Purpose: Interactive Usage and API Access
```

**Grant Type:**
```
☑ Client Credentials
```

**Token Settings:**
```
Token Lifetime: 3600 seconds
```

**Authorization Scopes** (CHECK ALL OF THESE):
```
☑ Planning Model API
☑ Data Import Service API  
☑ Planning Model Data API
☑ Multi-Action API (if available)
☑ Read Planning Data
☑ Write Planning Data
```

**Redirect URI:**
```
(Leave empty - not needed for client credentials)
```

### Step 3: Save and Copy Credentials (1 minute)

1. Click **"Add"** or **"Save"**

2. **CRITICAL**: A dialog will appear with:
   ```
   OAuth Client ID: sb-xxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxx
   Secret: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

3. **Copy both values immediately** - you cannot retrieve the secret later!

4. Share securely with development team

### Step 4: Verify User Permissions (5 minutes)

The OAuth client needs to be associated with a user/service account that has:

1. **Access to Planning Model**: `PRDA_PL_PLAN`
   - Check in: Main Menu → Modeler → Planning Models
   - Ensure the technical user can see and edit this model

2. **Multi-Action Execution Rights**:
   - Open model `PRDA_PL_PLAN`
   - Go to Multi-Actions
   - Find Multi-Action ID: `E5280280114D3785596849C3D321B820`
   - Verify it exists and can be executed

3. **Write Permissions**:
   - User must have "Planning" or "Planning Professional" role
   - Check: System → Administration → Security → Users

### Step 5: Provide Configuration to Dev Team (2 minutes)

Send the following information securely (e.g., via encrypted email or secure vault):

```bash
SAC OAuth Client Credentials
============================

Client ID: [paste OAuth Client ID here]
Client Secret: [paste Secret here]
Token Endpoint: https://cvs-pharmacy-q.us10.hcs.cloud.sap/oauth/token

Created: [current date/time]
Expires: Never (but can be rotated if needed)
Purpose: AI Predictive Agent - Multi-Action Execution
```

## 🔍 Verification Steps

After creating the OAuth client, verify it works:

### Test 1: Token Acquisition

```bash
curl -X POST \
  'https://cvs-pharmacy-q.us10.hcs.cloud.sap/oauth/token' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -u 'CLIENT_ID:CLIENT_SECRET' \
  -d 'grant_type=client_credentials'
```

**Expected Response:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJ...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "..."
}
```

✅ If you get this, token acquisition works!

### Test 2: Decode Token (Optional)

1. Copy the `access_token` value
2. Go to https://jwt.io
3. Paste token in "Encoded" section
4. Check "Decoded" section for scopes
5. Verify it includes planning/data write scopes

## 📋 Comparison: XSUAA vs SAC OAuth

### Current Setup (XSUAA) - ❌ DOESN'T WORK

```
Token URL: https://cvs-pharmacy-q.authentication.us10.hana.ondemand.com/oauth/token
Client ID: sb-d0a25928-2a38-486...lient!b655
Purpose: BTP service authentication
Scopes: uaa.resource, approuter access, api proxy
Result: ❌ 401 on Multi-Action execution
```

### New Setup (SAC OAuth) - ✅ WILL WORK

```
Token URL: https://cvs-pharmacy-q.us10.hcs.cloud.sap/oauth/token
Client ID: [new OAuth client ID]
Purpose: SAC API direct access
Scopes: Planning API, Data Import, Multi-Action execution
Result: ✅ Multi-Action executes successfully
```

## ❓ FAQ

### Q: Why can't we just add scopes to the existing XSUAA client?

**A**: XSUAA and SAC use different authorization systems. XSUAA handles BTP-level authentication, while SAC has its own OAuth server for API access. Multi-Actions require SAC-level permissions that XSUAA cannot provide.

### Q: Will this affect existing authentication?

**A**: No. This creates a **new, separate** OAuth client. Existing authentication continues to work. We're adding an alternative path specifically for API access.

### Q: Is this secure?

**A**: Yes. This is the **official, documented approach** for SAC API integration. The credentials should be:
- Stored securely (environment variables, not code)
- Rotated periodically (every 90 days recommended)
- Limited to minimum necessary scopes

### Q: What if I don't see "OAuth Clients" in the menu?

**A**: You need SAC Administrator role. Contact your SAC tenant administrator to grant access or ask them to create the OAuth client.

### Q: Can we use the same OAuth client for multiple applications?

**A**: Technically yes, but **not recommended**. Best practice is one OAuth client per application for:
- Security isolation
- Audit trail clarity  
- Easier credential rotation

### Q: How do we rotate/revoke the credentials?

**A**: 
1. Go to System → Administration → App Integration → OAuth Clients
2. Find "AI Predictive Agent" client
3. Click to edit
4. Use "Generate New Secret" or "Delete" buttons

## 🚨 Troubleshooting

### If OAuth Client Creation Fails:

**Error**: "You don't have permission to create OAuth clients"
- **Solution**: Need SAC Administrator role
- **Action**: Contact SAC tenant owner

**Error**: "Invalid scope configuration"
- **Solution**: Some scopes might not be available in your SAC version
- **Action**: Select all available planning/data-related scopes

### If Token Acquisition Still Fails After Setup:

**401 Unauthorized during token request:**
- Verify Client ID and Secret are correct
- Check for extra spaces/newlines in credentials
- Ensure using correct token URL (SAC, not XSUAA)

**403 Forbidden during token request:**
- OAuth client might be disabled
- Check in SAC UI that client status is "Active"

## 📞 Support Escalation

If issues persist after following this guide:

**Contact**:
- SAP Support Portal: https://support.sap.com
- Component: CA-EPM-ANA-PLC (SAC Planning)
- Priority: High (business functionality blocked)
- Include: OAuth Client ID, timestamps, error messages

**Useful Information to Provide**:
- SAC Tenant: cvs-pharmacy-q.us10.hcs.cloud.sap
- Model ID: PRDA_PL_PLAN
- Multi-Action ID: E5280280114D3785596849C3D321B820
- Error: 401 Unauthorized on Multi-Action execution
- Already Tried: XSUAA authentication, CSRF tokens, multiple endpoints

## ✅ Success Criteria

You'll know it's fixed when the development team reports:

```log
✅ Multi-Action triggered successfully
✅ Forecast job started
✅ No more 401 errors
```

## 📅 Timeline

**Total Time Required**: 15-20 minutes

- Setup (Steps 1-3): 8 minutes
- Verification (Step 4): 5 minutes
- Communication (Step 5): 2 minutes
- Testing: 5 minutes

**Downtime**: None (new client creation doesn't affect existing functionality)

---

## 🎯 Bottom Line

**What to Do**: Create a new SAC-native OAuth client with Planning API scopes  
**Where**: SAC UI → System → Administration → App Integration → OAuth Clients  
**Why**: Current XSUAA client can't execute Multi-Actions (wrong permission system)  
**When**: ASAP (blocks critical business functionality)  
**Who**: SAC Administrator  
**Impact**: 15 minutes to fix, enables AI forecasting application  

---

*Questions? Contact the development team or SAP Support.*
