# SAC Widget Fix Guide

## 🚨 Issue Summary

**Error in SAC Story:**
```
Something went wrong. The system couldn't load the custom widget com.cvshealth.aiforecast_1.x
```

**Root Cause:** Widget files were missing from the application (404 error when SAC tried to load them).

---

## ✅ Solution Implemented

### Files Added:

1. **`public/widget/sac-widget.json`** - Widget manifest
   - Defines widget metadata
   - Specifies properties, methods, and events
   - Points to widget JavaScript URL

2. **`public/widget/sac-widget.js`** - Widget implementation
   - Custom web component
   - Natural language input interface
   - Connects to AI Forecast API
   - Styled with SAP Fiori design

3. **Updated `src/server.ts`** - Added widget routes
   - Serves static widget files from `/widget` path
   - CORS configured for SAC access
   - No authentication required for widget loading

---

## 🚀 Deployment Steps

### Step 1: Build and Deploy

```bash
# Build the application
npm run build

# Deploy to Cloud Foundry
cf push ai-predictive-agent

# Monitor deployment
cf logs ai-predictive-agent --recent
```

### Step 2: Verify Widget Files Are Accessible

After deployment, test the widget URLs:

```bash
# Test widget manifest
curl https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/widget/sac-widget.json

# Should return JSON manifest, NOT 404!

# Test widget JavaScript
curl https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/widget/sac-widget.js

# Should return JavaScript code, NOT 404!
```

**Expected Response**: Widget files content (not 404 error)

---

## 📦 Update Widget in SAC

### Option 1: Update Existing Widget

1. **Login to SAC**: https://cvs-pharmacy-q.us10.hcs.cloud.sap

2. **Go to Custom Widgets**:
   - Click menu (☰) → **Files**
   - Navigate to **Custom Widgets**
   - Find your existing widget `com.cvshealth.aiforecast`

3. **Update Widget**:
   - Click the widget → **Edit**
   - Update the URL to: `https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/widget/sac-widget.json`
   - Click **Update**

### Option 2: Import New Widget

1. **Login to SAC**: https://cvs-pharmacy-q.us10.hcs.cloud.sap

2. **Import Widget**:
   - Click menu (☰) → **Files** → **Custom Widgets**
   - Click **+ Create** → **Import from URL**
   - Enter URL: `https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/widget/sac-widget.json`
   - Click **Import**

3. **Wait for Import**:
   - SAC will download and validate the widget
   - Should see success message

---

## 🔧 Configure Widget in SAC Story

### Step 1: Add Widget to Story

1. Open your SAC Story
2. Click **Insert** → **Custom Widget**
3. Select **AI Forecast Agent** widget
4. Drag and drop onto canvas

### Step 2: Configure Widget Properties

Click on the widget and set properties:

| Property | Value |
|----------|-------|
| **apiEndpoint** | `https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/api/forecast/query` |
| **apiKey** | Your API key (if authentication is enabled) |
| **width** | `400` (or adjust as needed) |
| **height** | `600` (or adjust as needed) |

### Step 3: Save and Test

1. **Save** the story
2. **View** the story (exit edit mode)
3. **Test** the widget:
   - Type: "Create 6 month forecast for GL 500100"
   - Click **Submit**
   - Should see processing message, then success

---

## ✅ Verification Checklist

After deployment, verify each of these:

- [ ] Widget manifest accessible:
  ```bash
  curl https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/widget/sac-widget.json
  ```
  ✅ Returns JSON (not 404)

- [ ] Widget JavaScript accessible:
  ```bash
  curl https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/widget/sac-widget.js
  ```
  ✅ Returns JavaScript code (not 404)

- [ ] Widget imports in SAC without errors
  ✅ No correlation ID error

- [ ] Widget displays in SAC Story
  ✅ Shows title "🤖 AI Forecast Agent"

- [ ] Widget can submit requests
  ✅ Example queries work

- [ ] API responds to widget requests
  ✅ Check logs: `cf logs ai-predictive-agent --recent`

---

## 🔍 Troubleshooting

### Issue: Still Getting 404 Error

**Check 1: Files deployed?**
```bash
cf ssh ai-predictive-agent -c "ls -la /home/vcap/app/public/widget/"
```

**Expected**: Should list `sac-widget.js` and `sac-widget.json`

**If missing**:
- Ensure files are committed to git
- Check `.cfignore` doesn't exclude `public/`
- Redeploy: `cf push ai-predictive-agent`

### Issue: Widget Loads but Shows Blank

