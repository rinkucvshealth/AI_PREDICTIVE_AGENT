#!/bin/bash
# Cloud Foundry Deployment Script
# This script builds the app locally and then deploys to CF

set -e  # Exit on error

echo "================================"
echo "CF Deployment Script"
echo "================================"
echo ""

# Step 1: Install dependencies
echo "Step 1: Installing dependencies..."
npm install
echo "✓ Dependencies installed"
echo ""

# Step 2: Build TypeScript
echo "Step 2: Building TypeScript..."
npm run build
echo "✓ TypeScript build complete"
echo ""

# Step 3: Verify dist/ exists
if [ ! -d "dist" ]; then
    echo "✗ Error: dist/ directory not found!"
    echo "Build may have failed. Please check for errors above."
    exit 1
fi

echo "✓ dist/ directory verified"
echo ""

# Step 4: Push to Cloud Foundry
echo "Step 3: Pushing to Cloud Foundry..."
cf push
echo ""
echo "================================"
echo "Deployment complete!"
echo "================================"
