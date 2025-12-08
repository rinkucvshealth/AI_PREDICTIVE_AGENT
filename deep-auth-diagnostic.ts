import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const config = {
  sacTenant: process.env.SAC_TENANT_URL || '',
  sacClientId: process.env.SAC_CLIENT_ID || '',
  sacClientSecret: process.env.SAC_CLIENT_SECRET || '',
  oauthTokenUrl: process.env.SAC_OAUTH_TOKEN_URL || '',
  modelId: process.env.SAC_MODEL_ID || '',
  multiActionId: process.env.SAC_MULTIACTION_ID || ''
};

interface TokenInfo {
  raw: string;
  header: any;
  payload: any;
  scopes: string[];
  expiresAt: Date;
  clientId: string;
  grantType: string;
}

function decodeJWT(token: string): TokenInfo {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }

  const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
  
  return {
    raw: token,
    header,
    payload,
    scopes: payload.scope || [],
    expiresAt: new Date(payload.exp * 1000),
    clientId: payload.client_id || payload.azp || 'unknown',
    grantType: payload.grant_type || 'unknown'
  };
}

async function getToken(): Promise<string> {
  console.log('\n🔐 Acquiring OAuth Token...');
  console.log('━'.repeat(80));
  
  const authString = `${config.sacClientId}:${config.sacClientSecret}`;
  const base64Auth = Buffer.from(authString).toString('base64');
  
  try {
    const response = await axios.post(
      config.oauthTokenUrl,
      'grant_type=client_credentials',
      {
        headers: {
          'Authorization': `Basic ${base64Auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    console.log('✅ Token acquired successfully');
    return response.data.access_token;
  } catch (error: any) {
    console.error('❌ Token acquisition failed:', error.response?.data || error.message);
    throw error;
  }
}

async function analyzeToken(token: string) {
  console.log('\n📊 Token Analysis');
  console.log('━'.repeat(80));
  
  try {
    const info = decodeJWT(token);
    
    console.log('\n📝 Token Header:');
    console.log(JSON.stringify(info.header, null, 2));
    
    console.log('\n📝 Token Payload:');
    console.log(JSON.stringify(info.payload, null, 2));
    
    console.log('\n🎯 Key Information:');
    console.log(`  Client ID: ${info.clientId}`);
    console.log(`  Grant Type: ${info.grantType}`);
    console.log(`  Expires At: ${info.expiresAt.toISOString()}`);
    console.log(`  Time Until Expiry: ${Math.round((info.expiresAt.getTime() - Date.now()) / 1000)}s`);
    
    console.log('\n🔑 Scopes:');
    if (Array.isArray(info.scopes)) {
      info.scopes.forEach(scope => console.log(`  ✓ ${scope}`));
    } else {
      console.log('  (No scopes found)');
    }
    
    console.log('\n⚠️  Missing Scopes for Multi-Action Execution:');
    const requiredScopes = [
      'sap.fpa.planning.write',
      'sap.fpa.data.write',
      'sap.fpa.multiaction.execute'
    ];
    
    requiredScopes.forEach(scope => {
      const hasScope = info.scopes.some(s => s.includes(scope));
      console.log(`  ${hasScope ? '✓' : '❌'} ${scope}`);
    });
    
    return info;
  } catch (error) {
    console.error('❌ Failed to decode token:', error);
    throw error;
  }
}

async function testAPIEndpoints(token: string) {
  console.log('\n🧪 Testing SAC API Endpoints');
  console.log('━'.repeat(80));
  
  const endpoints = [
    {
      name: 'Planning Model Info (GET)',
      method: 'get',
      url: `/api/v1/dataimport/planningModel/${config.modelId}`,
      needsCSRF: false
    },
    {
      name: 'Planning Model (HEAD) - CSRF',
      method: 'head',
      url: `/api/v1/dataimport/planningModel/${config.modelId}`,
      needsCSRF: false,
      headers: { 'x-csrf-token': 'fetch' }
    },
    {
      name: 'Multi-Actions List (GET)',
      method: 'get',
      url: `/api/v1/dataimport/planningModel/${config.modelId}/multiActions`,
      needsCSRF: false
    },
    {
      name: 'Specific Multi-Action (GET)',
      method: 'get',
      url: `/api/v1/dataimport/planningModel/${config.modelId}/multiActions/${config.multiActionId}`,
      needsCSRF: false
    }
  ];
  
  const results: any[] = [];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`\n📍 Testing: ${endpoint.name}`);
      console.log(`   URL: ${config.sacTenant}${endpoint.url}`);
      
      const headers: any = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        ...endpoint.headers
      };
      
      const response = await axios({
        method: endpoint.method as any,
        url: endpoint.url,
        baseURL: config.sacTenant,
        headers,
        validateStatus: () => true // Don't throw on any status
      });
      
      const success = response.status >= 200 && response.status < 300;
      console.log(`   Status: ${response.status} ${response.statusText}`);
      
      if (success) {
        console.log(`   ✅ Success`);
        if (response.data) {
          console.log(`   Data: ${JSON.stringify(response.data).substring(0, 200)}...`);
        }
        if (response.headers['x-csrf-token']) {
          console.log(`   🔒 CSRF Token: ${response.headers['x-csrf-token'].substring(0, 20)}...`);
        }
      } else {
        console.log(`   ❌ Failed`);
        console.log(`   Error: ${response.data}`);
      }
      
      results.push({
        endpoint: endpoint.name,
        status: response.status,
        success,
        data: response.data
      });
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
      results.push({
        endpoint: endpoint.name,
        status: error.response?.status || 0,
        success: false,
        error: error.message
      });
    }
  }
  
  return results;
}

async function checkAlternativeAuthMethods() {
  console.log('\n🔄 Checking Alternative Authentication Methods');
  console.log('━'.repeat(80));
  
  // Check if we should use password grant
  console.log('\n1️⃣  Client Credentials (Current)');
  console.log('   ✓ Currently using this method');
  console.log('   ⚠️  This gives SERVICE-level access, not USER-level');
  console.log('   ⚠️  Multi-Actions might require USER context');
  
  console.log('\n2️⃣  Password Grant (Resource Owner)');
  console.log('   ❌ Requires username/password');
  console.log('   ✓ Provides USER context');
  console.log('   ⚠️  Not recommended for production');
  
  console.log('\n3️⃣  SAML Bearer Assertion');
  console.log('   ✓ Best for user-context operations');
  console.log('   ❌ Requires SAML assertion from user session');
  console.log('   ℹ️  Typically used with AppRouter');
  
  console.log('\n4️⃣  JWT Bearer Token Exchange');
  console.log('   ✓ Can exchange client credentials token for user token');
  console.log('   ❌ Requires additional configuration');
}

async function diagnosePermissions(tokenInfo: TokenInfo) {
  console.log('\n🔍 Permission Diagnosis');
  console.log('━'.repeat(80));
  
  console.log('\n❓ Why are Multi-Actions failing with 401?');
  console.log('\nPossible Causes:');
  
  console.log('\n1. ❌ WRONG TOKEN TYPE');
  console.log('   Current: Client Credentials token (service-to-service)');
  console.log('   Needed:  User-context token (user propagation)');
  console.log('   Reason:  Multi-Actions often require user permissions');
  
  console.log('\n2. ❌ MISSING SCOPES');
  console.log('   Current scopes:', tokenInfo.scopes.join(', '));
  console.log('   Missing:        Planning/Multi-Action execution scopes');
  
  console.log('\n3. ❌ WRONG OAUTH CLIENT');
  console.log('   Current: XSUAA service instance client');
  console.log('   Needed:  SAC-specific OAuth client');
  console.log('   Where:   SAC → System → Administration → App Integration → OAuth Clients');
  
  console.log('\n4. ❌ MISSING USER ASSIGNMENT');
  console.log('   Even with correct client, the service user might not have:');
  console.log('   - Planning Model access');
  console.log('   - Multi-Action execution rights');
  console.log('   - Write permissions on the model');
}

async function suggestSolutions() {
  console.log('\n💡 SOLUTIONS');
  console.log('━'.repeat(80));
  
  console.log('\n🎯 Solution 1: Create SAC-Native OAuth Client (RECOMMENDED)');
  console.log('━'.repeat(80));
  console.log('1. Log into SAC: https://cvs-pharmacy-q.us10.hcs.cloud.sap');
  console.log('2. Go to: System → Administration → App Integration → OAuth Clients');
  console.log('3. Click "Add a New OAuth Client"');
  console.log('4. Configure:');
  console.log('   Name: AI Predictive Agent');
  console.log('   Purpose: Interactive Usage and API Access');
  console.log('   Access: ');
  console.log('     ✓ Planning Model API');
  console.log('     ✓ Data Import API');
  console.log('     ✓ Multi-Action Execution');
  console.log('   Token Lifetime: 3600 seconds');
  console.log('5. Save and copy the Client ID and Secret');
  console.log('6. Update environment variables:');
  console.log('   SAC_CLIENT_ID=<new-client-id>');
  console.log('   SAC_CLIENT_SECRET=<new-client-secret>');
  console.log('   SAC_OAUTH_TOKEN_URL=https://cvs-pharmacy-q.us10.hcs.cloud.sap/oauth/token');
  
  console.log('\n🎯 Solution 2: Use XSUAA with User Token (Current Auth)');
  console.log('━'.repeat(80));
  console.log('If you MUST use XSUAA, you need:');
  console.log('1. A technical user in SAC with Multi-Action permissions');
  console.log('2. Use Password Grant instead of Client Credentials:');
  console.log('   grant_type=password&username=<technical-user>&password=<password>');
  console.log('⚠️  Not recommended - harder to secure');
  
  console.log('\n🎯 Solution 3: Verify Current OAuth Client Permissions');
  console.log('━'.repeat(80));
  console.log('Ask BASIS team to verify:');
  console.log('1. Is this client created in SAC OAuth Clients?');
  console.log('   OR');
  console.log('   Is this a BTP XSUAA service instance?');
  console.log('');
  console.log('2. If XSUAA, does the destination/client have:');
  console.log('   - Correct scopes for SAC Planning APIs?');
  console.log('   - User propagation configured?');
  console.log('   - Role collections assigned?');
  console.log('');
  console.log('3. Check SAC Role Collections:');
  console.log('   BTP Cockpit → Security → Trust Configuration');
  console.log('   Verify service instance has SAC planning roles');
}

async function main() {
  console.log('\n');
  console.log('═'.repeat(80));
  console.log('🔬 DEEP SAC AUTHENTICATION DIAGNOSTIC');
  console.log('═'.repeat(80));
  console.log(`\n📅 Date: ${new Date().toISOString()}`);
  console.log(`🌐 SAC Tenant: ${config.sacTenant}`);
  console.log(`📦 Model: ${config.modelId}`);
  console.log(`⚡ Multi-Action: ${config.multiActionId}`);
  
  try {
    // Step 1: Get token
    const token = await getToken();
    
    // Step 2: Analyze token
    const tokenInfo = await analyzeToken(token);
    
    // Step 3: Test endpoints
    const results = await testAPIEndpoints(token);
    
    // Step 4: Check alternatives
    await checkAlternativeAuthMethods();
    
    // Step 5: Diagnose
    await diagnosePermissions(tokenInfo);
    
    // Step 6: Solutions
    await suggestSolutions();
    
    // Summary
    console.log('\n');
    console.log('═'.repeat(80));
    console.log('📋 SUMMARY');
    console.log('═'.repeat(80));
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    console.log(`\n✅ Successful API calls: ${successCount}/${results.length}`);
    console.log(`❌ Failed API calls: ${failCount}/${results.length}`);
    
    if (successCount === 0) {
      console.log('\n⚠️  CRITICAL: No API endpoints are accessible with current token');
      console.log('   → Token is invalid for SAC APIs');
      console.log('   → Likely using wrong OAuth client or token URL');
      console.log('   → Follow Solution 1 above to create SAC-native OAuth client');
    } else if (failCount > 0) {
      console.log('\n⚠️  PARTIAL ACCESS: Some endpoints work, others fail');
      console.log('   → Token is valid but lacks specific permissions');
      console.log('   → Multi-Action execution requires additional scopes');
      console.log('   → Follow Solution 3 to verify and update permissions');
    } else {
      console.log('\n✅ All GET endpoints work!');
      console.log('   → Token is valid and has read permissions');
      console.log('   → 401 on Multi-Action execution suggests:');
      console.log('     • Missing write/execute permissions');
      console.log('     • User context required for execution');
    }
    
    console.log('\n');
    console.log('═'.repeat(80));
    console.log('🎬 NEXT STEPS');
    console.log('═'.repeat(80));
    console.log('\n1. Share this diagnostic output with BASIS team');
    console.log('2. Ask them to create SAC-native OAuth client (Solution 1)');
    console.log('3. Ensure OAuth client has Multi-Action execution permissions');
    console.log('4. Update environment variables with new credentials');
    console.log('5. Verify technical user has write access to model');
    console.log('\n');
    
  } catch (error: any) {
    console.error('\n❌ Diagnostic failed:', error.message);
    console.error('\nThis usually means:');
    console.error('  • Environment variables not set correctly');
    console.error('  • OAuth token endpoint is wrong');
    console.error('  • Client credentials are invalid');
    process.exit(1);
  }
}

main();
