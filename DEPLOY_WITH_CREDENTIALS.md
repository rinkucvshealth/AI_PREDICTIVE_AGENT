# Deployment Guide - Handling Credentials Correctly

## Problem Solved
Previously, `manifest.yml` contained hardcoded credentials that would reset to old values every time you ran `cf push`.

## Solution
Credentials are now set via `cf set-env` commands, which persist across deployments.

## 🚀 Complete Deployment Process

### Option 1: Quick Deploy (Credentials Already Set)
If credentials are already configured in CF:
```bash
npm run build
cf push
```

### Option 2: First Time or Reset Credentials
If you need to set/update credentials:

```bash
# 1. Build the application
npm run build

# 2. Deploy (without credentials in manifest)
cf push

# 3. Set credentials via environment variables
cf set-env ai-predictive-agent SAC_CLIENT_ID "sb-d0a25928-2a38-4862-ab82-bc4f8529aab7!b563143|client!b655"
cf set-env ai-predictive-agent SAC_CLIENT_SECRET "9a81d84e-1277-4ccb-95fd-7db0f60f15e7\$KytCvQeVWDy5JrXqAS0fLrKFhPn9s1xumtyXc9jNgeA="
cf set-env ai-predictive-agent SAC_REFRESH_TOKEN "5c91ed78d1814ec0a07373bf93c0fdf5-r"
cf set-env ai-predictive-agent OPENAI_API_KEY "your-openai-key"

# 4. Restage to apply credential changes
cf restage ai-predictive-agent
```

### Option 3: Use the Script
```bash
# 1. Build
npm run build

# 2. Deploy
cf push

# 3. Set credentials using script
chmod +x SET_CREDENTIALS.sh
./SET_CREDENTIALS.sh

# 4. Restage
cf restage ai-predictive-agent
```

## 📋 Verify Credentials

Check that credentials are set correctly:
```bash
cf env ai-predictive-agent | grep -E "SAC_CLIENT_ID|SAC_CLIENT_SECRET|SAC_REFRESH_TOKEN"
```

Expected output:
```
SAC_CLIENT_ID: sb-d0a25928-2a38-4862-ab82-bc4f8529aab7!b563143|client!b655
SAC_CLIENT_SECRET: 9a81d84e-1277-4ccb-95fd-7db0f60f15e7$KytCvQeVWDy5JrXqAS0fLrKFhPn9s1xumtyXc9jNgeA=
SAC_REFRESH_TOKEN: 5c91ed78d1814ec0a07373bf93c0fdf5-r
```

## ⚠️ Important Notes

### Why Not in manifest.yml?
- ❌ Credentials in manifest.yml get reset on every `cf push`
- ❌ Credentials in manifest.yml are visible in source control
- ✅ Using `cf set-env` persists credentials across deployments
- ✅ More secure - not stored in files

### When to Update Credentials
You only need to run `cf set-env` when:
- First time deploying
- Credentials change (new client ID/secret)
- Refresh token expires and needs renewal
- Moving between environments (dev/qa/prod)

### Regular Deployments
After credentials are set once, normal deployments are:
```bash
npm run build
cf push
```

Credentials will persist! 🎉

## 🔄 If You Need to Update Refresh Token

The refresh token expires periodically. To get a new one:

```bash
# 1. Visit the OAuth login page
open https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/oauth/login

# 2. After successful login, copy the new refresh token from the page

# 3. Update in Cloud Foundry
cf set-env ai-predictive-agent SAC_REFRESH_TOKEN "new-refresh-token-here"

# 4. Restage
cf restage ai-predictive-agent
```

## 🚀 Ready to Deploy

Now you can safely run:
```bash
npm run build
cf push
```

Your credentials won't be reset anymore! ✅
