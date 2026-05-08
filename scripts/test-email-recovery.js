// Test script for Supabase password recovery email
require('dotenv').config({ path: '../.env' });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

console.log('=== SUPABASE EMAIL RECOVERY TEST ===');
console.log('URL:', SUPABASE_URL);
console.log('Key:', SUPABASE_KEY ? SUPABASE_KEY.substring(0, 20) + '...' : 'MISSING');
console.log('=====================================');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('FAIL: Missing URL or key in .env');
  process.exit(1);
}

const testEmail = 'test@example.com';

fetch(`${SUPABASE_URL}/auth/v1/recover`, {
  method: 'POST',
  headers: {
    'apikey': SUPABASE_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ email: testEmail }),
})
  .then((response) => {
    console.log('Status code:', response.status);
    console.log('Status text:', response.statusText);
    console.log('OK:', response.ok);
    return response.text();
  })
  .then((body) => {
    console.log('Response body:', body);
    console.log('\n=== RESULT ===');
    console.log('If status is 200: Supabase API call succeeded');
    console.log('If no email arrives: SMTP/Resend configuration issue');
    console.log('If status is not 200: Supabase configuration issue');
    console.log('================');
    process.exit(0);
  })
  .catch((error) => {
    console.error('FAIL: Network error');
    console.error('Error:', error.message);
    console.log('\n=== RESULT: FAIL ===');
    console.log('Network/Supabase connectivity issue');
    console.log('====================');
    process.exit(1);
  });
