/**
 * PASSWORD RESET & AUTH UTILITIES
 * ================================
 * Architecture: Backend-only via Render
 *   - Frontend NEVER calls Firebase client-side password reset APIs.
 *   - Frontend sends reset requests to Render backend /api/send-reset.
 *   - Backend uses Firebase Admin SDK to verify user exists, generate reset link,
 *     then sends the email via Resend.
 *   - Confirmation email (/api/send-confirmation) is sent ONLY after
 *     confirmPasswordReset succeeds on the frontend.
 *
 * Production URLs:
 *   - Reset page: https://marketplace-app-3b3f7.web.app/reset-password.html
 *   - Backend API: https://market-place-app-1.onrender.com
 */

import {
  getAuth,
  confirmPasswordReset,
  verifyPasswordResetCode,
  fetchSignInMethodsForEmail,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
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

// ─── Send password reset via backend API (Resend) ────────────────
// Frontend only calls the deployed Render backend.
// Firebase Admin + Resend lives exclusively on the server.

const DEFAULT_RESET_API_URL = 'https://market-place-app-1.onrender.com';

export interface BackendResetResult {
  success: boolean;
  emailId?: string;
  error?: string;
  code?: string;
}

// ─── Warm up Render backend (free tier sleeps) ────────────────────

function getBackendUrl(): string {
  return process.env.EXPO_PUBLIC_RESET_API_URL || DEFAULT_RESET_API_URL;
}

export async function warmUpBackend(): Promise<boolean> {
  const baseUrl = getBackendUrl();
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

export interface DirectResetResult {
  success: boolean;
  error?: string;
  code?: string;
}

export async function sendPasswordResetEmailDirect(
  email: string
): Promise<DirectResetResult> {
  const rawEmail = email;
  const normalizedEmail = email.trim().toLowerCase();

  console.log('[FirebaseAuth] === SEND RESET EMAIL (DIRECT) ===');
  console.log('[FirebaseAuth] Raw email:', rawEmail);
  console.log('[FirebaseAuth] Normalized email:', normalizedEmail);

  if (!_isFirebaseConfigured()) {
    console.warn('[FirebaseAuth] Firebase not configured');
    return { success: false, error: 'Firebase not configured', code: 'auth/not-configured' };
  }

  try {
    const app = getFirebaseApp();
    const auth = getAuth(app);
    console.log('[FirebaseAuth] Auth instance projectId:', app.options.projectId);
    console.log('[FirebaseAuth] About to call sendPasswordResetEmail for:', normalizedEmail);

    await sendPasswordResetEmail(auth, normalizedEmail);

    console.log('[FirebaseAuth] sendPasswordResetEmail RESOLVED successfully for:', normalizedEmail);
    return { success: true };
  } catch (error: any) {
    const code = error.code || 'unknown';
    const message = error.message || 'Unknown error';
    console.error('[FirebaseAuth] sendPasswordResetEmail REJECTED');
    console.error('[FirebaseAuth]   error.code   :', code);
    console.error('[FirebaseAuth]   error.message:', message);
    if (error.stack) {
      console.error('[FirebaseAuth]   error.stack  :', error.stack);
    }
    return { success: false, error: message, code };
  }
}

export const sendPasswordResetViaBackend = async (
  email: string
): Promise<BackendResetResult> => {
  const baseUrl = getBackendUrl();
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
  const baseUrl = getBackendUrl();
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
