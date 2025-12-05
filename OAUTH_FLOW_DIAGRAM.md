# OAuth Authentication Flow - Current vs Required

## ❌ CURRENT (FAILING) FLOW

```
┌─────────────────┐
│  Your App       │
│  (Cloud         │
│   Foundry)      │
└────────┬────────┘
         │
         │ Uses BTP/XSUAA Credentials:
         │ SAC_CLIENT_ID: sb-d0a25928-...|client!b655
         │ SAC_CLIENT_SECRET: 9a81d84e-...
         │
         ▼
┌─────────────────────────────────────────┐
│  OAuth Token Endpoint                    │
│  https://cvs-pharmacy-q.authentication.  │
│         us10.hana.ondemand.com/oauth/token│
└────────┬────────────────────────────────┘
         │
         │ Returns token (but wrong type!)
         │ BTP/XSUAA Token ≠ SAC Token
         │
         ▼
┌─────────────────────────────────────────┐
│  SAC Multi-Action API                    │
│  POST /api/v1/dataimport/planningModel/  │
│       PRDA_PL_PLAN/multiActions/{id}/runs│
│                                          │
│  Authorization: Bearer <BTP-token>       │
└────────┬────────────────────────────────┘
         │
         │ ❌ REJECTS REQUEST
         │
         ▼
    🔴 401 Unauthorized
    "The token is not valid for SAC API"
```

**Problem**: BTP/XSUAA tokens are for BTP platform services (HANA, XSUAA, etc.), NOT for SAC APIs!

---

## ✅ REQUIRED (WORKING) FLOW

```
┌─────────────────┐
│  Your App       │
│  (Cloud         │
│   Foundry)      │
└────────┬────────┘
         │
         │ Uses SAC OAuth Credentials:
         │ SAC_CLIENT_ID: <simple-alphanumeric-id>
         │ SAC_CLIENT_SECRET: <simple-secret>
         │
         │ (Created in SAC Admin → OAuth Clients)
         │
         ▼
┌─────────────────────────────────────────┐
│  OAuth Token Endpoint                    │
│  https://cvs-pharmacy-q.authentication.  │
│         us10.hana.ondemand.com/oauth/token│
└────────┬────────────────────────────────┘
         │
         │ Returns SAC-valid token
         │ With SAC API permissions
         │ (Data Import, Planning, Multi-Action)
         │
         ▼
┌─────────────────────────────────────────┐
│  SAC Multi-Action API                    │
│  POST /api/v1/dataimport/planningModel/  │
│       PRDA_PL_PLAN/multiActions/{id}/runs│
│                                          │
│  Authorization: Bearer <SAC-token>       │
└────────┬────────────────────────────────┘
         │
         │ ✅ ACCEPTS REQUEST
         │ Token has correct permissions
         │
         ▼
    🟢 200 OK
    Multi-Action triggered successfully!
```

---

## Key Differences

### BTP/XSUAA Credentials (What You Currently Have)

```
┌─────────────────────────────────────┐
│  BTP Cockpit                         │
│  ├─ Service Instances                │
│  │  ├─ XSUAA Instance                │
│  │  │  └─ Service Key                │
│  │  │     ├─ clientid: sb-xxx|client!b..│
│  │  │     └─ clientsecret: ...       │
└─────────────────────────────────────┘

Purpose: Authenticate to BTP services
Created in: BTP Cockpit
Format: sb-<guid>!b<number>|client!b<number>
Works with: HANA, XSUAA, BTP services
Works with SAC APIs: ❌ NO
```

### SAC OAuth Credentials (What You Need)

```
┌─────────────────────────────────────┐
│  SAC Admin Console                   │
│  ├─ System                            │
│  │  ├─ Administration                │
│  │  │  ├─ App Integration            │
│  │  │  │  ├─ OAuth Clients           │
│  │  │  │  │  └─ AI Predictive Agent  │
│  │  │  │  │     ├─ Client ID: <simple> │
│  │  │  │  │     ├─ Secret: <simple>    │
│  │  │  │  │     ├─ Grant: Client Creds │
│  │  │  │  │     └─ Scopes: Data Import,│
│  │  │  │  │                Planning,   │
│  │  │  │  │                Multi-Action│
└─────────────────────────────────────┘

Purpose: Authenticate to SAC APIs
Created in: SAC Admin Console
Format: Simple alphanumeric string
Works with: SAC APIs (Multi-Action, Planning, etc.)
Works with SAC APIs: ✅ YES
```

---

## What Happens in Your Logs

### Current (Failing) Behavior

```
[2025-12-05T22:46:22.147Z] [INFO] Received forecast query
[2025-12-05T22:46:23.425Z] [INFO] Successfully interpreted forecast query
[2025-12-05T22:46:23.426Z] [INFO] Triggering SAC Multi-Action: E528...

❌ NO LOGS for "Fetching new OAuth access token"
❌ NO LOGS for "Successfully obtained OAuth access token"

[2025-12-05T22:46:23.461Z] [ERROR] Failed to trigger Multi-Action: Request failed with status code 401
[2025-12-05T22:46:23.461Z] [ERROR] SAC API Error: {"status":401,"statusText":"Unauthorized"}
```

**Missing Logs Indicate**: OAuth token fetch returned `null` or wrong token type

---

### Expected (Working) Behavior

```
[2025-12-05T22:46:22.147Z] [INFO] Received forecast query
[2025-12-05T22:46:23.425Z] [INFO] Successfully interpreted forecast query

✅ [INFO] Fetching new OAuth access token from SAC
✅ [INFO] Using OAuth token endpoint: https://cvs-pharmacy-q.authentication...
✅ [INFO] Successfully obtained OAuth access token  ← KEY SUCCESS INDICATOR!

[2025-12-05T22:46:23.426Z] [INFO] Triggering SAC Multi-Action: E528...
✅ [INFO] Multi-Action triggered successfully

🟢 200 OK Response
```

---

## Action Required

### 1. Create SAC OAuth Client

**Where**: SAC Admin Console (NOT BTP Cockpit!)

**Path**: SAC → Menu → System → Administration → App Integration → OAuth Clients

**Config**:
- ✅ Grant Type: **Client Credentials**
- ✅ Scopes: **Data Import, Planning, Multi-Action**

### 2. Replace Credentials

```bash
# OLD (wrong):
SAC_CLIENT_ID: sb-d0a25928-2a38-4862-ab82-bc4f8529aab7!b563143|client!b655

# NEW (correct):
SAC_CLIENT_ID: <your-new-sac-oauth-client-id>
```

### 3. Restart & Verify

```bash
cf set-env ai-predictive-agent SAC_CLIENT_ID "<new-id>"
cf set-env ai-predictive-agent SAC_CLIENT_SECRET "<new-secret>"
cf restart ai-predictive-agent

# Watch for success logs:
cf logs ai-predictive-agent --recent | grep -E "(OAuth|SUCCESS)"
```

---

## Quick Check: Do I Have the Right Credentials?

### ❌ Wrong (BTP/XSUAA):
- Client ID starts with `sb-`
- Client ID ends with `|client!b###`
- Created in BTP Cockpit
- Service key from XSUAA instance

### ✅ Right (SAC OAuth):
- Client ID is simple alphanumeric
- No special prefixes or suffixes
- Created in SAC Admin Console
- From OAuth Clients section

---

## Still Confused?

Run the diagnostic script:
```bash
./diagnose-oauth.sh
```

Or read detailed instructions:
```
SAC_OAUTH_FIX_INSTRUCTIONS.md
```

---

**Bottom Line**: Create OAuth credentials IN SAC (not BTP) → Problem solved! 🎉
