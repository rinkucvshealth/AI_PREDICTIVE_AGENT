/**
 * Multi-Action Diagnostic Tool
 * Tests SAC Multi-Action accessibility and API endpoints
 */

import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const SAC_TENANT_URL = process.env['SAC_TENANT_URL'] || 'https://cvs-pharmacy-q.us10.hcs.cloud.sap';
const SAC_CLIENT_ID = process.env['SAC_CLIENT_ID'] || '';
const SAC_CLIENT_SECRET = process.env['SAC_CLIENT_SECRET'] || '';
const SAC_MODEL_ID = process.env['SAC_MODEL_ID'] || 'PRDA_PL_PLAN';
const SAC_MULTI_ACTION_ID = process.env['SAC_MULTI_ACTION_ID'] || 'E5280280114D3785596849C3D321B820';

// OAuth token endpoint
const tenantMatch = SAC_TENANT_URL.match(/https:\/\/([^.]+)\.([^.]+)\./);
const tenantName = tenantMatch ? tenantMatch[1] : 'cvs-pharmacy-q';
const region = tenantMatch ? tenantMatch[2] : 'us10';
const TOKEN_URL = `https://${tenantName}.authentication.${region}.hana.ondemand.com/oauth/token`;

interface DiagnosticResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  message: string;
  details?: any;
}

const results: DiagnosticResult[] = [];

/**
 * Get OAuth access token
 */
