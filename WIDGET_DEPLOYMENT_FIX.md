# Widget Deployment Fix - Complete Guide

## 🚨 Problem

Widget files returning 404 error:
```
curl https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/widget/sac-widget.json
Cannot GET /widget/sac-widget.json
```

SAC Error:
```
The system couldn't load the custom widget com.cvshealth.aiforecast_1.x
```

## ✅ Fixes Applied

### 1. **Updated `package.json`**
   - Added explicit `files` array to ensure `public/` directory is deployed
   - Guarantees widget files are included in Cloud Foundry package

### 2. **Enhanced `src/server.ts`**
   - Added logging to show widget file path
   - Added debug endpoint: `/widget/debug` to verify files exist
   - Improved content-type handling for `.json` and `.js` files
   - Better error reporting

### 3. **Path Resolution**
   - Correctly resolves `public/widget` path in production (Cloud Foundry)
   - Works in both development and production environments

---

## 🚀 Deployment Steps

### Step 1: Pull Latest Code (in BAS)

```bash
cd ~/projects/AI_PREDICTIVE_AGENT
git pull origin main
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Build

```bash
npm run build
```

### Step 4: Deploy to Cloud Foundry

```bash
cf push ai-predictive-agent
```

### Step 5: Monitor Deployment

```bash
cf logs ai-predictive-agent --recent
```

**Look for**:
```
[INFO] Widget files path: /home/vcap/app/public/widget
```

---

## 🔍 Verification Steps

### Test 1: Debug Endpoint

```bash
curl https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/widget/debug
```

**Expected Response** (should show widget files):
```json
{
  "widgetPath": "/home/vcap/app/public/widget",
  "filesExist": ["sac-widget.js", "sac-widget.json"],
  "__dirname": "/home/vcap/app/dist",
  "cwd": "/home/vcap/app"
}
```

**If you see an error**, the public directory is missing!

### Test 2: Widget Manifest

```bash
curl https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/widget/sac-widget.json
```

**Expected**: JSON content (NOT 404 or HTML error)

### Test 3: Widget JavaScript

```bash
curl https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/widget/sac-widget.js
```

**Expected**: JavaScript code (NOT 404 or HTML error)

---

## 🔧 If Still Getting 404

### Check 1: SSH into App and Verify Files

```bash
cf ssh ai-predictive-agent
```

Once inside:
```bash
ls -la /home/vcap/app/public/widget/
```

**Expected**: Should list `sac-widget.js` and `sac-widget.json`

**If missing**: Files weren't deployed!

### Check 2: Verify .cfignore Doesn't Exclude public/

```bash
# In BAS
cat .cfignore | grep public
```

**Expected**: Should NOT see `public/` in the ignore list

### Check 3: Check package.json Files Array

```bash
# In BAS
cat package.json | grep -A 5 '"files"'
```

**Expected**:
```json
"files": [
  "dist/",
  "public/",
  "package.json",
  "package-lock.json"
],
```

### Check 4: Verify Build Output

```bash
ls -la public/widget/
```

**Expected**: Files should exist locally before deployment

---

## 🆘 Nuclear Option: Force Deploy with Public Directory

If files still aren't deploying:

### Option 1: Move Widget Files to dist/

```bash
# In BAS
mkdir -p dist/public/widget
cp public/widget/* dist/public/widget/
cf push ai-predictive-agent
```

Then update server path:
```typescript
const widgetPath = path.join(__dirname, './public/widget');
```

### Option 2: Serve from Root

```bash
# Move files to root
mkdir -p widget
cp public/widget/* widget/
cf push ai-predictive-agent
```

Update server:
```typescript
const widgetPath = path.join(__dirname, '../widget');
```

---

## 📋 SAC Custom Widget Import (CORRECT WAY)

**❌ WRONG**: Don't upload `sac-widget.json` file directly to SAC!

**✅ CORRECT**: Import widget via URL

### Step 1: Login to SAC

https://cvs-pharmacy-q.us10.hcs.cloud.sap

### Step 2: Navigate to Custom Widgets

- Menu (☰) → **Files**
- Click **Custom Widgets**

### Step 3: Import from URL

- Click **+ Create**
- Select **Import from URL**
- Enter URL:
  ```
  https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/widget/sac-widget.json
  ```
- Click **Import**

### Step 4: Wait for Import

SAC will:
1. Download the JSON manifest
2. Download the JavaScript file
3. Validate the widget
4. Register it in your tenant

**Success**: Widget appears in Custom Widgets list

### Step 5: Use in Story

1. Open your SAC Story
2. Click **Insert** → **Custom Widget**
3. Select **AI Forecast Agent**
4. Drag to canvas
5. Configure properties (see below)

---

## ⚙️ Widget Configuration in SAC

Click the widget and set these properties:

| Property | Value | Required |
|----------|-------|----------|
| **apiEndpoint** | `https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/api/forecast/query` | Yes |
| **apiKey** | Your API key (if auth enabled) | If needed |
| **width** | `400` | No (default) |
| **height** | `600` | No (default) |

---

## 🎯 Complete Test Flow

### 1. Deploy App

```bash
cd ~/projects/AI_PREDICTIVE_AGENT
git pull origin main
npm install
npm run build
cf push ai-predictive-agent
```

### 2. Verify Endpoints

```bash
# Debug
curl https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/widget/debug

# Manifest
curl https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/widget/sac-widget.json

# JavaScript
curl https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/widget/sac-widget.js
```

### 3. Import in SAC

- Go to SAC Custom Widgets
- Import from URL
- Use widget JSON URL

### 4. Test in Story

- Add widget to story
- Configure endpoint
- Test with query: "Create 6 month forecast for GL 500100"

### 5. Check Logs

```bash
cf logs ai-predictive-agent --recent
```

Look for:
- ✅ Widget file access logs
- ✅ API forecast requests
- ❌ No 404 errors

---

## 📊 Troubleshooting Matrix

| Symptom | Cause | Solution |
|---------|-------|----------|
| 404 on `/widget/sac-widget.json` | Files not deployed | Check `package.json` files array |
| 404 on `/widget/sac-widget.js` | Files not deployed | Verify with `/widget/debug` |
| `/widget/debug` shows error | `public/` not in CF | Check .cfignore |
| SAC can't import | Widget JSON invalid | Validate JSON format |
| Widget loads but errors | API endpoint wrong | Check widget properties |
| API returns 401 | OAuth not set | Set SAC_CLIENT_ID and SECRET |
| API returns 500 | Server error | Check `cf logs` |

---

## ✅ Success Indicators

After deployment:

1. **Debug Endpoint Works**:
   ```bash
   curl .../widget/debug
   # Returns: {"filesExist": ["sac-widget.js", "sac-widget.json"]}
   ```

2. **Widget Files Accessible**:
   ```bash
   curl .../widget/sac-widget.json  # Returns JSON
   curl .../widget/sac-widget.js    # Returns JavaScript
   ```

3. **SAC Import Succeeds**:
   - No correlation ID error
   - Widget appears in custom widgets list

4. **Widget Works in Story**:
   - Displays UI correctly
   - Can submit queries
   - Shows success/error messages

5. **End-to-End Test**:
   - Widget → API → SAC Multi-Action → Success!

---

## 📝 Quick Commands Summary

```bash
# Deploy
cd ~/projects/AI_PREDICTIVE_AGENT
git pull origin main && npm install && npm run build && cf push ai-predictive-agent

# Verify
curl https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/widget/debug
curl https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/widget/sac-widget.json

# SSH Check
cf ssh ai-predictive-agent -c "ls -la /home/vcap/app/public/widget/"

# Logs
cf logs ai-predictive-agent --recent
```

---

## 🎯 Next Steps

1. ✅ Code updated with fixes
2. ⏳ Deploy to Cloud Foundry
3. ⏳ Verify widget files accessible
4. ⏳ Import widget in SAC (via URL, not file upload!)
5. ⏳ Test in SAC Story
6. ⏳ Set OAuth credentials (if not done)

---

**Status**: 🟢 Ready for Deployment - All fixes applied!
