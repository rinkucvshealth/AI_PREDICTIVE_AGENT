# Multi-Action 404 Error - Troubleshooting Guide

## Current Status

✅ **OAuth Authentication**: Working perfectly with refresh token  
✅ **CSRF Token Acquisition**: Successful  
❌ **Multi-Action Execution**: All endpoints returning 404

## Error Details

All three Multi-Action API endpoints are returning 404:

1. `/api/v1/multiActions/E5280280114D3785596849C3D321B820/executions` → 404
2. `/api/v1/dataimport/planningModel/PRDA_PL_PLAN/jobs` → 404
3. `/api/v1/dataimport/planningModel/PRDA_PL_PLAN/multiActions/E5280280114D3785596849C3D321B820/runs` → 404

## Root Cause Analysis

The 404 errors indicate one of these issues:

### 1. ❌ Incorrect Multi-Action ID
The Multi-Action ID `E5280280114D3785596849C3D321B820` might be:
- Not the correct ID for the QA environment
- From a different SAC tenant
- Incorrectly formatted

### 2. ❌ Multi-Action Not Configured for API Access
The Multi-Action might exist in SAC but not be enabled for external API calls.

**Required Setting**: In SAC Multi-Action configuration:
- ✅ Enable "Allow External API Access"

### 3. ❌ Multi-Action API Not Available
The Multi-Action API endpoints might not be available in the QA environment due to:
- SAC version/license limitations
- Feature flags not enabled
- Different API paths for your SAC version

## Diagnostic Steps

### Step 1: Use Discovery Endpoints

I've added diagnostic endpoints to help identify the issue:

#### 1.1 Discover Available Endpoints

```bash
curl -X GET https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/api/forecast/discover-endpoints
```

This will test multiple SAC API endpoints and show which ones are available.

#### 1.2 List All Multi-Actions

```bash
curl -X GET https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/api/forecast/list-multiactions
```

This will attempt to list all Multi-Actions to verify:
- If Multi-Action API is available
- What Multi-Actions exist
- The correct Multi-Action ID format

### Step 2: Verify Multi-Action Configuration in SAC

Ask the BASIS team to verify in SAC:

1. **Navigate to the Multi-Action**:
   ```
   SAC → Stories/Applications → Open the story with the Multi-Action
   → Edit → Select the Multi-Action
   ```

2. **Get the Correct Multi-Action ID**:
   - Look for the Multi-Action ID in the properties/settings
   - The ID format should be like: `E5280280114D3785596849C3D321B820`
   - Or it might be in a different format: `packageId:objectId`

3. **Check "Allow External API Access"**:
   - In Multi-Action settings, ensure this option is enabled
   - Without this, the Multi-Action cannot be triggered via API

4. **Verify Model Association**:
   - Confirm the Multi-Action is associated with model: `PRDA_PL_PLAN`
   - Check that the model ID is correct in the QA environment

### Step 3: Alternative - Use SAC Analytics Designer API

If Multi-Action API is not available, there might be alternative approaches:

#### Option A: Analytics Designer API
Some SAC versions require using the Analytics Designer API:

```javascript
POST /api/v1/stories/{storyId}/executions
{
  "action": "multiAction",
  "multiActionId": "...",
  "parameters": { ... }
}
```

#### Option B: Data Action API
If Multi-Action is actually a Data Action:

```javascript
POST /api/v1/dataactions/{dataActionId}/execute
{
  "parameters": { ... }
}
```

#### Option C: Planning Function API
If using planning functions instead:

```javascript
POST /api/v1/planningfunctions/{functionId}/execute
{
  "parameters": { ... }
}
```

## Required Information from BASIS Team

Please ask the BASIS team to provide:

### 1. Verify Multi-Action Exists

In SAC, navigate to:
```
System → Administration → Multi-Actions
```

Or in the Story/Application where the Multi-Action is defined.

Confirm:
- ✅ Multi-Action exists
- ✅ Multi-Action name: `_____________`
- ✅ Multi-Action ID: `_____________`
- ✅ Associated Model: `PRDA_PL_PLAN`
- ✅ "Allow External API Access" is enabled

### 2. Get the Correct API Path

They can test in SAC directly:
1. Open Browser Developer Tools (F12)
2. Go to Network tab
3. Execute the Multi-Action manually in SAC
4. Look for the API call in the Network tab
5. Share the exact URL and payload used

### 3. Check SAC Version and Features

Confirm:
- SAC version: `_____________`
- License type: `_____________`
- Is Multi-Action API available? `_____________`
- Alternative APIs available? `_____________`

## Next Steps

### Immediate Actions:

1. **Run the discovery endpoints** (after deployment):
   ```bash
   # Test endpoint discovery
   curl https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/api/forecast/discover-endpoints

   # List Multi-Actions
   curl https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/api/forecast/list-multiactions
   ```

2. **Share results** with BASIS team for analysis

3. **BASIS team to verify** Multi-Action configuration in SAC

### After Getting Correct Information:

Once we have the correct Multi-Action ID and API path, we'll:
1. Update the `SAC_MULTI_ACTION_ID` environment variable
2. Adjust the API endpoint paths if needed
3. Test the Multi-Action execution again

## Configuration Check

Current configuration in Cloud Foundry:

```bash
# Check current environment variables
cf env ai-predictive-agent | grep SAC_
```

Expected values:
```
SAC_TENANT_URL: https://cvs-pharmacy-q.us10.hcs.cloud.sap
SAC_MODEL_ID: PRDA_PL_PLAN
SAC_MULTI_ACTION_ID: E5280280114D3785596849C3D321B820 (← VERIFY THIS)
SAC_CLIENT_ID: sb-2c3a1567...
SAC_CLIENT_SECRET: ***
SAC_REFRESH_TOKEN: *** (✅ Working)
```

## Deployment Instructions

To deploy the diagnostic endpoints:

```bash
# Build the application
npm run build

# Deploy to Cloud Foundry
cf push

# Wait for deployment to complete
# Then run the diagnostic endpoints
```

## References

- SAP Help: https://help.sap.com/docs/SAP_ANALYTICS_CLOUD/
- Multi-Action API Documentation: https://help.sap.com/docs/SAP_ANALYTICS_CLOUD/14cac91febef464dbb1efce20e3f1613/
- SAP Community: https://community.sap.com/

## Contact

After running the diagnostic endpoints, please share:
1. Discovery endpoint results
2. Multi-Actions list results
3. Information from BASIS team about Multi-Action configuration

This will help us identify the exact issue and implement the correct solution.
