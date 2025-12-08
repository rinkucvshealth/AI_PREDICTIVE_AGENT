import axios from 'axios';

/**
 * Test OAuth authentication with SAC
 * This script tests all three authentication methods
 */

// Read credentials from environment
const SAC_CLIENT_ID = process.env.SAC_CLIENT_ID || '';
const SAC_CLIENT_SECRET = process.env.SAC_CLIENT_SECRET || '';
const SAC_TENANT_URL = process.env.SAC_TENANT_URL || 'https://cvs-pharmacy-q.us10.hcs.cloud.sap';
const SAC_OAUTH_TOKEN_URL = process.env.SAC_OAUTH_TOKEN_URL || 'https://cvs-pharmacy-q.authentication.us10.hana.ondemand.com/oauth/token';

console.log('==========================================');
console.log('🔍 OAuth Debugging Tool');
console.log('==========================================');
console.log('SAC Tenant URL:', SAC_TENANT_URL);
console.log('OAuth Token URL:', SAC_OAUTH_TOKEN_URL);
console.log('Client ID:', SAC_CLIENT_ID.substring(0, 30) + '...');
console.log('Client Secret:', SAC_CLIENT_SECRET.substring(0, 10) + '...');
console.log('==========================================\n');

async function testMethod1BasicAuth() {
  console.log('\n📋 Method 1: Basic Auth (Standard)');
  console.log('------------------------------------------');
  
  try {
    const credentials = Buffer.from(`${SAC_CLIENT_ID}:${SAC_CLIENT_SECRET}`).toString('base64');
    
    console.log('Request Details:');
    console.log('  URL:', SAC_OAUTH_TOKEN_URL);
    console.log('  Method: POST');
    console.log('  Headers:');
    console.log('    Content-Type: application/x-www-form-urlencoded');
    console.log('    Authorization: Basic ' + credentials.substring(0, 20) + '...');
    console.log('  Body: grant_type=client_credentials');
    
    const response = await axios.post(
      SAC_OAUTH_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'client_credentials',
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`,
        },
        timeout: 30000,
      }
    );

    console.log('\n✅ SUCCESS!');
    console.log('Response Status:', response.status);
    console.log('Access Token:', response.data.access_token?.substring(0, 50) + '...');
    console.log('Token Type:', response.data.token_type);
    console.log('Expires In:', response.data.expires_in, 'seconds');
    console.log('Scope:', response.data.scope || 'Not provided');
    
    return response.data.access_token;
  } catch (error: any) {
    console.log('\n❌ FAILED');
    console.log('Error:', error.message);
    if (error.response) {
      console.log('Response Status:', error.response.status);
      console.log('Response Data:', JSON.stringify(error.response.data, null, 2));
      console.log('Response Headers:', JSON.stringify(error.response.headers, null, 2));
    }
    return null;
  }
}

async function testMethod2BasicAuthWithResource() {
  console.log('\n📋 Method 2: Basic Auth with Resource (XSUAA)');
  console.log('------------------------------------------');
  
  try {
    const credentials = Buffer.from(`${SAC_CLIENT_ID}:${SAC_CLIENT_SECRET}`).toString('base64');
    
    // Extract tenant and region from URL
    const tenantMatch = SAC_TENANT_URL.match(/https:\/\/([^.]+)\.([^.]+)\./);
    const tenantName = tenantMatch ? tenantMatch[1] : '';
    const region = tenantMatch ? tenantMatch[2] : 'us10';
    const audience = `https://${tenantName}.authentication.${region}.hana.ondemand.com`;
    
    console.log('Request Details:');
    console.log('  URL:', SAC_OAUTH_TOKEN_URL);
    console.log('  Method: POST');
    console.log('  Headers:');
    console.log('    Content-Type: application/x-www-form-urlencoded');
    console.log('    Authorization: Basic ' + credentials.substring(0, 20) + '...');
    console.log('  Body: grant_type=client_credentials&resource=' + audience);
    
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      resource: audience,
    });

    const response = await axios.post(
      SAC_OAUTH_TOKEN_URL,
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`,
        },
        timeout: 30000,
      }
    );

    console.log('\n✅ SUCCESS!');
    console.log('Response Status:', response.status);
    console.log('Access Token:', response.data.access_token?.substring(0, 50) + '...');
    console.log('Token Type:', response.data.token_type);
    console.log('Expires In:', response.data.expires_in, 'seconds');
    console.log('Scope:', response.data.scope || 'Not provided');
    
    return response.data.access_token;
  } catch (error: any) {
    console.log('\n❌ FAILED');
    console.log('Error:', error.message);
    if (error.response) {
      console.log('Response Status:', error.response.status);
      console.log('Response Data:', JSON.stringify(error.response.data, null, 2));
      console.log('Response Headers:', JSON.stringify(error.response.headers, null, 2));
    }
    return null;
  }
}

async function testMethod3BodyCredentials() {
  console.log('\n📋 Method 3: Client Credentials in Body');
  console.log('------------------------------------------');
  
  try {
    console.log('Request Details:');
    console.log('  URL:', SAC_OAUTH_TOKEN_URL);
    console.log('  Method: POST');
    console.log('  Headers:');
    console.log('    Content-Type: application/x-www-form-urlencoded');
    console.log('  Body: grant_type=client_credentials&client_id=...&client_secret=...');
    
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: SAC_CLIENT_ID,
      client_secret: SAC_CLIENT_SECRET,
    });

    const response = await axios.post(
      SAC_OAUTH_TOKEN_URL,
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 30000,
      }
    );

    console.log('\n✅ SUCCESS!');
    console.log('Response Status:', response.status);
    console.log('Access Token:', response.data.access_token?.substring(0, 50) + '...');
    console.log('Token Type:', response.data.token_type);
    console.log('Expires In:', response.data.expires_in, 'seconds');
    console.log('Scope:', response.data.scope || 'Not provided');
    
    return response.data.access_token;
  } catch (error: any) {
    console.log('\n❌ FAILED');
    console.log('Error:', error.message);
    if (error.response) {
      console.log('Response Status:', error.response.status);
      console.log('Response Data:', JSON.stringify(error.response.data, null, 2));
      console.log('Response Headers:', JSON.stringify(error.response.headers, null, 2));
    }
    return null;
  }
}

async function testMultiActionAPI(accessToken: string) {
  console.log('\n📋 Testing SAC Multi-Action API');
  console.log('------------------------------------------');
  
  const SAC_MODEL_ID = process.env.SAC_MODEL_ID || 'PRDA_PL_PLAN';
  const SAC_MULTI_ACTION_ID = process.env.SAC_MULTI_ACTION_ID || 'E5280280114D3785596849C3D321B820';
  
  const endpoint = `${SAC_TENANT_URL}/api/v1/dataimport/planningModel/${SAC_MODEL_ID}/multiActions/${SAC_MULTI_ACTION_ID}/runs`;
  
  try {
    console.log('Request Details:');
    console.log('  URL:', endpoint);
    console.log('  Method: POST');
    console.log('  Headers:');
    console.log('    Authorization: Bearer ' + accessToken.substring(0, 20) + '...');
    console.log('    Content-Type: application/json');
    console.log('  Body: { "parameterValues": { "GLAccount": "500100", "ForecastPeriod": 6, "VersionName": "Test" } }');
    
    const response = await axios.post(
      endpoint,
      {
        parameterValues: {
          GLAccount: '500100',
          ForecastPeriod: 6,
          VersionName: 'Test_OAuth_Debug'
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: 60000,
      }
    );

    console.log('\n✅ SUCCESS!');
    console.log('Response Status:', response.status);
    console.log('Response Data:', JSON.stringify(response.data, null, 2));
    
    return true;
  } catch (error: any) {
    console.log('\n❌ FAILED');
    console.log('Error:', error.message);
    if (error.response) {
      console.log('Response Status:', error.response.status);
      console.log('Response Status Text:', error.response.statusText);
      console.log('Response Data:', JSON.stringify(error.response.data, null, 2));
      console.log('Response Headers:', JSON.stringify(error.response.headers, null, 2));
    }
    return false;
  }
}

async function main() {
  // Validate credentials
  if (!SAC_CLIENT_ID || SAC_CLIENT_ID === 'placeholder') {
    console.error('❌ SAC_CLIENT_ID is not set or is placeholder');
    process.exit(1);
  }
  
  if (!SAC_CLIENT_SECRET || SAC_CLIENT_SECRET === 'placeholder') {
    console.error('❌ SAC_CLIENT_SECRET is not set or is placeholder');
    process.exit(1);
  }

  // Try all three methods
  let accessToken: string | null = null;
  
  accessToken = await testMethod1BasicAuth();
  if (accessToken) {
    await testMultiActionAPI(accessToken);
    return;
  }
  
  accessToken = await testMethod2BasicAuthWithResource();
  if (accessToken) {
    await testMultiActionAPI(accessToken);
    return;
  }
  
  accessToken = await testMethod3BodyCredentials();
  if (accessToken) {
    await testMultiActionAPI(accessToken);
    return;
  }
  
  console.log('\n==========================================');
  console.log('❌ All OAuth methods failed!');
  console.log('==========================================');
  console.log('\nPossible issues:');
  console.log('1. Client ID or Client Secret is incorrect');
  console.log('2. OAuth Token URL is incorrect');
  console.log('3. Credentials do not have Multi-Action API scope');
  console.log('4. SAC tenant configuration issue');
}

main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
