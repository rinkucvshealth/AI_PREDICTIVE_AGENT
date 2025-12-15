# Multi-Action POST Test Plan

## Discovery Results Analysis

✅ **All endpoints return 200 OK** - They exist!  
❌ **But responses are HTML redirects** - SAC approuter is intercepting

### What We Found:
- Multi-Action endpoints **DO exist**
- GET requests return 200 (but with HTML redirect to login)
- POST requests return 404 (approuter blocking)
- SAC is treating API requests as browser requests

## Root Cause:
SAC's **approuter** is intercepting requests before they reach the API layer.

## Solution Applied:
Added required headers to bypass approuter:
- `X-Requested-With: XMLHttpRequest` (tells SAC this is an API request)
- Enhanced CSRF token handling
- Cookie session management
- Origin/Referer headers

## New Test Endpoint:
`POST /api/forecast/test-multiaction-post`

This will test POST requests with 4 different header combinations:
1. Standard API headers
2. With CSRF token
3. With cookies
4. Browser-like headers (most complete)

## Deploy and Test:

```bash
# 1. Deploy
cf push

# 2. Test POST with different header combinations
curl -X POST https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/api/forecast/test-multiaction-post

# 3. If successful, test the actual forecast query
curl -X POST https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/api/forecast/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Create 6 month forecast for GL 500100"}'
```

## Expected Results:

### Scenario A: Header combination works ✅
One of the header combinations will return success (not HTML redirect).
→ We'll update the main Multi-Action trigger to use those headers.
→ Problem solved!

### Scenario B: All header combinations fail ❌
All combinations still return HTML redirects or 404.
→ SAC approuter requires different authentication approach.
→ May need to use SAC's embedded API or different auth flow.
→ Contact BASIS team for SAC API gateway configuration.

## Next Steps After Test:

If test shows a working combination, I'll update `triggerMultiAction()` to use those exact headers.
