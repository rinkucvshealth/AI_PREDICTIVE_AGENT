#!/bin/bash
# Script to set sensitive credentials via cf set-env
# This prevents credentials from being reset during cf push

APP_NAME="ai-predictive-agent"

echo "🔐 Setting SAC credentials for $APP_NAME..."
echo ""

# SAC OAuth Credentials (Interactive Usage - from BASIS team)
cf set-env $APP_NAME SAC_CLIENT_ID "sb-d0a25928-2a38-4862-ab82-bc4f8529aab7!b563143|client!b655"
cf set-env $APP_NAME SAC_CLIENT_SECRET "9a81d84e-1277-4ccb-95fd-7db0f60f15e7\$KytCvQeVWDy5JrXqAS0fLrKFhPn9s1xumtyXc9jNgeA="

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
