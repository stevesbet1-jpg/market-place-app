/**
 * MARKETPLACE PASSWORD RESET CLOUD FUNCTION
 * ==========================================
 * Deployed as a Firebase Cloud Function (v1) and proxied via Firebase Hosting.
 *
 * Hosting rewrite:
 *   /api/send-reset        → this function
 *   /api/send-confirmation → this function
 *   /api/health            → this function
 *
 * The frontend on https://marketplace-app-3b3f7.web.app calls these as
 * SAME-ORIGIN requests (no CORS needed, no localhost).
 */

const path = require('path');
const fs = require('fs');
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const { Resend } = require('resend');

// ─── Firebase Admin ──────────────────────────────────────────────
admin.initializeApp();

// ─── Env vars (Firebase Functions config or process.env) ───────────
// Set in Firebase:
//   firebase functions:config:set resend.apikey="re_..." email.from="noreply@..."
let RESEND_API_KEY, EMAIL_FROM;
try {
  const cfg = functions.config();
  RESEND_API_KEY = cfg.resend?.apikey || process.env.RESEND_API_KEY;
  EMAIL_FROM = cfg.email?.from || process.env.EMAIL_FROM;
} catch {
  RESEND_API_KEY = process.env.RESEND_API_KEY;
  EMAIL_FROM = process.env.EMAIL_FROM;
}

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

const CONTINUE_URL = 'https://marketplace-app-3b3f7.web.app/reset-password.html';

// ─── Express app ─────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// ─── Email template helpers ──────────────────────────────────────
function loadTemplate(fileName) {
  const templatePath = path.join(__dirname, 'email-templates', fileName);
  if (!fs.existsSync(templatePath)) {
    console.error('[Function] Template not found:', templatePath);
    return null;
  }
  return fs.readFileSync(templatePath, 'utf8');
}

function buildEmailBody(resetLink, email, template) {
  return template
    .replace(/\{\{RESET_LINK\}\}/g, resetLink)
    .replace(/\{\{EMAIL\}\}/g, email)
    .replace(/\{\{BRAND_NAME\}\}/g, 'Marketplace')
    .replace(/\{\{EXPIRES_HOURS\}\}/g, '1');
}

// ─── Health check ────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    firebaseAdminReady: true,
    resendReady: !!resend,
    emailFrom: EMAIL_FROM || 'MISSING',
  });
});

