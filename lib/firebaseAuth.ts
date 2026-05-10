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
 *
 * 4. Authentication → Settings → Authorized domains
 *    - Must include:
 *      • localhost
 *      • marketplace-app-3b3f7.firebaseapp.com
 *      • marketplace-app-3b3f7.web.app
 *
 * 5. Hosting (for deep-link bridge page)
 *    - Deploy public/reset-password.html via Firebase CLI:
 *      firebase deploy --only hosting
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

// ─── Strict email existence check ────────────────────────────────────
// Returns true ONLY if the email is registered in Firebase Auth.
// This is called BEFORE sendPasswordResetEmail to prevent fake success.

export async function checkEmailExistsInFirebase(email: string): Promise<boolean> {
  if (!_isFirebaseConfigured()) {
    console.warn('[FirebaseAuth] Cannot check email existence — Firebase not configured');
    return false;
  }

  try {
    const auth = getAuth(getFirebaseApp());
    const methods = await fetchSignInMethodsForEmail(auth, email);
    const exists = methods.length > 0;
    console.log('[FirebaseAuth] Email existence check:', email, '→ methods:', methods, '→ exists:', exists);
    return exists;
  } catch (error: any) {
    console.error('[FirebaseAuth] fetchSignInMethodsForEmail failed:', error.code, error.message);
    // Fail closed: if we can't verify, assume not exists to prevent fake success
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
// STRICT: throws if email is NOT registered in Firebase Auth.
// This prevents the fake "email sent" message for unregistered emails.

export const sendFirebasePasswordReset = async (email: string): Promise<void> => {
  if (!_isFirebaseConfigured()) {
    throw new Error('Firebase is not configured. Please check your environment variables.');
  }

  const auth = getAuth(getFirebaseApp());
  const config = getFirebaseApp().options;

  console.log('[FirebaseAuth] === PASSWORD RESET REQUEST ===');
  console.log('[FirebaseAuth] Email:', email);
  console.log('[FirebaseAuth] Firebase projectId:', config.projectId);
  console.log('[FirebaseAuth] Firebase authDomain:', config.authDomain);

  // ── STEP 1: Verify email exists in Firebase Auth ───────────────
  console.log('[FirebaseAuth] Checking if email is registered in Firebase Auth...');
  const exists = await checkEmailExistsInFirebase(email);

  if (!exists) {
    console.error('[FirebaseAuth] BLOCKED: Email', email, 'is NOT registered in Firebase Auth.');
    console.error('[FirebaseAuth] Firebase will NOT send a reset email to an unregistered address.');
    throw new Error('This email is not registered. Please create an account first.');
  }

  console.log('[FirebaseAuth] Email exists check PASSED. Proceeding to send reset email.');

  // ── STEP 2: Configure action code settings ──────────────────────
  const actionCodeSettings = {
    url: 'https://marketplace-app-3b3f7.firebaseapp.com/reset-password.html',
    handleCodeInApp: true,
    iOS: {
      bundleId: 'com.anonymous.Matketplace',
    },
    android: {
      packageName: 'com.anonymous.Matketplace',
      installApp: false,
      minimumVersion: '1',
    },
  };

  console.log('[FirebaseAuth] Action code settings:', JSON.stringify(actionCodeSettings, null, 2));
  console.log('[FirebaseAuth] Calling sendPasswordResetEmail...');

  // ── STEP 3: Send the reset email ────────────────────────────────
  try {
    await sendPasswordResetEmail(auth, email, actionCodeSettings);
    console.log('[FirebaseAuth] Password reset email SENT successfully for:', email);
  } catch (error: any) {
    const code = error.code || 'unknown';
    const message = error.message || 'Unknown error';
    console.error('[FirebaseAuth] sendPasswordResetEmail FAILED:', code, message);
    console.error('[FirebaseAuth] Full error:', error);

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
      'auth/user-not-found': 'No user found with this email.',
    };

    const friendlyMessage = errorMessages[code] || message;
    throw new Error(friendlyMessage);
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
    console.error('[FirebaseAuth] confirmPasswordReset FAILED:', code, message);

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
    console.error('[FirebaseAuth] Login FAILED:', error.code, error.message);
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
