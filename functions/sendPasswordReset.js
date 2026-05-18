/**
 * FIREBASE CLOUD FUNCTION — RESEND PASSWORD RESET
 * =================================================
 * This is a production-grade Cloud Function that intercepts Firebase Auth
 * password reset events and sends the email via Resend instead of Firebase's
 * default shared-IP delivery.
 *
 * DEPLOY:
 *   1. npm install -g firebase-tools
 *   2. firebase login
 *   3. firebase init functions
 *   4. Copy this file to functions/src/index.js (or .ts)
 *   5. Add to functions/.env:
 *        RESEND_API_KEY=re_your_key
 *        EMAIL_FROM=noreply@yourdomain.com
 *   6. firebase deploy --only functions
 *
 * HOW IT WORKS:
 *   Firebase triggers this function on password reset request.
 *   The function generates a reset link via Admin SDK, then sends it via Resend.
 *
 * NOTE: This requires a Firebase Blaze (pay-as-you-go) plan for Cloud Functions.
 */

const { Resend } = require('resend');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Admin SDK (auto-detects project from environment in Cloud Functions)
admin.initializeApp();

const resend = new Resend(process.env.RESEND_API_KEY);
const EMAIL_FROM = process.env.EMAIL_FROM;
const CONTINUE_URL = 'https://marketplace-app-3b3f7.web.app/reset-password.html';

// Load email template
const TEMPLATE_PATH = path.join(__dirname, '../scripts/email-templates', 'reset-password.html');

function buildEmailBody(resetLink, email) {
  let template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  template = template.replace(/\{\{RESET_LINK\}\}/g, resetLink);
  template = template.replace(/\{\{EMAIL\}\}/g, email);
  template = template.replace(/\{\{BRAND_NAME\}\}/g, 'Marketplace');
  template = template.replace(/\{\{EXPIRES_HOURS\}\}/g, '1');
  return template;
}

exports.sendPasswordResetEmail = async (event) => {
  const { email } = event.data;
  const requestId = event.id || 'unknown';
  const t0 = Date.now();

  console.log(`[CloudFunction] Password reset requested for: ${email}`);
  console.log(`[CloudFunction] Event ID: ${requestId}`);

  try {
    // Generate reset link
    const resetLink = await admin.auth().generatePasswordResetLink(email, {
      url: CONTINUE_URL,
      handleCodeInApp: true,
      iOS: { bundleId: 'com.anonymous.Matketplace' },
      android: {
        packageName: 'com.anonymous.Matketplace',
        installApp: false,
        minimumVersion: '1',
      },
    });

    const linkGenDuration = Date.now() - t0;
    console.log(`[CloudFunction] Link generated in ${linkGenDuration}ms`);

    // Build and send email
    const html = buildEmailBody(resetLink, email);
    const subject = 'Reset Your Marketplace Password';

    const resendResponse = await resend.emails.send({
      from: EMAIL_FROM,
      to: [email],
      subject,
      html,
    });

    const totalDuration = Date.now() - t0;

    if (resendResponse.error) {
      console.error(`[CloudFunction] Resend error:`, resendResponse.error);
      throw new Error(`Resend rejected: ${JSON.stringify(resendResponse.error)}`);
    }

    console.log(`[CloudFunction] ✅ Email sent via Resend`);
    console.log(`[CloudFunction]    Resend ID:      ${resendResponse.data?.id}`);
    console.log(`[CloudFunction]    Total duration: ${totalDuration}ms`);
    console.log(`[CloudFunction]    Recipient:      ${email}`);

    return { success: true, resendId: resendResponse.data?.id };

  } catch (error) {
    console.error(`[CloudFunction] ❌ Failed to send reset email:`, error.message);
    throw new Error(`Password reset email failed: ${error.message}`);
  }
};

// Trigger configuration (v2 functions syntax):
// exports.sendPasswordResetEmail = functions.auth.user().onCreate(...)
// For beforeCreate / beforeSignIn triggers, see:
// https://firebase.google.com/docs/auth/extend-with-blocking-functions
