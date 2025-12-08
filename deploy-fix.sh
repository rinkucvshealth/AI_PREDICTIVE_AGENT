#!/bin/bash

###############################################################################
# SAC OAuth Fix Deployment Script
# Deploys the enhanced OAuth authentication fix
###############################################################################

set -e  # Exit on error

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║   SAC OAuth 401 Fix - Automated Deployment               ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check prerequisites
echo "📋 Step 1: Checking prerequisites..."
echo ""

# Check if cf CLI is installed
if ! command -v cf &> /dev/null; then
    echo -e "${RED}❌ Cloud Foundry CLI not found${NC}"
    echo "   Install from: https://docs.cloudfoundry.org/cf-cli/install-go-cli.html"
    exit 1
fi
echo -e "${GREEN}✓${NC} Cloud Foundry CLI found"

# Check if logged in to CF
if ! cf target &> /dev/null; then
    echo -e "${RED}❌ Not logged in to Cloud Foundry${NC}"
    echo "   Run: cf login -a https://api.cf.us10.hana.ondemand.com"
    exit 1
fi
echo -e "${GREEN}✓${NC} Logged in to Cloud Foundry"

# Show current target
echo ""
echo "Current CF Target:"
cf target
echo ""

# Step 2: Verify build
echo "🔨 Step 2: Building application..."
echo ""

if [ ! -d "dist" ]; then
    echo "Building TypeScript code..."
    npm run build
else
    echo "Dist folder exists. Rebuilding..."
    npm run build
fi

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Build successful"
echo ""

# Step 3: Verify environment variables
echo "🔐 Step 3: Checking environment variables..."
echo ""

# Check if environment variables are set (for local testing)
if [ -z "$SAC_CLIENT_ID" ]; then
    echo -e "${YELLOW}⚠${NC}  SAC_CLIENT_ID not set in local environment"
    echo "   (This is OK - will use Cloud Foundry env vars)"
else
    echo -e "${GREEN}✓${NC} SAC_CLIENT_ID is set"
fi

if [ -z "$SAC_CLIENT_SECRET" ]; then
    echo -e "${YELLOW}⚠${NC}  SAC_CLIENT_SECRET not set in local environment"
    echo "   (This is OK - will use Cloud Foundry env vars)"
else
    echo -e "${GREEN}✓${NC} SAC_CLIENT_SECRET is set"
fi
echo ""

# Step 4: Optional - Test OAuth locally
echo "🧪 Step 4: Test OAuth authentication (optional)..."
echo ""
read -p "Do you want to test OAuth locally before deploying? (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -z "$SAC_CLIENT_ID" ] || [ -z "$SAC_CLIENT_SECRET" ]; then
        echo -e "${RED}❌ Cannot test - credentials not set${NC}"
        echo "   Set them with:"
        echo "   export SAC_CLIENT_ID='your-client-id'"
        echo "   export SAC_CLIENT_SECRET='your-secret'"
    else
        echo "Running OAuth test..."
        node dist/test-sac-oauth.js
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓${NC} OAuth test passed!"
        else
            echo -e "${RED}❌ OAuth test failed${NC}"
            read -p "Continue with deployment anyway? (y/N): " -n 1 -r
            echo ""
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
        fi
    fi
    echo ""
fi

# Step 5: Deploy to Cloud Foundry
echo "🚀 Step 5: Deploying to Cloud Foundry..."
echo ""

# Determine app name
if [ -f "manifest.yml" ]; then
    APP_NAME=$(grep -E "^\s*-?\s*name:" manifest.yml | head -1 | sed 's/.*name:\s*//' | tr -d ' ')
    echo "Found app name in manifest.yml: $APP_NAME"
else
    APP_NAME="sac-multiaction-api"
    echo "No manifest.yml found, using default name: $APP_NAME"
fi

echo ""
echo "Deploying application: $APP_NAME"
echo ""

# Push the app
cf push

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Deployment successful"
echo ""

# Step 6: Verify deployment
echo "✅ Step 6: Verifying deployment..."
echo ""

# Check app status
APP_STATUS=$(cf app $APP_NAME | grep "^#0" | awk '{print $2}')

if [ "$APP_STATUS" == "running" ]; then
    echo -e "${GREEN}✓${NC} Application is running"
else
    echo -e "${RED}❌ Application status: $APP_STATUS${NC}"
fi

# Get app URL
APP_URL=$(cf app $APP_NAME | grep "routes:" | awk '{print $2}')
echo ""
echo "Application URL: https://$APP_URL"
echo ""

# Step 7: Show logs
echo "📋 Step 7: Showing recent logs..."
echo ""
echo "Looking for OAuth success indicators..."
echo ""

cf logs $APP_NAME --recent | tail -50

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                 DEPLOYMENT COMPLETE!                      ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "📊 Next Steps:"
echo ""
echo "1. Watch logs for OAuth success:"
echo "   cf logs $APP_NAME"
echo ""
echo "   Look for:"
echo "   ✅ '🔐 Starting OAuth token acquisition'"
echo "   ✅ 'Credential type: XSUAA (BTP-integrated)'"
echo "   ✅ '✅ Success with Method X'"
echo "   ✅ '✓ Token acquired'"
echo ""
echo "2. Test the API:"
echo "   curl -X POST https://$APP_URL/api/forecast \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -H 'x-api-key: your-api-key' \\"
echo "     -d '{\"query\": \"Create 6 month forecast for GL 500100\"}'"
echo ""
echo "3. Test from SAC widget:"
echo "   Open: https://cvs-pharmacy-q.us10.hcs.cloud.sap"
echo "   Enter: 'Create 6 month forecast for GL 500100'"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""
echo -e "${GREEN}✅ Deployment successful!${NC}"
echo ""
