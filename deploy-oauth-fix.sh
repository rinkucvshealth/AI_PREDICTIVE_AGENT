#!/bin/bash

echo "=========================================="
echo "🚀 Deploying OAuth 401 Fix"
echo "=========================================="
echo ""

# Check if CF CLI is installed
if ! command -v cf &> /dev/null; then
    echo "❌ CF CLI not found. Please install it first:"
    echo "   https://docs.cloudfoundry.org/cf-cli/install-go-cli.html"
    exit 1
fi

echo "✅ CF CLI found"
echo ""

# Check if logged in
if ! cf target &> /dev/null; then
    echo "❌ Not logged in to Cloud Foundry"
    echo "   Please run: cf login"
    exit 1
fi

echo "✅ CF CLI authenticated"
echo ""

# Show current target
echo "📍 Current CF Target:"
cf target
echo ""

# Check if dist folder exists
if [ ! -d "dist" ]; then
    echo "❌ dist/ directory not found. Building application..."
    npm run build
    if [ $? -ne 0 ]; then
        echo "❌ Build failed"
        exit 1
    fi
    echo "✅ Build successful"
else
    echo "✅ dist/ directory found (already built)"
fi
echo ""

# Ask user if they want to rebuild
read -p "Do you want to rebuild the application? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "📦 Building application..."
    npm run build
    if [ $? -ne 0 ]; then
        echo "❌ Build failed"
        exit 1
    fi
    echo "✅ Build successful"
    echo ""
fi

echo "=========================================="
echo "📦 Pushing to Cloud Foundry..."
echo "=========================================="
echo ""

# Push to Cloud Foundry
cf push

if [ $? -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "✅ DEPLOYMENT SUCCESSFUL!"
    echo "=========================================="
    echo ""
    echo "Next steps:"
    echo "1. Test your widget in SAC"
    echo "2. Check logs for diagnostic information:"
    echo "   cf logs ai-predictive-agent --recent"
    echo ""
    echo "Look for these key log sections:"
    echo "  • 🔐 Starting OAuth token acquisition"
    echo "  • 🎯 Triggering SAC Multi-Action"
    echo "  • ✅ Success messages or"
    echo "  • ❌ Detailed error information"
    echo ""
    echo "If you still get 401 errors, check:"
    echo "  • OAuth client credentials in SAC"
    echo "  • API scopes assigned to OAuth client"
    echo "  • Multi-Action ID and Model ID are correct"
    echo ""
    echo "For detailed troubleshooting, see: OAUTH_401_FIX.md"
else
    echo ""
    echo "=========================================="
    echo "❌ DEPLOYMENT FAILED"
    echo "=========================================="
    echo ""
    echo "Please check the error messages above."
    exit 1
fi
