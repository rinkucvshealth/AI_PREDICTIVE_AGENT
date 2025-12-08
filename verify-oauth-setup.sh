#!/bin/bash

# SAC OAuth Setup Verification Script
# This script helps verify your OAuth configuration and diagnose issues

set -e

echo "═══════════════════════════════════════════════════════════════════════"
echo "🔍 SAC OAuth Configuration Verification"
echo "═══════════════════════════════════════════════════════════════════════"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found${NC}"
    echo "   Create .env file with your SAC credentials"
    exit 1
fi

# Load environment variables
source .env

echo "📋 Configuration Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check SAC_TENANT_URL
if [ -z "$SAC_TENANT_URL" ]; then
    echo -e "${RED}❌ SAC_TENANT_URL not set${NC}"
    exit 1
else
    echo -e "${GREEN}✓${NC} SAC_TENANT_URL: $SAC_TENANT_URL"
fi

# Check SAC_CLIENT_ID
if [ -z "$SAC_CLIENT_ID" ]; then
    echo -e "${RED}❌ SAC_CLIENT_ID not set${NC}"
    exit 1
else
    # Mask client ID for security
    MASKED_CLIENT_ID="${SAC_CLIENT_ID:0:20}...${SAC_CLIENT_ID: -10}"
    echo -e "${GREEN}✓${NC} SAC_CLIENT_ID: $MASKED_CLIENT_ID"
    
    # Detect if it's XSUAA format
    if [[ $SAC_CLIENT_ID == sb-*!b*\|client!b* ]]; then
        echo -e "${YELLOW}⚠️  Client ID format: XSUAA (BTP)${NC}"
        echo -e "${YELLOW}   This is likely the wrong type of OAuth client!${NC}"
        echo -e "${YELLOW}   You need SAC-native OAuth client${NC}"
    else
        echo -e "${GREEN}✓${NC} Client ID format: Looks like SAC OAuth"
    fi
fi

# Check SAC_CLIENT_SECRET
if [ -z "$SAC_CLIENT_SECRET" ]; then
    echo -e "${RED}❌ SAC_CLIENT_SECRET not set${NC}"
    exit 1
else
    echo -e "${GREEN}✓${NC} SAC_CLIENT_SECRET: ••••••••••••••••"
fi

# Check SAC_OAUTH_TOKEN_URL
if [ -z "$SAC_OAUTH_TOKEN_URL" ]; then
    echo -e "${YELLOW}⚠️  SAC_OAUTH_TOKEN_URL not set (using default)${NC}"
    # Try to construct from tenant URL
    TENANT_NAME=$(echo $SAC_TENANT_URL | sed 's/https:\/\/\([^.]*\).*/\1/')
    REGION=$(echo $SAC_TENANT_URL | sed 's/https:\/\/[^.]*\.\([^.]*\).*/\1/')
    TOKEN_URL="https://${TENANT_NAME}.authentication.${REGION}.hana.ondemand.com/oauth/token"
    echo "   Using: $TOKEN_URL"
else
    echo -e "${GREEN}✓${NC} SAC_OAUTH_TOKEN_URL: $SAC_OAUTH_TOKEN_URL"
    
    # Check if it's the right format
    if [[ $SAC_OAUTH_TOKEN_URL == *"authentication"*"hana.ondemand.com"* ]]; then
        echo -e "${YELLOW}⚠️  Token URL points to XSUAA${NC}"
        echo -e "${YELLOW}   For SAC OAuth, use: ${SAC_TENANT_URL}/oauth/token${NC}"
    elif [[ $SAC_OAUTH_TOKEN_URL == *"hcs.cloud.sap/oauth/token"* ]]; then
        echo -e "${GREEN}✓${NC} Token URL format: SAC OAuth (correct!)"
    fi
fi

echo ""
echo "🧪 Testing OAuth Token Acquisition"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Determine token URL
if [ -z "$SAC_OAUTH_TOKEN_URL" ]; then
    TENANT_NAME=$(echo $SAC_TENANT_URL | sed 's/https:\/\/\([^.]*\).*/\1/')
    REGION=$(echo $SAC_TENANT_URL | sed 's/https:\/\/[^.]*\.\([^.]*\).*/\1/')
    TOKEN_URL="https://${TENANT_NAME}.authentication.${REGION}.hana.ondemand.com/oauth/token"
else
    TOKEN_URL="$SAC_OAUTH_TOKEN_URL"
fi

echo "Token URL: $TOKEN_URL"
echo "Requesting OAuth token..."

# Try to get OAuth token
RESPONSE=$(curl -s -X POST "$TOKEN_URL" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -u "${SAC_CLIENT_ID}:${SAC_CLIENT_SECRET}" \
    -d "grant_type=client_credentials" \
    --max-time 30) || {
    echo -e "${RED}❌ Failed to connect to OAuth endpoint${NC}"
    exit 1
}

