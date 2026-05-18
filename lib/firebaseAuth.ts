/**
 * FIREBASE CONSOLE VERIFICATION CHECKLIST
 * ======================================
 * Before password reset emails will actually be delivered, verify:
 *
 * 1. Authentication → Users
 *    - The target email MUST exist as a user in Firebase Auth.
 *    - Firebase silently drops reset emails for unregistered addresses.
 *
 * 2. Authentication → Sign-in method
 *    - Email/Password provider MUST be enabled.
 *
 * 3. Authentication → Templates → Password reset
 *    - Template MUST be enabled (it is by default).
 *    - Template MUST use a FROM address that matches your verified domain.
 *    - Subject line should be clear: "Reset your Marketplace password".
 *    - Body should NOT contain spam trigger words (FREE, URGENT, ACT NOW).
 *    - Ensure the template includes the %LINK% placeholder.
 *    - Do NOT use ALL CAPS or excessive punctuation in the template.
 *
 * 4. Authentication → Settings → Authorized domains
 *    - Must include:
 *      • localhost
 *      • marketplace-app-3b3f7.firebaseapp.com
 *      • marketplace-app-3b3f7.web.app
 *    - If using a custom domain, add it here.
 *
 * 5. Hosting (for deep-link bridge page)
 *    - Deploy public/reset-password.html via Firebase CLI:
 *      firebase deploy --only hosting
 *
 * 6. Gmail deliverability
 *    - Check spam/promotions folder.
 *    - Whitelist noreply@<project>.firebaseapp.com in Gmail filters.
 *    - Firebase sends from a shared IP pool; delivery can take 1-60 seconds.
 *
 * 7. Project region
 *    - Default is us-central1. Emails send from the closest region.
 *    - Cannot be changed for existing projects.
 *
 * 8. Expo dev mode
 *    - In __DEV__, Metro may add proxy overhead.
 *    - Test on a production build (`eas build`) for real delivery speed.
 */

