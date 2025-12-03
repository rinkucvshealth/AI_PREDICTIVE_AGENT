# 🚀 Deploy Now - Quick Guide

## ✅ What We Fixed

1. **Created deploy.sh script** - Builds locally before pushing to CF
2. **Build strategy changed** - No longer building on CF (avoids cache issues)
3. **Simplified deployment** - Pre-built files are uploaded to CF
4. **Updated manifest.yml** - Uses safe placeholder values
5. **Created deployment docs** - See DEPLOYMENT_FIX.md for details

## 🎯 Deploy Right Now

### Step 1: Deploy using the script (Recommended)
```bash
./deploy.sh
```

This will:
- Install dependencies locally
- Build TypeScript to JavaScript
- Push the built app to Cloud Foundry

### Step 2: Alternative - Manual deployment
```bash
npm install
npm run build
cf push
```

### Step 3: After Successful Deployment

Set your real credentials via CF CLI:

```bash
# SAC Credentials
cf set-env ai-predictive-agent SAC_USERNAME "your_actual_username"
cf set-env ai-predictive-agent SAC_PASSWORD "your_actual_password"

# OpenAI API Key
cf set-env ai-predictive-agent OPENAI_API_KEY "sk-your-actual-key"

# API Key (for securing your endpoints)
cf set-env ai-predictive-agent API_KEY "$(openssl rand -hex 32)"

# SAC Multi-Action ID
cf set-env ai-predictive-agent SAC_MULTI_ACTION_ID "your_multi_action_id"

# Restart to apply changes
cf restart ai-predictive-agent
```

### Step 4: Test Your Deployment

```bash
# Get your app URL
cf app ai-predictive-agent

# Test (replace with your actual URL and API key)
curl https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/health
```

## 🔍 What Changed in Deployment Strategy

**Before:**
- CF tried to build TypeScript during staging
- Buildpack cache caused `tsc: not found` errors
- Unreliable due to cache timing issues

**After:**
- Build happens locally with full dependencies
- CF receives pre-built JavaScript files
- No build phase needed on CF
- Much more reliable! ✅

## 📊 Expected Output

### Local Build (from deploy.sh)
```
✓ Installing dependencies
✓ Building TypeScript
✓ dist/ directory verified
✓ Pushing to Cloud Foundry
```

### CF Push
```
✓ Downloading nodejs_buildpack
✓ Installing node 18.20.8
✓ Installing production dependencies
✓ Staging complete
✓ App started successfully
```

## ⚠️ If Deployment Fails

### Check the logs:
```bash
cf logs ai-predictive-agent --recent
```

### Common issues:

**1. deploy.sh not executable:**
```bash
chmod +x deploy.sh
./deploy.sh
```

**2. Build fails locally:**
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

**3. CF cache issues:**
```bash
cf delete ai-predictive-agent
./deploy.sh
```

**4. Memory issues:**
- Increase in manifest.yml: `memory: 1G`

## 🎉 After Successful Deployment

Your app will be available at:
```
https://ai-predictive-agent.cfapps.us10.hana.ondemand.com
```

Test endpoints:
- `/health` - Health check
- `/` - API info
- `/api/forecast/test-sac` - Test SAC connection
- `/api/forecast/query` - Forecast query

## 📚 Full Documentation

- **DEPLOYMENT_FIX.md** - Detailed explanation of the fix
- **CF_DEPLOYMENT.md** - Complete deployment guide
- **DEPLOYMENT_STATUS.md** - Current status and options
- **PRE_DEPLOY_CHECK.sh** - Pre-deployment checks
- **deploy.sh** - Automated deployment script

---

## 🚀 Ready to Deploy?

Run this command:
```bash
./deploy.sh
```

Or manually:
```bash
npm install && npm run build && cf push
```

Good luck! 🎯
