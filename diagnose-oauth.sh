#!/bin/bash

# SAC OAuth Diagnostic Script
# This script helps diagnose OAuth authentication issues with SAC

echo "================================================"
echo "SAC OAuth Authentication Diagnostic Tool"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get environment variables
echo "📋 Step 1: Checking Environment Variables"
echo "================================================"

CLIENT_ID=$(cf env ai-predictive-agent | grep "SAC_CLIENT_ID:" | awk '{print $2}')
CLIENT_SECRET_SET=$(cf env ai-predictive-agent | grep "SAC_CLIENT_SECRET:" | wc -l)
OAUTH_TOKEN_URL=$(cf env ai-predictive-agent | grep "SAC_OAUTH_TOKEN_URL:" | awk '{print $2}')
TENANT_URL=$(cf env ai-predictive-agent | grep "SAC_TENANT_URL:" | awk '{print $2}')

echo "SAC_CLIENT_ID: $CLIENT_ID"
echo "SAC_CLIENT_SECRET: $(if [ $CLIENT_SECRET_SET -gt 0 ]; then echo '[SET]'; else echo '[NOT SET]'; fi)"
echo "SAC_OAUTH_TOKEN_URL: $OAUTH_TOKEN_URL"
echo "SAC_TENANT_URL: $TENANT_URL"
echo ""

# Analyze Client ID format
echo "🔍 Step 2: Analyzing OAuth Client ID Format"
echo "================================================"

if [[ $CLIENT_ID == sb-*\|client\!* ]]; then
    echo -e "${RED}❌ ERROR: This is a BTP/XSUAA Client ID!${NC}"
    echo ""
    echo "Format detected: BTP XSUAA (sb-...!b...|client!b...)"
    echo ""
    echo -e "${YELLOW}⚠️  SAC Multi-Action API requires SAC OAuth credentials,${NC}"
    echo -e "${YELLOW}   NOT BTP platform credentials!${NC}"
    echo ""
    echo "Action Required:"
    echo "1. Create OAuth Client in SAC Admin Console"
    echo "2. Use the SAC OAuth Client ID (simple alphanumeric format)"
    echo "3. Update environment variable with: cf set-env ai-predictive-agent SAC_CLIENT_ID <new-sac-client-id>"
    echo ""
    CREDENTIAL_TYPE="BTP_XSUAA"
elif [[ $CLIENT_ID == placeholder ]] || [[ -z $CLIENT_ID ]]; then
    echo -e "${RED}❌ ERROR: Client ID is placeholder or not set!${NC}"
    echo ""
    echo "Action Required:"
    echo "1. Create OAuth Client in SAC Admin Console"
    echo "2. Set environment variable with: cf set-env ai-predictive-agent SAC_CLIENT_ID <sac-client-id>"
    echo ""
    CREDENTIAL_TYPE="PLACEHOLDER"
else
    echo -e "${GREEN}✅ Client ID format looks like SAC OAuth credentials${NC}"
    echo "Format: Simple alphanumeric (likely SAC OAuth)"
    echo ""
    CREDENTIAL_TYPE="SAC_OAUTH"
fi

# Check OAuth Token URL
echo "🔍 Step 3: Checking OAuth Token URL"
echo "================================================"

if [[ -z $OAUTH_TOKEN_URL ]]; then
    echo -e "${YELLOW}⚠️  OAuth Token URL not set (will be auto-generated)${NC}"
    echo "Expected: https://cvs-pharmacy-q.authentication.us10.hana.ondemand.com/oauth/token"
    echo ""
elif [[ $OAUTH_TOKEN_URL == *".authentication."*".hana.ondemand.com/oauth/token" ]]; then
    echo -e "${GREEN}✅ OAuth Token URL format is correct${NC}"
    echo ""
else
    echo -e "${RED}❌ OAuth Token URL format may be incorrect${NC}"
    echo "Current: $OAUTH_TOKEN_URL"
    echo "Expected pattern: https://<tenant>.authentication.<region>.hana.ondemand.com/oauth/token"
    echo ""
fi

# Check recent logs for OAuth attempts
echo "📝 Step 4: Checking Recent Logs for OAuth Activity"
echo "================================================"

echo "Looking for OAuth-related log entries..."
echo ""

LOGS=$(cf logs ai-predictive-agent --recent 2>&1 | grep -i oauth | head -20)

if [[ -z $LOGS ]]; then
    echo -e "${RED}❌ No OAuth-related logs found${NC}"
    echo ""
    echo "This suggests:"
    echo "  - OAuth token fetch is not being attempted"
    echo "  - OR credentials are failing silently"
    echo ""
