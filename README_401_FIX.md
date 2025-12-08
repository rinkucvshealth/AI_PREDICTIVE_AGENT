# 🔧 Fix for 401 Unauthorized Error - Multi-Action API

## 🎯 Problem

Your application is getting **401 Unauthorized** errors when calling SAC Multi-Action API:

```
✅ OAuth token acquired
✅ CSRF token fetched
❌ Multi-Action API: 401 Unauthorized
```

## ✅ Solution Applied

Updated the SAC client to try **3 different API endpoints** in fallback order:

1. **Data Import Job API** (Most reliable, recommended by SAP)
2. **Planning Model Multi-Action Runs** (Direct Multi-Action trigger)
3. **Generic Multi-Action Trigger** (Legacy endpoint)

The application will automatically try each endpoint until one succeeds.

---

## 🚀 Quick Start - Deploy Fix Now

### Option 1: One-Command Deployment

```bash
./DEPLOY_401_FIX.sh
```

This script will:
- ✅ Build the application
- ✅ Deploy to Cloud Foundry
- ✅ Show deployment logs
- ✅ Provide next steps

### Option 2: Manual Deployment

```bash
# Build
npm run build

# Deploy
cf push

# Monitor
cf logs ai-predictive-agent --recent
```

---

## 🔍 Verify Deployment

### 1. Check Application Status

```bash
cf app ai-predictive-agent
```

**Expected output:**
```
     state     since                  cpu    memory   disk
#0   running   2025-12-08T20:30:00Z   0.0%   85M      217M
```

### 2. View Recent Logs

```bash
cf logs ai-predictive-agent --recent | grep "Multi-Action"
```

**Look for SUCCESS log:**
```
[INFO] ✅ Multi-Action triggered successfully via Data Import Job (Recommended)
```

**Or one of the alternative endpoints:**
```
[INFO] ✅ Multi-Action triggered successfully via Planning Model Multi-Action Runs
[INFO] ✅ Multi-Action triggered successfully via Generic Multi-Action Trigger
```

### 3. Test from SAC Widget

1. Open SAC: https://cvs-pharmacy-q.us10.hcs.cloud.sap
2. Load the widget (should load automatically)
3. Enter query: `"Generate 12 month forecast for account 400250"`
4. Check response in widget

**Expected:**
- Widget shows: "✅ Forecast initiated successfully"
- No error messages

---

## 🔧 If Still Getting 401 Error

### Run Diagnostic Tool

The diagnostic tool will test all endpoints and identify the specific issue:

```bash
npx ts-node diagnose-multiaction.ts
```

**This will test:**
1. OAuth token acquisition
2. Model API access
3. Multi-Action existence
4. All 3 API endpoints
5. Provide specific recommendations

### Common Issues & Solutions

#### Issue 1: Multi-Action Doesn't Exist

**Symptoms:**
- Diagnostic shows: "Multi-Action ID not found"
- All endpoints return 404

**Solution:**

1. **Get correct Multi-Action ID from SAC:**
   - Open SAC Planning Model: PRDA_PL_PLAN
   - Go to **Multi-Actions** tab
   - Open your Multi-Action
   - Copy ID from URL
   
2. **Update environment variable:**
   ```bash
   cf set-env ai-predictive-agent SAC_MULTI_ACTION_ID "YOUR_CORRECT_ID"
   cf restage ai-predictive-agent
   ```

3. **Or create new Multi-Action** (see section below)

#### Issue 2: OAuth Client Lacks Permissions

**Symptoms:**
- OAuth token acquired successfully
- All endpoints return 401 or 403
- Diagnostic shows: "Authentication/Authorization error"

**Solution:**

1. **Log into SAC as administrator**
2. **Go to:** Settings → App Integration → OAuth Clients
3. **Find your client:** `sb-d0a25928-2a38-4862-...`
4. **Click Edit**
5. **Enable these scopes:**
   - ✅ Data Import Service
   - ✅ Planning Model: Read & Write
   - ✅ Multi-Action Execution
6. **Save** and wait 5 minutes for changes to take effect
7. **Redeploy application:**
   ```bash
   cf restage ai-predictive-agent
   ```

#### Issue 3: Multi-Action Not Published

**Symptoms:**
- Multi-Action exists in SAC
- Can run manually but API returns 401

**Solution:**

1. Open Multi-Action in SAC
2. Click **Publish** button
3. Ensure "Available via API" is enabled
4. Save changes
5. Retry application

---

## 📋 Create New Multi-Action (If Needed)

If you don't have a Multi-Action set up yet:

### Quick Setup Steps

1. **Open SAC Planning Model**
   - Navigate to: PRDA_PL_PLAN

2. **Create Multi-Action**
   - Click: Multi-Actions tab → **New Multi-Action**
   - Name: `AI_Predictive_Forecast`
   - Description: `AI-driven forecast automation`

3. **Add Input Parameters**
   
   | Parameter | Type | Required |
   |-----------|------|----------|
   | GLAccount | String | Yes |
   | ForecastPeriod | Integer | Yes |
   | VersionName | String | Yes |

