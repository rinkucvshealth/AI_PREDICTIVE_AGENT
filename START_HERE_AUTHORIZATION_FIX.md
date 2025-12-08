# 🚨 START HERE: SAC Authorization Fix

## What's Happening

Your application gets **401 Unauthorized** errors when executing SAC Multi-Actions, even though OAuth authentication succeeds. This error keeps happening repeatedly.

## Why It Keeps Happening

You're using the **wrong TYPE** of OAuth client:

```
Current Setup (XSUAA)          Needed Setup (SAC OAuth)
━━━━━━━━━━━━━━━━━━━━━         ━━━━━━━━━━━━━━━━━━━━━━━
✅ Can authenticate            ✅ Can authenticate
✅ Can get CSRF tokens         ✅ Can get CSRF tokens
❌ CANNOT execute Multi-Actions ✅ CAN execute Multi-Actions
```

**Analogy**: You have a valid visitor badge (XSUAA) but need an employee keycard (SAC OAuth) to access the secure server room (Multi-Actions).

## The 15-Minute Fix

### Step 1: BASIS Team Creates SAC OAuth Client (10 minutes)

**Guide**: Open `BASIS_TEAM_ACTION_GUIDE.md` and follow the steps.

**Quick Version**:
1. Log into SAC: https://cvs-pharmacy-q.us10.hcs.cloud.sap
2. Navigate to: Main Menu → System → Administration → App Integration → OAuth Clients
3. Click "Add a New OAuth Client"
4. Configure:
   - Name: AI Predictive Agent
   - Grant Type: Client Credentials
   - Scopes: ✓ Planning Model API, ✓ Multi-Action Execution
5. Save and copy the Client ID and Secret (**IMPORTANT**: You only see the secret once!)
6. Share credentials securely with dev team

### Step 2: Development Team Updates Configuration (5 minutes)

**After receiving new credentials from BASIS team**:

```bash
# Update environment variables in Cloud Foundry
cf set-env ai-predictive-agent SAC_CLIENT_ID "<new-oauth-client-id>"
cf set-env ai-predictive-agent SAC_CLIENT_SECRET "<new-oauth-client-secret>"
cf set-env ai-predictive-agent SAC_OAUTH_TOKEN_URL "https://cvs-pharmacy-q.us10.hcs.cloud.sap/oauth/token"

# Restart application
cf restage ai-predictive-agent
```

### Step 3: Verify the Fix (2 minutes)

Run the verification script:
```bash
./verify-oauth-setup.sh
```

Or test manually:
```bash
# Try to trigger a forecast through the UI
# You should see:
[INFO] ✅ Multi-Action triggered successfully
# Instead of:
[ERROR] ❌ 401 Unauthorized
```

## Documentation Overview

| File | What It's For | Who Reads It |
|------|--------------|--------------|
| **START_HERE_AUTHORIZATION_FIX.md** (this file) | Quick overview and action items | Everyone |
| **BASIS_TEAM_ACTION_GUIDE.md** | Detailed step-by-step instructions | BASIS Team |
| **AUTHORIZATION_ROOT_CAUSE_ANALYSIS.md** | Technical deep dive | Technical folks |
| **WHAT_IS_REALLY_HAPPENING.md** | Plain English explanation | Non-technical stakeholders |
| **README_AUTHORIZATION_FIX.md** | Comprehensive reference | Everyone |

## Quick Q&A

### Q: Why can't we just fix the code?
**A**: The code is correct. This is an infrastructure/configuration issue, not a code issue.

### Q: Why can't we add scopes to the existing XSUAA client?
**A**: XSUAA and SAC use different authorization systems. XSUAA cannot provide SAC-level permissions.

### Q: Are the current credentials wrong?
**A**: No, they're valid for XSUAA authentication. We just need DIFFERENT credentials for SAC API access.

### Q: Will this affect existing functionality?
**A**: No. This creates a NEW OAuth client. Existing authentication continues to work.

### Q: How long until it's fixed?
**A**: ~15-20 minutes once BASIS team starts working on it.

### Q: What if it still doesn't work after the fix?
**A**: 
1. Run `./verify-oauth-setup.sh` to check configuration
2. Read AUTHORIZATION_ROOT_CAUSE_ANALYSIS.md for troubleshooting
3. Contact SAP Support (Component: CA-EPM-ANA-PLC)

