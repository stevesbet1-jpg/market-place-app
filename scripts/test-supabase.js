// Node test script for Supabase connectivity
// Uses exact same URL and key from .env

require('dotenv').config({ path: '../.env' });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

console.log('=== SUPABASE NODE TEST ===');
console.log('URL:', SUPABASE_URL || 'MISSING');
console.log('Key prefix:', SUPABASE_ANON_KEY ? SUPABASE_ANON_KEY.substring(0, 12) + '...' : 'MISSING');
console.log('Key length:', SUPABASE_ANON_KEY?.length || 0);
console.log('=========================');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('FAIL: Missing URL or key in .env');
  process.exit(1);
}

fetch(`${SUPABASE_URL}/auth/v1/settings`, {
  headers: {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
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
