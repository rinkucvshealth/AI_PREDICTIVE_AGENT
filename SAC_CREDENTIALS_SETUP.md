# SAC Credentials Setup - PERMANENT SOLUTION

## Problem
Getting 401 Unauthorized error from SAC Multi-Action API due to missing/incorrect OAuth credentials.

## Solution Options

### Option 1: OAuth Client Credentials (Recommended for Production)

#### Step 1: Create OAuth Client in SAC
1. Log in to SAC: https://cvs-pharmacy-q.us10.hcs.cloud.sap
2. Go to **System** → **Administration** → **App Integration**
3. Click **Add a New OAuth Client**
4. Configure:
   - **Name**: AI Predictive Agent
   - **Purpose**: Interactive Usage and API Access
   - **Grant Type**: Client Credentials
   - **Token Lifetime**: 3600 seconds
   - **Scopes**: 
     - Planning
     - Data Import
     - Story Read/Write
5. Click **Add** and **SAVE THE CLIENT ID AND SECRET** (shown only once!)

#### Step 2: Set Environment Variables in Cloud Foundry
```bash
# Set SAC OAuth credentials
cf set-env ai-predictive-agent SAC_CLIENT_ID "your-actual-client-id-here"
cf set-env ai-predictive-agent SAC_CLIENT_SECRET "your-actual-client-secret-here"

# Verify they're set
cf env ai-predictive-agent | grep SAC_CLIENT

# Restart the app
cf restart ai-predictive-agent
```

#### Step 3: Test the Connection
```bash
# Watch the logs
cf logs ai-predictive-agent --recent

# Test in SAC widget - should now work!
```

---

### Option 2: Basic Authentication (If OAuth Not Available)

If your SAC instance doesn't support OAuth or you can't create an OAuth client, you can modify the code to use Basic Authentication with a technical user.

#### Step 1: Create Technical User in SAC
1. Go to **System** → **Administration** → **Security** → **User Management**
2. Create a technical user with appropriate permissions
3. Note the username and password

#### Step 2: Set Environment Variables
```bash
cf set-env ai-predictive-agent SAC_USERNAME "technical-user@company.com"
cf set-env ai-predictive-agent SAC_PASSWORD "technical-user-password"
cf set-env ai-predictive-agent SAC_AUTH_METHOD "basic"

cf restart ai-predictive-agent
```

#### Step 3: Code Changes Required
The application needs to be modified to support Basic Authentication (see BASIC_AUTH_IMPLEMENTATION.md)

---

### Option 3: Service Binding (Best for SAP BTP)

If running on SAP BTP, you can use service bindings:

1. Create SAC service instance:
```bash
cf create-service sac-platform standard sac-service -c sac-config.json
```

2. Bind to your app:
```bash
cf bind-service ai-predictive-agent sac-service
cf restart ai-predictive-agent
```

---

## Verification Checklist

After setting credentials, verify:

- [ ] Environment variables are set (not "placeholder")
- [ ] App restarts successfully
- [ ] Logs show "Successfully obtained OAuth access token"
- [ ] No more 401 errors in logs
- [ ] SAC widget can trigger forecasts

## Troubleshooting

### Still getting 401 errors?

1. **Check OAuth Token URL**
   The app auto-constructs the OAuth token URL from your tenant URL. For `https://cvs-pharmacy-q.us10.hcs.cloud.sap`, it becomes:
   ```
   https://cvs-pharmacy-q.authentication.us10.hana.ondemand.com/oauth/token
   ```
   
   If this is wrong, override it:
   ```bash
   cf set-env ai-predictive-agent SAC_OAUTH_TOKEN_URL "https://correct-url/oauth/token"
   cf restart ai-predictive-agent
   ```

2. **Check OAuth Client Scopes**
   Make sure your OAuth client has these scopes:
   - Planning
   - Data Import API
   - Multi-Action execution rights

3. **Check Multi-Action ID**
   Verify the Multi-Action ID is correct:
   ```bash
   cf env ai-predictive-agent | grep SAC_MULTI_ACTION_ID
   ```
   Should be: `E5280280114D3785596849C3D321B820`

4. **Check Multi-Action Permissions**
   In SAC, verify the OAuth client/user has permission to:
   - Access the Planning Model: `PRDA_PL_PLAN`
   - Execute the Multi-Action: `E5280280114D3785596849C3D321B820`

5. **Test OAuth Token Manually**
   ```bash
   curl -X POST https://cvs-pharmacy-q.authentication.us10.hana.ondemand.com/oauth/token \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -H "Authorization: Basic $(echo -n 'CLIENT_ID:CLIENT_SECRET' | base64)" \
     -d "grant_type=client_credentials"
   ```

## Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Wrong credentials | Double-check CLIENT_ID and CLIENT_SECRET |
| 403 Forbidden | Missing permissions | Grant Planning/Data Import scopes to OAuth client |
| 404 Not Found | Wrong Multi-Action ID | Verify Multi-Action ID in SAC |
| 400 Bad Request | Wrong OAuth endpoint | Set SAC_OAUTH_TOKEN_URL manually |

## Need Help?

If you're still stuck:
1. Share the output of: `cf logs ai-predictive-agent --recent`
2. Verify OAuth client exists in SAC
3. Check if Multi-Action works manually in SAC
4. Consider using Basic Auth if OAuth is too complex
