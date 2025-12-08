/**
 * SAC OAuth Test Script
 * Tests OAuth token acquisition with detailed logging
 * 
 * Usage:
 *   npm run build
 *   SAC_CLIENT_ID="xxx" SAC_CLIENT_SECRET="xxx" node dist/test-sac-oauth.js
 */

import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

interface OAuthTestResult {
  method: string;
  success: boolean;
  error?: string;
  token?: string;
  expiresIn?: number;
  scope?: string;
}

async function testOAuthMethod(
  method: string,
  tokenUrl: string,
  clientId: string,
  clientSecret: string,
  params: URLSearchParams,
  headers: Record<string, string>
): Promise<OAuthTestResult> {
  try {
    console.log(`\n🧪 Testing: ${method}`);
    console.log(`   URL: ${tokenUrl}`);
    console.log(`   Headers: ${JSON.stringify(Object.keys(headers))}`);
    console.log(`   Body params: ${Array.from(params.keys()).join(', ')}`);

    const response = await axios.post(tokenUrl, params, { headers, timeout: 30000 });

    if (response.data && response.data.access_token) {
      const tokenPreview = response.data.access_token.substring(0, 30) + '...';
      console.log(`   ✅ SUCCESS - Token: ${tokenPreview}`);
      console.log(`   ✅ Expires in: ${response.data.expires_in} seconds`);
      if (response.data.scope) {
        console.log(`   ✅ Scopes: ${response.data.scope}`);
      }

      return {
        method,
        success: true,
        token: tokenPreview,
        expiresIn: response.data.expires_in,
        scope: response.data.scope,
      };
    } else {
      console.log(`   ❌ FAILED - No access_token in response`);
      return { method, success: false, error: 'No access_token in response' };
    }
  } catch (error: any) {
    console.log(`   ❌ FAILED - ${error.message}`);
    if (error.response) {
      console.log(`   ❌ Status: ${error.response.status}`);
      console.log(`   ❌ Response: ${JSON.stringify(error.response.data)}`);
    }
    return {
      method,
      success: false,
      error: error.response ? JSON.stringify(error.response.data) : error.message,
    };
  }
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║        SAC OAuth Token Acquisition Test Suite            ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  // Get credentials from environment
  const clientId = process.env.SAC_CLIENT_ID || '';
  const clientSecret = process.env.SAC_CLIENT_SECRET || '';
  const tenantUrl = process.env.SAC_TENANT_URL || 'https://cvs-pharmacy-q.us10.hcs.cloud.sap';

  if (!clientId || clientId === 'placeholder') {
    console.error('❌ SAC_CLIENT_ID not set or is placeholder');
    console.error('   Set it with: export SAC_CLIENT_ID="your-client-id"');
    process.exit(1);
  }

  if (!clientSecret || clientSecret === 'placeholder') {
    console.error('❌ SAC_CLIENT_SECRET not set or is placeholder');
    console.error('   Set it with: export SAC_CLIENT_SECRET="your-client-secret"');
    process.exit(1);
  }

  // Extract tenant info
  const tenantMatch = tenantUrl.match(/https:\/\/([^.]+)\.([^.]+)\./);
  const tenantName = tenantMatch ? tenantMatch[1] : '';
  const region = tenantMatch ? tenantMatch[2] : 'us10';
  const tokenUrl = `https://${tenantName}.authentication.${region}.hana.ondemand.com/oauth/token`;
  const audience = `https://${tenantName}.authentication.${region}.hana.ondemand.com`;

  // Log configuration
  console.log('📋 Configuration:');
  console.log(`   Tenant URL: ${tenantUrl}`);
  console.log(`   Tenant Name: ${tenantName}`);
  console.log(`   Region: ${region}`);
  console.log(`   Token URL: ${tokenUrl}`);
  console.log(`   Client ID: ${clientId.substring(0, 20)}...${clientId.substring(clientId.length - 10)}`);
  console.log(`   Client Secret: ${clientSecret.substring(0, 10)}...${clientSecret.substring(clientSecret.length - 5)}`);
  
  const isXSUAA = /^sb-[^!]+!b[^|]+\|client!b.+$/.test(clientId);
  console.log(`   Format: ${isXSUAA ? 'XSUAA (BTP-integrated)' : 'Standard SAC OAuth'}`);

  // Test methods
  const results: OAuthTestResult[] = [];

  // Method 1: Basic Auth
  const credentials1 = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  results.push(
    await testOAuthMethod(
      'Method 1: Basic Auth (Standard)',
      tokenUrl,
      clientId,
      clientSecret,
      new URLSearchParams({ grant_type: 'client_credentials' }),
      {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials1}`,
      }
    )
  );

  // Method 2: Basic Auth with Resource
  const credentials2 = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  results.push(
    await testOAuthMethod(
      'Method 2: Basic Auth with Resource (XSUAA)',
      tokenUrl,
      clientId,
      clientSecret,
      new URLSearchParams({
        grant_type: 'client_credentials',
        resource: audience,
      }),
      {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials2}`,
      }
    )
  );

  // Method 3: Client Credentials in Body
  results.push(
    await testOAuthMethod(
      'Method 3: Client Credentials in POST Body',
      tokenUrl,
      clientId,
      clientSecret,
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
      {
        'Content-Type': 'application/x-www-form-urlencoded',
      }
    )
  );

  // Summary
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║                      TEST SUMMARY                         ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(`✅ Successful: ${successful.length}/${results.length}`);
  console.log(`❌ Failed: ${failed.length}/${results.length}\n`);

  if (successful.length > 0) {
    console.log('✅ WORKING METHODS:');
    successful.forEach((r) => {
      console.log(`   • ${r.method}`);
      console.log(`     Token: ${r.token}`);
      console.log(`     Expires: ${r.expiresIn}s`);
      if (r.scope) {
        console.log(`     Scopes: ${r.scope}`);
      }
    });
  }

  if (failed.length > 0) {
    console.log('\n❌ FAILED METHODS:');
    failed.forEach((r) => {
      console.log(`   • ${r.method}`);
      console.log(`     Error: ${r.error}`);
    });
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('🎯 RECOMMENDATION:');
  if (successful.length > 0) {
    console.log('   ✅ OAuth authentication is working!');
    console.log(`   ✅ Use: ${successful[0].method}`);
    console.log('   ✅ Deploy your application and test Multi-Action API');
  } else {
    console.log('   ❌ All OAuth methods failed!');
    console.log('   ❌ Check these potential issues:');
    console.log('      1. Verify OAuth client exists in SAC:');
    console.log(`         https://cvs-pharmacy-q.us10.hcs.cloud.sap`);
    console.log('         → Menu → System → Administration → App Integration → OAuth Clients');
    console.log('      2. Verify client is Enabled');
    console.log('      3. Verify Grant Type is "Client Credentials"');
    console.log('      4. Verify required scopes are selected:');
    console.log('         - Data Import Service');
    console.log('         - Planning');
    console.log('         - Multi-Action Service');
    console.log('      5. Regenerate client secret and try again');
    console.log('      6. Check if client ID was copied correctly');
  }
  console.log('═══════════════════════════════════════════════════════════\n');

  process.exit(successful.length > 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
