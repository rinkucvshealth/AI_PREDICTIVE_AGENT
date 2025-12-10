# 🔐 How to Get SAC Refresh Token (Interactive Usage)

**Purpose**: Get a refresh token from SAC OAuth client with "Interactive Usage" to fix 401 Multi-Action errors

**Time Required**: 15-30 minutes  
**Prerequisites**: SAC OAuth client with "Interactive Usage" purpose

---

## 🎯 Overview

The refresh token allows your backend service to get access tokens **as a real SAC user** (not as a service/machine). This satisfies the SAC Multi-Action requirement for user-context authentication.

**Flow**:
1. **One-time**: User performs interactive login via browser → Gets refresh token
2. **Backend**: Uses refresh token to get access tokens automatically
3. **Multi-Action**: Works because token has user context ✅

---

## 📋 Prerequisites

### 1. SAC OAuth Client with "Interactive Usage"

Your SAC admin must create an OAuth client with these settings:

**Location**: SAC → System → Administration → App Integration → OAuth Clients

**Configuration**:
```
Name: AI Predictive Agent
Purpose: Interactive Usage and API Access ✅
Access Type: Confidential
Grant Types:
  ✅ Authorization Code
  ✅ Refresh Token
Token Lifetime: 3600 seconds
Redirect URIs:
  - http://localhost:8080/oauth/callback (for local testing)
  - https://your-app-url/oauth/callback (for production)

Required Scopes:
  ✅ Data Import Service API
  ✅ Planning Model API
  ✅ Multi-Action Execution
  ✅ Read Planning Data
  ✅ Write Planning Data
```

**Get from SAC Admin**:
- Client ID
- Client Secret
- Authorized Redirect URI

---

## 🚀 Method 1: Using Browser (Recommended)

### **Step 1: Construct Authorization URL**

Open your browser and navigate to:

```
https://cvs-pharmacy-q.us10.hcs.cloud.sap/oauth/authorize?response_type=code&client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost:8080/oauth/callback
```

**Replace**:
- `cvs-pharmacy-q.us10.hcs.cloud.sap` → Your SAC tenant URL
- `YOUR_CLIENT_ID` → Your OAuth client ID
- `http://localhost:8080/oauth/callback` → Your redirect URI

### **Step 2: Login to SAC**

1. Browser redirects to SAC login page
2. Enter your **SAC username and password**
3. Click "Log In"
4. (Optional) Approve permissions if prompted

### **Step 3: Get Authorization Code**

After successful login, browser redirects to:

```
http://localhost:8080/oauth/callback?code=AUTHORIZATION_CODE_HERE
```

**Copy the `code` parameter** from the URL (the long string after `code=`)

### **Step 4: Exchange Code for Tokens**

Run this command (replace placeholders):

```bash
curl -X POST \
  'https://cvs-pharmacy-q.us10.hcs.cloud.sap/oauth/token' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -u 'YOUR_CLIENT_ID:YOUR_CLIENT_SECRET' \
  -d 'grant_type=authorization_code' \
  -d 'code=AUTHORIZATION_CODE_FROM_STEP_3' \
  -d 'redirect_uri=http://localhost:8080/oauth/callback'
```

**Replace**:
- `YOUR_CLIENT_ID` → Your client ID
- `YOUR_CLIENT_SECRET` → Your client secret
- `AUTHORIZATION_CODE_FROM_STEP_3` → The code from browser URL

### **Step 5: Extract Refresh Token**

Response will look like:

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "Planning.API MultiAction.Execute ..."
}
```

**Copy the `refresh_token`** value.

### **Step 6: Set Environment Variable**

Add to your `.env` file:

```bash
SAC_REFRESH_TOKEN=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Important**: Keep this secure! The refresh token is like a password.

---

## 🔧 Method 2: Using Helper Script

Create a file `get-refresh-token.js`:

```javascript
const express = require('express');
const axios = require('axios');

const app = express();
const PORT = 8080;

// Configuration (update these)
const SAC_TENANT = 'https://cvs-pharmacy-q.us10.hcs.cloud.sap';
const CLIENT_ID = 'your-client-id';
const CLIENT_SECRET = 'your-client-secret';
const REDIRECT_URI = 'http://localhost:8080/oauth/callback';

// Step 1: Start server and show authorization URL
app.listen(PORT, () => {
  console.log('🚀 OAuth Helper Server Started');
  console.log('');
  console.log('📋 Step 1: Open this URL in your browser:');
  console.log('');
  const authUrl = `${SAC_TENANT}/oauth/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
  console.log(authUrl);
  console.log('');
  console.log('Then login to SAC and wait for redirect...');
});

