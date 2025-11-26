# SAC Predictive Scenario AI Agent

AI-powered agent for running SAC predictive scenarios using natural language queries.

## 🎯 Overview

This AI agent allows users to interact with SAP Analytics Cloud (SAC) predictive scenarios using natural language. Users can request forecasts for specific GL accounts and time periods, and the agent will:

1. Interpret the natural language request using OpenAI GPT
2. Trigger SAC Multi-Action to run predictive scenario
3. Save forecast results to specified version
4. Refresh SAC story to display new forecasts

## 🏗️ Architecture

```
User Input (NLP)
    ↓
AI Agent (OpenAI GPT-4)
    ↓
Parse: GL Account, Period, Version
    ↓
SAC Multi-Action Trigger (REST API)
    ↓
    ├─ Step 1: Run Predictive Scenario
    ├─ Step 2: Save Forecast to Version
    └─ Step 3: Refresh Story
    ↓
✅ Forecast Complete
```

## 📋 Configuration

### SAC Environment
- **Tenant**: https://cvs-pharmacy-q.us10.hcs.cloud.sap
- **Planning Model**: PRDA_PL_PLAN (Planning Model with Actuals Data)
- **Environment**: QA

### Prerequisites
1. SAC user account with Planning permissions
2. Multi-Action configured in SAC
3. OpenAI API key
4. Node.js 18.x or higher

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your credentials
```

### 3. Run Locally
```bash
npm run dev
```

### 4. Deploy to Cloud Foundry
```bash
npm run build
cf push
```

## 💬 Example Queries

- "Forecast GL account 41000000 for the next 6 months"
- "Run prediction for GL 50000000 for 3 months in version Q1_Forecast"
- "Generate 12-month forecast for account 41000000"
- "Predict next quarter for GL account 60000000"

## 📁 Project Structure

```
AI_PREDICTIVE_AGENT/
├── src/
│   ├── server.ts              # Express server
│   ├── config.ts              # Configuration
│   ├── clients/
│   │   ├── openai-client.ts   # OpenAI integration
│   │   └── sac-client.ts      # SAC API client
│   ├── routes/
│   │   └── forecast.ts        # Forecast API endpoints
│   ├── utils/
│   │   └── logger.ts          # Logging utility
│   └── types/
│       └── index.ts           # TypeScript types
├── package.json
├── tsconfig.json
├── manifest.yml               # Cloud Foundry config
└── README.md
```

## 🔐 Environment Variables

Required environment variables:

```bash
# SAC Connection
SAC_TENANT_URL=https://cvs-pharmacy-q.us10.hcs.cloud.sap
SAC_USERNAME=your_sac_username
SAC_PASSWORD=your_sac_password

# Planning Model
SAC_MODEL_ID=PRDA_PL_PLAN
SAC_MULTI_ACTION_ID=your_multi_action_id

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key

# Server
PORT=3002
NODE_ENV=development
```

## 📖 API Endpoints

### POST /api/forecast/query
Main endpoint for natural language forecast requests.

**Request:**
```json
{
  "query": "Forecast GL account 41000000 for next 6 months",
  "sessionId": "optional-session-id"
}
```

**Response:**
```json
{
  "success": true,
  "summary": "Forecast generated for GL 41000000 (6 months)",
  "details": {
    "glAccount": "41000000",
    "forecastPeriod": 6,
    "versionName": "Forecast_2024_11",
    "multiActionStatus": "completed"
  }
}
```

## 🔧 SAC Multi-Action Setup

### Required Multi-Action Steps:
1. Run Predictive Scenario (with parameters)
2. Save Forecast to Version
3. Refresh Target Story

### Parameters:
- `GLAccount` (string)
- `ForecastPeriod` (number)
- `VersionName` (string)

## 📝 Development

### Build TypeScript
```bash
npm run build
```

### Watch Mode
```bash
npm run watch
```

### Run Tests
```bash
npm test
```

## 🚀 Deployment

### Cloud Foundry
```bash
cf login
cf push
```

### Environment Variables
Set via CF CLI:
```bash
cf set-env ai-predictive-agent SAC_USERNAME "your_username"
cf set-env ai-predictive-agent SAC_PASSWORD "your_password"
cf restart ai-predictive-agent
```

## 📊 Monitoring

Check logs:
```bash
cf logs ai-predictive-agent --recent
```

Check app status:
```bash
cf app ai-predictive-agent
```

## 🤝 Contributing

This is an internal CVS Health SAP AI project.

## 📄 License

Internal Use Only - CVS Health

## 🔗 Related Projects

- [sac-custom-widget-bas1](https://github.com/rinkucvshealth/sac-custom-widget-bas1) - SAC Custom Widget with AI Chatbot

---

**Last Updated**: November 2024
**Status**: 🚧 In Development