4. **Add Steps**
   
   **Step 1:** Run Predictive Scenario
   - Select your predictive scenario
   - Map: GL Account → `@GLAccount`
   - Map: Forecast Period → `@ForecastPeriod`
   
   **Step 2:** Save Results
   - Action: Save Data
   - Target Version: `@VersionName`
   - Commit: Yes
   
   **Step 3:** (Optional) Refresh Story
   - Action: Refresh Story
   - Story: [Your forecast story]

5. **Save and Publish**
   - Click **Save**
   - Click **Publish**
   - ✅ Enable "Available via API"

6. **Copy Multi-Action ID**
   - From URL bar or Multi-Action details
   - Update environment:
     ```bash
     cf set-env ai-predictive-agent SAC_MULTI_ACTION_ID "YOUR_ID"
     cf restage ai-predictive-agent
     ```

7. **Test Manually**
   - Click **Run** in SAC
   - Enter test values
   - Verify execution completes

For detailed setup, see: `SAC_MULTIACTION_TEMPLATE.md`

---

## 📊 What Changed?

### Before (Single Endpoint - Failed)

```typescript
// Only tried one endpoint
endpoint = `/api/v1/dataimport/planningModel/${modelId}/multiActions/${actionId}/runs`;
response = await axios.post(endpoint, body);
// If 404 or 401 → Failed immediately
```

### After (Multiple Endpoints - Robust)

```typescript
// Try 3 endpoints in order
endpoints = [
  '/api/v1/dataimport/planningModel/{modelId}/jobs',           // Data Import Job
  '/api/v1/dataimport/planningModel/{modelId}/multiActions/{actionId}/runs',  // Direct
  '/api/v1/multiactions/{actionId}/trigger'                     // Generic
];

// Try each until one succeeds
for (endpoint of endpoints) {
  try {
    response = await axios.post(endpoint, body);
    if (success) return response;  // ✅ Success!
  } catch (error) {
    continue;  // Try next endpoint
  }
}
```

### Benefits

- ✅ **More reliable**: 3 chances instead of 1
- ✅ **Future-proof**: Works with different SAC versions
- ✅ **Better error handling**: Clear logging for each attempt
- ✅ **Automatic fallback**: No manual intervention needed

---

## 📈 Expected Success Flow

```
User Query
    ↓
Widget → Agent API
    ↓
Agent: Interpret with OpenAI ✅
    ↓
Agent: Get OAuth Token ✅
    ↓
Agent: Fetch CSRF Token ✅
    ↓
Agent: Try Endpoint 1 (Data Import Job)
    ↓
    ├─ Success? → ✅ Return to widget
    └─ Failed? → Try Endpoint 2
           ↓
           ├─ Success? → ✅ Return to widget
           └─ Failed? → Try Endpoint 3
                  ↓
                  ├─ Success? → ✅ Return to widget
                  └─ Failed? → ❌ Return error with details
```

---

## 🎯 Success Criteria

After deploying the fix, you should see:

### In Logs (cf logs)
```
[INFO] 🎯 Triggering SAC Multi-Action
[INFO] Attempting endpoint: Data Import Job (Recommended)
[INFO] ✅ Multi-Action triggered successfully via Data Import Job (Recommended)
[INFO] Response: { jobId: "abc123", status: "RUNNING" }
```

### In Widget
```
✅ Forecast initiated successfully
Job ID: abc123
Estimated completion: 2 minutes
```

### In SAC
- Multi-Action execution appears in history
- Status shows "Running" then "Completed"
- Forecast data appears in target version

---

## 📞 Need Help?

### If One Endpoint Works

✅ **You're good!** The application will use that endpoint automatically.

### If All Endpoints Fail

1. **Run diagnostic:**
   ```bash
   npx ts-node diagnose-multiaction.ts
   ```

2. **Check these in order:**
   - [ ] Multi-Action exists in SAC
   - [ ] Multi-Action is published
   - [ ] OAuth client has permissions
   - [ ] Multi-Action ID is correct

3. **Review detailed guide:**
   - See: `FIX_401_MULTI_ACTION.md`

4. **Contact SAC Administrator:**
   - Request Multi-Action API permissions for OAuth client
   - Verify service account has planning model access
   - Confirm Multi-Action is accessible via API

---

## 📁 Related Files

- `FIX_401_MULTI_ACTION.md` - Detailed troubleshooting guide
- `diagnose-multiaction.ts` - Diagnostic tool
- `SAC_MULTIACTION_TEMPLATE.md` - Multi-Action setup guide
- `DEPLOY_401_FIX.sh` - One-click deployment script

---

## ✅ Summary

**Problem:** 401 Unauthorized on Multi-Action API

**Solution:** Try 3 different endpoints automatically

**Deploy:** `./DEPLOY_401_FIX.sh`

**Verify:** `cf logs ai-predictive-agent --recent | grep "Multi-Action"`

**Expected:** `✅ Multi-Action triggered successfully`

---

**Last Updated:** December 8, 2025  
**Status:** Ready for Deployment ✅
