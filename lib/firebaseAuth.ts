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

// ─── Email existence check (debug only — do NOT leak to UI) ──────

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

export const sendFirebasePasswordReset = async (email: string): Promise<void> => {
  if (!_isFirebaseConfigured()) {
    throw new Error('Firebase is not configured. Please check your environment variables.');
  }

  const auth = getAuth(getFirebaseApp());

  // Log Firebase config for diagnostics
  const config = getFirebaseApp().options;
  console.log('[FirebaseAuth] Firebase project:', config.projectId);
  console.log('[FirebaseAuth] Firebase authDomain:', config.authDomain);

  // Check if email exists BEFORE sending (debug only)
  const exists = await checkEmailExistsInFirebase(email);
  if (!exists) {
    console.warn(
      '[FirebaseAuth] CRITICAL: Email', email,
      'is NOT registered in Firebase Auth.\n' +
      'Firebase will return HTTP 200 but will NOT send any email.\n' +
      'To fix: create a user with this email in Firebase Console → Authentication → Users → Add user'
    );
  }

  const actionCodeSettings = {
    // The continue URL MUST be in Firebase's authorized domains list.
    // We use Firebase's own hosting domain (always authorized) and redirect to the app from there.
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

  console.log('[FirebaseAuth] Sending password reset email to:', email);
  console.log('[FirebaseAuth] Action code settings:', JSON.stringify(actionCodeSettings, null, 2));

  try {
    await sendPasswordResetEmail(auth, email, actionCodeSettings);
    console.log('[FirebaseAuth] sendPasswordResetEmail returned SUCCESS for:', email);
    console.log(
      '[FirebaseAuth] IMPORTANT: Firebase returns success for ALL emails (even non-existent ones).\n' +
      'If the email is not in Firebase Auth, NO email was actually sent.\n' +
      'If the email IS in Firebase Auth, check inbox/spam. It can take 1-5 minutes.'
    );
  } catch (error: any) {
    const code = error.code || 'unknown';
    const message = error.message || 'Unknown error';
    console.error('[FirebaseAuth] sendPasswordResetEmail FAILED:', code, message);
    console.error('[FirebaseAuth] Full error:', error);

    // Map specific Firebase errors to actionable messages
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