## Evidence from Logs

Your logs show this pattern repeatedly:

```log
✅ [INFO] ✓ Token acquired: eyJ0eXAiOiJKV1QiLCJq...
✅ [INFO] ✓ CSRF token acquired: qAEDFCCqXbLmygFg_7dO...
✅ [INFO] Attempting endpoint: Generic Multi-Action Trigger
❌ [ERROR] Request failed with status code 401
❌ [ERROR] Response: {"status":401,"statusText":"Unauthorized"}
```

This proves:
- Authentication works (getting tokens) ✅
- Authorization fails (executing Multi-Actions) ❌

## What BASIS Team Needs to Know

**Share this with BASIS team**:

> We need a SAC-native OAuth client created in the SAC UI (not BTP Cockpit). The current XSUAA credentials authenticate successfully but lack authorization scopes for Multi-Action execution. This is causing persistent 401 errors. Creating a SAC OAuth client takes ~15 minutes and is documented in BASIS_TEAM_ACTION_GUIDE.md.

## Application Updates

The application code has been updated to:
1. ✅ Detect XSUAA-only tokens automatically
2. ✅ Warn when token lacks Multi-Action scopes
3. ✅ Provide actionable error messages on 401 errors
4. ✅ Point to solution documentation

You'll now see helpful warnings like:

```log
⚠️  WARNING: Token Analysis Detected Potential Issue ⚠️
Token has XSUAA scopes but lacks Multi-Action execution scopes.
This will cause 401 Unauthorized errors on Multi-Action execution.

🔧 SOLUTION: Create SAC-native OAuth client
   Location: SAC → System → Administration → OAuth Clients
```

## Next Steps

### 🎯 Immediate Action Required

1. **BASIS Team**: Read and execute `BASIS_TEAM_ACTION_GUIDE.md` (15 min)
2. **Dev Team**: Wait for new credentials, then update app (5 min)
3. **Both Teams**: Verify with `./verify-oauth-setup.sh`
4. **Test**: Trigger a forecast and confirm success

### 📅 Timeline

| Time | Action | Owner |
|------|--------|-------|
| Now | Read START_HERE document | Both teams |
| +5 min | Read BASIS_TEAM_ACTION_GUIDE.md | BASIS Team |
| +15 min | Create SAC OAuth client | BASIS Team |
| +17 min | Share credentials securely | BASIS Team |
| +20 min | Update app configuration | Dev Team |
| +23 min | Redeploy application | Dev Team |
| +25 min | Test and verify | Dev Team |

**Total Time: ~25 minutes from start to verified fix**

## Success Criteria

✅ Fix is successful when you see:
```log
[INFO] ✅ Multi-Action triggered successfully
[INFO] ✅ Job ID: 12345-67890-abcdef
[INFO] ✅ Status: Running/Completed
```

❌ Not fixed if you still see:
```log
[ERROR] ❌ 401 Unauthorized
```

## Help & Support

### Documentation
- Full technical analysis: `AUTHORIZATION_ROOT_CAUSE_ANALYSIS.md`
- Step-by-step guide: `BASIS_TEAM_ACTION_GUIDE.md`
- Plain English: `WHAT_IS_REALLY_HAPPENING.md`
- Quick reference: `README_AUTHORIZATION_FIX.md`

### Scripts
- Verification: `./verify-oauth-setup.sh`
- Build: `npm run build`
- Deploy: `cf push`

### SAP Support
- Portal: https://support.sap.com
- Component: CA-EPM-ANA-PLC (SAC Planning)
- Priority: High (business functionality blocked)

---

## Bottom Line

**Problem**: Wrong type of OAuth client (XSUAA instead of SAC OAuth)  
**Solution**: Create SAC-native OAuth client with Multi-Action permissions  
**Time**: 15-25 minutes  
**Impact**: Fixes 401 errors permanently  
**Action**: BASIS team creates OAuth client → Dev team updates config → Deploy  

**START WITH**: Have BASIS team read `BASIS_TEAM_ACTION_GUIDE.md` and create the OAuth client.
