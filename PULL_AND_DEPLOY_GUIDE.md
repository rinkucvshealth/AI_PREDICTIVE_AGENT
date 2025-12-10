# 🚀 Pull and Deploy Guide - BAS Quick Reference

**Branch**: `cursor/check-authorization-error-checklist-4546`  
**Changes**: Multi-Action ID format + API endpoint updates

---

## 📥 Step 1: Pull Changes to BAS

```bash
# Navigate to your project directory
cd /home/user/projects/workspace

# Check current branch
git branch

# Pull the latest changes
git pull origin cursor/check-authorization-error-checklist-4546

# Or if you need to switch branches first:
git checkout cursor/check-authorization-error-checklist-4546
git pull
```

**Expected output**:
```
From https://github.com/your-org/your-repo
 * branch            cursor/check-authorization-error-checklist-4546 -> FETCH_HEAD
Updating abc123..def456
Fast-forward
 .env.example              | 3 ++-
 src/config.ts             | 2 +-
 src/clients/sac-client.ts | 45 ++++++++++++++++++++++++++++++++-------------
 3 files changed, 35 insertions(+), 15 deletions(-)
```

---

## 🔍 Step 2: Verify Changes

```bash
# Check what files changed
git diff HEAD~1

# Or view specific changes
cat src/config.ts | grep MULTI_ACTION_ID
cat .env.example | grep MULTI_ACTION_ID
```

**You should see**:
```
SAC_MULTI_ACTION_ID=MULTIACTIONS:t.2:E5280280114D3785596849C3D321B820
```

---

## ⚙️ Step 3: Update Environment Variables

Edit your `.env` file (NOT .env.example):

```bash
# Open your .env file
nano .env
# or
vi .env
```

**Update this line**:
```bash
# OLD:
SAC_MULTI_ACTION_ID=E5280280114D3785596849C3D321B820

# NEW:
SAC_MULTI_ACTION_ID=MULTIACTIONS:t.2:E5280280114D3785596849C3D321B820
```

**IMPORTANT**: Also update OAuth credentials when you get them from SAC admin:
```bash
SAC_CLIENT_ID=<new-oauth-client-id>
SAC_CLIENT_SECRET=<new-oauth-client-secret>
```

Save and exit (Ctrl+X, then Y, then Enter in nano).

---

## 📦 Step 4: Install Dependencies (if needed)

```bash
# Check if node_modules exists
ls -la node_modules

# If not, or if you want to be safe:
npm install

# Or for clean install:
rm -rf node_modules package-lock.json
npm install
```

---

## 🏗️ Step 5: Build the Application

```bash
# Clean previous build
rm -rf dist

# Build TypeScript
npm run build

# Verify build success
ls -la dist/
```

**Expected output**:
```
dist/
  ├── clients/
  │   ├── openai-client.js
  │   └── sac-client.js
  ├── routes/
  │   └── forecast.js
  ├── server.js
  └── config.js
```

---

## 🚀 Step 6: Deploy to Cloud Foundry

### **Option A: Using cf push**

```bash
# Login to Cloud Foundry (if not already logged in)
cf login -a https://api.cf.us10.hana.ondemand.com

# Verify you're targeting correct space
cf target

# Push the application
cf push

# Follow the deployment logs
cf logs your-app-name --recent
```

### **Option B: Using deployment script**

```bash
# If you have a deployment script
./deploy.sh

# Or
bash deploy.sh
```

---

## ✅ Step 7: Verify Deployment

### **Check App Status**:
```bash
cf apps
```

**Expected**:
```
name              requested state   instances   memory   disk   urls
your-app-name     started           1/1         1G       1G     your-app-url.cfapps.us10.hana.ondemand.com
```

### **Check Recent Logs**:
```bash
cf logs your-app-name --recent | grep "Configuration loaded"
```

**You should see**:
```
[INFO] 📋 Configuration loaded:
[INFO]    SAC Tenant: https://cvs-pharmacy-q.us10.hcs.cloud.sap
[INFO]    SAC Model: PRDA_PL_PLAN
```

---

## 🧪 Step 8: Test the Changes

### **Test 1: Health Check**
```bash
curl https://your-app-url.cfapps.us10.hana.ondemand.com/health
```

