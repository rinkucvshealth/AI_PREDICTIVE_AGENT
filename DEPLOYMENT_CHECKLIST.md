# 401 Error Fix - Deployment Checklist

## Pre-Deployment

- [ ] **Obtain OAuth Credentials from SAC**
  - Login to SAC: https://cvs-pharmacy-q.us10.hcs.cloud.sap
  - Navigate to: System → Administration → App Integration → OAuth Clients
  - Create new OAuth client with:
    - Name: `AI Predictive Agent`
    - Grant Type: `Client Credentials`
    - Permissions: ✅ Data Import Service, ✅ Planning, ✅ Multi-Action Service
  - Copy Client ID and Client Secret

- [ ] **Verify Multi-Action ID**
  - Current ID from logs: `E5280280114D3785596849C3D321B820`
  - Confirm this matches your Multi-Action in SAC

## Environment Variables Setup

Run these commands with your actual OAuth credentials:

```bash
# Set OAuth credentials
cf set-env ai-predictive-agent SAC_CLIENT_ID "your-client-id-here"
cf set-env ai-predictive-agent SAC_CLIENT_SECRET "your-client-secret-here"

# Verify other variables
cf set-env ai-predictive-agent SAC_MULTI_ACTION_ID "E5280280114D3785596849C3D321B820"
cf set-env ai-predictive-agent SAC_TENANT_URL "https://cvs-pharmacy-q.us10.hcs.cloud.sap"
cf set-env ai-predictive-agent SAC_MODEL_ID "PRDA_PL_PLAN"
```

- [ ] SAC_CLIENT_ID set
- [ ] SAC_CLIENT_SECRET set
- [ ] SAC_MULTI_ACTION_ID set
- [ ] SAC_TENANT_URL set
- [ ] SAC_MODEL_ID set

## Deployment

```bash
# 1. Build the application
npm run build

# 2. Deploy to Cloud Foundry
cf push ai-predictive-agent

# 3. Monitor deployment
cf logs ai-predictive-agent --recent
```

- [ ] Code built successfully
- [ ] Application deployed
- [ ] No build errors in logs

## Post-Deployment Verification

### 1. Check Application Logs

```bash
cf logs ai-predictive-agent --recent
```

**Expected Success Messages**:
- ✅ `SAC Client initialized for tenant`
- ✅ `Successfully obtained OAuth access token`
- ✅ `Multi-Action triggered successfully`

**Should NOT See**:
- ❌ `401 Unauthorized`
- ❌ `Failed to get OAuth access token`
- ❌ `Failed to trigger Multi-Action`

- [ ] Application started successfully
- [ ] No 401 errors in logs
- [ ] OAuth token obtained successfully

### 2. Test API Endpoint

```bash
curl -X POST https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/api/forecast/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Create 6 month forecast for GL 500100"}'
```

**Expected Response**:
```json
{
  "success": true,
  "summary": "Forecast initiated for GL Account 500100...",
  "details": {
    "glAccount": "500100",
    "forecastPeriod": 6,
    "versionName": "Forecast_20251204",
    "multiActionStatus": "success"
  }
}
```

- [ ] API returns success response
- [ ] No 401 or 500 errors

### 3. Test Widget in SAC

- [ ] Open SAC Story: https://cvs-pharmacy-q.us10.hcs.cloud.sap
- [ ] Load AI Predictive Agent widget
- [ ] Submit test query: "Create 6 month forecast for GL 500100"
- [ ] Verify forecast is triggered successfully
- [ ] Check Multi-Action execution in SAC

## Troubleshooting

If still getting 401 errors after deployment:

1. **Verify OAuth Client Configuration**:
   ```bash
   cf env ai-predictive-agent | grep SAC_
   ```
   - Ensure CLIENT_ID and CLIENT_SECRET are set
   - Check for typos or extra spaces

2. **Check OAuth Client in SAC**:
   - Is the OAuth client "Enabled"?
   - Does it have the required permissions?
   - Is it set to "Client Credentials" grant type?

3. **Enable Debug Logging**:
   ```bash
   cf set-env ai-predictive-agent LOG_LEVEL "debug"
   cf restage ai-predictive-agent
   cf logs ai-predictive-agent --recent
   ```

4. **Verify Token Endpoint**:
   - Default: `{tenantUrl}/oauth/token`
   - If different, update `src/clients/sac-client.ts`

## Rollback Plan

If issues persist:

```bash
# Rollback to previous version
cf rollback ai-predictive-agent

# Or redeploy from previous commit
git checkout <previous-commit>
cf push ai-predictive-agent
```

## Success Criteria

✅ Application deployed without errors  
✅ OAuth token obtained successfully  
✅ Multi-Action triggers without 401 errors  
✅ Widget functions correctly in SAC  
✅ Forecast requests complete successfully  

---

**Deployment Date**: _______________  
**Deployed By**: _______________  
**OAuth Client Created By**: _______________  
**Verification Complete**: [ ]  
