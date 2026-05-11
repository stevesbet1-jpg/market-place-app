/**
 * RESEND-POWERED PASSWORD RESET DELIVERY
 * ======================================
 * Replaces Firebase's default shared-IP email delivery with Resend's
 * dedicated infrastructure for guaranteed fast inbox delivery.
 *
 * FLOW:
 *   1. Firebase Admin SDK generates a real password reset link
 *   2. Resend sends a branded HTML email with the link
 *   3. Full delivery tracking and retry logic
 *
 * RUN:
 *   npm run send:reset-resend
 *   or: node scripts/send-reset-via-resend.js stevesbet1@gmail.com
 *
 * PREREQUISITES:
 *   1. RESEND_API_KEY in .env
 *      - Sign up at https://resend.com
 *      - Create an API key
 *      - Add to .env: RESEND_API_KEY=re_xxxxxxxxxxxx
 *   2. EMAIL_FROM in .env
 *      - Verify a domain in Resend (or use onboarding@resend.dev for testing)
 *      - Add to .env: EMAIL_FROM=noreply@yourdomain.com
 *   3. scripts/serviceAccount.json (Firebase Admin credentials)
 *      - Firebase Console → Project Settings → Service accounts → Generate new private key
 *
 * EXPECTED OUTPUT:
 *   ✅ Reset link generated: https://marketplace-app-3b3f7.firebaseapp.com/__/auth/action?...
 *   ✅ Resend accepted: emailId = xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 *   ✅ Delivery status: sent
 *   Total duration: 1.2s
 */

require('dotenv').config({ path: './.env' });

const fs = require('fs');
const path = require('path');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM;
const PROJECT_ID = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
const AUTH_DOMAIN = process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN;

const TEST_EMAIL = process.argv[2] || 'stevesbet1@gmail.com';
const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'serviceAccount.json');
const TEMPLATE_PATH = path.join(__dirname, 'email-templates', 'reset-password.html');

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [500, 1500, 3000];

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

function maskKey(key) {
  if (!key || key.length < 12) return '***INVALID***';
  return key.substring(0, 8) + '...***';
}

// ─── Validation ────────────────────────────────────────────────────
printDivider(' RESEND-POWERED PASSWORD RESET DELIVERY ');

console.log('Target email:          ', TEST_EMAIL);
console.log('Firebase projectId:    ', PROJECT_ID || 'MISSING');
console.log('Firebase authDomain:   ', AUTH_DOMAIN || 'MISSING');
console.log('EMAIL_FROM:            ', EMAIL_FROM || 'MISSING');
console.log('RESEND_API_KEY:        ', maskKey(RESEND_API_KEY));
console.log('Service account:       ', fs.existsSync(SERVICE_ACCOUNT_PATH) ? '✅ FOUND' : '❌ MISSING');
console.log('HTML template:         ', fs.existsSync(TEMPLATE_PATH) ? '✅ FOUND' : '❌ MISSING');
console.log('');

const missing = [];
if (!RESEND_API_KEY || !RESEND_API_KEY.startsWith('re_')) {
  missing.push('RESEND_API_KEY (get from https://resend.com/api-keys)');
}
if (!EMAIL_FROM) {
  missing.push('EMAIL_FROM (e.g., noreply@yourdomain.com or onboarding@resend.dev)');
}
if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  missing.push('scripts/serviceAccount.json (Firebase Console → Project Settings → Service accounts)');
}
if (!fs.existsSync(TEMPLATE_PATH)) {
  missing.push('scripts/email-templates/reset-password.html');
}

if (missing.length > 0) {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  ❌ MISSING PREREQUISITES                                     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  missing.forEach((m) => console.log('  • ' + m));
  console.log('');
  console.log('QUICK START:');
  console.log('  1. Sign up at https://resend.com');
  console.log('  2. Create an API key → add to .env: RESEND_API_KEY=re_your_key');
  console.log('  3. Verify a domain (or use onboarding@resend.dev for testing)');
  console.log('  4. Add to .env: EMAIL_FROM=onboarding@resend.dev');
  console.log('  5. Download serviceAccount.json from Firebase Console');
  console.log('  6. Save it to scripts/serviceAccount.json');
  console.log('');
  process.exit(1);
}

