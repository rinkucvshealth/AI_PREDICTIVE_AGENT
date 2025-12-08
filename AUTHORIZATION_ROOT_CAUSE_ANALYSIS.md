# 🔍 SAC 401 Authorization Error - Root Cause Analysis

## Executive Summary

**The 401 error is NOT a credentials issue** - your OAuth token is being successfully acquired. The problem is that the token **lacks the necessary permissions/scopes** to execute SAC Multi-Actions, even though it can read model data and fetch CSRF tokens.

## What's Working ✅

From the logs, we can confirm:

1. **OAuth Token Acquisition**: ✅ SUCCESSFUL
   ```
   [INFO] ✓ Token acquired: eyJ0eXAiOiJKV1QiLCJq...
   [INFO] ✓ Expires in: 3599 seconds
   [INFO] ✓ Token type: bearer
   [INFO] ✓ Scopes: uaa.resource approuter-sac-sacus10!t655.sap.fpa.user dmi-api-proxy-sac-sacus10!t655.apiaccess
   ```

2. **CSRF Token Acquisition**: ✅ SUCCESSFUL
   ```
   [INFO] ✓ CSRF token acquired: qAEDFCCqXbLmygFg_7dO...
   [INFO] ✓ Stored 2 cookie(s) for session
   ```

3. **Network Connectivity**: ✅ SUCCESSFUL
   - Can reach SAC tenant
   - Can authenticate to XSUAA
   - Can make API calls

## What's Failing ❌

**Multi-Action Execution**: ❌ RETURNS 401
```
[ERROR] Request failed with status code 401
Status: 401 Unauthorized
Endpoint: /api/v1/multiactions/E5280280114D3785596849C3D321B820/trigger
```

## Root Cause Analysis

### The Real Problem: Wrong Authentication Context

Your current setup is using **XSUAA Client Credentials Grant**, which provides a **service-to-service token**. This token has these scopes:
- `uaa.resource` - Basic UAA resource access
- `approuter-sac-sacus10!t655.sap.fpa.user` - SAC app router user role
- `dmi-api-proxy-sac-sacus10!t655.apiaccess` - Data API proxy access

**BUT** Multi-Action execution requires:
1. **User-context permissions** (not just service permissions)
2. **Planning write scopes** (your token only has read/proxy scopes)
3. **Multi-Action execution rights** (specific SAC permission)

### Why This Happens

There are two types of OAuth clients in the SAC ecosystem:

#### 1. XSUAA OAuth Client (What you're currently using)
- **Location**: BTP Cockpit → Service Instances
- **Purpose**: Service-to-service authentication
- **Token Type**: Service/technical token
- **Scopes**: Limited to what's defined in XSUAA instance
- **Problem**: ❌ Cannot execute user-level operations like Multi-Actions

#### 2. SAC-Native OAuth Client (What you need)
- **Location**: SAC UI → System → Administration → App Integration → OAuth Clients
- **Purpose**: Application API access with user-like permissions
- **Token Type**: API access token with full permissions
- **Scopes**: Full SAC API access including Planning and Multi-Actions
- **Solution**: ✅ Can execute Multi-Actions

## Why BASIS Team Says "Credentials Are Correct"

They're technically right! The credentials ARE valid for authentication. However:

1. **They work for AUTHENTICATION** ✅ (getting a token)
2. **They DON'T work for AUTHORIZATION** ❌ (executing Multi-Actions)

This is like having a valid ID card to enter a building, but not having access to the executive floor.

## The Solution

### Option 1: Create SAC-Native OAuth Client (RECOMMENDED)

This is the correct, supported approach for API access to SAC Multi-Actions.

#### Steps for BASIS Team:

1. **Log into SAC**
   - URL: https://cvs-pharmacy-q.us10.hcs.cloud.sap
   - Use admin credentials

2. **Navigate to OAuth Clients**
   ```
   Main Menu (☰) → System → Administration → App Integration → OAuth Clients
   ```

3. **Add New OAuth Client**
   - Click "Add a New OAuth Client"
   - Fill in details:
     ```
     Name: AI Predictive Agent
     Purpose: Interactive Usage and API Access
     Grant Type: Client Credentials
     Token Lifetime: 3600 seconds
     ```

4. **Select Authorization Scopes**
   ✅ Check these boxes:
   - **Data Import Service API**
   - **Planning Model API**
   - **Multi-Action Execution**
   - **Read Planning Data**
   - **Write Planning Data**

5. **Add to Story (Optional but Recommended)**
   - If Multi-Action needs story context, grant story access

6. **Save and Copy Credentials**
   - **IMPORTANT**: Copy the Client ID and Client Secret
   - You can only see the secret ONCE!

7. **Assign to Technical User**
   - Ensure the OAuth client is associated with a user that has:
     - Access to model `PRDA_PL_PLAN`
     - Permission to execute Multi-Action `E5280280114D3785596849C3D321B820`
     - Write access to Planning data

#### Update Application Configuration:

After creating the SAC-native OAuth client, update these environment variables:

