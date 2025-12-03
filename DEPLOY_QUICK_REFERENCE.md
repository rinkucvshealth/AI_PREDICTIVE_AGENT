# 🚀 Quick Deployment Reference

## One Command Deployment
```bash
./deploy.sh
```

## Manual Deployment
```bash
npm install
npm run build  
cf push
```

## What Happens
1. ✅ Builds TypeScript locally
2. ✅ Uploads built files to CF
3. ✅ CF installs dependencies
4. ✅ App starts from pre-built JS

## After Deployment
```bash
# Set credentials
cf set-env ai-predictive-agent SAC_USERNAME "your_username"
cf set-env ai-predictive-agent SAC_PASSWORD "your_password"
cf set-env ai-predictive-agent OPENAI_API_KEY "sk-..."
cf set-env ai-predictive-agent API_KEY "$(openssl rand -hex 32)"
cf set-env ai-predictive-agent SAC_MULTI_ACTION_ID "your_id"

# Restart
cf restart ai-predictive-agent
```

## Test
```bash
# Get URL
cf app ai-predictive-agent

# Test health
curl https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/health
```

## Troubleshooting
```bash
# View logs
cf logs ai-predictive-agent --recent

# Clear cache and redeploy
cf delete ai-predictive-agent
./deploy.sh

# Local build issues
rm -rf node_modules
npm install
npm run build
```

## Files Changed
- ✅ `package.json` - Removed postinstall
- ✅ `deploy.sh` - New deployment script
- ✅ `manifest.yml` - Simple npm start

## Why This Works
- Builds locally (no CF cache issues)
- Uploads pre-built files
- More reliable and predictable

---
**Deploy now:** `./deploy.sh`