// ─── Initialize Firebase Admin ───────────────────────────────────
let admin;
try {
  admin = require('firebase-admin');
} catch {
  console.error('❌ firebase-admin is not installed. Run: npm install -D firebase-admin');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

// ─── Initialize Resend ───────────────────────────────────────────
const { Resend } = require('resend');
const resend = new Resend(RESEND_API_KEY);

// ─── Generate Password Reset Link ─────────────────────────────────
const CONTINUE_URL = 'https://marketplace-app-3b3f7.firebaseapp.com/reset-password.html';

async function generateResetLink(email) {
  const t0 = Date.now();
  console.log('[ResendDelivery] Generating password reset link via Firebase Admin SDK...');
  console.log('[ResendDelivery] Email:', email);

  const link = await admin.auth().generatePasswordResetLink(email, {
    url: CONTINUE_URL,
    handleCodeInApp: true,
    iOS: { bundleId: 'com.anonymous.Matketplace' },
    android: {
      packageName: 'com.anonymous.Matketplace',
      installApp: false,
      minimumVersion: '1',
    },
  });

  const duration = Date.now() - t0;
  console.log(`[ResendDelivery] ✅ Link generated in ${duration}ms`);
  console.log('[ResendDelivery] Link:', link);
  console.log('');
  return link;
}

// ─── Load and populate email template ──────────────────────────────
function buildEmailBody(resetLink, email) {
  let template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  template = template.replace(/\{\{RESET_LINK\}\}/g, resetLink);
  template = template.replace(/\{\{EMAIL\}\}/g, email);
  template = template.replace(/\{\{BRAND_NAME\}\}/g, 'Marketplace');
  template = template.replace(/\{\{EXPIRES_HOURS\}\}/g, '1');
  return template;
}

// ─── Send email via Resend with retry logic ──────────────────────
async function sendEmailWithRetry(to, subject, html) {
  console.log('[ResendDelivery] Sending email via Resend...');
  console.log('[ResendDelivery] From:', EMAIL_FROM);
  console.log('[ResendDelivery] To:', to);
  console.log('[ResendDelivery] Subject:', subject);
  console.log('');

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const t0 = Date.now();
    console.log(`[ResendDelivery] Attempt ${attempt + 1}/${MAX_RETRIES}...`);

    try {
      const response = await resend.emails.send({
        from: EMAIL_FROM,
        to: [to],
        subject,
        html,
      });

      const duration = Date.now() - t0;
      console.log(`[ResendDelivery] ✅ Resend responded in ${duration}ms`);
      console.log('[ResendDelivery] Resend data:', JSON.stringify(response.data, null, 2));
      console.log('[ResendDelivery] Resend error:', response.error || 'none');
      console.log('');

      if (response.error) {
        throw new Error(`Resend error: ${response.error.message || JSON.stringify(response.error)}`);
      }

      if (!response.data || !response.data.id) {
        throw new Error('Resend returned success but no email ID');
      }

      return {
        id: response.data.id,
        duration,
        accepted: true,
      };
    } catch (error) {
      const failDuration = Date.now() - t0;
      console.error(`[ResendDelivery] ❌ Attempt ${attempt + 1} failed after ${failDuration}ms:`, error.message);

      if (attempt < MAX_RETRIES - 1) {
        const delay = RETRY_DELAYS_MS[attempt];
        console.log(`[ResendDelivery] ↻ Retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw error;
      }
    }
  }
}

// ─── Main execution ──────────────────────────────────────────────
async function main() {
  const totalStart = Date.now();

  try {
    // Step 1: Generate reset link
    const resetLink = await generateResetLink(TEST_EMAIL);

    // Step 2: Build email
    const subject = 'Reset Your Marketplace Password';
    const html = buildEmailBody(resetLink, TEST_EMAIL);

    // Step 3: Send via Resend
    const result = await sendEmailWithRetry(TEST_EMAIL, subject, html);

    // Step 4: Final report
    const totalDuration = Date.now() - totalStart;

    printDivider(' ✅ RESEND DELIVERY COMPLETE ');

    console.log(`Total duration:        ${totalDuration}ms`);
    console.log(`Resend email ID:       ${result.id}`);
    console.log(`Delivery accepted:     YES (Resend confirmed)`);
    console.log(`Recipient:             ${TEST_EMAIL}`);
    console.log(`From:                  ${EMAIL_FROM}`);
    console.log(`Subject:               ${subject}`);
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║  INBOX DIAGNOSTICS                                           ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('Expected delivery time: 1–10 seconds (Resend dedicated IP)');
    console.log('');
    console.log('Check your Gmail Inbox NOW. If not visible:');
    console.log('  1. Check Spam / Promotions folders');
    console.log('  2. Search for "Reset Your Marketplace Password"');
    console.log('  3. Whitelist ' + EMAIL_FROM + ' in Gmail contacts');
    console.log('');
    console.log('Track this email in Resend dashboard:');
    console.log('  https://resend.com/emails/' + result.id);
    console.log('');
    console.log('If email is still missing after 30 seconds:');
    console.log('  • Verify your Resend domain is verified (not in "unverified" state)');
    console.log('  • Check Resend dashboard for bounce/block events');
    console.log('  • Try onboarding@resend.dev as EMAIL_FROM for testing');
    console.log('');
    process.exit(0);

  } catch (error) {
    const totalFail = Date.now() - totalStart;

    printDivider(' ❌ RESEND DELIVERY FAILED ');

    console.log(`Total duration:  ${totalFail}ms`);
    console.log(`Error:           ${error.message}`);
    console.log('');

    if (error.message?.includes('user-not-found')) {
      console.log('DIAGNOSIS: ' + TEST_EMAIL + ' does NOT exist in Firebase Auth.');
      console.log('FIX: Create the user in Firebase Console → Authentication → Users');
    } else if (error.message?.includes('Resend error')) {
      console.log('DIAGNOSIS: Resend rejected the request.');
      console.log('FIX: Check RESEND_API_KEY validity and domain verification status.');
    } else if (error.message?.includes('timeout')) {
      console.log('DIAGNOSIS: Network timeout.');
      console.log('FIX: Check internet connection.');
    } else {
      console.log('DIAGNOSIS: Unknown error. See full message above.');
    }

    console.log('');
    process.exit(1);
  }
}

main();
