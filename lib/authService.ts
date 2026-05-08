import Constants from 'expo-constants';
import * as AppleAuthentication from 'expo-apple-authentication';
import { socialLogin, loginUser, setCurrentSession, clearSession } from '../app/(auth)/authStorage';
import { isSupabaseConfigured, supabase } from './supabase';

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
export async function loginWithApple(): Promise<any> {
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
        return user;
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

    const mockEmail = credential.email || 'apple_user@example.com';
    const providerId = credential.user || `apple_${Date.now()}`;
    
    const user = await socialLogin('apple', mockEmail.toLowerCase(), providerId);
    setCurrentSession(user);
    console.log('APPLE_AUTH: Real login successful', user);
    return user;
  } catch (error: any) {
    console.error('APPLE_AUTH_ERROR:', {
      code: error.code,
      message: error.message,
      stack: error.stack,
    });
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
    console.log('EMAIL_AUTH: Attempting login');
    
    const user = await loginUser(email, password);
    setCurrentSession(user);
    console.log('EMAIL_AUTH: Login successful', user);
    return user;
  } catch (error: any) {
    console.error('EMAIL_AUTH_ERROR:', {
      message: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

// Logout
export async function logout(): Promise<void> {
  try {
    console.log('AUTH: Logging out');
    
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
