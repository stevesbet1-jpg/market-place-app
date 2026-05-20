/**
 * MARKETPLACE PASSWORD RESET BACKEND API
 * ======================================
 * Express server that exposes a single endpoint:
 *   POST /api/send-reset
 *
 * This endpoint generates a Firebase password-reset link via Admin SDK
 * and delivers it via Resend, giving the app reliable, trackable email
 * delivery instead of Firebase’s default shared-IP mail.
 *
 * RUN (development):
 *   npm run server
 *
 * The app should call:
 *   POST http://<host>:3001/api/send-reset
 *   Body: { "email": "user@example.com" }
 */

const path = require('path');
const fs = require('fs');

// ─── Load environment variables ────────────────────────────────────
try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch {
  console.warn('[Server] dotenv not available, relying on system env vars');
}

const express = require('express');
const cors = require('cors');
const { Resend } = require('resend');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Firebase Admin setup ────────────────────────────────────────
let admin;
let adminInitialized = false;

function initFirebaseAdmin() {
  if (adminInitialized) return true;

  const candidatePaths = [
    path.join(__dirname, '..', 'scripts', 'serviceAccount.json'),
    path.join(__dirname, '..', 'marketplace-app-3b3f7-firebase-adminsdk-fbsvc-3c92274ace.json'),
  ];

  let serviceAccountPath = null;
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      serviceAccountPath = p;
      break;
    }
  }

  // Support Render env var: paste raw JSON service account into dashboard
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  let serviceAccountFromEnv = null;
  if (serviceAccountJson) {
    try {
      serviceAccountFromEnv = JSON.parse(serviceAccountJson);
      console.log('[Server]   Service account loaded from FIREBASE_SERVICE_ACCOUNT_JSON env var');
    } catch (e) {
      console.error('[Server]   ⚠️  FIREBASE_SERVICE_ACCOUNT_JSON env var is not valid JSON');
    }
  }

  console.log('[Server] Firebase Admin init starting...');
  console.log('[Server]   Service account file found:', serviceAccountPath ? 'YES' : 'NO');
  console.log('[Server]   Service account from env var:', serviceAccountFromEnv ? 'YES' : 'NO');
  if (serviceAccountPath) {
    console.log('[Server]   Service account path:', serviceAccountPath);
  }

  try {
    admin = require('firebase-admin');
    if (admin.apps.length === 0) {
      if (serviceAccountFromEnv) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccountFromEnv),
          projectId: 'marketplace-app-3b3f7',
        });
        console.log('[Server] ✅ Firebase Admin initialized from env var');
      } else if (serviceAccountPath) {
        const serviceAccount = require(serviceAccountPath);
        console.log('[Server]   ServiceAccount.project_id:', serviceAccount.project_id || 'MISSING');
        console.log('[Server]   ServiceAccount.client_email:', serviceAccount.client_email || 'MISSING');
        console.log('[Server]   ServiceAccount has private_key:', !!serviceAccount.private_key);
        if (!serviceAccount.private_key || serviceAccount.private_key.length < 100) {
          console.error('[Server]   ⚠️  Service account private_key is missing or malformed');
        }
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: 'marketplace-app-3b3f7',
        });
        console.log('[Server] ✅ Firebase Admin initialized with service account file');
      } else {
        console.error('[Server]   ❌ No service account found. Set FIREBASE_SERVICE_ACCOUNT_JSON env var or place serviceAccount.json in scripts/');
        return false;
      }
    }
    adminInitialized = true;
    return true;
  } catch (err) {
    console.error('[Server] ❌ Firebase Admin initialization failed:', err.message);
    if (err.stack) console.error('[Server]   stack:', err.stack);
    return false;
  }
}

// ─── Resend setup ────────────────────────────────────────────────
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM;
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

const CONTINUE_URL = 'https://marketplace-app-3b3f7.web.app/reset-password.html';

// ─── Email template helpers ──────────────────────────────────────
function loadTemplate(fileName) {
  const templatePath = path.join(__dirname, '..', 'scripts', 'email-templates', fileName);
  if (!fs.existsSync(templatePath)) {
    console.error('[Server] Template not found:', templatePath);
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
    firebaseAdminReady: initFirebaseAdmin(),
    resendReady: !!resend,
    emailFrom: EMAIL_FROM || 'MISSING',
  });
});

