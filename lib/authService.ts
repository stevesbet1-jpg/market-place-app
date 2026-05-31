import { Alert } from 'react-native';
import Constants from 'expo-constants';
import * as AppleAuthentication from 'expo-apple-authentication';
import { socialLogin, loginUser, setCurrentSession, clearSession } from '../app/(auth)/authStorage';
import { isSupabaseConfigured, supabase } from './supabase';
import { loginWithFirebaseEmail, logoutFromFirebase } from './firebaseAuth';

// Environment helpers
export const isExpoGo = (): boolean => {
  return Constants.appOwnership === 'expo';
};

export const isDevBuild = (): boolean => {
  return !Constants.appOwnership || Constants.appOwnership !== 'expo';
};

export const isProduction = (): boolean => {
  return Constants.appOwnership !== 'expo' && !__DEV__;
};

// Apple Login
export type AppleLoginResult =
  | { success: true }
  | { success: false; cancelled: true }
  | { success: false; cancelled: false };

function isAppleCancellation(error: any): boolean {
  const code: string = error?.code ?? '';
  const message: string = (error?.message ?? '').toLowerCase();
  return (
    code === 'ERR_REQUEST_CANCELED' ||
    code === 'ERR_CANCELED' ||
    message.includes('cancel') ||
    message.includes('user canceled') ||
    message.includes('user cancelled')
  );
}

export async function loginWithApple(): Promise<AppleLoginResult> {
  try {
    const isAvailable = await AppleAuthentication.isAvailableAsync();

    if (!isAvailable) {
      // Fallback for Expo Go or devices without Apple Sign-In
      if (isExpoGo()) {
        console.log('APPLE_AUTH: Expo Go detected - using mock login');

        const mockEmail = 'apple_user@example.com';
        const mockProviderId = `apple_mock_${Date.now()}`;

        const user = await socialLogin('apple', mockEmail, mockProviderId);
        setCurrentSession(user);
        console.log('APPLE_AUTH: Mock login successful', user);
        return { success: true };
      }

      throw new Error('Apple Sign-In is not available on this device');
    }

    // Real Apple Sign-In
    console.log('APPLE_AUTH: Using real Apple Sign-In');

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    const appleEmail = credential.email || 'apple_user@example.com';
    const providerId = credential.user || `apple_${Date.now()}`;

    const user = await socialLogin('apple', appleEmail.toLowerCase(), providerId);
    setCurrentSession(user);
    console.log('APPLE_AUTH: Real login successful', user);
    return { success: true };
  } catch (error: any) {
    // User cancelled — normal action, no log, no throw
    if (isAppleCancellation(error)) {
      return { success: false, cancelled: true };
    }

    // Incomplete/unknown Apple auth — warn only, show friendly message
    if (error?.code === 'ERR_REQUEST_UNKNOWN') {
      console.warn('APPLE_AUTH: Sign in not completed (ERR_REQUEST_UNKNOWN)');
      Alert.alert(
        'Sign In Incomplete',
        'Apple Sign In was not completed. Please try again.',
      );
      return { success: false, cancelled: false };
    }

    // Unexpected errors — warn (not error) to avoid red dev screen
    console.warn('APPLE_AUTH_ERROR:', { code: error?.code, message: error?.message });
    throw error;
  }
}

// Email Login
export interface EmailLoginParams {
  email: string;
  password: string;
  loginUser: (email: string, password: string) => Promise<any>;
}

export async function loginWithEmail({ email, password, loginUser }: EmailLoginParams): Promise<any> {
  try {
    console.log('EMAIL_AUTH: Attempting Firebase login');

    const firebaseResult = await loginWithFirebaseEmail(email, password);

    if (firebaseResult.success && firebaseResult.userId) {
      const user = {
        id: firebaseResult.userId,
        email: firebaseResult.email || email,
        name: firebaseResult.email || email,
        provider: 'firebase',
      };
      setCurrentSession(user);
      console.log('EMAIL_AUTH: Firebase login successful', user);
      return user;
    }

    // ── Firebase is configured but returned an auth error ──────
    // Firebase is the source of truth. After a password reset, only
    // Firebase knows the new password. Do NOT fall back to Supabase
    // or local auth — that would confuse the user with mismatched
    // passwords or stale accounts.
    if (firebaseResult.error && firebaseResult.error !== 'Firebase not configured') {
      console.log('EMAIL_AUTH: Firebase auth error:', firebaseResult.error);
      throw new Error(firebaseResult.error);
    }

    // ── Firebase NOT configured → fallback chain ─────────────────
    console.log('EMAIL_AUTH: Firebase not configured. Trying Supabase...');
    const supabaseUser = await trySupabaseLogin(email, password);
    if (supabaseUser) {
      return supabaseUser;
    }

    console.log('EMAIL_AUTH: No Supabase user either. Falling back to local auth.');
    const user = await loginUser(email, password);
    setCurrentSession(user);
    console.log('EMAIL_AUTH: Local login successful', user);
    return user;
  } catch (error: any) {
    console.log('EMAIL_AUTH_ERROR:', error.message);
    throw error;
  }
}

async function trySupabaseLogin(email: string, password: string): Promise<any | null> {
  if (!isSupabaseConfigured()) {
    console.log('EMAIL_AUTH: Supabase not configured, skipping Supabase fallback');
    return null;
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      console.log('EMAIL_AUTH: Supabase login error:', error.message);
      return null;
    }

    if (!data.user) {
      console.log('EMAIL_AUTH: Supabase signInWithPassword returned no user');
      return null;
    }

    const user = {
      id: data.user.id,
      email: data.user.email || email,
      name: data.user.user_metadata?.full_name || email,
      provider: 'supabase',
    };

    setCurrentSession(user);
    console.log('EMAIL_AUTH: Supabase login successful', user);
    return user;
  } catch (error: any) {
    console.log('EMAIL_AUTH: Supabase login exception:', error.message);
    return null;
  }
}

// Logout
export async function logout(): Promise<void> {
  try {
    console.log('AUTH: Logging out');
    
    // Sign out from Firebase
    await logoutFromFirebase();

    // Sign out from Supabase if configured
    if (isSupabaseConfigured()) {
      await supabase.auth.signOut();
    }

    clearSession();
  } catch (error: any) {
    console.error('LOGOUT_ERROR:', {
      message: error.message,
      stack: error.stack,
    });
    throw error;
  }
}