# Check if we got a token
if echo "$RESPONSE" | grep -q "access_token"; then
    echo -e "${GREEN}✓${NC} OAuth token acquired successfully!"
    
    # Extract and decode token
    TOKEN=$(echo "$RESPONSE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
    
    # Decode JWT (just the payload)
    if [ ! -z "$TOKEN" ]; then
        echo ""
        echo "📊 Token Analysis"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        
        # Extract payload (second part of JWT)
        PAYLOAD=$(echo "$TOKEN" | cut -d'.' -f2)
        # Add padding if needed
        PADDING=$((4 - ${#PAYLOAD} % 4))
        if [ $PADDING -lt 4 ]; then
            for i in $(seq 1 $PADDING); do
                PAYLOAD="${PAYLOAD}="
            done
        fi
        
        # Decode base64
        DECODED=$(echo "$PAYLOAD" | base64 -d 2>/dev/null) || {
            echo -e "${YELLOW}⚠️  Could not decode token payload${NC}"
            DECODED=""
        }
        
        if [ ! -z "$DECODED" ]; then
            # Extract scopes
            SCOPES=$(echo "$DECODED" | grep -o '"scope":"[^"]*"' | cut -d'"' -f4)
            
            if [ ! -z "$SCOPES" ]; then
                echo "Token Scopes:"
                echo "$SCOPES" | tr ' ' '\n' | while read -r scope; do
                    if [ ! -z "$scope" ]; then
                        echo "  • $scope"
                    fi
                done
                
                echo ""
                echo "Scope Analysis:"
                
                # Check for Multi-Action scopes
                if echo "$SCOPES" | grep -qE "(multiaction|planning\.write|fpa\.planning|data\.write)"; then
                    echo -e "${GREEN}✓${NC} Token has Multi-Action execution scopes"
                else
                    echo -e "${YELLOW}⚠️  Token LACKS Multi-Action execution scopes${NC}"
                    
                    # Check if it's XSUAA-only
                    if echo "$SCOPES" | grep -qE "(uaa\.resource|approuter|dmi-api-proxy)" && \
                       ! echo "$SCOPES" | grep -qE "(multiaction|planning\.write|fpa\.planning)"; then
                        echo -e "${RED}❌ Token has XSUAA scopes only${NC}"
                        echo ""
                        echo -e "${RED}┌─────────────────────────────────────────────────────────┐${NC}"
                        echo -e "${RED}│ PROBLEM DETECTED: Using XSUAA OAuth token              │${NC}"
                        echo -e "${RED}│                                                         │${NC}"
                        echo -e "${RED}│ This token can authenticate but CANNOT execute         │${NC}"
                        echo -e "${RED}│ Multi-Actions. You will get 401 Unauthorized errors.   │${NC}"
                        echo -e "${RED}│                                                         │${NC}"
                        echo -e "${RED}│ SOLUTION: Create SAC-native OAuth client               │${NC}"
                        echo -e "${RED}│                                                         │${NC}"
                        echo -e "${RED}│ See: BASIS_TEAM_ACTION_GUIDE.md                        │${NC}"
                        echo -e "${RED}└─────────────────────────────────────────────────────────┘${NC}"
                    fi
                fi
            else
                echo -e "${YELLOW}⚠️  No scopes found in token${NC}"
            fi
        fi
    fi
else
    echo -e "${RED}❌ Failed to acquire OAuth token${NC}"
    echo ""
    echo "Error Response:"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q "invalid_client"; then
        echo ""
        echo -e "${RED}❌ Invalid client credentials${NC}"
        echo "   Check that CLIENT_ID and CLIENT_SECRET are correct"
    elif echo "$RESPONSE" | grep -q "unauthorized"; then
        echo ""
        echo -e "${RED}❌ Unauthorized${NC}"
        echo "   Credentials may be correct but lack necessary permissions"
    fi
    
    exit 1
fi

echo ""
echo "═══════════════════════════════════════════════════════════════════════"
echo "✅ Verification Complete"
echo "═══════════════════════════════════════════════════════════════════════"
echo ""

# Summary
echo "📝 Summary:"
echo ""
if [[ $SAC_CLIENT_ID == sb-*!b*\|client!b* ]]; then
    echo -e "${YELLOW}⚠️  You are using XSUAA OAuth client${NC}"
    echo "   This will likely cause 401 errors on Multi-Action execution"
    echo ""
    echo "   🔧 ACTION REQUIRED:"
    echo "   1. Read BASIS_TEAM_ACTION_GUIDE.md"
    echo "   2. Create SAC-native OAuth client"
    echo "   3. Update credentials and redeploy"
    echo ""
elif echo "$SCOPES" | grep -qE "(multiaction|planning\.write|fpa\.planning|data\.write)"; then
    echo -e "${GREEN}✅ Configuration looks good!${NC}"
    echo "   Token has necessary scopes for Multi-Action execution"
    echo ""
else
    echo -e "${YELLOW}⚠️  Configuration may have issues${NC}"
    echo "   Token lacks Multi-Action execution scopes"
    echo ""
    echo "   🔧 ACTION REQUIRED:"
    echo "   1. Verify OAuth client has correct scopes in SAC"
    echo "   2. Check: System → Administration → OAuth Clients"
    echo "   3. Ensure these are enabled:"
    echo "      - Planning Model API"
    echo "      - Multi-Action Execution"
    echo "      - Data Write permissions"
    echo ""
fi

echo "For detailed help, see:"
echo "  • AUTHORIZATION_ROOT_CAUSE_ANALYSIS.md"
echo "  • BASIS_TEAM_ACTION_GUIDE.md"
echo "  • WHAT_IS_REALLY_HAPPENING.md"
echo ""
