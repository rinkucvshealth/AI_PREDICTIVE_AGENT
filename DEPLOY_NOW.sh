#!/bin/bash
# Quick deployment script

echo "🔨 Building TypeScript..."
npm run build

if [ $? -ne 0 ]; then
  echo "❌ Build failed!"
  exit 1
fi

echo "✅ Build successful!"
echo ""
echo "📦 Deploying to Cloud Foundry..."
cf push

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Deployment successful!"
  echo ""
  echo "🧪 Test the diagnostic endpoints:"
  echo "curl https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/api/forecast/discover-endpoints"
  echo "curl https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/api/forecast/list-multiactions"
else
  echo "❌ Deployment failed!"
  exit 1
fi
