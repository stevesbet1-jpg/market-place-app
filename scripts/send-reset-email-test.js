/**
 * FIREBASE PASSWORD RESET — TERMINAL DELIVERY TEST
 * =================================================
 * This script calls the SAME Firebase Identity Toolkit REST API that the app uses.
 * It sends a password reset email for the provided address and logs everything.
 *
 * RUN:
 *   node scripts/send-reset-email-test.js user@example.com
 *
 * REQUIREMENTS:
 *   - .env file with EXPO_PUBLIC_FIREBASE_API_KEY set
 *   - Node.js 18+ (built-in fetch)
 */

require('dotenv').config({ path: './.env' });

const API_KEY = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
const AUTH_DOMAIN = process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN;
const PROJECT_ID = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
const TEST_EMAIL = process.argv[2];
if (!TEST_EMAIL) {
  console.error('Usage: node scripts/send-reset-email-test.js <email>');
  process.exit(1);
}

const CONTINUE_URL = 'https://marketplace-app-3b3f7.firebaseapp.com/reset-password.html';

function maskKey(key) {
  if (!key || key.length < 12) return '***INVALID***';
  return key.substring(0, 8) + '...***';
}

function printDivider(label) {
  const width = 62;
  const pad = Math.max(0, width - label.length - 2);
  const left = Math.floor(pad / 2);
  const right = pad - left;
  console.log('');
  console.log('╔' + '═'.repeat(width) + '╗');
  console.log('║' + ' '.repeat(left) + label + ' '.repeat(right) + '║');
  console.log('╚' + '═'.repeat(width) + '╝');
  console.log('');
}

printDivider(' FIREBASE PASSWORD RESET — TERMINAL DELIVERY TEST ');

console.log('Firebase projectId:   ', PROJECT_ID || 'MISSING');
console.log('Firebase authDomain:  ', AUTH_DOMAIN || 'MISSING');
console.log('Firebase apiKey:      ', maskKey(API_KEY));
console.log('Test email:           ', TEST_EMAIL);
console.log('Continue URL:         ', CONTINUE_URL);
console.log('');

// ─── Validation ──────────────────────────────────────────────────
if (!API_KEY || API_KEY.includes('YOUR_')) {
  console.error('❌ FAIL: EXPO_PUBLIC_FIREBASE_API_KEY is missing or still a placeholder in .env');
  console.error('   Fix: copy the real API key from Firebase Console → Project Settings → General → Web');
  process.exit(1);
}

if (!PROJECT_ID || PROJECT_ID.includes('YOUR_')) {
  console.error('❌ FAIL: EXPO_PUBLIC_FIREBASE_PROJECT_ID is missing or still a placeholder');
  process.exit(1);
}

// ─── FIREBASE CONSOLE AUTO-CHECKLIST ─────────────────────────────
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║  FIREBASE CONSOLE VERIFICATION CHECKLIST (manual)            ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('');
console.log('☐ 1. Firebase Console → Build → Authentication → Sign-in method');
console.log('      → Email/Password provider is ENABLED');
console.log('');
console.log('☐ 2. Firebase Console → Build → Authentication → Users');
console.log('      → ' + TEST_EMAIL + ' EXISTS in the list');
console.log('      → If NOT listed, the email will be SILENTLY dropped');
console.log('');
console.log('☐ 3. Firebase Console → Build → Authentication → Templates');
console.log('      → Password reset template is ENABLED');
console.log('      → Subject does NOT contain spam triggers (FREE, URGENT, !!!)');
console.log('');
console.log('☐ 4. Firebase Console → Build → Authentication → Settings → Authorized domains');
console.log('      → marketplace-app-3b3f7.firebaseapp.com is listed');
console.log('      → marketplace-app-3b3f7.web.app is listed');
console.log('      → localhost is listed (for dev testing)');
console.log('');
console.log('☐ 5. Gmail deliverability');
console.log('      → Search Inbox, Spam, and Promotions for "Firebase" or "reset password"');
console.log('      → Whitelist noreply@marketplace-app-3b3f7.firebaseapp.com');
console.log('      → Try with a different Gmail / Outlook address');
console.log('');
console.log('☐ 6. If Console settings are correct but email never arrives,');
console.log('      run:  node scripts/generate-reset-link-admin.js');
console.log('      (requires Firebase Admin SDK service account)');
console.log('');

// ─── SEND VIA FIREBASE IDENTITY TOOLKIT REST API ─────────────────
// This is the EXACT same endpoint the Firebase JS SDK calls internally.

