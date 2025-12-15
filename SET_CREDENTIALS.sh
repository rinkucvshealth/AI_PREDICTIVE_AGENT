#!/bin/bash
# Script to set sensitive credentials via cf set-env
# This prevents credentials from being reset during cf push

APP_NAME="ai-predictive-agent"

echo "🔐 Setting SAC credentials for $APP_NAME..."
echo ""

# SAC OAuth Credentials (Interactive Usage - from BASIS team)
cf set-env $APP_NAME SAC_CLIENT_ID "sb-2c3a1567-6d9a-4df1-8abd-def112306fe5!b563143|client!b655"
cf set-env $APP_NAME SAC_CLIENT_SECRET "068de6c1-3916-42b5-9d43-587039aea58a\$KQyTpHTYuReSBwMLR2698qeGP4HL2e0cxZ4FVNq544o="

# SAC Refresh Token (obtained from /oauth/login flow)
cf set-env $APP_NAME SAC_REFRESH_TOKEN "5c91ed78d1814ec0a07373bf93c0fdf5-r"

# OpenAI API Key (if you have one)
# cf set-env $APP_NAME OPENAI_API_KEY "sk-..."

echo ""
echo "✅ Credentials set successfully!"
echo ""
echo "⚠️  IMPORTANT: You must restage the app for changes to take effect:"
echo "   cf restage $APP_NAME"
echo ""