**Check 1: Browser console for errors**
- Open browser DevTools (F12)
- Check Console tab for JavaScript errors

**Check 2: CORS issues**
- Look for CORS errors in console
- Verify `Access-Control-Allow-Origin` header is set

### Issue: Widget Submits but Gets Error

**Check 1: OAuth credentials set?**
```bash
cf env ai-predictive-agent | grep SAC_CLIENT
```

**Expected**: Real OAuth credentials (not "placeholder")

**If placeholders**: Follow `AUTH_FIX_GUIDE.md` to set OAuth credentials

**Check 2: API Key authentication**
- If API_KEY is set, widget needs it in properties
- Or disable API key auth for development

### Issue: "Correlation ID" Error in SAC

This means SAC couldn't load the widget files.

**Solution**:
1. Verify URLs are accessible (see Verification Checklist)
2. Check widget manifest JSON is valid
3. Re-import widget in SAC with correct URL
4. Clear browser cache and refresh SAC

---

## 📊 Widget Features

### What the Widget Does:

1. **Natural Language Input**: Users type requests in plain English
2. **Example Queries**: Pre-filled examples for quick testing
3. **Real-time Processing**: Shows loading state while processing
4. **Success/Error Messages**: Clear feedback with details
5. **Forecast Details**: Displays GL account, period, version name
6. **Event Emission**: Fires `onForecastComplete` event for SAC scripting

### Widget Properties (Configurable in SAC):

- `apiEndpoint` - API URL (default: production endpoint)
- `apiKey` - Optional API key for authentication
- `width` - Widget width in pixels
- `height` - Widget height in pixels

### Widget Methods (Callable from SAC):

- `refresh()` - Clears results and resets widget

### Widget Events (Listenable in SAC):

- `onForecastComplete` - Triggered when forecast succeeds
  - Detail includes: `success`, `summary`, `details`

---

## 🎨 Widget UI

The widget features:
- **Modern Design**: SAP Fiori-inspired styling
- **Responsive Layout**: Adapts to different sizes
- **Loading States**: Visual feedback during processing
- **Color-coded Messages**:
  - 🔵 Blue = Info
  - 🟢 Green = Success
  - 🔴 Red = Error
  - 🟠 Orange = Processing
- **Example Chips**: Quick-click preset queries
- **Scrollable Results**: History of all requests

---

## 📝 Example Widget Usage

### In SAC Story:

```javascript
// Get widget reference
var widget = Canvas.getWidgetById("AIForecastWidget_1");

// Listen for forecast completion
widget.addEventListener("onForecastComplete", function(event) {
  var details = event.detail.details;
  console.log("Forecast created for GL: " + details.glAccount);
  
  // Refresh other widgets or update story
  Application.showMessage("Forecast created successfully!", MessageType.Success);
});

// Programmatically refresh widget
widget.refresh();
```

---

## 📚 Related Documentation

- **AUTH_FIX_GUIDE.md** - OAuth setup for API authentication
- **401_ERROR_FIX_README.md** - Complete OAuth documentation
- **DEPLOYMENT_CHECKLIST.md** - Deployment verification steps

---

## 🎯 Quick Commands

```bash
# Build and deploy
npm run build && cf push ai-predictive-agent

# Verify widget files
curl https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/widget/sac-widget.json
curl https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/widget/sac-widget.js

# Check deployment logs
cf logs ai-predictive-agent --recent

# SSH into app to verify files
cf ssh ai-predictive-agent -c "ls -la /home/vcap/app/public/widget/"

# Test API (after setting OAuth credentials)
curl -X POST https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/api/forecast/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Create 6 month forecast for GL 500100"}'
```

---

## ✅ Summary

| Component | Status | Action |
|-----------|--------|--------|
| **Widget Files** | ✅ Created | `public/widget/` directory added |
| **Server Routes** | ✅ Updated | `/widget` endpoint configured |
| **Build** | ✅ Successful | Ready for deployment |
| **Deployment** | ⏳ Pending | Run `cf push ai-predictive-agent` |
| **SAC Import** | ⏳ Pending | Import widget from URL |
| **OAuth Setup** | ⏳ Pending | Set real OAuth credentials |

---

**Next Steps:**
1. ✅ Code changes complete
2. ⏳ Deploy to Cloud Foundry
3. ⏳ Verify widget URLs accessible
4. ⏳ Import/update widget in SAC
5. ⏳ Test widget in SAC Story
6. ⏳ Set OAuth credentials (if not done yet)
7. ⏳ Test end-to-end forecast creation

---

**Status**: 🟢 Ready for Deployment
