# SAC Authentication Fix Guide

## Problem Summary

Your application is receiving **401 Unauthorized** errors when calling the SAC Multi-Action API. The logs show:

```
[ERROR] Failed to trigger Multi-Action: ["Request failed with status code 401"]
[ERROR] SAC API Error: [{"status":401,"statusText":"Unauthorized",...}]
```

**Root Cause**: The application was using basic authentication (username/password), but SAP Analytics Cloud requires **OAuth 2.0 authentication** with client credentials.

---

## Changes Made

### 1. Updated SAC Client (`src/clients/sac-client.ts`)
- ✅ Implemented OAuth 2.0 client credentials flow
- ✅ Added automatic token refresh mechanism
- ✅ Fixed Multi-Action endpoint to match actual SAC API format:
  - Old: `/api/v1/multiactions/{id}/trigger`
  - New: `/api/v1/dataimport/planningModel/{modelId}/multiActions/{actionId}/runs`

### 2. Updated Configuration (`src/config.ts`)
- ✅ Changed from `SAC_USERNAME/SAC_PASSWORD` to `SAC_CLIENT_ID/SAC_CLIENT_SECRET`
- ✅ Added Multi-Action ID default: `E5280280114D3785596849C3D321B820`

### 3. Updated Type Definitions (`src/types/index.ts`)
- ✅ Updated Config interface to use OAuth credentials

### 4. Updated Environment Template (`.env.example`)
- ✅ Updated with OAuth credential placeholders

---

## Required Actions to Fix 401 Error

### Step 1: Obtain OAuth Credentials from SAC

You need to create an OAuth client in SAP Analytics Cloud:

1. **Login to SAC**: Go to https://cvs-pharmacy-q.us10.hcs.cloud.sap

2. **Navigate to OAuth Clients**:
   - Click the menu (☰) → **System** → **Administration**
   - Select **App Integration**
   - Click **OAuth Clients**

3. **Create New OAuth Client**:
   - Click **+ Add a New OAuth Client**
   - **Name**: `AI Predictive Agent`
   - **Purpose**: `Interactive Usage and API Access`
   - **Authorization Grant**: `Client Credentials`
   - **Access**: Check these permissions:
     - ✅ Data Import Service
     - ✅ Planning
     - ✅ Multi-Action Service

4. **Copy Credentials**:
   - **Client ID**: Copy and save this (e.g., `sb-12345678-abcd-efgh-ijkl-mnopqrstuvwx`)
   - **Client Secret**: Copy and save this immediately (you won't see it again!)
   - **Token URL**: Note the OAuth token endpoint (usually ends with `/oauth/token`)

### Step 2: Set Environment Variables in Cloud Foundry

Update the Cloud Foundry environment variables with your OAuth credentials:

```bash
# Set SAC OAuth credentials
cf set-env ai-predictive-agent SAC_CLIENT_ID "your-actual-client-id"
cf set-env ai-predictive-agent SAC_CLIENT_SECRET "your-actual-client-secret"

# Verify Multi-Action ID is set (from logs it's E5280280114D3785596849C3D321B820)
cf set-env ai-predictive-agent SAC_MULTI_ACTION_ID "E5280280114D3785596849C3D321B820"

# Verify other required variables
cf set-env ai-predictive-agent SAC_TENANT_URL "https://cvs-pharmacy-q.us10.hcs.cloud.sap"
cf set-env ai-predictive-agent SAC_MODEL_ID "PRDA_PL_PLAN"
```

### Step 3: Redeploy the Application

Deploy the updated code to Cloud Foundry:

```bash
# Build the application
npm run build

# Deploy to Cloud Foundry
cf push ai-predictive-agent

# Or use the deploy script if available
./deploy.sh
```

### Step 4: Verify the Fix

After redeployment, test the application:

1. **Check Recent Logs**:
   ```bash
   cf logs ai-predictive-agent --recent
   ```
   
   Look for:
   - ✅ `Successfully obtained OAuth access token`
   - ✅ `Multi-Action triggered successfully`
   - ❌ No more `401 Unauthorized` errors

2. **Test the API**:
   ```bash
   curl -X POST https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/api/forecast/query \
     -H "Content-Type: application/json" \
     -d '{"query": "Create 6 month forecast for GL 500100"}'
   ```

3. **Check Widget Integration**:
   - Open SAC Story: https://cvs-pharmacy-q.us10.hcs.cloud.sap
   - Test the AI Predictive Agent widget
   - Verify forecast requests are processed successfully

---

## OAuth Token URL

The application automatically detects the correct OAuth token endpoint based on your SAC tenant URL.

For tenant: `https://cvs-pharmacy-q.us10.hcs.cloud.sap`
The OAuth token URL is: `https://cvs-pharmacy-q.authentication.us10.hana.ondemand.com/oauth/token`

If you need to override this, set the `SAC_OAUTH_TOKEN_URL` environment variable:
```bash
cf set-env ai-predictive-agent SAC_OAUTH_TOKEN_URL "https://your-custom-oauth-endpoint/oauth/token"
```

---

## Troubleshooting

### Still Getting 401 Errors?

1. **Verify OAuth Client Permissions**:
   - Ensure the OAuth client has "Data Import Service" and "Multi-Action Service" permissions
   - Check that the client is "Enabled"

2. **Check Token Endpoint**:
   - The OAuth token URL might be different from `{tenantUrl}/oauth/token`
   - Contact SAC administrator or check SAC documentation for the correct endpoint

3. **Verify Multi-Action ID**:
   - Confirm `E5280280114D3785596849C3D321B820` is the correct Multi-Action ID
   - You can find this in SAC under Data Management → Multi-Actions

4. **Check Environment Variables**:
   ```bash
   cf env ai-predictive-agent
   ```
   Verify all required variables are set correctly

5. **Enable Debug Logging**:
   ```bash
   cf set-env ai-predictive-agent LOG_LEVEL "debug"
   cf restage ai-predictive-agent
   ```
   Then check logs for more detailed error messages

### OAuth Token Issues?

If you see errors like "Failed to get OAuth access token":

1. Verify the OAuth client credentials are correct
2. Check that the OAuth client has the required scopes
3. Ensure the token endpoint URL is correct
4. Contact your SAC administrator for assistance

---

## Summary

✅ **Code Updated**: OAuth 2.0 authentication implemented  
⏳ **Action Required**: Obtain OAuth credentials from SAC  
⏳ **Action Required**: Set environment variables in Cloud Foundry  
⏳ **Action Required**: Redeploy application  

Once you complete these steps, the 401 Unauthorized errors should be resolved and your application will successfully trigger SAC Multi-Actions.

---

## Quick Reference: Required Environment Variables

```bash
# OAuth Credentials (REQUIRED - obtain from SAC)
SAC_CLIENT_ID=sb-your-client-id
SAC_CLIENT_SECRET=your-client-secret

# SAC Configuration
SAC_TENANT_URL=https://cvs-pharmacy-q.us10.hcs.cloud.sap
SAC_MODEL_ID=PRDA_PL_PLAN
SAC_MULTI_ACTION_ID=E5280280114D3785596849C3D321B820

# OpenAI (if not already set)
OPENAI_API_KEY=sk-your-openai-key

# Server Configuration
API_KEY=your-api-key
ALLOWED_ORIGIN=https://cvs-pharmacy-q.us10.hcs.cloud.sap
```

---

**Need Help?** Contact your SAC administrator or SAP support for assistance with OAuth client creation.
