# SAC Predictive Agent - Credential Setup Guide

## URGENT: Set Your Credentials

Your app keeps failing because credentials are set to "placeholder". Follow these steps:

### Step 1: Update manifest.yml with Real Credentials

Edit `manifest.yml` and replace the placeholder values:

```yaml
env:
  OPENAI_API_KEY: "sk-your-real-openai-key-here"
  SAC_CLIENT_ID: "your-real-sac-client-id"
  SAC_CLIENT_SECRET: "your-real-sac-client-secret"
  SAC_MULTI_ACTION_ID: "E5280280114D3785596849C3D321B820"
```

### Step 2: Deploy

```bash
cf push
```

## How to Get the Credentials:

### OpenAI API Key:
1. Go to https://platform.openai.com/account/api-keys
2. Create or copy an existing key (starts with `sk-`)

### SAC OAuth Credentials:
1. Log into SAC as admin
2. Go to **System** → **Administration** → **App Integration**
3. Click **Add a New OAuth Client**
4. Set:
   - **Name**: AI Predictive Agent
   - **Authorization Grant**: Client Credentials
   - **Purpose**: API Access
5. Copy **Client ID** and **Client Secret**

## Alternative: Set via Command Line (temporary)

If you need to test quickly without editing manifest.yml:

```bash
# Set credentials
cf set-env ai-predictive-agent OPENAI_API_KEY "your-key"
cf set-env ai-predictive-agent SAC_CLIENT_ID "your-id"
cf set-env ai-predictive-agent SAC_CLIENT_SECRET "your-secret"

# Restart (don't cf push or it will reset!)
cf restart ai-predictive-agent
```

**WARNING**: Using `cf set-env` is temporary. Any `cf push` will overwrite them!