async function getAccessToken(): Promise<string | null> {
  try {
    console.log('\n🔐 Getting OAuth Token...');
    console.log(`Token URL: ${TOKEN_URL}`);
    
    const credentials = Buffer.from(`${SAC_CLIENT_ID}:${SAC_CLIENT_SECRET}`).toString('base64');
    
    const response = await axios.post(
      TOKEN_URL,
      new URLSearchParams({ grant_type: 'client_credentials' }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`,
        },
        timeout: 30000,
      }
    );

    if (response.data && response.data.access_token) {
      console.log('✅ OAuth token acquired');
      console.log(`   Scopes: ${response.data.scope || 'none'}`);
      console.log(`   Expires in: ${response.data.expires_in} seconds`);
      
      results.push({
        test: 'OAuth Token Acquisition',
        status: 'PASS',
        message: 'Successfully acquired OAuth token',
        details: {
          scopes: response.data.scope,
          expiresIn: response.data.expires_in,
        },
      });
      
      return response.data.access_token;
    }
    
    return null;
  } catch (error: any) {
    console.error('❌ Failed to get OAuth token:', error.message);
    results.push({
      test: 'OAuth Token Acquisition',
      status: 'FAIL',
      message: error.message,
      details: error.response?.data,
    });
    return null;
  }
}

/**
 * Test Model API access
 */
async function testModelAPI(token: string): Promise<boolean> {
  try {
    console.log('\n📊 Testing Model API Access...');
    const endpoint = `${SAC_TENANT_URL}/api/v1/models/${SAC_MODEL_ID}`;
    console.log(`Endpoint: ${endpoint}`);
    
    const response = await axios.get(endpoint, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
      validateStatus: () => true,
    });

    console.log(`   Status: ${response.status}`);
    
    if (response.status === 200) {
      console.log('✅ Model API accessible');
      results.push({
        test: 'Model API Access',
        status: 'PASS',
        message: 'Successfully accessed model via API',
        details: { modelId: SAC_MODEL_ID },
      });
      return true;
    } else {
      console.log(`⚠️  Model API returned ${response.status}`);
      results.push({
        test: 'Model API Access',
        status: 'WARNING',
        message: `Model API returned ${response.status}`,
        details: response.data,
      });
      return false;
    }
  } catch (error: any) {
    console.error('❌ Model API test failed:', error.message);
    results.push({
      test: 'Model API Access',
      status: 'FAIL',
      message: error.message,
    });
    return false;
  }
}

/**
 * Test Multi-Action listing
 */
async function testMultiActionListing(token: string): Promise<void> {
  try {
    console.log('\n📋 Testing Multi-Action Listing...');
    const endpoint = `${SAC_TENANT_URL}/api/v1/dataimport/planningModel/${SAC_MODEL_ID}/multiActions`;
    console.log(`Endpoint: ${endpoint}`);
    
    const response = await axios.get(endpoint, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
      validateStatus: () => true,
    });

    console.log(`   Status: ${response.status}`);
    
    if (response.status === 200) {
      console.log('✅ Multi-Action listing accessible');
      console.log('   Available Multi-Actions:', response.data);
      
      // Check if our Multi-Action ID exists
      const multiActions = response.data.multiActions || response.data.value || [];
      const found = multiActions.find((ma: any) => 
        ma.id === SAC_MULTI_ACTION_ID || ma.ID === SAC_MULTI_ACTION_ID
      );
      
      if (found) {
        console.log(`✅ Multi-Action ${SAC_MULTI_ACTION_ID} found`);
        results.push({
          test: 'Multi-Action Exists',
          status: 'PASS',
          message: 'Multi-Action found in model',
          details: found,
        });
      } else {
        console.log(`⚠️  Multi-Action ${SAC_MULTI_ACTION_ID} NOT found`);
        console.log(`   Available IDs: ${multiActions.map((ma: any) => ma.id || ma.ID).join(', ')}`);
        results.push({
          test: 'Multi-Action Exists',
          status: 'WARNING',
          message: 'Multi-Action ID not found in model',
          details: { availableMultiActions: multiActions },
        });
      }
    } else {
      console.log(`⚠️  Multi-Action listing returned ${response.status}`);
      results.push({
        test: 'Multi-Action Listing',
        status: 'WARNING',
        message: `API returned ${response.status}`,
        details: response.data,
      });
    }
  } catch (error: any) {
    console.error('❌ Multi-Action listing failed:', error.message);
    results.push({
      test: 'Multi-Action Listing',
      status: 'FAIL',
      message: error.message,
      details: error.response?.data,
    });
  }
}

/**
 * Test CSRF token fetch
 */
async function testCSRFToken(token: string): Promise<string | null> {
  try {
    console.log('\n🔒 Testing CSRF Token Fetch...');
    const endpoint = `${SAC_TENANT_URL}/api/v1/dataimport/planningModel/${SAC_MODEL_ID}`;
    console.log(`Endpoint: ${endpoint}`);
    
    const response = await axios.get(endpoint, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-csrf-token': 'Fetch',
        'Accept': 'application/json',
      },
      validateStatus: () => true,
    });

    console.log(`   Status: ${response.status}`);
    
    const csrfToken = response.headers['x-csrf-token'];
    if (csrfToken) {
      console.log('✅ CSRF token acquired');
      console.log(`   Token: ${csrfToken.substring(0, 20)}...`);
      results.push({
        test: 'CSRF Token Fetch',
        status: 'PASS',
        message: 'Successfully fetched CSRF token',
      });
      return csrfToken;
    } else {
      console.log('⚠️  No CSRF token in response');
      results.push({
        test: 'CSRF Token Fetch',
        status: 'WARNING',
        message: 'No CSRF token in response headers',
      });
      return null;
    }
  } catch (error: any) {
    console.error('❌ CSRF token fetch failed:', error.message);
    results.push({
      test: 'CSRF Token Fetch',
      status: 'FAIL',
      message: error.message,
    });
    return null;
  }
}

/**
 * Test Multi-Action trigger endpoints
 */
async function testMultiActionTrigger(token: string, csrfToken: string | null): Promise<void> {
  const endpoints = [
    {
      name: 'Primary (Planning Model)',
      url: `/api/v1/dataimport/planningModel/${SAC_MODEL_ID}/multiActions/${SAC_MULTI_ACTION_ID}/runs`,
      body: { parameterValues: { GLAccount: '400250', ForecastPeriod: 12, VersionName: 'Test' } },
    },
    {
      name: 'Alternative (Generic)',
      url: `/api/v1/multiactions/${SAC_MULTI_ACTION_ID}/trigger`,
      body: { GLAccount: '400250', ForecastPeriod: 12, VersionName: 'Test' },
    },
    {
      name: 'Data Import Job',
      url: `/api/v1/dataimport/planningModel/${SAC_MODEL_ID}/jobs`,
      body: {
        type: 'MULTIACTION',
        multiActionId: SAC_MULTI_ACTION_ID,
        parameters: { GLAccount: '400250', ForecastPeriod: 12, VersionName: 'Test' },
      },
    },
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`\n🎯 Testing ${endpoint.name}...`);
      console.log(`   URL: ${SAC_TENANT_URL}${endpoint.url}`);
      
      const headers: any = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };
      
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }
      
      const response = await axios.post(
        `${SAC_TENANT_URL}${endpoint.url}`,
        endpoint.body,
        {
          headers,
          validateStatus: () => true,
        }
      );

      console.log(`   Status: ${response.status}`);
      
      if (response.status === 200 || response.status === 201 || response.status === 202) {
        console.log(`✅ ${endpoint.name} endpoint works!`);
        console.log('   Response:', JSON.stringify(response.data, null, 2));
        results.push({
          test: `Multi-Action Trigger (${endpoint.name})`,
          status: 'PASS',
          message: 'Successfully triggered Multi-Action',
          details: response.data,
        });
      } else {
        console.log(`❌ ${endpoint.name} returned ${response.status}`);
        console.log('   Response:', response.data);
        results.push({
          test: `Multi-Action Trigger (${endpoint.name})`,
          status: 'FAIL',
          message: `HTTP ${response.status}: ${response.statusText}`,
          details: response.data,
        });
      }
    } catch (error: any) {
      console.error(`❌ ${endpoint.name} failed:`, error.message);
      results.push({
        test: `Multi-Action Trigger (${endpoint.name})`,
        status: 'FAIL',
        message: error.message,
        details: error.response?.data,
      });
    }
  }
}

/**
 * Generate diagnostic report
 */
function generateReport(): void {
  console.log('\n' + '='.repeat(80));
  console.log('📊 DIAGNOSTIC REPORT');
  console.log('='.repeat(80));
  
  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const warnCount = results.filter(r => r.status === 'WARNING').length;
  
  console.log(`\nResults: ${passCount} passed, ${failCount} failed, ${warnCount} warnings\n`);
  
  results.forEach((result, index) => {
    const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${index + 1}. ${icon} ${result.test}`);
    console.log(`   ${result.message}`);
    if (result.details) {
      console.log(`   Details: ${JSON.stringify(result.details, null, 2).substring(0, 200)}...`);
    }
    console.log();
  });
  
  console.log('='.repeat(80));
  console.log('💡 RECOMMENDATIONS');
  console.log('='.repeat(80));
  
  // Generate recommendations based on results
  const oauthPass = results.find(r => r.test === 'OAuth Token Acquisition' && r.status === 'PASS');
  const multiActionExists = results.find(r => r.test === 'Multi-Action Exists');
  const triggerTests = results.filter(r => r.test.includes('Multi-Action Trigger'));
  const anyTriggerPass = triggerTests.some(t => t.status === 'PASS');
  
  if (!oauthPass) {
    console.log('\n1. ❌ OAuth authentication is failing');
    console.log('   → Check SAC_CLIENT_ID and SAC_CLIENT_SECRET');
    console.log('   → Verify credentials are for SAC (not BTP platform)');
    console.log('   → Create OAuth client in SAC: Settings → App Integration → OAuth Clients');
  }
  
  if (multiActionExists && multiActionExists.status !== 'PASS') {
    console.log('\n2. ⚠️  Multi-Action not found or not accessible');
    console.log('   → Verify Multi-Action ID: ' + SAC_MULTI_ACTION_ID);
    console.log('   → Create Multi-Action in SAC Planning Model: PRDA_PL_PLAN');
    console.log('   → Ensure Multi-Action is published and accessible via API');
    console.log('   → Check available Multi-Actions in the diagnostic output above');
  }
  
  if (!anyTriggerPass && oauthPass) {
    console.log('\n3. ❌ All Multi-Action trigger endpoints failing');
    console.log('   → OAuth client may lack required scopes/permissions');
    console.log('   → In SAC, edit OAuth client and grant:');
    console.log('      • Data Import Service');
    console.log('      • Planning Model: Read & Write');
    console.log('      • Multi-Action Execution');
    console.log('   → Contact SAC administrator to verify service account permissions');
  }
  
  if (anyTriggerPass) {
    console.log('\n✅ SUCCESS! At least one endpoint works');
    const workingEndpoint = triggerTests.find(t => t.status === 'PASS');
    console.log(`   → Use: ${workingEndpoint?.test}`);
    console.log('   → Update application to use this endpoint');
  }
  
  console.log('\n' + '='.repeat(80));
}

/**
 * Main diagnostic function
 */
async function main() {
  console.log('🔍 SAC Multi-Action Diagnostic Tool');
  console.log('='.repeat(80));
  console.log(`SAC Tenant: ${SAC_TENANT_URL}`);
  console.log(`Model ID: ${SAC_MODEL_ID}`);
  console.log(`Multi-Action ID: ${SAC_MULTI_ACTION_ID}`);
  console.log('='.repeat(80));
  
  // Step 1: Get OAuth token
  const token = await getAccessToken();
  if (!token) {
    console.error('\n❌ Cannot proceed without OAuth token');
    generateReport();
    process.exit(1);
  }
  
  // Step 2: Test Model API
  await testModelAPI(token);
  
  // Step 3: Test Multi-Action listing
  await testMultiActionListing(token);
  
  // Step 4: Get CSRF token
  const csrfToken = await testCSRFToken(token);
  
  // Step 5: Test Multi-Action trigger
  await testMultiActionTrigger(token, csrfToken);
  
  // Generate final report
  generateReport();
}

main().catch(console.error);
