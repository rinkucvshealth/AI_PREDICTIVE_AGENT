# Simplified Multi-Action - Single Parameter

## 🎯 Changes Made

The Multi-Action has been simplified to use only ONE hardcoded parameter instead of three dynamic parameters.

### Before (3 Parameters):
```javascript
{
  GLAccount: "500100",        // User input
  ForecastPeriod: 6,          // User input  
  VersionName: "Forecast_20251215"  // Auto-generated
}
```

### After (1 Parameter):
```javascript
{
  VersionToSaveForecast: "aipredictive"  // Hardcoded
}
```

## 📝 Code Changes

### 1. **Updated Types** (`src/types/index.ts`)
- `SACMultiActionRequest` now accepts single parameter: `VersionToSaveForecast`
- `ForecastResponse.details` made `glAccount` and `forecastPeriod` optional

### 2. **Simplified OpenAI Interpretation** (`src/clients/openai-client.ts`)
- Now just **validates** if the query is a forecast request
- Doesn't extract GL Account or Forecast Period anymore
- Returns confidence score (must be >= 0.7 to proceed)

### 3. **Simplified Route Handler** (`src/routes/forecast.ts`)
- Removed parameter extraction logic
- Always sends single hardcoded parameter: `VersionToSaveForecast: 'aipredictive'`
- Simplified success response

## 🚀 How It Works Now

### User Query Examples (All Valid):
```
"Create forecast"
"Generate prediction"
"Run forecast"  
"Predict for next 6 months"
"Create 6 month forecast for GL 500100"
```

**Note**: User can still mention GL accounts and periods in their query, but they're **ignored**. The Multi-Action uses its own hardcoded logic.

### Flow:
1. User sends natural language query
2. OpenAI validates it's a forecast request (confidence check)
3. System triggers Multi-Action with: `{VersionToSaveForecast: 'aipredictive'}`
4. SAC executes the Multi-Action (with its own internal logic)
5. Returns success message

## 📊 API Request/Response

### Request:
```bash
curl -X POST https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/api/forecast/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Create forecast"}'
```

### Response (Success):
```json
{
  "success": true,
  "summary": "AI Predictive forecast initiated successfully → Version: aipredictive",
  "details": {
    "versionName": "aipredictive",
    "multiActionStatus": "success",
    "executionId": "abc123"
  },
  "sessionId": "default"
}
```

### Response (Not a Forecast Request):
```json
{
  "success": false,
  "summary": "Failed to interpret your forecast request. Please try rephrasing.",
  "error": "Query interpretation failed"
}
```

## ✅ Benefits

1. **Simpler Integration**: No need to extract/validate parameters
2. **Fewer Errors**: Hardcoded parameter = no validation issues
3. **Faster Response**: Less OpenAI processing
4. **Consistent Output**: Same parameter every time
5. **Flexible Multi-Action**: All logic in SAC Multi-Action (easier to change)

## 🔧 Testing

After deploying, test with ANY forecast-related query:

```bash
# All of these work:
curl -X POST [URL] -d '{"query": "Create forecast"}'
curl -X POST [URL] -d '{"query": "Run prediction"}'
curl -X POST [URL] -d '{"query": "Generate 6 month forecast"}'
curl -X POST [URL] -d '{"query": "Forecast GL 500100"}'
```

## 📋 Deployment

```bash
# Build is already done
cf push
```

## 🎯 What Stays the Same

- ✅ OAuth authentication (refresh token)
- ✅ CSRF token handling
- ✅ Cookie-based sessions
- ✅ Multi-Action ID: `t.2:E5280280114D3785596849C3D321B820`
- ✅ All diagnostic endpoints
- ✅ Error handling and logging

Only the **parameter sent to Multi-Action** changed!

## ⚠️ Important

Make sure the SAC Multi-Action is configured to:
1. ✅ Accept parameter: `VersionToSaveForecast` (string)
2. ✅ Use hardcoded values for GL Account and Forecast Period internally
3. ✅ "Allow External API Access" enabled
4. ✅ User has execute permission

The Multi-Action should handle all the forecast logic internally now.
