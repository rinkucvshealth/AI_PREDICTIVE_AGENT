#!/bin/bash
# Script to cleanly pull latest changes and build in BAS

echo "🔄 Pulling latest changes from GitHub..."

# Ensure we're on the main branch
git checkout main

# Fetch latest changes
git fetch origin

# Stash any local changes
echo "📦 Stashing any local changes..."
git stash

# Pull latest from main
echo "⬇️  Pulling from origin/main..."
git pull origin main --rebase

# Install dependencies
echo "📥 Installing dependencies..."
npm install

# Build the project
echo "🔨 Building TypeScript..."
npm run build

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo ""
    echo "Next steps:"
    echo "1. Set OAuth credentials:"
    echo "   cf set-env ai-predictive-agent SAC_CLIENT_ID \"your-client-id\""
    echo "   cf set-env ai-predictive-agent SAC_CLIENT_SECRET \"your-client-secret\""
    echo ""
    echo "2. Deploy to Cloud Foundry:"
    echo "   cf push ai-predictive-agent"
    echo ""
    echo "3. Verify deployment:"
    echo "   cf logs ai-predictive-agent --recent"
else
    echo "❌ Build failed! Check errors above."
    exit 1
fi

# Pop stashed changes if any
if git stash list | grep -q "stash@{0}"; then
    echo ""
    echo "⚠️  You had local changes that were stashed."
    echo "To restore them, run: git stash pop"
fi
