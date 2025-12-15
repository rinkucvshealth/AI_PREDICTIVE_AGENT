# Diagnostic Deployment Instructions - Multi-Action 404 Fix

## Summary of Changes

I've added **diagnostic endpoints** to help identify why all Multi-Action API endpoints are returning 404 errors.

### What's Working ✅
- OAuth authentication with refresh token
- CSRF token acquisition
- Application startup and health

### What's Failing ❌
- All Multi-Action API endpoints returning 404
- This indicates either:
  - Wrong Multi-Action ID
  - Multi-Action not configured for API access
  - Multi-Action API not available in the environment

## New Diagnostic Endpoints Added

### 1. Discover Endpoints
**URL**: `GET /api/forecast/discover-endpoints`

**Purpose**: Tests multiple SAC API endpoints to discover what's available

**What it checks**:
- Multi-Action API endpoints
- Planning Model API endpoints  
- Data Import API endpoints
- Model API endpoints

**Response includes**:
- Which endpoints are available (200-299)
- Which return authentication errors (401/403)
- Which are not found (404)
- Recommendations based on findings

### 2. List Multi-Actions
**URL**: `GET /api/forecast/list-multiactions`

**Purpose**: Attempts to list all Multi-Actions in the system

**What it does**:
- Tries different API paths to find Multi-Actions
- Returns list of available Multi-Actions
- Helps verify the correct Multi-Action ID

## Deployment Steps

### Step 1: Deploy to Cloud Foundry

```bash
# Make sure you're in the project directory
cd /workspace

# Push to Cloud Foundry (build is already done)
cf push
```

### Step 2: Wait for Deployment

The application will be deployed and started. Wait for:
```
App started
```

### Step 3: Run Diagnostic Endpoints

Once deployed, run these diagnostic commands:

#### 3.1 Test Endpoint Discovery

```bash
curl -X GET "https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/api/forecast/discover-endpoints" | jq .
```

This will show:
- ✅ Which SAC API endpoints are accessible
- ❌ Which endpoints return 404
- 🔒 Which require different permissions
- 💡 Recommendations for next steps

#### 3.2 List Available Multi-Actions

```bash
curl -X GET "https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/api/forecast/list-multiactions" | jq .
```

This will show:
- All Multi-Actions available via API
- The correct Multi-Action ID format
- Which API endpoint works for listing Multi-Actions

### Step 4: Share Results with BASIS Team

Save the output from both diagnostic endpoints and share with the BASIS team.

**Questions for BASIS Team**:

1. **Multi-Action ID Verification**:
   - Is `E5280280114D3785596849C3D321B820` the correct Multi-Action ID?
   - Can you confirm this ID exists in the QA environment?
   - What is the Multi-Action name?

2. **Multi-Action Configuration**:
   - In SAC, open the Multi-Action settings
   - Is "Allow External API Access" enabled?
   - Is it associated with model `PRDA_PL_PLAN`?

3. **Alternative Method**:
   - In SAC, open Browser DevTools (F12)
   - Execute the Multi-Action manually
   - Look at the Network tab for the API call
   - What URL and payload does SAC use internally?

## Expected Outcomes

### Scenario A: Multi-Action ID is Wrong
**Discovery shows**: Other Multi-Action endpoints return 200, but not the one with ID `E5280280114D3785596849C3D321B820`

**Solution**: 
- Get correct Multi-Action ID from list-multiactions endpoint or BASIS team
- Update CF environment variable:
  ```bash
  cf set-env ai-predictive-agent SAC_MULTI_ACTION_ID "<correct-id>"
  cf restage ai-predictive-agent
  ```

### Scenario B: Multi-Action API Not Available
**Discovery shows**: All Multi-Action endpoints return 404, but Model/Planning endpoints work

**Solution**:
- Multi-Action API might not be enabled in this SAC environment
- Check SAC license and feature flags with BASIS team
- May need to use alternative API (Data Actions, Planning Functions)

### Scenario C: Different API Path Structure
**Discovery shows**: Some planning-related endpoints work but with different paths

**Solution**:
- Update the API endpoint paths in the code based on what works
- Might need to use a different SAC API version

### Scenario D: Permission Issues
**Discovery shows**: Endpoints return 401/403 instead of 404

**Solution**:
- OAuth token lacks required scopes
- User needs additional SAC permissions
- Multi-Action needs "Allow External API Access" enabled

## Troubleshooting Tips

### If Discovery Endpoints Don't Work

Check application logs:
```bash
cf logs ai-predictive-agent --recent | grep -E "discover|multiaction"
```

### If All Endpoints Return 401

The refresh token might have expired:
```bash
# Re-authenticate via /oauth/login to get new refresh token
open https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/oauth/login

# After authentication, update the CF environment variable
cf set-env ai-predictive-agent SAC_REFRESH_TOKEN "<new-token>"
cf restage ai-predictive-agent
```

### Check Current Configuration

```bash
# View all SAC-related environment variables
cf env ai-predictive-agent | grep SAC_
```

## Next Steps After Diagnosis

Once we have the diagnostic results:

1. **If correct Multi-Action ID is found**: Update environment variable and redeploy
2. **If API path is different**: Update code to use correct endpoints
3. **If Multi-Action API is not available**: Implement alternative approach (Data Actions, etc.)
4. **If configuration issue**: BASIS team fixes in SAC, then retest

## Files Changed

- `src/routes/forecast.ts` - Added diagnostic endpoints
- `src/clients/sac-client.ts` - Added discovery and list methods
- `MULTI_ACTION_404_TROUBLESHOOTING.md` - Detailed troubleshooting guide
- `DIAGNOSTIC_DEPLOYMENT_INSTRUCTIONS.md` - This file

## Quick Commands Reference

```bash
# Deploy
cf push

# Check logs
cf logs ai-predictive-agent --recent

# Test discovery
curl https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/api/forecast/discover-endpoints

# List Multi-Actions
curl https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/api/forecast/list-multiactions

# Check environment
cf env ai-predictive-agent | grep SAC_

# Update Multi-Action ID
cf set-env ai-predictive-agent SAC_MULTI_ACTION_ID "<new-id>"
cf restage ai-predictive-agent
```

## Summary

The diagnostic endpoints will help us:
1. ✅ Verify which SAC API endpoints are accessible
2. ✅ Discover the correct Multi-Action ID
3. ✅ Identify if Multi-Action API is available
4. ✅ Get recommendations for the next steps

**Action Required**: Deploy the application and run the diagnostic endpoints, then share results.
