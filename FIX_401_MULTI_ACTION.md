# Fix 401 Unauthorized - Multi-Action API

## 🔍 Problem Analysis

Your application is experiencing **401 Unauthorized** errors when trying to trigger SAC Multi-Actions. The logs show:

```
✅ OAuth token acquired successfully
✅ CSRF token fetched successfully
❌ Multi-Action API call: 401 Unauthorized
```

This means:
- ✅ Authentication is working (OAuth token acquired)
- ❌ Authorization is failing (Multi-Action API rejects the request)

## 🎯 Root Causes

### 1. Multi-Action Not Accessible via API
The Multi-Action ID `E5280280114D3785596849C3D321B820` might:
- Not exist in the SAC Planning Model
- Not be published/active
- Not be accessible via API

### 2. OAuth Client Lacks Permissions
The OAuth client credentials may not have:
- Multi-Action execution permissions
- Data Import API access
- Planning Model write access

### 3. Incorrect API Endpoint
SAC Multi-Action API has different endpoint formats depending on:
- SAC version
- Tenant configuration
- Multi-Action type

## ✅ Solutions Applied

### Solution 1: Multiple Endpoint Fallback

Updated `sac-client.ts` to try **3 different endpoints** in order:

1. **Data Import Job API** (Recommended - most reliable)
   ```
   POST /api/v1/dataimport/planningModel/{modelId}/jobs
   Body: { type: "MULTIACTION", multiActionId: "...", parameters: {...} }
   ```

2. **Planning Model Multi-Action Runs**
   ```
   POST /api/v1/dataimport/planningModel/{modelId}/multiActions/{actionId}/runs
   Body: { parameterValues: {...} }
   ```

3. **Generic Multi-Action Trigger**
   ```
   POST /api/v1/multiactions/{actionId}/trigger
   Body: { ...parameters }
   ```

The application will try each endpoint until one succeeds.

### Solution 2: Diagnostic Tool

Created `diagnose-multiaction.ts` to:
- Test OAuth authentication
- Check Multi-Action existence
- Test all API endpoints
- Provide specific recommendations

## 🚀 Deployment Steps

### Step 1: Run Diagnostic (Optional but Recommended)

Before deploying, run the diagnostic to identify issues:

```bash
# Install dependencies (if not already done)
npm install

# Run diagnostic
npx ts-node diagnose-multiaction.ts
```

**What to look for:**
- ✅ OAuth token acquisition: PASS
- ⚠️ Multi-Action exists: Check if ID is correct
- ✅ At least one endpoint: PASS

### Step 2: Deploy Updated Application

```bash
# Build the application
npm run build

# Deploy to Cloud Foundry
cf push

# Monitor logs
cf logs ai-predictive-agent --recent
```

### Step 3: Test from SAC Widget

1. Open SAC: https://cvs-pharmacy-q.us10.hcs.cloud.sap
2. Load the widget
3. Try forecast query: "Generate 12 month forecast for account 400250"
4. Check logs:
   ```bash
   cf logs ai-predictive-agent --recent
   ```

**Expected Success Log:**
```
✅ Multi-Action triggered successfully via Data Import Job
Response: { jobId: "...", status: "RUNNING" }
```

## 🔧 Troubleshooting

### If All Endpoints Still Return 401

**Problem:** OAuth client doesn't have Multi-Action permissions

**Solution:** Update OAuth client in SAC

1. Log into SAC as administrator
2. Go to: **Settings → App Integration → OAuth Clients**
3. Find your OAuth client (Client ID starts with `sb-d0a25928-...`)
4. Click **Edit**
5. Ensure these scopes are enabled:
   - ✅ **Data Import Service**
   - ✅ **Planning Model: Read & Write**
   - ✅ **Multi-Action Execution** (if available)
6. Click **Save**
7. Wait 5 minutes for permissions to propagate
8. Retry the application

### If Multi-Action ID is Incorrect

**Problem:** Multi-Action `E5280280114D3785596849C3D321B820` doesn't exist

**Solution:** Get correct Multi-Action ID from SAC

1. Open SAC Planning Model: **PRDA_PL_PLAN**
2. Navigate to: **Multi-Actions** section
3. Find your Multi-Action (or create new one - see below)
4. Open the Multi-Action
5. Copy ID from browser URL bar:
   ```
   https://cvs-pharmacy-q.us10.hcs.cloud.sap/.../models/PRDA_PL_PLAN/multiactions/CORRECT_ID
                                                                                     ↑
                                                                              Copy this ID
   ```
6. Update environment variable:
   ```bash
   cf set-env ai-predictive-agent SAC_MULTI_ACTION_ID "YOUR_CORRECT_ID"
   cf restage ai-predictive-agent
   ```

### If Multi-Action Doesn't Exist

**Problem:** No Multi-Action created in SAC

**Solution:** Create Multi-Action in SAC

#### Quick Creation Steps:

1. **Open SAC Planning Model**
   - Go to: https://cvs-pharmacy-q.us10.hcs.cloud.sap
   - Navigate to: **Planning → Models → PRDA_PL_PLAN**

2. **Create New Multi-Action**
   - Click: **Multi-Actions** tab
   - Click: **Create New Multi-Action**
   - Name: `AI_Predictive_Forecast`
   - Description: `Automated forecast triggered by AI agent`

