#!/bin/bash

# Quick Start Script for AI Predictive Agent
# This script helps you quickly test and manage your application

set -e

echo "🚀 AI Predictive Agent - Quick Start"
echo "===================================="
echo ""

# Check if server is running
if ps aux | grep -q "[n]ode dist/server.js"; then
    echo "✅ Server is running"
    PID=$(ps aux | grep "[n]ode dist/server.js" | awk '{print $2}')
    echo "   PID: $PID"
else
    echo "❌ Server is NOT running"
    echo ""
    echo "Starting server..."
    cd /workspace
    node dist/server.js > /tmp/server.log 2>&1 &
    sleep 2
    echo "✅ Server started"
fi

echo ""
echo "📊 Testing Endpoints..."
echo ""

# Test health endpoint (localhost)
echo "1. Health Check (localhost):"
curl -s http://localhost:3002/health | head -c 100
echo "..."
echo ""

# Test root endpoint
echo "2. API Info:"
curl -s http://localhost:3002/ \
  -H "x-api-key: 6b429687b35c3756bf6f99db7e884d36fadcc4c752e4ca336f4f03955ab4c22a" | head -c 200
echo "..."
echo ""

# Test SAC connection
echo "3. SAC Connection Test:"
curl -s http://localhost:3002/api/forecast/test-sac \
  -H "x-api-key: 6b429687b35c3756bf6f99db7e884d36fadcc4c752e4ca336f4f03955ab4c22a"
echo ""

echo ""
echo "📝 Quick Commands:"
echo ""
echo "  View logs:        tail -f /tmp/server.log"
echo "  Stop server:      pkill -f 'node dist/server.js'"
echo "  Restart server:   ./QUICK_START.sh"
echo "  Deploy to CF:     npm run cf-deploy"
echo ""
echo "📖 Full documentation: DEPLOYMENT_STATUS.md"
echo ""