import {
  getAuth,
  sendPasswordResetEmail,
  confirmPasswordReset,
  verifyPasswordResetCode,
  fetchSignInMethodsForEmail,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { getFirebaseApp, isFirebaseConfigured as _isFirebaseConfigured } from './firebase';

export { _isFirebaseConfigured as isFirebaseConfigured };

export interface FirebaseAuthResult {
  success: boolean;
  userId?: string;
  email?: string;
  error?: string;
}

// ─── Diagnostic-only sign-in methods check ─────────────────────────
// NOTE: fetchSignInMethodsForEmail is NOT a reliable user existence check.
// When Firebase Email Enumeration Protection is enabled (default for new projects),
// this returns an empty array for ALL emails — registered or not.
// Use this ONLY for diagnostics, NEVER as a gate for sending reset emails.

export async function checkEmailExistsInFirebase(email: string): Promise<boolean> {
  if (!_isFirebaseConfigured()) {
    console.warn('[FirebaseAuth] Cannot check email existence — Firebase not configured');
    return false;
  }

  try {
    const auth = getAuth(getFirebaseApp());
    const methods = await fetchSignInMethodsForEmail(auth, email);
    const exists = methods.length > 0;
    console.log('[FirebaseAuth] fetchSignInMethodsForEmail result:', email, '→ methods:', methods, '→ exists:', exists);
    console.log('[FirebaseAuth] ⚠️  This result is UNRELIABLE when Email Enumeration Protection is enabled.');
    return exists;
  } catch (error: any) {
    console.error('[FirebaseAuth] fetchSignInMethodsForEmail failed:', error.code, error.message);
    return false;
  }
}

// ─── Verify reset code (returns associated email or throws) ───────

export async function verifyResetCode(oobCode: string): Promise<string> {
  if (!_isFirebaseConfigured()) {
    throw new Error('Firebase is not configured.');
  }

  console.log('[FirebaseAuth] Verifying reset code:', oobCode.substring(0, 8) + '...');

  try {
    const auth = getAuth(getFirebaseApp());
    const email = await verifyPasswordResetCode(auth, oobCode);
    console.log('[FirebaseAuth] Reset code is valid. Associated email:', email);
    return email;
  } catch (error: any) {
    console.error('[FirebaseAuth] verifyPasswordResetCode FAILED:', error.code, error.message);
    throw error;
  }
}

// ─── Send password reset email ─────────────────────────────────────
// OPTIMIZED: Zero unnecessary round-trips, precise timing, retry logic.
// Firebase Email Enumeration Protection means we cannot verify existence client-side.
// We send directly and let Firebase handle filtering server-side.
//
// CACHE CLEAR REQUIRED after changing .env:
//   npx expo start --clear
//   or: rm -rf node_modules/.cache && npx expo start --clear

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [500, 1500, 3000];
const NETWORK_TIMEOUT_MS = 15000;

function isRetryableError(code: string, message: string): boolean {
  return (
    code === 'auth/network-request-failed' ||
    code === 'auth/timeout' ||
    code === 'auth/internal-error' ||
    message.toLowerCase().includes('timeout') ||
    message.toLowerCase().includes('network') ||
    message.toLowerCase().includes('etimedout') ||
    message.toLowerCase().includes('econnrefused') ||
    message.toLowerCase().includes('network error')
  );
}

function runWithTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} exceeded ${ms}ms timeout`));
    }, ms);
    promise
      .then((val) => { clearTimeout(timer); resolve(val); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
}

export const sendFirebasePasswordReset = async (email: string): Promise<void> => {
  const requestStart = Date.now();

  if (!_isFirebaseConfigured()) {
    throw new Error('Firebase is not configured. Please check your environment variables.');
  }

  const auth = getAuth(getFirebaseApp());
  const config = getFirebaseApp().options;

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  [FirebaseAuth] PASSWORD RESET — PRODUCTION TIMING LOG         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`[FirebaseAuth] T+0ms     Request start`);
  console.log(`[FirebaseAuth] T+0ms     Email: ${email}`);
  console.log(`[FirebaseAuth] T+0ms     projectId: ${config.projectId}`);
  console.log(`[FirebaseAuth] T+0ms     authDomain: ${config.authDomain}`);
  console.log(`[FirebaseAuth] T+0ms     __DEV__: ${__DEV__}`);
  console.log(`[FirebaseAuth] T+0ms     Auth instance warmed: ${!!auth}`);

  const actionCodeSettings = {
    url: 'https://marketplace-app-3b3f7.firebaseapp.com/reset-password.html',
    handleCodeInApp: false,
  };

  const setupDone = Date.now();
  console.log(`[FirebaseAuth] T+${setupDone - requestStart}ms  Pre-send setup complete (actionCodeSettings ready)`);

  // ── RETRY LOOP with timeout wrapper ────────────────────────────
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const attemptStart = Date.now();
    console.log(`[FirebaseAuth] T+${attemptStart - requestStart}ms  Attempt ${attempt + 1}/${MAX_RETRIES} → calling sendPasswordResetEmail...`);

    try {
      const sendPromise = sendPasswordResetEmail(auth, email, actionCodeSettings);
      await runWithTimeout(sendPromise, NETWORK_TIMEOUT_MS, 'Firebase sendPasswordResetEmail');

      const successTime = Date.now();
      const firebaseDuration = successTime - attemptStart;
      const totalDuration = successTime - requestStart;

      console.log(`[FirebaseAuth] T+${successTime - requestStart}ms  ✅ sendPasswordResetEmail returned SUCCESS`);
      console.log(`[FirebaseAuth]            Firebase API duration: ${firebaseDuration}ms`);
      console.log(`[FirebaseAuth]            Total request duration:    ${totalDuration}ms`);
      console.log(`[FirebaseAuth]            Firebase accepted reset email request.`);
      console.log(`[FirebaseAuth]            ─── Request Details ───`);
      console.log(`[FirebaseAuth]            projectId:        ${config.projectId}`);
      console.log(`[FirebaseAuth]            authDomain:       ${config.authDomain}`);
      console.log(`[FirebaseAuth]            email:            ${email}`);
      console.log(`[FirebaseAuth]            actionCodeURL:    ${actionCodeSettings.url}`);
      console.log(`[FirebaseAuth]            timestamp:        ${new Date(successTime).toISOString()}`);
      console.log(`[FirebaseAuth]            __DEV__:          ${__DEV__}`);
      console.log(`[FirebaseAuth]            ─── Delivery Note ───`);
      console.log(`[FirebaseAuth]            Firebase accepted the request. This does NOT prove delivery.`);
      console.log(`[FirebaseAuth]            If email is registered → queued for delivery (1-60s).`);
      console.log(`[FirebaseAuth]            If email is NOT registered → silently dropped by Firebase.`);
      console.log(`[FirebaseAuth]            Run: node scripts/send-reset-email-test.js  (terminal proof)`);
      console.log('╔══════════════════════════════════════════════════════════════╗');
      console.log('║  END TIMING LOG                                              ║');
      console.log('╚══════════════════════════════════════════════════════════════╝');
      console.log('');
      return; // SUCCESS — exit immediately, no more attempts

    } catch (error: any) {
      const failTime = Date.now();
      const code = error.code || 'unknown';
      const message = error.message || 'Unknown error';
      console.log(`[FirebaseAuth] T+${failTime - requestStart}ms  ❌ Attempt ${attempt + 1} FAILED: ${code} — ${message}`);
      console.log(`[FirebaseAuth]            Attempt duration: ${failTime - attemptStart}ms`);

      if (isRetryableError(code, message) && attempt < MAX_RETRIES - 1) {
        const delay = RETRY_DELAYS_MS[attempt];
        const retryAt = Date.now();
        console.log(`[FirebaseAuth] T+${retryAt - requestStart}ms  ↻ Transient error. Retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      // Non-retryable or max retries exhausted
      const totalFail = Date.now() - requestStart;
      console.log(`[FirebaseAuth] T+${totalFail}ms  ❌ FINAL FAILURE after ${attempt + 1} attempt(s). Total: ${totalFail}ms`);
      console.log('╔══════════════════════════════════════════════════════════════╗');
      console.log('║  END TIMING LOG                                              ║');
      console.log('╚══════════════════════════════════════════════════════════════╝');
      console.log('');

      const errorMessages: Record<string, string> = {
        'auth/invalid-email': 'The email address is not valid.',
        'auth/missing-android-pkg-name': 'Android package name is missing in actionCodeSettings.',
        'auth/missing-continue-uri': 'Continue URL is missing in actionCodeSettings.',
        'auth/missing-ios-bundle-id': 'iOS bundle ID is missing in actionCodeSettings.',
        'auth/invalid-continue-uri': 'Continue URL is invalid. Must be a valid HTTPS URL.',
        'auth/unauthorized-continue-uri':
          'Continue URL domain is NOT authorized in Firebase Console.\n' +
          'Go to Firebase Console → Authentication → Settings → Authorized domains → Add: ' +
          (config.authDomain || 'your-auth-domain'),
        'auth/too-many-requests': 'Too many requests. Please wait a few minutes and try again.',
      };

      const friendlyMessage = errorMessages[code] || message;
      throw new Error(friendlyMessage);
    }
  }
};

