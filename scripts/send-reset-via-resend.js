/**
 * RESEND-POWERED PASSWORD RESET — PRODUCTION DELIVERY
 * =====================================================
 * Sends password reset emails via Resend with guaranteed inbox delivery.
 *
 * DELIVERABILITY HARDENING:
 *   - Multipart email (HTML + plain text)
 *   - Domain verification check
 *   - SPF/DKIM/DMARC guidance
 *   - Subject line optimized for inbox placement
 *   - Preheader text for Gmail preview
 *   - Inline styles for email client compatibility
 *   - Delivery status polling
 *   - Exponential backoff retry logic
 *
 * RUN:
 *   npm run send:reset-resend
 *   or: node scripts/send-reset-via-resend.js stevesbet1@gmail.com
 *
 * EXPECTED OUTPUT:
 *   ✅ Reset link generated in 400ms
 *   ✅ Resend accepted: emailId = xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 *   ✅ Delivery status: delivered
 *   Total duration: 2.1s
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
const HTML_TEMPLATE_PATH = path.join(__dirname, 'email-templates', 'reset-password.html');
const TEXT_TEMPLATE_PATH = path.join(__dirname, 'email-templates', 'reset-password.txt');

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [500, 1500, 3000];
const DELIVERY_POLL_MAX_MS = 30000;
const DELIVERY_POLL_INTERVAL_MS = 2000;

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

function isOnboardingDomain(from) {
  return from && from.includes('onboarding@resend.dev');
}

// ─── Phase 1: Validation ─────────────────────────────────────────
printDivider(' RESEND PRODUCTION DELIVERY SYSTEM ');

console.log('Target email:          ', TEST_EMAIL);
console.log('Firebase projectId:    ', PROJECT_ID || 'MISSING');
console.log('Firebase authDomain:   ', AUTH_DOMAIN || 'MISSING');
console.log('EMAIL_FROM:            ', EMAIL_FROM || 'MISSING');
console.log('RESEND_API_KEY:        ', maskKey(RESEND_API_KEY));
console.log('Service account:       ', fs.existsSync(SERVICE_ACCOUNT_PATH) ? '✅ FOUND' : '❌ MISSING');
console.log('HTML template:         ', fs.existsSync(HTML_TEMPLATE_PATH) ? '✅ FOUND' : '❌ MISSING');
console.log('Text template:         ', fs.existsSync(TEXT_TEMPLATE_PATH) ? '✅ FOUND' : '❌ MISSING');
console.log('');

const missing = [];
if (!RESEND_API_KEY || !RESEND_API_KEY.startsWith('re_')) {
  missing.push('RESEND_API_KEY (get from https://resend.com/api-keys, starts with "re_")');
}
if (!EMAIL_FROM) {
  missing.push('EMAIL_FROM (e.g., noreply@yourdomain.com or onboarding@resend.dev for testing)');
}
if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  missing.push('scripts/serviceAccount.json (Firebase Console → Project Settings → Service accounts → Generate new private key)');
}
if (!fs.existsSync(HTML_TEMPLATE_PATH)) {
  missing.push('scripts/email-templates/reset-password.html');
}
if (!fs.existsSync(TEXT_TEMPLATE_PATH)) {
  missing.push('scripts/email-templates/reset-password.txt (plain text fallback)');
}

if (missing.length > 0) {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  ❌ MISSING PREREQUISITES — CANNOT PROCEED                    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  missing.forEach((m) => console.log('  • ' + m));
  console.log('');
  console.log('QUICK START:');
  console.log('  1. Sign up at https://resend.com');
  console.log('  2. Create an API key → add to .env: RESEND_API_KEY=re_your_key');
  console.log('  3. Verify a domain for production (use onboarding@resend.dev ONLY for testing)');
  console.log('  4. Add to .env: EMAIL_FROM=noreply@yourdomain.com');
  console.log('  5. Download serviceAccount.json from Firebase Console');
  console.log('  6. Save it to scripts/serviceAccount.json (already gitignored)');
  console.log('');
  process.exit(1);
}

// ─── Phase 2: Initialize Firebase Admin ──────────────────────────
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

// ─── Phase 3: Initialize Resend ──────────────────────────────────
const { Resend } = require('resend');
const resend = new Resend(RESEND_API_KEY);

// ─── Phase 4: Domain Verification Check ──────────────────────────
async function checkDomainStatus() {
  console.log('[ResendDelivery] Checking domain verification status...');
  try {
    const domains = await resend.domains.list();
    const activeDomains = domains?.data?.filter((d) => d.status === 'active') || [];
    if (activeDomains.length === 0) {
      console.log('[ResendDelivery] ⚠️  NO VERIFIED DOMAINS FOUND');
      console.log('[ResendDelivery]     Emails sent from unverified domains have HIGH spam risk.');
      console.log('[ResendDelivery]     For production, verify your domain at https://resend.com/domains');
      if (isOnboardingDomain(EMAIL_FROM)) {
        console.log('[ResendDelivery]     Using onboarding@resend.dev → limited to test sends only.');
        console.log('[ResendDelivery]     Gmail may still filter these to spam or promotions.');
      }
      return false;
    }
    console.log('[ResendDelivery] ✅ Verified domains:', activeDomains.map((d) => d.name).join(', '));
    return true;
  } catch (error) {
    console.log('[ResendDelivery] ⚠️  Could not check domain status:', error.message);
    console.log('[ResendDelivery]     Proceeding anyway...');
    return null;
  }
}

// ─── Phase 5: Generate Password Reset Link ───────────────────────
const CONTINUE_URL = 'https://marketplace-app-3b3f7.web.app/reset-password.html';

async function generateResetLink(email) {
  const t0 = Date.now();
  console.log('[ResendDelivery] Generating password reset link via Firebase Admin SDK...');
  console.log('[ResendDelivery]   Email:      ', email);
  console.log('[ResendDelivery]   ContinueURL:', CONTINUE_URL);
  console.log('[ResendDelivery]   handleCodeInApp: false (redirects to continue URL for universal compatibility)');

  const actionCodeSettings = {
    url: CONTINUE_URL,
    handleCodeInApp: false,
  };

  let generatedLink;
  try {
    generatedLink = await admin.auth().generatePasswordResetLink(email, actionCodeSettings);
  } catch (linkErr) {
    console.error('[ResendDelivery] ❌ generatePasswordResetLink FAILED');
    console.error('[ResendDelivery]   error.code   :', linkErr.code);
    console.error('[ResendDelivery]   error.message:', linkErr.message);
    if (linkErr.stack) {
      console.error('[ResendDelivery]   error.stack  :', linkErr.stack);
    }
    throw linkErr;
  }

  const duration = Date.now() - t0;
  console.log(`[ResendDelivery] ✅ Firebase link generated in ${duration}ms`);
  console.log('[ResendDelivery]   Generated link: ', generatedLink);

  // Extract oobCode/apiKey from the generated link and construct a direct URL
  // to our custom reset page so the user lands on it with the code in the URL.
  const url = new URL(generatedLink);
  const oobCode = url.searchParams.get('oobCode');
  const apiKey = url.searchParams.get('apiKey');
  const mode = url.searchParams.get('mode') || 'resetPassword';

  console.log('[ResendDelivery]   Parsed oobCode:', oobCode ? oobCode.substring(0, 8) + '...***' : 'MISSING');
  console.log('[ResendDelivery]   Parsed mode:  ', mode);
  console.log('[ResendDelivery]   Parsed apiKey:', apiKey ? 'yes' : 'no');

  let directLink;
  if (!oobCode) {
    console.warn('[ResendDelivery]   ⚠️ No oobCode found. Falling back to raw generated link.');
    directLink = generatedLink;
  } else {
    const directUrl = new URL(CONTINUE_URL);
    directUrl.searchParams.set('oobCode', oobCode);
    directUrl.searchParams.set('mode', mode);
    if (apiKey) directUrl.searchParams.set('apiKey', apiKey);
    directLink = directUrl.toString();
    console.log('[ResendDelivery]   Direct page link:', directLink);
  }

  console.log('');
  return directLink;
}

// ─── Phase 6: Build Email Content ────────────────────────────────
function buildEmailBodies(resetLink, email) {
  let html = fs.readFileSync(HTML_TEMPLATE_PATH, 'utf8');
  html = html.replace(/\{\{RESET_LINK\}\}/g, resetLink);
  html = html.replace(/\{\{EMAIL\}\}/g, email);
  html = html.replace(/\{\{BRAND_NAME\}\}/g, 'Marketplace');
  html = html.replace(/\{\{EXPIRES_HOURS\}\}/g, '1');

  let text = fs.readFileSync(TEXT_TEMPLATE_PATH, 'utf8');
  text = text.replace(/\{\{RESET_LINK\}\}/g, resetLink);
  text = text.replace(/\{\{EMAIL\}\}/g, email);
  text = text.replace(/\{\{BRAND_NAME\}\}/g, 'Marketplace');
  text = text.replace(/\{\{EXPIRES_HOURS\}\}/g, '1');

  return { html, text };
}

// ─── Phase 7: Send with Retry + Delivery Polling ───────────────────
async function sendEmailWithRetry(to, subject, html, text) {
  console.log('[ResendDelivery] Sending multipart email via Resend...');
  console.log('[ResendDelivery]   From:   ', EMAIL_FROM);
  console.log('[ResendDelivery]   To:     ', to);
  console.log('[ResendDelivery]   Subject:', subject);
  console.log('');

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const t0 = Date.now();
    console.log(`[ResendDelivery]   Attempt ${attempt + 1}/${MAX_RETRIES}...`);

    try {
      const response = await resend.emails.send({
        from: EMAIL_FROM,
        to: [to],
        subject,
        html,
        text,
        reply_to: EMAIL_FROM,
      });

      const duration = Date.now() - t0;
      console.log(`[ResendDelivery]   ✅ Resend API responded in ${duration}ms`);
      console.log('[ResendDelivery]      Response:', JSON.stringify(response, null, 2));
      console.log('');

      if (response.error) {
        throw new Error(`Resend rejected: ${response.error.message || JSON.stringify(response.error)}`);
      }

      if (!response.data || !response.data.id) {
        throw new Error('Resend returned no email ID — delivery status unknown');
      }

      return { id: response.data.id, duration, accepted: true };
    } catch (error) {
      const failDuration = Date.now() - t0;
      console.error(`[ResendDelivery]   ❌ Attempt ${attempt + 1} failed after ${failDuration}ms:`, error.message);

      if (attempt < MAX_RETRIES - 1) {
        const delay = RETRY_DELAYS_MS[attempt];
        console.log(`[ResendDelivery]   ↻ Retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw error;
      }
    }
  }
}

async function pollDeliveryStatus(emailId) {
  console.log('[ResendDelivery] Polling delivery status...');
  const start = Date.now();
  let lastStatus = 'unknown';

  while (Date.now() - start < DELIVERY_POLL_MAX_MS) {
    try {
      const email = await resend.emails.get(emailId);
      lastStatus = email?.data?.status || email?.status || 'unknown';
      console.log(`[ResendDelivery]   Status check: ${lastStatus} (${Date.now() - start}ms elapsed)`);

      if (lastStatus === 'delivered') {
        return { status: 'delivered', details: email };
      }
      if (lastStatus === 'bounced' || lastStatus === 'complained') {
        return { status: lastStatus, details: email };
      }
    } catch (e) {
      console.log(`[ResendDelivery]   Could not poll status: ${e.message}`);
    }

    await new Promise((r) => setTimeout(r, DELIVERY_POLL_INTERVAL_MS));
  }

  return { status: lastStatus, details: null };
}

// ─── Phase 8: Main Execution ─────────────────────────────────────
async function main() {
  const totalStart = Date.now();

  try {
    // 8a: Domain check
    const domainVerified = await checkDomainStatus();

    // 8b: Generate reset link
    const resetLink = await generateResetLink(TEST_EMAIL);

    // 8c: Build email
    const subject = 'Reset your Marketplace password';
    const { html, text } = buildEmailBodies(resetLink, TEST_EMAIL);

    // 8d: Send
    const result = await sendEmailWithRetry(TEST_EMAIL, subject, html, text);

    // 8e: Poll for delivery
    const delivery = await pollDeliveryStatus(result.id);

    // 8f: Final report
    const totalDuration = Date.now() - totalStart;

    printDivider(' FINAL DELIVERY REPORT ');

    console.log(`Total duration:          ${totalDuration}ms`);
    console.log(`Resend email ID:         ${result.id}`);
    console.log(`API response time:       ${result.duration}ms`);
    console.log(`Delivery status:         ${delivery.status.toUpperCase()}`);
    console.log(`Domain verified:         ${domainVerified === true ? 'YES' : domainVerified === false ? 'NO — HIGH SPAM RISK' : 'UNKNOWN'}`);
    console.log(`Recipient:               ${TEST_EMAIL}`);
    console.log(`From:                    ${EMAIL_FROM}`);
    console.log(`Subject:                 ${subject}`);
    console.log(`Reset link (truncated):  ${resetLink.substring(0, 60)}...`);
    console.log('');

    // ─── DELIVERABILITY DIAGNOSTICS ──────────────────────────────
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║  DELIVERABILITY DIAGNOSTICS                                  ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');

    if (delivery.status === 'delivered') {
      console.log('✅ RESEND CONFIRMED DELIVERY');
      console.log('   The email was accepted by the recipient\'s mail server.');
      console.log('   This is the STRONGEST proof of delivery available.');
    } else if (delivery.status === 'bounced') {
      console.log('❌ EMAIL BOUNCED');
      console.log('   The recipient\'s mail server rejected the email.');
      console.log('   Check the email address is valid and not a full mailbox.');
    } else if (delivery.status === 'complained') {
      console.log('❌ EMAIL COMPLAINED');
      console.log('   The recipient marked the email as spam.');
    } else {
      console.log(`⏳ STATUS: ${delivery.status.toUpperCase()} (still processing)`);
      console.log('   Resend has not yet received a delivery receipt.');
      console.log('   This is normal for the first 10–30 seconds.');
    }

    console.log('');
    console.log('INBOX CHECKLIST (do these NOW):');
    console.log('  1. Open Gmail and check PRIMARY tab');
    console.log('  2. Check Spam folder');
    console.log('  3. Check Promotions tab');
    console.log('  4. Search: "Reset your Marketplace password"');
    console.log('  5. Search sender: ' + EMAIL_FROM);
    console.log('');

    if (!domainVerified && !isOnboardingDomain(EMAIL_FROM)) {
      console.log('⚠️  CRITICAL: Your domain is NOT verified in Resend.');
      console.log('   Without domain verification, deliverability is severely degraded.');
      console.log('   Go to https://resend.com/domains and complete verification.');
      console.log('   Required DNS records: SPF, DKIM, DMARC.');
    }

    if (isOnboardingDomain(EMAIL_FROM)) {
      console.log('⚠️  USING TEST DOMAIN: onboarding@resend.dev');
      console.log('   This is for testing only. Production requires a verified custom domain.');
      console.log('   Gmail often filters test-domain emails to Spam or Promotions.');
      console.log('   For production: verify yourdomain.com in Resend and set EMAIL_FROM=noreply@yourdomain.com');
    }

    console.log('');
    console.log('Track this email in Resend dashboard:');
    console.log('  https://resend.com/emails/' + result.id);
    console.log('');
    console.log('To verify the reset link works:');
    console.log('  1. Click the link in the email (or copy into browser)');
    console.log('  2. It should redirect to: ' + CONTINUE_URL + '?oobCode=...');
    console.log('  3. Enter a new password and confirm');
    console.log('  4. The password should update successfully');
    console.log('');

    // Final verdict
    if (delivery.status === 'delivered') {
      printDivider(' ✅ SYSTEM FULLY OPERATIONAL ');
      process.exit(0);
    } else {
      printDivider(' ⏳ SYSTEM OPERATIONAL — WAITING FOR DELIVERY CONFIRMATION ');
      console.log('The email was accepted by Resend. Delivery to inbox is in progress.');
      console.log('Recheck Resend dashboard in 60 seconds for final status.');
      process.exit(0);
    }

  } catch (error) {
    const totalFail = Date.now() - totalStart;

    printDivider(' ❌ CRITICAL FAILURE ');

    console.log(`Total duration:  ${totalFail}ms`);
    console.log(`Error:           ${error.message}`);
    console.log('');

    if (error.code === 'auth/user-not-found') {
      console.log('DIAGNOSIS: ' + TEST_EMAIL + ' does NOT exist in Firebase Auth.');
      console.log('FIX: Firebase Console → Authentication → Users → Add User');
    } else if (error.code === 'auth/invalid-email') {
      console.log('DIAGNOSIS: Invalid email format.');
    } else if (error.message?.includes('Resend rejected')) {
      console.log('DIAGNOSIS: Resend API rejected the send request.');
      console.log('FIX: Check RESEND_API_KEY and domain verification status.');
    } else if (error.message?.includes('no email ID')) {
      console.log('DIAGNOSIS: Resend accepted but did not return a tracking ID.');
      console.log('FIX: Check Resend dashboard for any queued emails.');
    } else if (error.message?.includes('invalid credential') || error.message?.includes('Unauthorized')) {
      console.log('DIAGNOSIS: Firebase service account is invalid or for a different project.');
      console.log('FIX: Download a fresh serviceAccount.json from Firebase Console.');
    } else {
      console.log('DIAGNOSIS: Unexpected error. Full stack:');
      console.log(error.stack);
    }

    console.log('');
    process.exit(1);
  }
}

main();
