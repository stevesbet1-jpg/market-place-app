/**
 * Set Render environment variable from local service account JSON.
 *
 * Usage:
 *   export RENDER_API_KEY=rk_your_key_here
 *   node scripts/set-render-env.js
 *
 * Get your API key from: https://dashboard.render.com/account-settings
 */

const fs = require('fs');
const path = require('path');

const SERVICE_NAME = 'market-place-app-1';
const ENV_KEY = 'FIREBASE_SERVICE_ACCOUNT_JSON';

async function main() {
  const apiKey = process.env.RENDER_API_KEY;
  if (!apiKey) {
    console.error('ERROR: Set RENDER_API_KEY environment variable first.');
    console.error('Get it from: https://dashboard.render.com/account-settings');
    process.exit(1);
  }

  // Find the service account JSON file
  const rootDir = path.join(__dirname, '..');
  const candidates = [
    path.join(rootDir, 'marketplace-app-3b3f7-firebase-adminsdk-fbsvc-3c92274ace.json'),
    path.join(rootDir, 'scripts', 'serviceAccount.json'),
  ];

  let jsonPath = null;
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      jsonPath = p;
      break;
    }
  }

  if (!jsonPath) {
    console.error('ERROR: No firebase-adminsdk service account JSON found.');
    console.error('Looked in:', candidates);
    process.exit(1);
  }

  const jsonContent = fs.readFileSync(jsonPath, 'utf8');
  // Validate it's valid JSON
  try {
    JSON.parse(jsonContent);
  } catch (e) {
    console.error('ERROR: File is not valid JSON:', jsonPath);
    process.exit(1);
  }

  console.log(`Found service account: ${jsonPath}`);
  console.log(`Setting ${ENV_KEY} on Render service: ${SERVICE_NAME}`);

  // First, find the service ID
  const serviceListUrl = 'https://api.render.com/v1/services';
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  let serviceId = null;
  try {
    const resp = await fetch(serviceListUrl, { headers });
    if (!resp.ok) {
      const err = await resp.text();
      console.error('ERROR: Failed to list services:', resp.status, err);
      process.exit(1);
    }
    const services = await resp.json();
    const service = services.find(s => s.service?.name === SERVICE_NAME || s.name === SERVICE_NAME);
    if (!service) {
      console.error('ERROR: Service not found:', SERVICE_NAME);
      console.error('Available services:', services.map(s => s.service?.name || s.name));
      process.exit(1);
    }
    serviceId = service.service?.id || service.id;
    console.log(`Found service ID: ${serviceId}`);
  } catch (e) {
    console.error('ERROR listing services:', e.message);
    process.exit(1);
  }

  // Set the env var
  const envUrl = `https://api.render.com/v1/services/${serviceId}/env-vars`;
  const body = {
    key: ENV_KEY,
    value: jsonContent,
  };

  try {
    const resp = await fetch(envUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const err = await resp.text();
      console.error('ERROR: Failed to set env var:', resp.status, err);
      process.exit(1);
    }
    console.log('SUCCESS: FIREBASE_SERVICE_ACCOUNT_JSON set on Render.');
    console.log('Render will redeploy automatically. Wait 1-2 minutes, then test:');
    console.log('  curl https://market-place-app-1.onrender.com/api/health');
  } catch (e) {
    console.error('ERROR setting env var:', e.message);
    process.exit(1);
  }
}

main();
