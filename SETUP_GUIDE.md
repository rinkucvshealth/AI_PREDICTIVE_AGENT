# Setup Guide - SAC Predictive Agent

## 🎯 Prerequisites

Before setting up the AI Predictive Agent, ensure you have:

1. ✅ SAC account with Planning permissions
2. ✅ Planning Model: **PRDA_PL_PLAN** (with actuals data loaded)
3. ✅ Predictive Scenario created in SAC
4. ✅ OpenAI API key
5. ✅ Node.js 18.x or higher
6. ✅ Cloud Foundry CLI (for deployment)

---

## 📋 Step 1: Configure SAC Multi-Action

### 1.1 Create Multi-Action in SAC

1. Open SAC and navigate to your Planning Model: **PRDA_PL_PLAN**
2. Go to **Multi-Actions** section
3. Click **Create New Multi-Action**
4. Name it: `Run_Predictive_Forecast`

### 1.2 Add Multi-Action Steps

**Step 1: Run Predictive Scenario**
- Action: Run Predictive Scenario
- Scenario: Select your predictive scenario
- Input Parameters:
  - `GLAccount` (string)
  - `ForecastPeriod` (number)

**Step 2: Save Forecast**
- Action: Save Data
- Target Version: Use parameter `VersionName`
- Commit: Yes

**Step 3: Refresh Story** (Optional)
- Action: Refresh Story
- Story: Select your forecast story
- Or: Use Story ID parameter

### 1.3 Get Multi-Action ID

After creating the Multi-Action:
1. Open browser Developer Tools (F12)
2. Navigate to the Multi-Action
3. Copy the Multi-Action ID from the URL
4. Format: `{modelId}_MultiAction_{id}`

---

## 📋 Step 2: Clone and Configure Project

### 2.1 Clone Repository

```bash
git clone https://github.com/rinkucvshealth/AI_PREDICTIVE_AGENT.git
cd AI_PREDICTIVE_AGENT
```

### 2.2 Install Dependencies

```bash
npm install
```

### 2.3 Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` file:

```bash
# SAC Connection
SAC_TENANT_URL=https://cvs-pharmacy-q.us10.hcs.cloud.sap
SAC_USERNAME=your_sac_username
SAC_PASSWORD=your_sac_password

# SAC Planning Model
SAC_MODEL_ID=PRDA_PL_PLAN
SAC_MULTI_ACTION_ID=your_multi_action_id_from_step_1.3

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key

# Server
PORT=3002
API_KEY=your-api-key-for-authentication
```

---

## 📋 Step 3: Test Locally

### 3.1 Start Development Server

```bash
npm run dev
```

### 3.2 Test Health Endpoint

```bash
curl http://localhost:3002/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-11-24T...",
  "service": "AI Predictive Agent"
}
```

### 3.3 Test SAC Connection

```bash
curl http://localhost:3002/api/forecast/test-sac
```

### 3.4 Test Forecast Query

```bash
curl -X POST http://localhost:3002/api/forecast/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Forecast GL account 41000000 for the next 6 months"
  }'
```

Expected response:
```json
{
  "success": true,
  "summary": "Forecast initiated for GL Account 41000000 (6 months) → Version: Forecast_20241124",
  "details": {
    "glAccount": "41000000",
    "forecastPeriod": 6,
    "versionName": "Forecast_20241124",
    "multiActionStatus": "success"
  }
}
```

---

## 📋 Step 4: Deploy to Cloud Foundry

### 4.1 Update manifest.yml

Edit `manifest.yml` and update the environment variables:

```yaml
SAC_USERNAME: <YOUR_SAC_USERNAME>
SAC_PASSWORD: <YOUR_SAC_PASSWORD>
SAC_MULTI_ACTION_ID: <YOUR_MULTI_ACTION_ID>
OPENAI_API_KEY: <YOUR_OPENAI_API_KEY>
API_KEY: <YOUR_API_KEY>
```

### 4.2 Login to Cloud Foundry

```bash
cf login -a https://api.cf.us10.hana.ondemand.com
# Enter your credentials
```

### 4.3 Deploy

```bash
npm run build
cf push
```

### 4.4 Verify Deployment

```bash
# Check app status
cf app ai-predictive-agent

# View logs
cf logs ai-predictive-agent --recent

# Test deployed app
curl https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/health
```

---

## 📋 Step 5: Integration Options

### Option A: Direct API Integration

Call the API from any application:

```javascript
const response = await fetch('https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/api/forecast/query', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-api-key'
  },
  body: JSON.stringify({
    query: 'Forecast GL 41000000 for 6 months'
  })
});

const result = await response.json();
console.log(result.summary);
```

### Option B: SAC Widget Integration

Integrate with existing SAC Custom Widget:

```javascript
// In your SAC widget
async function runForecast(query) {
  const response = await fetch('https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/api/forecast/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  return await response.json();
}
```

### Option C: SAC Story Script

Add to SAC Story Application Designer:

```javascript
Application.runForecast = function(glAccount, months) {
  var query = "Forecast GL " + glAccount + " for " + months + " months";
  
  var xhr = new XMLHttpRequest();
  xhr.open("POST", "https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/api/forecast/query");
  xhr.setRequestHeader("Content-Type", "application/json");
  
  xhr.onload = function() {
    var result = JSON.parse(xhr.responseText);
    console.log("Forecast completed:", result.summary);
  };
  
  xhr.send(JSON.stringify({ query: query }));
};
```

---

## 🔧 Troubleshooting

### Issue: SAC Connection Failed

**Error**: `SAC connection failed: 401 Unauthorized`

**Solution**:
- Verify SAC_USERNAME and SAC_PASSWORD are correct
- Check user has Planning permissions
- Ensure user can access PRDA_PL_PLAN model

### Issue: Multi-Action Not Found

**Error**: `Failed to trigger Multi-Action: 404 Not Found`

**Solution**:
- Verify SAC_MULTI_ACTION_ID is correct
- Check Multi-Action exists in the model
- Ensure Multi-Action is published/active

### Issue: OpenAI Error

**Error**: `Failed to interpret forecast query`

**Solution**:
- Verify OPENAI_API_KEY is valid
- Check OpenAI API quota
- Try rephrasing the query

---

## 📚 Next Steps

1. ✅ Test with different GL accounts
2. ✅ Customize version naming convention
3. ✅ Add story refresh functionality
4. ✅ Create SAC widget integration
5. ✅ Set up monitoring and logging

---

## 🆘 Support

For issues or questions:
- Check logs: `cf logs ai-predictive-agent --recent`
- Review SAC Multi-Action execution logs
- Contact SAP Basis team for SAC permissions

---

**Last Updated**: November 2024
