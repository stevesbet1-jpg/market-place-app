// Node test script for Supabase connectivity
// Uses exact same URL and key from .env

require('dotenv').config({ path: '../.env' });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

console.log('=== SUPABASE NODE TEST ===');
console.log('URL:', SUPABASE_URL || 'MISSING');
console.log('Key prefix:', SUPABASE_PUBLISHABLE_KEY ? SUPABASE_PUBLISHABLE_KEY.substring(0, 20) : 'MISSING');
console.log('Key length:', SUPABASE_PUBLISHABLE_KEY?.length || 0);
console.log('=========================');

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.error('FAIL: Missing URL or key in .env');
  process.exit(1);
}

fetch(`${SUPABASE_URL}/auth/v1/settings`, {
  headers: {
    'apikey': SUPABASE_PUBLISHABLE_KEY,
    'Authorization': `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
  },
})
  .then((response) => {
    console.log('Status code:', response.status);
    console.log('Status text:', response.statusText);
    console.log('OK:', response.ok);
    return response.text();
  })
  .then((body) => {
    console.log('Response body (first 300 chars):');
    console.log(body.substring(0, 300));
    console.log('\n=== RESULT: PASS ===');
    process.exit(0);
  })
  .catch((error) => {
    console.error('FAIL: Network error');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.log('\n=== RESULT: FAIL ===');
    process.exit(1);
  });
