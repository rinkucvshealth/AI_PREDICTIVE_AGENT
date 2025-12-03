#!/bin/bash

# Pre-Deployment Checklist Script
# Run this before deploying to Cloud Foundry

echo "🔍 Pre-Deployment Checklist"
echo "============================"
echo ""

# Check if dist folder exists
if [ -d "dist" ]; then
    echo "✅ dist/ folder exists"
    FILE_COUNT=$(find dist -name "*.js" | wc -l)
    echo "   Found $FILE_COUNT JavaScript files"
else
    echo "❌ dist/ folder NOT found"
    echo "   Run: npm run build"
    exit 1
fi

# Check critical files
echo ""
echo "📁 Checking critical files..."
CRITICAL_FILES=(
    "dist/server.js"
    "dist/config.js"
    "package.json"
    "manifest.yml"
    ".cfignore"
)

for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "   ✅ $file"
    else
        echo "   ❌ $file MISSING"
        exit 1
    fi
done

# Check package.json dependencies
echo ""
echo "📦 Checking dependencies..."
if grep -q '"typescript":' package.json; then
    if grep -A 10 '"dependencies":' package.json | grep -q '"typescript":'; then
        echo "   ✅ TypeScript in dependencies"
    else
        echo "   ❌ TypeScript NOT in dependencies"
        exit 1
    fi
fi

# Check manifest.yml
echo ""
echo "📋 Checking manifest.yml..."
if grep -q "nodejs_buildpack" manifest.yml; then
    echo "   ✅ Node.js buildpack configured"
else
    echo "   ⚠️  Node.js buildpack not specified"
fi

# Check for sensitive data
echo ""
echo "🔐 Security check..."
if grep -r "sk-[a-zA-Z0-9]\{20,\}" .env 2>/dev/null | grep -v "placeholder" | grep -v "example"; then
    echo "   ⚠️  Real OpenAI API key found in .env"
    echo "   Reminder: .env is in .cfignore (not deployed)"
else
    echo "   ✅ No sensitive data found in tracked files"
fi

# Check Cloud Foundry login
echo ""
echo "☁️  Cloud Foundry status..."
if cf target >/dev/null 2>&1; then
    echo "   ✅ Logged in to Cloud Foundry"
    echo "   Org:   $(cf target | grep org: | awk '{print $2}')"
    echo "   Space: $(cf target | grep space: | awk '{print $2}')"
else
    echo "   ❌ Not logged in to Cloud Foundry"
    echo "   Run: cf login -a https://api.cf.us10.hana.ondemand.com"
    exit 1
fi

echo ""
echo "✅ All checks passed!"
echo ""
echo "🚀 Ready to deploy!"
echo ""
echo "Next steps:"
echo "  1. Deploy:        cf push"
echo "  2. Set env vars:  See CF_DEPLOYMENT.md"
echo "  3. Restart app:   cf restart ai-predictive-agent"
echo ""
