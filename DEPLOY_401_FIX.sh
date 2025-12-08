#!/bin/bash

# Deploy Multi-Action 401 Fix
# This script deploys the updated application with multiple endpoint fallback

set -e

echo "=========================================="
echo "🚀 Deploying Multi-Action 401 Fix"
echo "=========================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json not found${NC}"
    echo "Please run this script from the project root directory"
    exit 1
fi

# Step 1: Build the application
echo ""
echo "📦 Step 1: Building application..."
npm run build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build successful${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

# Step 2: Verify dist directory
if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Error: dist directory not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build artifacts verified${NC}"

# Step 3: Show what's being deployed
echo ""
echo "📋 Deployment Summary:"
echo "  • Application: ai-predictive-agent"
echo "  • Multi-Action API: Updated with 3-endpoint fallback"
echo "  • Endpoints:"
echo "    1. Data Import Job API (Recommended)"
echo "    2. Planning Model Multi-Action Runs"
echo "    3. Generic Multi-Action Trigger"

# Step 4: Deploy to Cloud Foundry
echo ""
echo "🚀 Step 2: Deploying to Cloud Foundry..."
echo ""

cf push

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}=========================================="
    echo "✅ Deployment Successful!"
    echo "==========================================${NC}"
    echo ""
    echo "📊 Next Steps:"
    echo ""
    echo "1. Monitor logs:"
    echo "   cf logs ai-predictive-agent"
    echo ""
    echo "2. Test from SAC widget:"
    echo "   • Open: https://cvs-pharmacy-q.us10.hcs.cloud.sap"
    echo "   • Query: 'Generate 12 month forecast for account 400250'"
    echo ""
    echo "3. Look for SUCCESS message:"
    echo "   ${GREEN}✅ Multi-Action triggered successfully via [endpoint name]${NC}"
    echo ""
    echo "4. If still getting 401:"
    echo "   • Run diagnostic: npx ts-node diagnose-multiaction.ts"
    echo "   • Check Multi-Action exists in SAC"
    echo "   • Verify OAuth client permissions"
    echo "   • See: FIX_401_MULTI_ACTION.md"
    echo ""
    
    # Show recent logs
    echo "📋 Recent deployment logs:"
    echo "=========================================="
    cf logs ai-predictive-agent --recent | tail -50
    
else
    echo ""
    echo -e "${RED}=========================================="
    echo "❌ Deployment Failed"
    echo "==========================================${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check Cloud Foundry login: cf target"
    echo "  2. Verify manifest.yml exists"
    echo "  3. Check logs: cf logs ai-predictive-agent --recent"
    exit 1
fi

echo ""
echo "=========================================="
echo "🎯 Deployment Complete"
echo "=========================================="