### **Test 2: SAC Connection**
```bash
curl https://your-app-url.cfapps.us10.hana.ondemand.com/api/forecast/test-sac \
  -H "x-api-key: your-api-key"
```

### **Test 3: Forecast Query** (Will still fail with 401 until you get new OAuth client)
```bash
curl -X POST https://your-app-url.cfapps.us10.hana.ondemand.com/api/forecast/query \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{
    "query": "Forecast GL Account 41000000 for 6 months"
  }'
```

**Expected** (with current OAuth client):
```json
{
  "success": false,
  "error": "401 Unauthorized",
  "summary": "Failed to trigger multi-action - check OAuth client configuration"
}
```

**Expected** (after new OAuth client):
```json
{
  "success": true,
  "summary": "Forecast initiated for GL Account 41000000 (6 months) → Version: Forecast_20251210",
  "details": {
    "glAccount": "41000000",
    "forecastPeriod": 6,
    "versionName": "Forecast_20251210",
    "multiActionStatus": "success"
  }
}
```

---

## 📋 Environment Variables Checklist

Before deploying, ensure your `.env` has:

```bash
# SAC Connection
SAC_TENANT_URL=https://cvs-pharmacy-q.us10.hcs.cloud.sap
SAC_CLIENT_ID=<your-oauth-client-id>  ⚠️ UPDATE THIS
SAC_CLIENT_SECRET=<your-oauth-client-secret>  ⚠️ UPDATE THIS

# SAC Configuration (UPDATED)
SAC_MODEL_ID=PRDA_PL_PLAN
SAC_MULTI_ACTION_ID=MULTIACTIONS:t.2:E5280280114D3785596849C3D321B820  ✅ NEW FORMAT

# OpenAI
OPENAI_API_KEY=sk-...

# Server
PORT=3002
API_KEY=your-api-key
NODE_ENV=production
```

---

## 🔧 Troubleshooting

### **Issue: Build fails**

```bash
# Clear cache and rebuild
npm run clean  # if you have this script
rm -rf dist node_modules package-lock.json
npm install
npm run build
```

### **Issue: cf push fails**

```bash
# Check manifest.yml
cat manifest.yml

# Verify you're logged in
cf login

# Check target space
cf target

# Try with verbose logging
cf push --verbose
```

### **Issue: Still getting 401 errors**

**This is expected until you get the new OAuth client!**

Check logs:
```bash
cf logs your-app-name --recent | grep "401"
```

You should see the enhanced error message:
```
[ERROR] 🔍 401 UNAUTHORIZED ERROR - CHECKLIST ANALYSIS
[ERROR] LIKELY CAUSES:
[ERROR]   1. ❌ Using client_credentials OAuth flow (machine-to-machine)
[ERROR]      ✅ REQUIRED: Interactive Usage or SAML Bearer Assertion
```

**Solution**: Get new OAuth credentials from SAC admin (see CHECKLIST_IMPLEMENTATION_SUMMARY.md)

---

## 📞 Next Steps

After deploying the code changes:

1. ✅ **Code is deployed** - You're done with this step!

2. ⏳ **Request OAuth client** from SAC admin:
   - Send them: `CHECKLIST_IMPLEMENTATION_SUMMARY.md`
   - They need: ~15 minutes to create it
   - You need: Client ID + Client Secret

3. ⏳ **Update OAuth credentials**:
   ```bash
   # Update .env file
   SAC_CLIENT_ID=<new-value>
   SAC_CLIENT_SECRET=<new-value>
   
   # Redeploy
   cf push
   ```

4. ✅ **Test and celebrate!** 🎉

---

## 📄 Summary of Changes

| File | What Changed |
|------|--------------|
| `.env.example` | Multi-Action ID format updated |
| `src/config.ts` | Default Multi-Action ID updated |
| `src/clients/sac-client.ts` | API endpoint changed from `/trigger` to `/executions` |
| `src/clients/sac-client.ts` | Enhanced 401 error messages |
| `src/clients/sac-client.ts` | Added OAuth flow warnings |

---

## ⏱️ Time Estimate

- Pull changes: **1 minute**
- Update .env: **2 minutes**
- Build: **1 minute**
- Deploy: **3-5 minutes**
- Test: **2 minutes**

**Total**: ~10 minutes (plus waiting for new OAuth client from SAC admin)

---

**Good luck with the deployment! 🚀**
