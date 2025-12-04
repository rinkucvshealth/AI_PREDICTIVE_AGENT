# Quick Fix Commands - 401 Error Resolution

## 1. Set OAuth Credentials (REQUIRED)

```bash
# Replace with your actual OAuth credentials from SAC
cf set-env ai-predictive-agent SAC_CLIENT_ID "your-oauth-client-id"
cf set-env ai-predictive-agent SAC_CLIENT_SECRET "your-oauth-client-secret"
```

## 2. Verify Environment Variables

```bash
# Check current environment variables
cf env ai-predictive-agent

# Should show:
# SAC_CLIENT_ID: your-oauth-client-id
# SAC_CLIENT_SECRET: your-oauth-client-secret
# SAC_MULTI_ACTION_ID: E5280280114D3785596849C3D321B820
# SAC_TENANT_URL: https://cvs-pharmacy-q.us10.hcs.cloud.sap
# SAC_MODEL_ID: PRDA_PL_PLAN
```

## 3. Deploy Updated Code

```bash
# Build and deploy
npm run build
cf push ai-predictive-agent

# Monitor deployment
cf logs ai-predictive-agent --recent
```

## 4. Verify Fix

```bash
# Check logs for success
cf logs ai-predictive-agent --recent | grep -E "(OAuth|401|Multi-Action)"

# Expected: "Successfully obtained OAuth access token"
# Expected: "Multi-Action triggered successfully"
# Should NOT see: "401 Unauthorized"
```

## 5. Test API

```bash
# Test forecast endpoint
curl -X POST https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/api/forecast/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Create 6 month forecast for GL 500100"}'
```

## Quick Status Check

```bash
# One-liner to check app status and recent logs
cf app ai-predictive-agent && cf logs ai-predictive-agent --recent | tail -20
```

## Troubleshooting Commands

```bash
# If still getting 401 errors, check credentials are set
cf env ai-predictive-agent | grep -E "(CLIENT_ID|CLIENT_SECRET)"

# Enable debug logging
cf set-env ai-predictive-agent LOG_LEVEL "debug"
cf restage ai-predictive-agent

# Restart app without redeploying
cf restart ai-predictive-agent

# View all app info
cf app ai-predictive-agent
```

## Rollback (if needed)

```bash
# Rollback to previous version
cf rollback ai-predictive-agent
```

---

**Important**: You must obtain OAuth Client ID and Secret from SAC first!  
See `AUTH_FIX_GUIDE.md` for detailed instructions on creating OAuth client in SAC.