// Step 2: Handle callback and exchange code for tokens
app.get('/oauth/callback', async (req, res) => {
  const code = req.query.code;
  
  if (!code) {
    return res.send('❌ Error: No authorization code received');
  }

  console.log('');
  console.log('✅ Authorization code received:', code);
  console.log('');
  console.log('📋 Step 2: Exchanging code for tokens...');

  try {
    const tokenUrl = `${SAC_TENANT}/oauth/token`;
    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    
    const response = await axios.post(
      tokenUrl,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`,
        },
      }
    );

    const { access_token, refresh_token, expires_in, scope } = response.data;

    console.log('');
    console.log('✅✅✅ SUCCESS! ✅✅✅');
    console.log('');
    console.log('📋 Your Tokens:');
    console.log('');
    console.log('Access Token:', access_token.substring(0, 50) + '...');
    console.log('Expires in:', expires_in, 'seconds');
    console.log('');
    console.log('🔑 REFRESH TOKEN (copy this to .env):');
    console.log('');
    console.log('SAC_REFRESH_TOKEN=' + refresh_token);
    console.log('');
    console.log('Scopes:', scope);
    console.log('');
    console.log('📝 Next Steps:');
    console.log('1. Copy the line above to your .env file');
    console.log('2. Restart your application');
    console.log('3. Multi-Actions should now work!');
    console.log('');

    res.send(`
      <html>
        <body>
          <h1>✅ Success! Tokens Acquired</h1>
          <p>Check your terminal for the refresh token.</p>
          <p>Copy the <code>SAC_REFRESH_TOKEN=...</code> line to your .env file</p>
          <p>You can close this window now.</p>
        </body>
      </html>
    `);

    // Auto-shutdown after 5 seconds
    setTimeout(() => {
      console.log('Shutting down server...');
      process.exit(0);
    }, 5000);

  } catch (error) {
    console.error('');
    console.error('❌ Error exchanging code for tokens:');
    console.error(error.response?.data || error.message);
    console.error('');
    
    res.send('❌ Error: ' + (error.response?.data?.error_description || error.message));
  }
});
```

**Run the script**:

```bash
npm install express axios
node get-refresh-token.js
```

Follow the instructions in terminal.

---

## 🧪 Method 3: Using Postman

### **Step 1: Authorization Request**

1. Open Postman
2. Create new request: GET
3. URL: `https://cvs-pharmacy-q.us10.hcs.cloud.sap/oauth/authorize`
4. Params:
   - `response_type` = `code`
   - `client_id` = `your-client-id`
   - `redirect_uri` = `http://localhost:8080/oauth/callback`
5. Click "Send"
6. Postman will show HTML login page
7. Copy the URL and open in **real browser**
8. Login and copy the `code` from redirect URL

### **Step 2: Token Exchange**

1. Create new request: POST
2. URL: `https://cvs-pharmacy-q.us10.hcs.cloud.sap/oauth/token`
3. Authorization: Basic Auth
   - Username: `your-client-id`
   - Password: `your-client-secret`
4. Body: `x-www-form-urlencoded`
   - `grant_type` = `authorization_code`
   - `code` = `code-from-step-1`
   - `redirect_uri` = `http://localhost:8080/oauth/callback`
5. Click "Send"
6. Copy `refresh_token` from response

---

## 🔄 Refresh Token Lifecycle

### **Token Expiry**

- **Access Token**: Expires in ~1 hour (3600 seconds)
- **Refresh Token**: Expires in ~90 days (varies by SAC configuration)

### **Automatic Refresh**

Your application will automatically use the refresh token to get new access tokens when needed. You don't need to do anything.

### **Refresh Token Expired?**

If refresh token expires (after ~90 days), you'll see:

```
[ERROR] Failed OAuth: invalid_grant (Refresh token expired)
```

**Solution**: Repeat the process above to get a new refresh token.

---

## ✅ Verification

### **Test the Refresh Token**

```bash
curl -X POST \
  'https://cvs-pharmacy-q.us10.hcs.cloud.sap/oauth/token' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -u 'YOUR_CLIENT_ID:YOUR_CLIENT_SECRET' \
  -d 'grant_type=refresh_token' \
  -d 'refresh_token=YOUR_REFRESH_TOKEN'
```

**Expected**: Returns new `access_token` ✅

### **Check Token Scopes**

Copy the access token and go to https://jwt.io

Paste the token and check the payload:

```json
{
  "scope": [
    "Planning.API",
    "MultiAction.Execute",
    "Planning.Read",
    "Planning.Write"
  ],
  "user_name": "your.user@company.com",
  ...
}
```

**Verify**:
- ✅ Has `MultiAction.Execute` scope
- ✅ Has `user_name` (real user context)
- ✅ Has `Planning.Write` scope

---

## 🔐 Security Best Practices

### **DO**:
- ✅ Store refresh token in `.env` file
- ✅ Add `.env` to `.gitignore`
- ✅ Use different tokens for dev/staging/prod
- ✅ Rotate refresh tokens every 90 days
- ✅ Use Cloud Foundry user-provided service for prod

### **DON'T**:
- ❌ Commit refresh token to Git
- ❌ Share refresh token in chat/email
- ❌ Use personal user account for production
- ❌ Log refresh token in application logs

### **Cloud Foundry Security**

In production, use user-provided service:

```bash
cf cups sac-oauth -p '{
  "client_id": "...",
  "client_secret": "...",
  "refresh_token": "..."
}'

cf bind-service your-app sac-oauth
cf restage your-app
```

Access in code:
```javascript
const vcapServices = JSON.parse(process.env.VCAP_SERVICES);
const sacCreds = vcapServices['user-provided'][0].credentials;
const refreshToken = sacCreds.refresh_token;
```

---

## 🆘 Troubleshooting

### **Error: Invalid Redirect URI**

```
error: invalid_request
error_description: Invalid redirect_uri
```

**Solution**: 
1. Check redirect URI in OAuth client configuration
2. Ensure exact match (including http/https, trailing slash, etc.)
3. Add your redirect URI to OAuth client's allowed list

### **Error: Invalid Grant**

```
error: invalid_grant
error_description: Invalid authorization code
```

**Solution**:
1. Authorization code expires in ~10 minutes - get a fresh one
2. Code can only be used once - start over if already used
3. Ensure redirect_uri matches exactly

### **Error: Unauthorized Client**

```
error: unauthorized_client
error_description: Client is not authorized for this grant type
```

**Solution**:
1. Check OAuth client has "Authorization Code" grant type enabled
2. Check OAuth client has "Refresh Token" grant type enabled
3. Contact SAC admin to update client configuration

### **No Multi-Action Scopes in Token**

Check token at jwt.io - if no planning/multiaction scopes:

**Solution**:
1. OAuth client needs scopes added (SAC admin)
2. Re-create OAuth client with correct scopes
3. Get fresh refresh token with new client

---

## 📊 Summary

| Step | Action | Time |
|------|--------|------|
| 1 | Get OAuth client from SAC admin | 5 min |
| 2 | Construct authorization URL | 1 min |
| 3 | Login via browser | 1 min |
| 4 | Get authorization code | 1 min |
| 5 | Exchange code for tokens | 2 min |
| 6 | Extract refresh token | 1 min |
| 7 | Add to .env and test | 5 min |
| **Total** | | **15-20 min** |

---

## 🎯 Expected Result

After setting `SAC_REFRESH_TOKEN`:

```log
[INFO] 🔐 Starting OAuth token acquisition
[INFO] Attempting Method 1: Refresh Token (Interactive Usage) ✅ RECOMMENDED...
[INFO]   → Using Refresh Token flow (Interactive Usage)
[INFO]   ✓ Token acquired: eyJhbGciOiJSUzI1...
[INFO]   ✓ Scopes: Planning.API MultiAction.Execute Planning.Read Planning.Write
[INFO] ✅ Success with Method 1: Refresh Token (Interactive Usage) ✅ RECOMMENDED

[INFO] 🎯 Triggering SAC Multi-Action
[INFO] ✅ Multi-Action triggered successfully via Multi-Action Executions API
[INFO] Status: success
```

**No more 401 errors!** 🎉

---

**Questions?** See `CHECKLIST_IMPLEMENTATION_SUMMARY.md` or `AUTHORIZATION_ROOT_CAUSE_ANALYSIS.md`
