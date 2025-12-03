# Cloud Foundry Deployment Guide

## 🚀 Quick Deploy

### Step 1: Deploy the Application
```bash
cf push
```

### Step 2: Set Environment Variables
After deployment, set your credentials using CF CLI:

```bash
# SAC Credentials
cf set-env ai-predictive-agent SAC_USERNAME "your_actual_username"
cf set-env ai-predictive-agent SAC_PASSWORD "your_actual_password"

# OpenAI API Key
cf set-env ai-predictive-agent OPENAI_API_KEY "sk-your-actual-api-key"

# API Authentication Key (for securing your endpoint)
cf set-env ai-predictive-agent API_KEY "your-secure-api-key-here"

# SAC Multi-Action ID
cf set-env ai-predictive-agent SAC_MULTI_ACTION_ID "your_multi_action_id"

# Optional: SAC Story ID (for auto-refresh)
cf set-env ai-predictive-agent SAC_STORY_ID "your_story_id"
```

### Step 3: Restart the Application
```bash
cf restart ai-predictive-agent
```

### Step 4: Verify Deployment
```bash
# Check app status
cf app ai-predictive-agent

# View logs
cf logs ai-predictive-agent --recent

# Get app URL
cf apps | grep ai-predictive-agent
```

## 🧪 Test Your Deployed Application

### Get Your App URL
```bash
cf app ai-predictive-agent
```

Your app will be at: `https://ai-predictive-agent.cfapps.us10.hana.ondemand.com`

### Test Endpoints

**1. Health Check (No Auth Required):**
```bash
curl https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/health
```

**2. API Info:**
```bash
curl https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/ \
  -H "x-api-key: your-secure-api-key-here"
```

**3. Test SAC Connection:**
```bash
curl https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/api/forecast/test-sac \
  -H "x-api-key: your-secure-api-key-here"
```

**4. Forecast Query:**
```bash
curl -X POST https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/api/forecast/query \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-secure-api-key-here" \
  -d '{
    "query": "Forecast GL account 41000000 for next 6 months"
  }'
```

## 🔄 Update Deployment

When you make code changes:

```bash
# Option 1: Quick push (rebuilds automatically)
cf push

# Option 2: Build locally first (faster)
npm run build
cf push
```

## 📊 Monitoring

### View Logs
```bash
# Recent logs
cf logs ai-predictive-agent --recent

# Live logs (tail)
cf logs ai-predictive-agent
```

### Check Status
```bash
cf app ai-predictive-agent
```

### View Environment Variables
```bash
cf env ai-predictive-agent
```

## 🛠️ Troubleshooting

### App Won't Start
```bash
# Check logs
cf logs ai-predictive-agent --recent

# Restart app
cf restart ai-predictive-agent

# Check if env vars are set
cf env ai-predictive-agent
```

### Build Failures
```bash
# Make sure dependencies are up to date
npm install

# Build locally to test
npm run build

# Check for TypeScript errors
npx tsc --noEmit
```

### Memory Issues
```bash
# Increase memory
cf scale ai-predictive-agent -m 1G

# Check memory usage
cf app ai-predictive-agent
```

## 🔐 Security Best Practices

1. **Never commit credentials** to git
2. **Always use `cf set-env`** for sensitive data
3. **Rotate API keys** regularly
4. **Use strong API keys** (generate with: `openssl rand -hex 32`)

## 📝 Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `SAC_TENANT_URL` | Yes | SAC tenant URL | `https://your-tenant.hcs.cloud.sap` |
| `SAC_USERNAME` | Yes | SAC username | `your.name@company.com` |
| `SAC_PASSWORD` | Yes | SAC password | `your-password` |
| `SAC_MODEL_ID` | Yes | Planning model ID | `PRDA_PL_PLAN` |
| `SAC_MULTI_ACTION_ID` | Yes | Multi-Action ID | `MA_001` |
| `OPENAI_API_KEY` | Yes | OpenAI API key | `sk-...` |
| `API_KEY` | Yes | API auth key | `your-secure-key` |
| `SAC_STORY_ID` | No | Story to refresh | `STORY_001` |
| `LOG_LEVEL` | No | Logging level | `info` (default) |
| `ALLOWED_ORIGIN` | No | CORS origin | `https://...` |

## 🔗 Useful Commands

```bash
# Login to Cloud Foundry
cf login -a https://api.cf.us10.hana.ondemand.com

# List all your apps
cf apps

# Delete app (careful!)
cf delete ai-predictive-agent

# View marketplace services
cf marketplace

# Bind a service (if needed)
cf bind-service ai-predictive-agent <service-instance>

# Create a new route
cf map-route ai-predictive-agent cfapps.us10.hana.ondemand.com --hostname ai-forecast

# Scale instances
cf scale ai-predictive-agent -i 2
```

## 📖 Additional Resources

- Cloud Foundry Docs: https://docs.cloudfoundry.org/
- SAP BTP Documentation: https://help.sap.com/viewer/product/BTP/Cloud/en-US
- Node.js Buildpack: https://github.com/cloudfoundry/nodejs-buildpack

---

**Last Updated**: 2025-12-03
