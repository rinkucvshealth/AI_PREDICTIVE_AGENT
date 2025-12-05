#!/bin/bash

echo "🧹 Cleaning all build artifacts and caches..."

# Remove build outputs
rm -rf dist/
rm -rf node_modules/

# Remove any TypeScript cache
rm -rf .tsbuildinfo

# Clear npm cache
npm cache clean --force 2>/dev/null || true

echo "📦 Installing dependencies..."
npm install

echo "🔨 Building TypeScript..."
npm run build

# Check build status
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Build succeeded!"
    echo ""
    echo "📋 Verification:"
    echo "   - TypeScript compilation: PASSED"
    echo "   - All source files compiled successfully"
    echo "   - Output directory: ./dist/"
    echo ""
    echo "🎯 Next steps:"
    echo "   1. If your IDE still shows errors, restart it"
    echo "   2. Run: npm start (to start the server)"
    echo "   3. Or run: npm run cf-deploy (to deploy)"
else
    echo ""
    echo "❌ Build failed. Check errors above."
    exit 1
fi