// ─── Send password reset via backend API (Resend) ────────────────
// This calls the local Express server which uses Firebase Admin + Resend
// for reliable email delivery with tracking, instead of Firebase's default.

const DEFAULT_RESET_API_URL = 'https://marketplace-reset-api.onrender.com';

export interface BackendResetResult {
  success: boolean;
  emailId?: string;
  error?: string;
  code?: string;
}

// ─── Warm up Render backend (free tier sleeps) ────────────────────

export async function warmUpBackend(): Promise<boolean> {
  const baseUrl = DEFAULT_RESET_API_URL;
  const healthUrl = `${baseUrl}/api/health`;
  console.log('[FirebaseAuth] Warming up backend:', healthUrl);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(healthUrl, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (response.ok) {
      console.log('[FirebaseAuth] Backend warm-up SUCCESS');
      return true;
    }
    console.log('[FirebaseAuth] Backend warm-up returned status:', response.status);
    return false;
  } catch (e: any) {
    console.log('[FirebaseAuth] Backend warm-up FAILED (will retry on main request):', e.message);
    return false;
  }
}

export const sendPasswordResetViaBackend = async (
  email: string
): Promise<BackendResetResult> => {
  const baseUrl = DEFAULT_RESET_API_URL;
  const url = `${baseUrl}/api/send-reset`;

  console.log('[RESET EMAIL API URL]', url);
  console.log('[FirebaseAuth] Email:', email);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json();
    console.log('[RESET EMAIL RESULT]', data);

    if (response.ok && data.success) {
      console.log('[FirebaseAuth] Backend reset SUCCESS. Resend emailId:', data.emailId);
      return {
        success: true,
        emailId: data.emailId,
        error: undefined,
      };
    }

    console.log('[FirebaseAuth] Backend reset FAILED:', data.error, '| code:', data.code);
    return {
      success: false,
      error: data.error || 'Failed to send reset email',
      code: data.code,
    };
  } catch (error: any) {
    const message = error.message || 'Unknown error';
    console.error('[EMAIL ERROR]', message);
    console.log('[FirebaseAuth] Backend reset NETWORK/EXCEPTION:', message);

    if (message.includes('abort') || message.includes('Abort')) {
      return {
        success: false,
        error: 'Backend request timed out after 60 seconds. The server may be waking up. Please try again.',
      };
    }

    return {
      success: false,
      error: `Cannot reach reset API server at ${baseUrl}. Please check your internet connection and try again.`,
    };
  }
};

// ─── Send password-changed confirmation via backend API ─────────

export interface BackendConfirmResult {
  success: boolean;
  emailId?: string;
  error?: string;
}

