#!/bin/bash
# Quick Deploy Script - Fix for 401 Error
# This script deploys the rebuilt application with corrected SAC API endpoint

set -e

echo "=================================================="
echo "🚀 DEPLOYING FIX FOR 401 UNAUTHORIZED ERROR"
echo "=================================================="
echo ""

# Check if cf CLI is available
if ! command -v cf &> /dev/null; then
    echo "❌ Error: Cloud Foundry CLI (cf) not found!"
    echo "Please install CF CLI: https://docs.cloudfoundry.org/cf-cli/install-go-cli.html"
    exit 1
fi

# Check if logged in to CF
if ! cf target &> /dev/null; then
    echo "❌ Error: Not logged in to Cloud Foundry!"
    echo "Please run: cf login"
    exit 1
fi

echo "✅ CF CLI found and authenticated"
echo ""

# Verify dist/ directory exists (should be already built)
if [ ! -d "dist" ]; then
    echo "⚠️  dist/ directory not found. Building now..."
    npm install
    npm run build
    echo "✅ Build complete"
else
    echo "✅ dist/ directory found (already built)"
fi
echo ""

# Show current CF target
echo "📍 Current CF Target:"
cf target
echo ""

# Deploy to Cloud Foundry
echo "=================================================="
echo "📦 Pushing to Cloud Foundry..."
echo "=================================================="
cf push
echo ""

# Check if push was successful
if [ $? -eq 0 ]; then
    echo "=================================================="
    echo "✅ DEPLOYMENT SUCCESSFUL!"
    echo "=================================================="
    echo ""
    echo "Next steps:"
    echo "1. Test your widget in SAC"
    echo "2. Monitor logs: cf logs ai-predictive-agent --recent"
    echo "3. If still getting 401, check credentials:"
    echo "   cf env ai-predictive-agent"
    echo ""
    echo "Expected to see in logs:"
    echo "  ✓ SAC Multi-Action endpoint: /api/v1/dataimport/planningModel/..."
    echo "  ✓ OAuth token acquisition successful"
    echo "  ✓ Multi-Action triggered successfully"
    echo ""
else
    echo "❌ Deployment failed! Check errors above."
    exit 1
fi