// ─── Send reset endpoint ─────────────────────────────────────────
app.post('/api/send-reset', async (req, res) => {
  const t0 = Date.now();
  const { email } = req.body;

  // ── Validation ─────────────────────────────────────────────────
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ success: false, error: 'Email is required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ success: false, error: 'Invalid email format.' });
  }

  console.log('[RESET] email:', normalizedEmail);

  // ── Firebase Admin init ────────────────────────────────────────
  if (!initFirebaseAdmin()) {
    return res.status(500).json({
      success: false,
      error: 'Firebase Admin SDK not initialized. Check service account file.',
    });
  }

  // ── Resend config ────────────────────────────────────────────
  if (!resend) {
    return res.status(500).json({ success: false, error: 'Resend API key not configured.' });
  }
  if (!EMAIL_FROM) {
    return res.status(500).json({ success: false, error: 'EMAIL_FROM not configured.' });
  }

  // ── Generate reset link (Firebase Auth is the source of truth) ──
  const actionCodeSettings = { url: CONTINUE_URL };
  console.log('[RESET] actionCodeSettings:', JSON.stringify(actionCodeSettings));

  let generatedLink;
  try {
    generatedLink = await admin.auth().generatePasswordResetLink(normalizedEmail, actionCodeSettings);
  } catch (linkErr) {
    console.error('[RESET] generatePasswordResetLink FAILED');
    console.error('[RESET]   error.code   :', linkErr.code);
    console.error('[RESET]   error.message:', linkErr.message);

    if (linkErr.code === 'auth/user-not-found') {
      return res.status(404).json({
        success: false,
        code: 'auth/user-not-found',
        error: 'No account exists for this email.',
      });
    }
    if (linkErr.code === 'auth/invalid-email') {
      return res.status(400).json({
        success: false,
        code: 'auth/invalid-email',
        error: 'Invalid email address.',
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Unable to send reset email.',
      code: linkErr.code || 'unknown',
    });
  }

  const linkGenMs = Date.now() - t0;
  console.log(`[RESET] Firebase link generated in ${linkGenMs}ms`);
  console.log(`[RESET] Generated link: ${generatedLink.substring(0, 120)}...`);

  // ── Extract oobCode and build direct link ──────────────────────
  let directResetLink;
  try {
    const generatedUrl = new URL(generatedLink);
    const oobCode = generatedUrl.searchParams.get('oobCode');
    const apiKey = generatedUrl.searchParams.get('apiKey');
    const mode = generatedUrl.searchParams.get('mode') || 'resetPassword';

    if (!oobCode) {
      console.warn('[RESET] No oobCode found. Falling back to raw generated link.');
      directResetLink = generatedLink;
    } else {
      const directUrl = new URL(CONTINUE_URL);
      directUrl.searchParams.set('oobCode', oobCode);
      directUrl.searchParams.set('mode', mode);
      if (apiKey) directUrl.searchParams.set('apiKey', apiKey);
      directResetLink = directUrl.toString();
      console.log(`[RESET] Direct reset link: ${directResetLink.substring(0, 120)}...`);
    }
  } catch (parseErr) {
    console.warn('[RESET] Failed to parse generated link:', parseErr.message);
    directResetLink = generatedLink;
  }

  // ── Load templates ─────────────────────────────────────────────
  const htmlTemplate = loadTemplate('reset-password.html');
  const textTemplate = loadTemplate('reset-password.txt');
  if (!htmlTemplate || !textTemplate) {
    return res.status(500).json({ success: false, error: 'Email templates missing.' });
  }

  const html = buildEmailBody(directResetLink, normalizedEmail, htmlTemplate);
  const text = buildEmailBody(directResetLink, normalizedEmail, textTemplate);

  // ── Send via Resend ────────────────────────────────────────────
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
  console.log(`[RESET] Email sent. ID: ${emailId} | Total: ${totalMs}ms`);

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
  console.log(`[Server] /api/send-confirmation hit. Raw body email: ${email || 'MISSING'}`);

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
    return res.status(500).json({ success: false, error: 'EMAIL_FROM not configured in .env' });
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
      console.error('[Server] Confirmation email Resend rejected:', resendResponse.error);
      return res.status(502).json({
        success: false,
        error: `Resend rejected: ${JSON.stringify(resendResponse.error)}`,
      });
    }

    const emailId = resendResponse.data?.id;
    console.log(`[Server] ✅ Confirmation email sent via Resend. ID: ${emailId} | Total: ${totalMs}ms`);

    return res.json({
      success: true,
      emailId,
      recipient: normalizedEmail,
      durationMs: totalMs,
      message: 'Confirmation email sent.',
    });

  } catch (error) {
    const totalMs = Date.now() - t0;
    console.error(`[Server] ❌ Confirmation email failed after ${totalMs}ms:`, error.message);
    return res.status(500).json({
      success: false,
      error: error.message,
      code: error.code || 'unknown',
    });
  }
});

// ─── Start server ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║  Marketplace Reset API Server                              ║`);
  console.log(`╠════════════════════════════════════════════════════════════╣`);
  console.log(`║  Listening on port ${PORT}                                    ║`);
  console.log(`║  Health:   GET  /api/health                                ║`);
  console.log(`║  Reset:    POST /api/send-reset                            ║`);
  console.log(`║  Confirm:  POST /api/send-confirmation                     ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝\n`);
});