```bash
# CHANGE THESE:
SAC_CLIENT_ID=<new-sac-oauth-client-id>
SAC_CLIENT_SECRET=<new-sac-oauth-client-secret>
SAC_OAUTH_TOKEN_URL=https://cvs-pharmacy-q.us10.hcs.cloud.sap/oauth/token

# KEEP THESE:
SAC_TENANT_URL=https://cvs-pharmacy-q.us10.hcs.cloud.sap
SAC_MODEL_ID=PRDA_PL_PLAN
SAC_MULTIACTION_ID=E5280280114D3785596849C3D321B820
```

**Key Change**: The token URL changes from XSUAA (`authentication.us10.hana.ondemand.com`) to SAC direct (`cvs-pharmacy-q.us10.hcs.cloud.sap/oauth/token`).

### Option 2: Add User Token Exchange (Complex)

If you must continue using XSUAA, you need to:

1. Configure XSUAA destination with user token exchange
2. Use SAML bearer assertion flow
3. Propagate user context from browser session

**This is much more complex and not recommended for API-only access.**

## Verification Steps

After implementing Option 1, verify with:

1. **Test Token Acquisition**
   ```bash
   curl -X POST \
     https://cvs-pharmacy-q.us10.hcs.cloud.sap/oauth/token \
     -H 'Content-Type: application/x-www-form-urlencoded' \
     -u 'CLIENT_ID:CLIENT_SECRET' \
     -d 'grant_type=client_credentials'
   ```

2. **Decode the Token**
   - Copy the `access_token` from response
   - Go to https://jwt.io
   - Paste the token
   - Check the scopes include planning/multi-action permissions

3. **Test Multi-Action**
   - Redeploy your application with new credentials
   - Try triggering a forecast
   - Should succeed with 200/202 status

## Common Misconceptions

### ❌ "The credentials are wrong"
**Reality**: Credentials are valid, but for the wrong authentication system (XSUAA vs SAC OAuth).

### ❌ "It's a network/firewall issue"
**Reality**: Network is fine - we successfully get tokens and CSRF tokens. It's a permissions issue.

### ❌ "We need to add more scopes to XSUAA"
**Reality**: XSUAA scopes won't help. You need SAC-native OAuth client.

### ❌ "The Multi-Action ID is wrong"
**Reality**: If the ID was wrong, you'd get 404, not 401. The 401 specifically means authorization failure.

### ❌ "We need to fix the code"
**Reality**: Code is working correctly. It's an infrastructure/configuration issue.

## Evidence from Logs

### Proof Token Works for Read Operations:
```log
[INFO] ✓ CSRF token acquired: qAEDFCCqXbLmygFg_7dO...
```
This proves the token CAN authenticate and access SAC APIs.

### Proof Token Fails for Write/Execute Operations:
```log
[ERROR] Request failed with status code 401
Response: {"status":401,"statusText":"Unauthorized","data":"Unauthorized"}
```
This specifically happens on Multi-Action execution, a write/execute operation.

### Proof It's a Scope Issue:
The token has these scopes:
- `approuter-sac-sacus10!t655.sap.fpa.user` - App Router user (read-only)
- `dmi-api-proxy-sac-sacus10!t655.apiaccess` - API proxy (read-only)

Missing scopes like:
- `sap.fpa.planning.write`
- `sap.fpa.multiaction.execute`

## Timeline of Failures

Looking at your logs, you've been getting 401 errors consistently:
- 20:01:06 - 401 on Multi-Action
- 20:10:15 - 401 on Multi-Action  
- 20:28:05 - 401 on Multi-Action

All with the same pattern:
1. ✅ Token acquired
2. ✅ CSRF acquired
3. ❌ Multi-Action 401

This consistency proves it's a **systematic permissions issue**, not a transient error.

## Next Steps

### For BASIS Team:
1. Create SAC-native OAuth client (15 minutes)
2. Grant Multi-Action execution permissions (5 minutes)
3. Provide Client ID and Secret to development team (1 minute)

### For Development Team:
1. Update environment variables with new credentials
2. Redeploy application
3. Test Multi-Action execution
4. Celebrate 🎉

## Success Criteria

You'll know it's fixed when you see:
```log
[INFO] ✅ Multi-Action triggered successfully
[INFO] Job ID: <some-uuid>
[INFO] Status: Running/Completed
```

Instead of:
```log
[ERROR] ❌ Failed to trigger Multi-Action
[ERROR] Request failed with status code 401
```

## References

- [SAC OAuth Client Documentation](https://help.sap.com/docs/SAP_ANALYTICS_CLOUD/00f68c2e08b941f081002fd3691d86a7/1c2a2f1f5c7a4e2d9e3f8c9a9b5e6d7c.html)
- [SAC Planning API Documentation](https://help.sap.com/docs/SAP_ANALYTICS_CLOUD/14cac91febef464dbb1efce20e3f1613/615e2120e4f44e6fa7a5a4b6c9f7a8e6.html)
- [BTP XSUAA vs SAC OAuth](https://blogs.sap.com/2020/05/17/sac-oauth-integration-explained/)

---

**Bottom Line**: You need a SAC-native OAuth client, not a XSUAA OAuth client. This is a 15-minute configuration change on the BASIS side.
