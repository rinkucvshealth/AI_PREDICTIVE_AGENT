# SAC OAuth Credentials Setup - 401 Error Fix

## Root Cause
The current `SAC_CLIENT_ID` and `SAC_CLIENT_SECRET` are **BTP XSUAA credentials**, not SAC OAuth credentials.

SAC's Multi-Action API requires OAuth credentials created **directly in SAC**, not BTP platform credentials.

## Current (Wrong) Credentials Format
```
SAC_CLIENT_ID: sb-d0a25928-2a38-4862-ab82-bc4f8529aab7!b563143|client!b655
SAC_CLIENT_SECRET: 9a81d84e-1277-4ccb-95fd-7db0f60f15e7$...
```
☝️ These are BTP/XSUAA credentials (notice the `sb-...!b...|client!b...` format)

## Required: SAC OAuth Credentials Format
```
SAC_CLIENT_ID: <simple alphanumeric string>
SAC_CLIENT_SECRET: <simple alphanumeric string>
```
☝️ SAC OAuth credentials are simpler format without the complex suffixes

---

## Step-by-Step Fix

### Step 1: Create OAuth Client in SAC

1. **Login to SAC** as an administrator:
   ```
   https://cvs-pharmacy-q.us10.hcs.cloud.sap
   ```

2. **Navigate to OAuth Clients**:
   - Click the **Menu** (☰) → **System** → **Administration**
   - Click **App Integration** (left sidebar)
   - Click **OAuth Clients** tab

3. **Create New OAuth Client**:
   - Click **Add a New OAuth Client**
   - Fill in the details:
     ```
     Name: AI Predictive Agent
     Description: OAuth client for AI-driven forecast multi-actions
     Purpose: Interactive Usage and API Access
     Access: Confidential (for server-to-server communication)
     ```

4. **Set Grant Type**:
   - ✅ Check **Client Credentials** (this is required!)
   - ❌ Uncheck other grant types

5. **Set Authorization Scopes** (CRITICAL):
   You need to enable these scopes:
   - ✅ **Data Import Service** (for Multi-Actions)
   - ✅ **Planning** (for Planning Model access)
   - ✅ **Multi-Action Service** (if available)
   - ✅ **Planning Model** (if available)
   
   *Note: The exact scope names may vary by SAC version. Look for scopes related to:*
   - Planning
   - Data Import
   - Multi-Actions
   - Model Management

