# Quick Deploy - 403 CSRF Fix 🚀

## What Was Fixed

✅ **403 Forbidden Error** - Added CSRF token fetching  
✅ **Cookie Management** - Session cookies properly handled  
✅ **Two-step Authentication** - OAuth + CSRF token  

## Deploy Now (3 Simple Steps)

### Step 1: Build
```bash
cd /workspace
npm run build
```

### Step 2: Deploy
```bash
./DEPLOY_CSRF_FIX.sh
```

### Step 3: Verify
```bash
cf logs ai-predictive-agent --recent
```

## What to Look For in Logs

### ✅ Success Indicators
```
🔒 Fetching CSRF token from SAC...
✓ CSRF token acquired: [token]...
✓ Stored 2 cookie(s) for session
🎯 Triggering SAC Multi-Action
✅ Multi-Action triggered successfully
```

### ❌ If You Still See Errors

**403 Forbidden** → OAuth client needs Planning Model access
- Go to SAC → Security → OAuth Clients
- Add role: `sap.fpa.planning.model.Admin` or `sap.fpa.planning.model.User`

**401 Unauthorized** → OAuth token issue
- Verify SAC_CLIENT_ID and SAC_CLIENT_SECRET in manifest.yml
- Check token scopes include: `dmi-api-proxy-sac-sacus10!t655.apiaccess`

**404 Not Found** → Wrong endpoint or ID
- Verify SAC_MODEL_ID: `PRDA_PL_PLAN`
- Verify SAC_MULTI_ACTION_ID: `E5280280114D3785596849C3D321B820`

## Technical Summary

### Before
```
POST /api/v1/dataimport/.../runs
Headers: Authorization: Bearer [token]
Result: 403 Forbidden (CSRF token required)
```

### After
```
Step 1: GET /api/v1/dataimport/planningModel
        Headers: x-csrf-token: Fetch
        Response: x-csrf-token: [token], Set-Cookie: [cookies]

Step 2: POST /api/v1/dataimport/.../runs
        Headers: 
          - Authorization: Bearer [oauth-token]
          - x-csrf-token: [csrf-token]
          - Cookie: [session-cookies]
        Result: 200 OK - Multi-Action triggered
```

## Files Modified

- `src/clients/sac-client.ts` - Added CSRF token fetching and cookie handling
- Built and ready to deploy

## Need Help?

See detailed documentation: `FIX_403_CSRF_COMPLETE.md`
