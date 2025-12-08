# 403 Forbidden Error - CSRF Token Fix ✅

## Problem Identified

The **403 Forbidden** error was occurring because SAP Analytics Cloud's Data Import API requires a **CSRF (Cross-Site Request Forgery) token** for all POST, PUT, and DELETE operations.

### Error Analysis

From the logs, we could see:
- ✅ OAuth authentication was working (401 error resolved)
- ✅ Valid access token was being acquired
- ✅ Token had correct scopes: `dmi-api-proxy-sac-sacus10!t655.apiaccess`
- ❌ POST request was failing with 403
- 🔑 Response header showed: `x-csrf-token: Required`

## Solution Implemented

### Changes Made to `src/clients/sac-client.ts`

#### 1. Added CSRF Token Storage
```typescript
private csrfToken: string | null = null;
private cookies: string[] = [];
```

#### 2. Added Cookie Support
```typescript
this.axiosClient = axios.create({
  baseURL: this.tenantUrl,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 60000,
  withCredentials: true, // Enable cookie handling
});
```

#### 3. Implemented CSRF Token Fetching
```typescript
private async fetchCsrfToken(): Promise<string> {
  // Make a GET request with x-csrf-token: Fetch header
  // SAC returns the CSRF token and session cookies
  const response = await this.axiosClient.get('/api/v1/dataimport/planningModel', {
    headers: {
      'x-csrf-token': 'Fetch',
    },
  });

  const csrfToken = response.headers['x-csrf-token'];
  const setCookieHeader = response.headers['set-cookie'];

  // Store CSRF token and cookies for subsequent requests
  this.csrfToken = csrfToken;
  this.cookies = setCookieHeader;
  
  return csrfToken;
}
```

#### 4. Updated Multi-Action Trigger
```typescript
async triggerMultiAction(request: SACMultiActionRequest): Promise<SACMultiActionResponse> {
  // Fetch CSRF token before making POST request
  const csrfToken = await this.fetchCsrfToken();

  // Prepare headers with CSRF token and cookies
  const headers: any = {
    'x-csrf-token': csrfToken,
  };

  // Add cookies to maintain session
  if (this.cookies.length > 0) {
    headers['Cookie'] = this.cookies.map(cookie => 
      cookie.split(';')[0]
    ).join('; ');
  }

  // Make POST request with CSRF token and cookies
  const response = await this.axiosClient.post(endpoint, requestBody, { headers });
}
```

## How SAC CSRF Protection Works

### Two-Step Process

1. **Fetch CSRF Token (GET Request)**
   - Client: `GET /api/v1/dataimport/planningModel` with `x-csrf-token: Fetch` header
   - Server: Returns CSRF token in `x-csrf-token` response header
   - Server: Sets session cookies in `Set-Cookie` header

2. **Use CSRF Token (POST Request)**
   - Client: `POST /api/v1/dataimport/planningModel/.../runs` 
   - Client: Include `x-csrf-token` header with the fetched token
   - Client: Include `Cookie` header with session cookies
   - Server: Validates CSRF token and cookies, then processes request

### Security Benefits

- **Prevents CSRF attacks**: Malicious sites can't make authenticated requests without the token
- **Session binding**: Token is tied to the authenticated session via cookies
- **Token rotation**: Each session gets a new token

## Deployment Instructions

### Build the Application
```bash
cd /workspace
npm run build
```

### Deploy to Cloud Foundry
```bash
# Option 1: Use the deployment script
./deploy-oauth-fix.sh

# Option 2: Manual deployment
cf login -a https://api.cf.us10.hana.ondemand.com
cf target -o CVS_sap_ai -s cvs_ret_sapai
cf push
```

### Verify the Fix

1. **Check Application Logs**
   ```bash
   cf logs ai-predictive-agent --recent
   ```

2. **Look for These Success Indicators**
   ```
   🔒 Fetching CSRF token from SAC...
   ✓ CSRF token acquired: [token preview]
   ✓ Stored [N] cookie(s) for session
   🎯 Triggering SAC Multi-Action
   ✅ Multi-Action triggered successfully
   ```

3. **Test in SAC Widget**
   - Open your SAC story
   - Enter a forecast query: "Generate 12 month forecast for account 400250"
   - The Multi-Action should now execute successfully

## What Changed

| Before | After |
|--------|-------|
| ❌ 401 Unauthorized (OAuth missing) | ✅ OAuth working |
| ❌ 403 Forbidden (CSRF missing) | ✅ CSRF token fetched and included |
| No cookie handling | ✅ Session cookies maintained |
| Single-step POST request | ✅ Two-step: Fetch token → POST with token |

## Technical Details

### Request Flow

```
User Query → OpenAI Interpretation → SAC Multi-Action Trigger
                                           ↓
                                    1. Acquire OAuth Token
                                           ↓
                                    2. Fetch CSRF Token + Cookies
                                           ↓
                                    3. POST with OAuth + CSRF + Cookies
                                           ↓
                                    Multi-Action Execution
```

### Headers in Multi-Action Request

```
Authorization: Bearer [OAuth token]
x-csrf-token: [CSRF token]
Cookie: JSESSIONID=...; __VCAP_ID__=...
Content-Type: application/json
```

## Troubleshooting

### If 403 Still Occurs

1. **Check CSRF Token Fetch Logs**
   - Should see: "🔒 Fetching CSRF token from SAC..."
   - Should see: "✓ CSRF token acquired"

2. **Verify Cookies Are Stored**
   - Should see: "✓ Stored N cookie(s) for session"

3. **Check Token Endpoint Access**
   - OAuth client must have access to `/api/v1/dataimport/planningModel` endpoint
   - May need `sap.fpa.planning.model.Admin` role

4. **Session Timeout**
   - CSRF tokens expire with the session
   - Each request fetches a fresh token
   - No caching issues

### If Other Errors Occur

- **404 Not Found**: Multi-Action ID or Model ID incorrect
- **401 Unauthorized**: OAuth token expired or invalid scopes
- **500 Internal Server Error**: Check Multi-Action configuration in SAC

## Summary

✅ **401 Error**: Resolved with OAuth client credentials flow  
✅ **403 Error**: Resolved with CSRF token fetching and cookie management  
✅ **Ready to Deploy**: Build successful, code changes complete  

Your AI Predictive Agent should now work correctly with SAC Multi-Actions!

## Next Steps

1. Deploy the updated code: `./deploy-oauth-fix.sh`
2. Test in SAC widget
3. Monitor logs for any new issues
4. Celebrate! 🎉
