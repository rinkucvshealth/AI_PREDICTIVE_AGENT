#!/bin/bash
# SAC Credentials Setup Script
# This script helps you set SAC credentials in Cloud Foundry

set -e

APP_NAME="ai-predictive-agent"

echo "🔐 SAC Credentials Setup for Cloud Foundry"
echo "==========================================="
echo ""

# Check if cf CLI is available
if ! command -v cf &> /dev/null; then
    echo "❌ Error: Cloud Foundry CLI not found"
    echo "   Install from: https://docs.cloudfoundry.org/cf-cli/install-go-cli.html"
    exit 1
fi

# Check if logged in
if ! cf target &> /dev/null; then
    echo "❌ Error: Not logged into Cloud Foundry"
    echo "   Run: cf login"
    exit 1
fi

echo "Select authentication method:"
echo "1) OAuth Client Credentials (Recommended)"
echo "2) Basic Authentication (Technical User)"
echo ""
read -p "Enter choice (1 or 2): " AUTH_CHOICE

if [ "$AUTH_CHOICE" = "1" ]; then
    echo ""
    echo "📋 OAuth Client Credentials Setup"
    echo "=================================="
    echo ""
    echo "First, create an OAuth client in SAC:"
    echo "1. Go to System → Administration → App Integration"
    echo "2. Click 'Add a New OAuth Client'"
    echo "3. Set Grant Type: Client Credentials"
    echo "4. Add scopes: Planning, Data Import"
    echo "5. Copy the Client ID and Secret"
    echo ""
    
    read -p "Enter SAC OAuth Client ID: " SAC_CLIENT_ID
    read -s -p "Enter SAC OAuth Client Secret: " SAC_CLIENT_SECRET
    echo ""
    
    if [ -z "$SAC_CLIENT_ID" ] || [ -z "$SAC_CLIENT_SECRET" ]; then
        echo "❌ Error: Client ID and Secret are required"
        exit 1
    fi
    
    echo ""
    echo "Setting environment variables..."
    cf set-env "$APP_NAME" SAC_CLIENT_ID "$SAC_CLIENT_ID"
    cf set-env "$APP_NAME" SAC_CLIENT_SECRET "$SAC_CLIENT_SECRET"
    
    echo "✅ OAuth credentials set successfully"
    
elif [ "$AUTH_CHOICE" = "2" ]; then
    echo ""
    echo "📋 Basic Authentication Setup"
    echo "============================="
    echo ""
    echo "⚠️  WARNING: Basic Auth requires code changes (see BASIC_AUTH_IMPLEMENTATION.md)"
    echo ""
    
    read -p "Enter SAC Username (technical user): " SAC_USERNAME
    read -s -p "Enter SAC Password: " SAC_PASSWORD
    echo ""
    
    if [ -z "$SAC_USERNAME" ] || [ -z "$SAC_PASSWORD" ]; then
        echo "❌ Error: Username and Password are required"
        exit 1
    fi
    
    echo ""
    echo "Setting environment variables..."
    cf set-env "$APP_NAME" SAC_USERNAME "$SAC_USERNAME"
    cf set-env "$APP_NAME" SAC_PASSWORD "$SAC_PASSWORD"
    cf set-env "$APP_NAME" SAC_AUTH_METHOD "basic"
    
    echo "✅ Basic Auth credentials set successfully"
    echo "⚠️  Remember to modify sac-client.ts to support Basic Auth"
    
else
    echo "❌ Invalid choice"
    exit 1
fi

echo ""
echo "Setting other required credentials..."

# Check if OpenAI API key is set
CURRENT_OPENAI_KEY=$(cf env "$APP_NAME" 2>/dev/null | grep "OPENAI_API_KEY:" | awk '{print $2}' || echo "")
if [ "$CURRENT_OPENAI_KEY" = "placeholder" ] || [ -z "$CURRENT_OPENAI_KEY" ]; then
    read -s -p "Enter OpenAI API Key (or press Enter to skip): " OPENAI_API_KEY
    echo ""
    if [ -n "$OPENAI_API_KEY" ]; then
        cf set-env "$APP_NAME" OPENAI_API_KEY "$OPENAI_API_KEY"
        echo "✅ OpenAI API Key set"
    fi
fi

# Prompt for optional OAuth Token URL override
echo ""
read -p "Do you need to override the OAuth Token URL? (y/N): " OVERRIDE_TOKEN_URL
if [ "$OVERRIDE_TOKEN_URL" = "y" ] || [ "$OVERRIDE_TOKEN_URL" = "Y" ]; then
    read -p "Enter custom OAuth Token URL: " SAC_OAUTH_TOKEN_URL
    if [ -n "$SAC_OAUTH_TOKEN_URL" ]; then
        cf set-env "$APP_NAME" SAC_OAUTH_TOKEN_URL "$SAC_OAUTH_TOKEN_URL"
        echo "✅ OAuth Token URL set"
    fi
fi

echo ""
echo "🔄 Restarting application..."
cf restart "$APP_NAME"

echo ""
echo "✅ Setup complete!"
echo ""
echo "📊 Verify the setup:"
echo "   cf logs $APP_NAME --recent"
echo ""
echo "Look for these success indicators:"
echo "   - 'Successfully obtained OAuth access token'"
echo "   - No 401 Unauthorized errors"
echo ""
echo "🧪 Test in SAC:"
echo "   1. Open your SAC story"
echo "   2. Load the AI Predictive Agent widget"
echo "   3. Try: 'Create 6 month forecast for GL 500100'"
echo ""