3. **Add Parameters**
   - Click: **Add Parameter**
   - Parameter 1:
     - Name: `GLAccount`
     - Type: `String`
     - Required: Yes
   - Parameter 2:
     - Name: `ForecastPeriod`
     - Type: `Integer`
     - Required: Yes
   - Parameter 3:
     - Name: `VersionName`
     - Type: `String`
     - Required: Yes

4. **Add Steps**
   
   **Step 1: Run Predictive Scenario**
   - Action Type: `Run Predictive Scenario`
   - Scenario: Select your existing predictive scenario
   - Map parameters: Use `@GLAccount` and `@ForecastPeriod`
   
   **Step 2: Save Forecast Results**
   - Action Type: `Save Data`
   - Target Version: Use `@VersionName` parameter
   - Commit: Yes
   
   **Step 3: (Optional) Refresh Story**
   - Action Type: `Refresh Story`
   - Story: Select your forecast story

5. **Save and Publish**
   - Click: **Save**
   - Click: **Publish** (important!)
   - Copy the Multi-Action ID
   - Update environment variable (see above)

6. **Test in SAC**
   - Click: **Run**
   - Enter test values:
     - GLAccount: `400250`
     - ForecastPeriod: `12`
     - VersionName: `Test_Forecast`
   - Verify: Execution completes successfully

For detailed Multi-Action setup, see: `SAC_MULTIACTION_TEMPLATE.md`

## 📊 Expected Behavior After Fix

### Successful Flow:

```
1. User enters query in SAC widget
   "Generate 12 month forecast for account 400250"
   
2. Widget calls Agent API
   POST /api/forecast/query
   
3. Agent interprets query with OpenAI
   → GLAccount: 400250
   → ForecastPeriod: 12
   
4. Agent gets OAuth token
   ✅ Token acquired
   
5. Agent fetches CSRF token
   ✅ CSRF token acquired
   
6. Agent tries Data Import Job endpoint
   POST /api/v1/dataimport/planningModel/PRDA_PL_PLAN/jobs
   ✅ Multi-Action triggered (jobId: abc123)
   
7. Agent returns success to widget
   ✅ Forecast initiated
   
8. SAC executes Multi-Action
   ✅ Predictive scenario runs
   ✅ Results saved to version
   ✅ Story refreshed
```

### Success Logs:

```
[INFO] Received forecast query: "Generate 12 month forecast for account 400250"
[INFO] Successfully interpreted forecast query: [{"glAccount":"400250","forecastPeriod":12,...}]
[INFO] Triggering SAC Multi-Action with parameters: [{"GLAccount":"400250",...}]
[INFO] 🔐 Starting OAuth token acquisition
[INFO]   ✓ Token acquired: eyJ0eXAiOiJKV1QiLCJq...
[INFO]   ✓ Scopes: dmi-api-proxy-sac-sacus10!t655.apiaccess
[INFO] 🔒 Fetching CSRF token from SAC...
[INFO]   ✓ CSRF token acquired: qAEDFCCqXbLmygFg...
[INFO] Attempting endpoint: Data Import Job (Recommended)
[INFO]   URL: https://cvs-pharmacy-q.us10.hcs.cloud.sap/api/v1/dataimport/planningModel/PRDA_PL_PLAN/jobs
[INFO] ✅ Multi-Action triggered successfully via Data Import Job (Recommended)
[INFO] Response: { jobId: "abc123", status: "RUNNING" }
```

## 🎯 Quick Reference

### Check Deployment Status
```bash
cf app ai-predictive-agent
```

### View Live Logs
```bash
cf logs ai-predictive-agent
```

### View Recent Logs
```bash
cf logs ai-predictive-agent --recent
```

### Run Diagnostic
```bash
npx ts-node diagnose-multiaction.ts
```

### Update Multi-Action ID
```bash
cf set-env ai-predictive-agent SAC_MULTI_ACTION_ID "your_new_id"
cf restage ai-predictive-agent
```

### Check Environment Variables
```bash
cf env ai-predictive-agent | grep SAC
```

## 📞 Next Steps

1. **Deploy the fix:**
   ```bash
   npm run build
   cf push
   ```

2. **Monitor logs:**
   ```bash
   cf logs ai-predictive-agent --recent
   ```

3. **Test in SAC:**
   - Load widget
   - Enter forecast query
   - Check for success message

4. **If still fails:**
   - Run diagnostic: `npx ts-node diagnose-multiaction.ts`
   - Check Multi-Action exists in SAC
   - Verify OAuth client permissions
   - Contact SAC administrator if needed

## 📝 Files Changed

- ✅ `src/clients/sac-client.ts` - Added multiple endpoint fallback
- ✅ `diagnose-multiaction.ts` - New diagnostic tool
- ✅ `dist/` - Compiled JavaScript (ready for deployment)

## ✅ Summary

**Changes:**
1. Added 3-endpoint fallback strategy
2. Created diagnostic tool
3. Compiled and ready for deployment

**Deploy now:**
```bash
cf push && cf logs ai-predictive-agent
```

**Expected outcome:**
- ✅ One of the 3 endpoints will work
- ✅ Multi-Action triggers successfully
- ✅ Forecast completes in SAC

If none of the endpoints work, the issue is likely:
1. Multi-Action doesn't exist in SAC → Create it
2. OAuth client lacks permissions → Update in SAC Settings
3. Multi-Action ID is wrong → Get correct ID from SAC