6. **Save and Copy Credentials**:
   - Click **Add**
   - ⚠️ **IMPORTANT**: SAC will display the **Client Secret ONLY ONCE**
   - Copy both:
     - OAuth Client ID
     - Secret
   - Store them securely (you can't retrieve the secret later!)

### Step 2: Update Cloud Foundry Environment Variables

```bash
# Set the NEW SAC OAuth credentials
cf set-env ai-predictive-agent SAC_CLIENT_ID "<your-sac-oauth-client-id>"
cf set-env ai-predictive-agent SAC_CLIENT_SECRET "<your-sac-oauth-client-secret>"

# Restart the app to pick up new credentials
cf restart ai-predictive-agent
```

### Step 3: Verify the Fix

```bash
# Check recent logs
cf logs ai-predictive-agent --recent

# Look for these SUCCESS indicators:
# ✅ [INFO] Fetching new OAuth access token from SAC
# ✅ [INFO] Using OAuth token endpoint: https://cvs-pharmacy-q.authentication.us10.hana.ondemand.com/oauth/token
# ✅ [INFO] Successfully obtained OAuth access token
# ✅ [INFO] Multi-Action triggered successfully
```

### Step 4: Test with a Forecast Request

Test from the SAC Widget:
```
"Create 6 month forecast for GL 500100"
```

**Expected Success Response**:
```json
{
  "success": true,
  "summary": "Forecast initiated for GL Account 500100 (6 months) → Version: Forecast_20251205",
  "details": {
    "glAccount": "500100",
    "forecastPeriod": 6,
    "versionName": "Forecast_20251205",
    "multiActionStatus": "success"
  }
}
```

---

## Troubleshooting

### Issue: Still Getting 401 After Creating SAC OAuth Client

**Check 1: Verify OAuth Client is Enabled**
- Go back to SAC → OAuth Clients
- Ensure the client status is **Enabled** (not Disabled)

**Check 2: Verify Scopes/Permissions**
The OAuth client MUST have these permissions:
- Planning access
- Data Import access
- Multi-Action execution rights

**Check 3: Check OAuth Token URL**
Verify the token URL is correct:
```bash
cf env ai-predictive-agent | grep SAC_OAUTH_TOKEN_URL
```
Should be:
```
SAC_OAUTH_TOKEN_URL: https://cvs-pharmacy-q.authentication.us10.hana.ondemand.com/oauth/token
```

**Check 4: Enable Debug Logging**
```bash
cf set-env ai-predictive-agent LOG_LEVEL debug
cf restart ai-predictive-agent
```

Then check logs for OAuth token request/response details:
```bash
cf logs ai-predictive-agent --recent | grep -i oauth
```

### Issue: OAuth Token Fetch Fails

**Error**: `Failed to get OAuth access token`

**Possible Causes**:
1. **Wrong Token URL** - Must use `.authentication.{region}.hana.ondemand.com/oauth/token`
2. **Wrong Client ID/Secret** - Double-check you copied them correctly
3. **OAuth Client Disabled** - Enable it in SAC
4. **Missing Grant Type** - Ensure "Client Credentials" is enabled

**Debug Commands**:
```bash
# Check if credentials are set
cf env ai-predictive-agent | grep SAC_CLIENT

# Watch live logs during test
cf logs ai-predictive-agent
```

---

## Key Differences: BTP vs SAC OAuth

| Aspect | BTP/XSUAA Credentials | SAC OAuth Credentials |
|--------|----------------------|----------------------|
| **Created In** | BTP Cockpit → Service Instance | SAC Admin → OAuth Clients |
| **Format** | `sb-xxx!bxxx\|client!bxxx` | Simple alphanumeric string |
| **Purpose** | BTP service-to-service auth | SAC API access |
| **Used For** | BTP services (HANA, etc.) | SAC APIs (Multi-Actions, Planning) |
| **Works with SAC API?** | ❌ NO | ✅ YES |

---

## Summary

**Current Problem**:
- Using BTP XSUAA credentials instead of SAC OAuth credentials
- OAuth token fetch returns `null` → No Bearer token sent → 401 Unauthorized

**Solution**:
1. Create OAuth Client in **SAC Admin Console** (not BTP Cockpit)
2. Enable **Client Credentials** grant type
3. Add required **scopes** (Planning, Data Import, Multi-Action)
4. Copy the **Client ID** and **Secret**
5. Update Cloud Foundry environment variables
6. Restart the app

**Expected Result**:
```
[INFO] Fetching new OAuth access token from SAC
[INFO] Successfully obtained OAuth access token  ← This is KEY!
[INFO] Multi-Action triggered successfully
```

---

## Quick Reference

### SAC OAuth Client Settings
```
Name: AI Predictive Agent
Grant Type: Client Credentials ✅
Scopes: 
  - Data Import Service ✅
  - Planning ✅
  - Multi-Action Service ✅
```

### Cloud Foundry Commands
```bash
# Set credentials
cf set-env ai-predictive-agent SAC_CLIENT_ID "<sac-client-id>"
cf set-env ai-predictive-agent SAC_CLIENT_SECRET "<sac-client-secret>"

# Restart
cf restart ai-predictive-agent

# Check logs
cf logs ai-predictive-agent --recent | grep -E "(OAuth|401|ERROR|SUCCESS)"
```

---

**Status**: 🔴 Action Required
**Priority**: Critical
**Estimated Time**: 15 minutes (if you have SAC admin access)