// ─── Send reset endpoint ─────────────────────────────────────────
app.post('/api/send-reset', async (req, res) => {
  const t0 = Date.now();
  const { email } = req.body;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ success: false, error: 'Email is required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ success: false, error: 'Invalid email format.' });
  }

  console.log('[RESET] email:', normalizedEmail);

  // ── Verify user exists BEFORE generating link ─────────────────
  try {
    const user = await admin.auth().getUserByEmail(normalizedEmail);
    console.log('[RESET] user exists:', true, '| uid:', user.uid);
  } catch (userErr) {
    if (userErr.code === 'auth/user-not-found') {
      console.log('[RESET] user exists:', false);
      return res.status(404).json({
        success: false,
        code: 'user-not-found',
        error: 'No account exists for this email.',
      });
    }
    console.error('[RESET] getUserByEmail failed:', userErr.code, userErr.message);
    return res.status(500).json({
      success: false,
      error: userErr.message,
      code: userErr.code || 'unknown',
    });
  }

  if (!resend) {
    return res.status(500).json({ success: false, error: 'Resend API key not configured.' });
  }
  if (!EMAIL_FROM) {
    return res.status(500).json({ success: false, error: 'EMAIL_FROM not configured.' });
  }

  // ── Generate reset link ────────────────────────────────────────
  const actionCodeSettings = { url: CONTINUE_URL };
  console.log('[RESET] actionCodeSettings:', JSON.stringify(actionCodeSettings));

  let generatedLink;
  try {
    generatedLink = await admin.auth().generatePasswordResetLink(normalizedEmail, actionCodeSettings);
  } catch (linkErr) {
    console.error('[RESET] generatePasswordResetLink FAILED:', linkErr.code, linkErr.message);
    throw linkErr;
  }

  console.log(`[RESET] Firebase link generated in ${Date.now() - t0}ms`);

  // Extract oobCode and build direct link to custom reset page
  let directResetLink;
  try {
    const generatedUrl = new URL(generatedLink);
    const oobCode = generatedUrl.searchParams.get('oobCode');
    const apiKey = generatedUrl.searchParams.get('apiKey');
    const mode = generatedUrl.searchParams.get('mode') || 'resetPassword';

    if (!oobCode) {
      console.warn('[RESET] No oobCode found. Falling back to raw link.');
      directResetLink = generatedLink;
    } else {
      const directUrl = new URL(CONTINUE_URL);
      directUrl.searchParams.set('oobCode', oobCode);
      directUrl.searchParams.set('mode', mode);
      if (apiKey) directUrl.searchParams.set('apiKey', apiKey);
      directResetLink = directUrl.toString();
    }
  } catch (parseErr) {
    console.warn('[RESET] Failed to parse link:', parseErr.message);
    directResetLink = generatedLink;
  }

  const htmlTemplate = loadTemplate('reset-password.html');
  const textTemplate = loadTemplate('reset-password.txt');
  if (!htmlTemplate || !textTemplate) {
    return res.status(500).json({ success: false, error: 'Email templates missing.' });
  }

  const html = buildEmailBody(directResetLink, normalizedEmail, htmlTemplate);
  const text = buildEmailBody(directResetLink, normalizedEmail, textTemplate);

  const resendResponse = await resend.emails.send({
    from: EMAIL_FROM,
    to: [normalizedEmail],
    subject: 'Reset Your Marketplace Password',
    html,
    text,
  });

  const totalMs = Date.now() - t0;

  if (resendResponse.error) {
    console.error('[RESET] Resend rejected:', resendResponse.error);
    return res.status(502).json({
      success: false,
      error: `Resend rejected: ${JSON.stringify(resendResponse.error)}`,
    });
  }

  const emailId = resendResponse.data?.id;
  console.log(`[RESET] Email sent. ID: ${emailId} | ${totalMs}ms`);

  return res.json({
    success: true,
    emailId,
    recipient: normalizedEmail,
    durationMs: totalMs,
    message: 'Reset email sent. Check your inbox (and spam folder).',
  });
});

// ─── Send confirmation endpoint ──────────────────────────────────
app.post('/api/send-confirmation', async (req, res) => {
  const t0 = Date.now();
  const { email } = req.body;
  console.log(`[Function] /api/send-confirmation hit. Raw body email: ${email || 'MISSING'}`);

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ success: false, error: 'Email is required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ success: false, error: 'Invalid email format.' });
  }

  if (!resend) {
    return res.status(500).json({ success: false, error: 'Resend API key not configured.' });
  }

  if (!EMAIL_FROM) {
    return res.status(500).json({ success: false, error: 'EMAIL_FROM not configured.' });
  }

  try {
    const htmlTemplate = loadTemplate('password-changed.html');
    const textTemplate = loadTemplate('password-changed.txt');

    if (!htmlTemplate || !textTemplate) {
      return res.status(500).json({ success: false, error: 'Email templates missing.' });
    }

    const html = buildEmailBody('', normalizedEmail, htmlTemplate);
    const text = buildEmailBody('', normalizedEmail, textTemplate);

    const resendResponse = await resend.emails.send({
      from: EMAIL_FROM,
      to: [normalizedEmail],
      subject: 'Your Marketplace Password Was Changed',
      html,
      text,
    });

    const totalMs = Date.now() - t0;

    if (resendResponse.error) {
      console.error('[Function] Confirmation Resend rejected:', resendResponse.error);
      return res.status(502).json({
        success: false,
        error: `Resend rejected: ${JSON.stringify(resendResponse.error)}`,
      });
    }

    const emailId = resendResponse.data?.id;
    console.log(`[Function] Confirmation email sent. ID: ${emailId} | ${totalMs}ms`);

    return res.json({
      success: true,
      emailId,
      recipient: normalizedEmail,
      durationMs: totalMs,
      message: 'Confirmation email sent.',
    });

  } catch (error) {
    const totalMs = Date.now() - t0;
    console.error(`[Function] Confirmation failed after ${totalMs}ms:`, error.message);
    return res.status(500).json({ success: false, error: error.message, code: error.code || 'unknown' });
  }
});

// ─── Export as Cloud Function ────────────────────────────────────
// Firebase Hosting will rewrite /api/* to this function
exports.api = functions.https.onRequest(app);
