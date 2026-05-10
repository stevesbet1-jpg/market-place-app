import {
  getAuth,
  sendPasswordResetEmail,
  confirmPasswordReset,
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

export const sendFirebasePasswordReset = async (email: string): Promise<void> => {
  if (!_isFirebaseConfigured()) {
    throw new Error('Firebase is not configured. Please check your environment variables.');
  }

  const auth = getAuth(getFirebaseApp());

  const actionCodeSettings = {
    // Use Firebase's own authorized domain to ensure emails are actually sent.
    // Custom domains require verification in Firebase Console → Auth → Settings → Authorized domains.
    url: 'https://marketplace-app-3b3f7.firebaseapp.com/__/auth/action',
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
  console.log('[FirebaseAuth] Action code settings:', JSON.stringify(actionCodeSettings));

  try {
    await sendPasswordResetEmail(auth, email, actionCodeSettings);
    console.log('[FirebaseAuth] sendPasswordResetEmail completed without error for:', email);
    console.log('[FirebaseAuth] NOTE: Firebase returns success even if email does not exist in Auth.');
  } catch (error: any) {
    console.error('[FirebaseAuth] sendPasswordResetEmail FAILED:', error.code, error.message);
    console.error('[FirebaseAuth] Full error:', error);
    throw error;
  }
};

export const confirmFirebasePasswordReset = async (
  oobCode: string,
  newPassword: string
): Promise<void> => {
  if (!_isFirebaseConfigured()) {
    throw new Error('Firebase is not configured. Please check your environment variables.');
  }

  const auth = getAuth(getFirebaseApp());
  await confirmPasswordReset(auth, oobCode, newPassword);
};

export const loginWithFirebaseEmail = async (
  email: string,
  password: string
): Promise<FirebaseAuthResult> => {
  if (!_isFirebaseConfigured()) {
    return { success: false, error: 'Firebase not configured' };
  }

  try {
    const auth = getAuth(getFirebaseApp());
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return {
      success: true,
      userId: userCredential.user.uid,
      email: userCredential.user.email || email,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Login failed',
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

  try {
    const auth = getAuth(getFirebaseApp());
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return {
      success: true,
      userId: userCredential.user.uid,
      email: userCredential.user.email || email,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Registration failed',
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