export const sendPasswordChangedEmailViaBackend = async (
  email: string
): Promise<BackendConfirmResult> => {
  const baseUrl = DEFAULT_RESET_API_URL;
  const url = `${baseUrl}/api/send-confirmation`;

  console.log('[FirebaseAuth] Calling backend confirmation API:', url);
  console.log('[FirebaseAuth] Email:', email);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json();
    console.log('[PASSWORD CHANGED EMAIL RESULT]', data);

    if (response.ok && data.success) {
      console.log('[FirebaseAuth] Backend confirmation SUCCESS. Resend emailId:', data.emailId);
      return {
        success: true,
        emailId: data.emailId,
        error: undefined,
      };
    }

    console.log('[FirebaseAuth] Backend confirmation FAILED:', data.error);
    return {
      success: false,
      error: data.error || 'Failed to send confirmation email',
    };
  } catch (error: any) {
    const message = error.message || 'Unknown error';
    console.error('[PASSWORD CHANGED EMAIL ERROR]', message);
    console.log('[FirebaseAuth] Backend confirmation NETWORK/EXCEPTION:', message);

    if (message.includes('abort') || message.includes('Abort')) {
      return {
        success: false,
        error: 'Backend request timed out after 60 seconds. Please try again.',
      };
    }

    return {
      success: false,
      error: `Cannot reach confirmation API server at ${baseUrl}. Please check your connection and try again.`,
    };
  }
};

// ─── Confirm password reset ────────────────────────────────────────

export const confirmFirebasePasswordReset = async (
  oobCode: string,
  newPassword: string
): Promise<void> => {
  if (!_isFirebaseConfigured()) {
    throw new Error('Firebase is not configured. Please check your environment variables.');
  }

  console.log('[FirebaseAuth] Confirming password reset with code:', oobCode.substring(0, 8) + '...');

  try {
    const auth = getAuth(getFirebaseApp());
    await confirmPasswordReset(auth, oobCode, newPassword);
    console.log('[FirebaseAuth] confirmPasswordReset SUCCESS');
  } catch (error: any) {
    const code = error.code || 'unknown';
    const message = error.message || 'Unknown error';
    console.log('[FirebaseAuth] confirmPasswordReset FAILED:', code, message);

    const errorMessages: Record<string, string> = {
      'auth/expired-action-code': 'The reset link has expired. Please request a new one.',
      'auth/invalid-action-code': 'The reset link is invalid. It may have already been used.',
      'auth/user-disabled': 'This account has been disabled.',
      'auth/user-not-found': 'No user found for this reset link.',
      'auth/weak-password': 'Password is too weak. Use at least 8 characters with mixed case, numbers, and symbols.',
    };

    const friendlyMessage = errorMessages[code] || message;
    throw new Error(friendlyMessage);
  }
};

export const loginWithFirebaseEmail = async (
  email: string,
  password: string
): Promise<FirebaseAuthResult> => {
  if (!_isFirebaseConfigured()) {
    return { success: false, error: 'Firebase not configured' };
  }

  console.log('[FirebaseAuth] Attempting login for:', email);

  try {
    const auth = getAuth(getFirebaseApp());
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log('[FirebaseAuth] Login SUCCESS for:', email);
    return {
      success: true,
      userId: userCredential.user.uid,
      email: userCredential.user.email || email,
    };
  } catch (error: any) {
    console.log('[FirebaseAuth] Login FAILED:', error.code, error.message);
    const errorMessages: Record<string, string> = {
      'auth/invalid-email': 'Invalid email address.',
      'auth/user-disabled': 'This account has been disabled.',
      'auth/user-not-found': 'No account found with this email.',
      'auth/wrong-password': 'Incorrect password.',
      'auth/invalid-credential': 'Invalid email or password.',
    };
    return {
      success: false,
      error: errorMessages[error.code] || error.message || 'Login failed',
    };
  }
};

export const registerWithFirebaseEmail = async (
  email: string,
  password: string
): Promise<FirebaseAuthResult> => {
  if (!_isFirebaseConfigured()) {
    return { success: false, error: 'Firebase not configured' };
  }

  console.log('[FirebaseAuth] Registering user:', email);

  try {
    const auth = getAuth(getFirebaseApp());
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    console.log('[FirebaseAuth] Registration SUCCESS for:', email);
    return {
      success: true,
      userId: userCredential.user.uid,
      email: userCredential.user.email || email,
    };
  } catch (error: any) {
    console.error('[FirebaseAuth] Registration FAILED:', error.code, error.message);
    const errorMessages: Record<string, string> = {
      'auth/email-already-in-use': 'An account with this email already exists.',
      'auth/invalid-email': 'Invalid email address.',
      'auth/weak-password': 'Password is too weak. Use at least 8 characters.',
    };
    return {
      success: false,
      error: errorMessages[error.code] || error.message || 'Registration failed',
    };
  }
};

export const logoutFromFirebase = async (): Promise<void> => {
  if (!_isFirebaseConfigured()) {
    return;
  }

  try {
    const auth = getAuth(getFirebaseApp());
    await signOut(auth);
  } catch (error) {
    console.log('Firebase logout error (safe to ignore):', error);
  }
};