else
    echo "$LOGS"
    echo ""
fi

# Check for 401 errors
echo "📝 Step 5: Checking for 401 Errors"
echo "================================================"

ERROR_401=$(cf logs ai-predictive-agent --recent 2>&1 | grep "401" | tail -5)

if [[ -z $ERROR_401 ]]; then
    echo -e "${GREEN}✅ No recent 401 errors found${NC}"
    echo ""
else
    echo -e "${RED}❌ Recent 401 Unauthorized errors detected:${NC}"
    echo ""
    echo "$ERROR_401"
    echo ""
fi

# Check for successful OAuth token fetch
SUCCESS_OAUTH=$(cf logs ai-predictive-agent --recent 2>&1 | grep "Successfully obtained OAuth access token" | wc -l)

if [ $SUCCESS_OAUTH -gt 0 ]; then
    echo -e "${GREEN}✅ OAuth token was successfully obtained ($SUCCESS_OAUTH times)${NC}"
    echo ""
else
    echo -e "${RED}❌ No successful OAuth token fetch found in logs${NC}"
    echo "Expected log: 'Successfully obtained OAuth access token'"
    echo ""
fi

# Summary and Recommendations
echo "================================================"
echo "📊 DIAGNOSTIC SUMMARY"
echo "================================================"
echo ""

if [[ $CREDENTIAL_TYPE == "BTP_XSUAA" ]]; then
    echo -e "${RED}🔴 CRITICAL ISSUE IDENTIFIED${NC}"
    echo ""
    echo "Problem: Using BTP/XSUAA credentials instead of SAC OAuth credentials"
    echo ""
    echo "Impact: SAC Multi-Action API rejects requests with 401 Unauthorized"
    echo ""
    echo "Solution:"
    echo "  1. Open SAC: $TENANT_URL"
    echo "  2. Navigate: Menu → System → Administration → App Integration → OAuth Clients"
    echo "  3. Click 'Add a New OAuth Client'"
    echo "  4. Configure:"
    echo "     - Name: AI Predictive Agent"
    echo "     - Grant Type: Client Credentials ✅"
    echo "     - Scopes: Data Import, Planning, Multi-Action"
    echo "  5. Copy the Client ID and Secret"
    echo "  6. Run:"
    echo "     cf set-env ai-predictive-agent SAC_CLIENT_ID \"<new-sac-client-id>\""
    echo "     cf set-env ai-predictive-agent SAC_CLIENT_SECRET \"<new-sac-secret>\""
    echo "     cf restart ai-predictive-agent"
    echo ""
    echo "📖 Detailed instructions: SAC_OAUTH_FIX_INSTRUCTIONS.md"
    echo ""
elif [[ $CREDENTIAL_TYPE == "SAC_OAUTH" ]]; then
    echo -e "${GREEN}✅ Credentials appear to be SAC OAuth format${NC}"
    echo ""
    if [ $SUCCESS_OAUTH -gt 0 ]; then
        echo -e "${GREEN}✅ OAuth authentication is working!${NC}"
        echo ""
        echo "Next steps:"
        echo "  - Test a forecast request"
        echo "  - Monitor for any 401 errors"
    else
        echo -e "${YELLOW}⚠️  Credentials are correct format, but OAuth fetch not seen in logs${NC}"
        echo ""
        echo "Possible issues:"
        echo "  1. OAuth Client disabled in SAC"
        echo "  2. OAuth Client missing required scopes/permissions"
        echo "  3. Client Secret incorrect"
        echo ""
        echo "Troubleshooting steps:"
        echo "  1. Verify OAuth Client is 'Enabled' in SAC"
        echo "  2. Check OAuth Client has these scopes:"
        echo "     - Data Import Service"
        echo "     - Planning"
        echo "     - Multi-Action Service"
        echo "  3. Enable debug logging:"
        echo "     cf set-env ai-predictive-agent LOG_LEVEL debug"
        echo "     cf restart ai-predictive-agent"
        echo "  4. Watch logs during a test request:"
        echo "     cf logs ai-predictive-agent"
    fi
else
    echo -e "${YELLOW}⚠️  Credentials not set or using placeholder values${NC}"
    echo ""
    echo "Action required: Create and configure SAC OAuth credentials"
    echo "See: SAC_OAUTH_FIX_INSTRUCTIONS.md"
fi

echo ""
echo "================================================"
echo "For detailed fix instructions, see:"
echo "  📄 SAC_OAUTH_FIX_INSTRUCTIONS.md"
echo "================================================"
