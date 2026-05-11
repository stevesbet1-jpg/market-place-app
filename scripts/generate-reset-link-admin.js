/**
 * FIREBASE ADMIN SDK — GENERATE DIRECT PASSWORD RESET LINK
 * ==========================================================
 * Fallback when the client-side sendPasswordResetEmail "succeeds"
 * but the email never arrives in Gmail.
 *
 * This script uses Firebase Admin SDK to generate a REAL reset link
 * that you can copy and send manually (or via a real email provider).
 *
 * RUN:
 *   node scripts/generate-reset-link-admin.js
 *
 * REQUIREMENTS:
 *   1. A Firebase service account JSON file.
 *      Generate it:
 *        Firebase Console → Project Settings → Service accounts
 *        → Generate new private key → save as serviceAccount.json
 *   2. Install firebase-admin:
 *        npm install -D firebase-admin
 *
 * OUTPUT:
 *   A full HTTPS password reset link like:
 *   https://marketplace-app-3b3f7.firebaseapp.com/__/auth/action?...
 *   Open this link in a browser on your phone, or copy it into the app's
 *   deep link handler to test the reset flow.
 */

require('dotenv').config({ path: './.env' });

const fs = require('fs');
const path = require('path');

const TEST_EMAIL = 'stevesbet1@gmail.com';
const PROJECT_ID = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
const CONTINUE_URL = 'https://marketplace-app-3b3f7.firebaseapp.com/reset-password.html';
const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'serviceAccount.json');

function printDivider(label, char = '═') {
  const width = 62;
  const pad = Math.max(0, width - label.length - 2);
  const left = Math.floor(pad / 2);
  const right = pad - left;
  console.log('');
  console.log('╔' + char.repeat(width) + '╗');
  console.log('║' + ' '.repeat(left) + label + ' '.repeat(right) + '║');
  console.log('╚' + char.repeat(width) + '╝');
  console.log('');
}

printDivider(' FIREBASE ADMIN SDK — GENERATE RESET LINK ');

console.log('Project ID from .env:     ', PROJECT_ID || 'MISSING');
console.log('Test email:               ', TEST_EMAIL);
console.log('Continue URL:             ', CONTINUE_URL);
console.log('Service account path:     ', SERVICE_ACCOUNT_PATH);
console.log('File exists:              ', fs.existsSync(SERVICE_ACCOUNT_PATH) ? '✅ YES' : '❌ NO');
console.log('');

// ─── Check prerequisites ───────────────────────────────────────────
if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  ❌ MISSING: serviceAccount.json                              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('You must create a Firebase service account:');
  console.log('  1. Open https://console.firebase.google.com');
  console.log('  2. Select your project: ' + (PROJECT_ID || '(unknown)'));
  console.log('  3. Click the gear (⚙️) → Project settings → Service accounts');
  console.log('  4. Click "Generate new private key"');
  console.log('  5. Save the downloaded JSON as: scripts/serviceAccount.json');
  console.log('');
  console.log('SECURITY: Keep serviceAccount.json secret. Never commit it.');
  console.log('  Add "scripts/serviceAccount.json" to .gitignore');
  console.log('');
  process.exit(1);
}

let admin;
try {
  admin = require('firebase-admin');
} catch {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  ❌ MISSING: firebase-admin package                           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('Install it:');
  console.log('  npm install -D firebase-admin');
  console.log('');
  process.exit(1);
}

// ─── Initialize Admin SDK ────────────────────────────────────────
const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

console.log('Firebase Admin SDK initialized.');
console.log('');

// ─── Generate password reset link ────────────────────────────────
const t0 = Date.now();

admin
  .auth()
  .generatePasswordResetLink(TEST_EMAIL, {
    url: CONTINUE_URL,
    handleCodeInApp: true,
    iOS: { bundleId: 'com.anonymous.Matketplace' },
    android: {
      packageName: 'com.anonymous.Matketplace',
      installApp: false,
      minimumVersion: '1',
    },
  })
  .then((link) => {
    const t1 = Date.now();

    printDivider(' ✅ RESET LINK GENERATED ');

    console.log(`Duration:     ${t1 - t0}ms`);
    console.log(`Email:        ${TEST_EMAIL}`);
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║  FULL RESET LINK (copy this):                                ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(link);
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║  HOW TO USE THIS LINK                                        ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('Option A — Test on your phone:');
    console.log('  1. Copy the link above');
    console.log('  2. Send it to yourself via WhatsApp / Telegram / Email');
    console.log('  3. Tap the link on your phone → it should open the app');
    console.log('');
    console.log('Option B — Test in browser:');
    console.log('  1. Open the link in a browser');
    console.log('  2. It will redirect to the Firebase Hosting page');
    console.log('  3. The page should redirect to the app with the oobCode');
    console.log('');
    console.log('Option C — Bypass the app (raw Firebase console):');
    console.log('  1. Open the link in a browser');
    console.log('  2. Look for "oobCode" in the URL');
    console.log('  3. You can verify the code manually in the Firebase Console');
    console.log('');
    console.log('Option D — Send via a real email provider (SendGrid, Resend, AWS SES):');
    console.log('  Use the link above as the CTA button in your own branded email.');
    console.log('  This bypasses Firebase\'s shared IP pool delivery entirely.');
    console.log('');
    process.exit(0);
  })
  .catch((error) => {
    const tFail = Date.now();

    printDivider(' ❌ FAILED TO GENERATE LINK ', '═');

    console.log(`Duration:     ${tFail - t0}ms`);
    console.log(`Error code:   ${error.code || 'UNKNOWN'}`);
    console.log(`Error:        ${error.message}`);
    console.log('');

    if (error.code === 'auth/user-not-found') {
      console.log('DIAGNOSIS: stevesbet1@gmail.com does NOT exist in Firebase Auth.');
      console.log('FIX: Create the user first in Firebase Console → Authentication → Users');
    } else if (error.code === 'auth/invalid-email') {
      console.log('DIAGNOSIS: Invalid email format.');
    } else if (error.message?.includes('invalid credential')) {
      console.log('DIAGNOSIS: Service account JSON is invalid or for a different project.');
      console.log('FIX: Download a fresh service account key from Firebase Console.');
    } else {
      console.log('DIAGNOSIS: Unknown Admin SDK error. See message above.');
    }

    console.log('');
    process.exit(1);
  });