const endpoint = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${API_KEY}`;

const payload = {
  requestType: 'PASSWORD_RESET',
  email: TEST_EMAIL,
  continueUrl: CONTINUE_URL,
  // iOS and Android settings are SDK-only; REST API uses the project config
};

console.log('Calling Firebase Identity Toolkit REST API...');
console.log('Endpoint:', endpoint.replace(API_KEY, maskKey(API_KEY)));
console.log('Payload:', JSON.stringify(payload, null, 2));
console.log('');

const t0 = Date.now();

fetch(endpoint, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
})
  .then(async (response) => {
    const t1 = Date.now();
    const duration = t1 - t0;
    const bodyText = await response.text();

    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║  FIREBASE REST API RESPONSE                                  ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`HTTP Status:        ${response.status} ${response.statusText}`);
    console.log(`Request duration:     ${duration}ms`);
    console.log(`Response body:        ${bodyText || '(empty body)'}`);
    console.log('');

    if (response.ok) {
      console.log('╔══════════════════════════════════════════════════════════════╗');
      console.log('║  ✅ FIREBASE ACCEPTED THE REQUEST                            ║');
      console.log('╚══════════════════════════════════════════════════════════════╝');
      console.log('');
      console.log('Firebase returned HTTP 200. This means:');
      console.log('  • The API key is valid');
      console.log('  • The request format is correct');
      console.log('  • Firebase will attempt to send the email IF the user exists');
      console.log('');
      console.log('⚠️  BUT: Firebase does NOT confirm email delivery.');
      console.log('   If the user does NOT exist → email is silently dropped.');
      console.log('   If the user DOES exist → email is queued for delivery.');
      console.log('');
      console.log('NEXT STEPS:');
      console.log('  1. Check your Gmail Inbox, Spam, and Promotions NOW.');
      console.log('  2. Wait 1–60 seconds (Firebase shared IP pool delivery time).');
      console.log('  3. If no email arrives after 2 minutes:');
      console.log('     a. Verify ' + TEST_EMAIL + ' exists in Firebase Console → Users');
      console.log('     b. Check spam filters / corporate firewalls');
      console.log('     c. Run: node scripts/generate-reset-link-admin.js');
      console.log('        (generates a direct reset link you can send manually)');
      console.log('');
      process.exit(0);
    } else {
      console.log('╔══════════════════════════════════════════════════════════════╗');
      console.log('║  ❌ FIREBASE REJECTED THE REQUEST                            ║');
      console.log('╚══════════════════════════════════════════════════════════════╝');
      console.log('');

      let errorBody;
      try { errorBody = JSON.parse(bodyText); } catch { errorBody = { error: { message: bodyText } }; }
      const code = errorBody?.error?.code || 'UNKNOWN';
      const message = errorBody?.error?.message || bodyText;

      console.log(`Error code:    ${code}`);
      console.log(`Error message: ${message}`);
      console.log('');

      if (code === 400 && message.includes('API key not valid')) {
        console.log('DIAGNOSIS: Your API key is invalid or expired.');
        console.log('FIX: Copy a fresh API key from Firebase Console → Project Settings → General → Web');
      } else if (code === 400 && message.includes('INVALID_CONTINUE_URI')) {
        console.log('DIAGNOSIS: Continue URL domain is NOT authorized.');
        console.log('FIX: Add ' + CONTINUE_URL + ' to Firebase Console → Auth → Settings → Authorized domains');
      } else if (code === 400 && message.includes('EMAIL_NOT_FOUND')) {
        console.log('DIAGNOSIS: Email does not exist in Firebase Auth.');
        console.log('FIX: Create the user in Firebase Console → Authentication → Users');
      } else if (code === 403) {
        console.log('DIAGNOSIS: API key restrictions or project disabled.');
        console.log('FIX: Check Firebase Console → Project Settings → API key restrictions');
      } else {
        console.log('DIAGNOSIS: Unknown Firebase error. Check the error message above.');
      }

      console.log('');
      process.exit(1);
    }
  })
  .catch((error) => {
    const tFail = Date.now();
    console.error('');
    console.error('╔══════════════════════════════════════════════════════════════╗');
    console.error('║  ❌ NETWORK ERROR — COULD NOT REACH FIREBASE                  ║');
    console.error('╚══════════════════════════════════════════════════════════════╝');
    console.error('');
    console.error(`Error: ${error.message}`);
    console.error(`Time:  ${tFail - t0}ms`);
    console.error('');
    console.error('DIAGNOSIS: Device has no internet, or Firebase is unreachable.');
    console.error('FIX: Check WiFi/cellular. Try again in a few minutes.');
    console.error('');
    process.exit(1);
  });
