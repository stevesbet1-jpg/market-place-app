import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, Platform as OS } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { LuxuryColors, LuxurySpacing, LuxuryBorderRadius, LuxuryFontSize, LuxuryGradients, LuxuryShadow } from '../../constants/luxuryTheme';
import * as WebBrowser from 'expo-web-browser';
import * as GoogleProvider from 'expo-auth-session/providers/google';
import { checkEmailExists, loginUser } from './authStorage';
import { loginWithApple, loginWithEmail } from '../../lib/authService';
import { signInWithFirebaseGoogle } from '../../lib/firebaseAuth';
import { upsertUserProfile } from '../../lib/userProfile';
import {
  SecurePasswordInput,
  type SecurePasswordInputRef,
} from '../../components/SecurePasswordInput';
import { ScreenEntrance } from '../../components/ui/ScreenEntrance';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
// Both IDs are required on iOS. Fallback strings prevent the hook from throwing
// when env vars are missing — the GOOGLE_CONFIGURED guard blocks promptAsync.
const GOOGLE_CONFIGURED = !!(GOOGLE_WEB_CLIENT_ID && GOOGLE_IOS_CLIENT_ID);
const _hookWebClientId = GOOGLE_WEB_CLIENT_ID || 'not-configured';
const _hookIosClientId = GOOGLE_IOS_CLIENT_ID || GOOGLE_WEB_CLIENT_ID || 'not-configured';
// Derive the reverse-DNS scheme redirect URI from the iOS OAuth client ID.
// Google automatically authorises this URI for iOS clients, and on iOS,
// ASWebAuthenticationSession intercepts the callback scheme without requiring
// it to be registered in Expo Go's Info.plist — fixing Error 400 in Expo Go.
const _iosClientPrefix = GOOGLE_IOS_CLIENT_ID?.replace('.apps.googleusercontent.com', '') ?? '';
const _iosRedirectUri = (Platform.OS === 'ios' && _iosClientPrefix)
  ? `com.googleusercontent.apps.${_iosClientPrefix}:/oauthredirect`
  : undefined;
console.log('[GoogleSignIn] iOS redirect URI:', _iosRedirectUri ?? 'not applicable');

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const passwordInputRef = useRef<SecurePasswordInputRef>(null);

  const [, googleResponse, googlePromptAsync] = GoogleProvider.useAuthRequest({
    webClientId: _hookWebClientId,
    iosClientId: _hookIosClientId,
    selectAccount: true,
    ...(_iosRedirectUri ? { redirectUri: _iosRedirectUri } : {}),
  });

  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const idToken = googleResponse.authentication?.idToken ?? null;
      const accessToken = googleResponse.authentication?.accessToken ?? null;
      if (!idToken && !accessToken) {
        console.warn('[GoogleSignIn] No token in authentication response');
        Alert.alert('Sign In Failed', 'Could not get Google token. Please try again.');
        setIsGoogleLoading(false);
        return;
      }
      signInWithFirebaseGoogle(idToken, accessToken)
        .then(async (result) => {
          if (result.success) {
            if (result.userId) {
              const saved = await upsertUserProfile(result.userId, {
                email: result.email ?? null,
                fullName: result.displayName ?? null,
                photoURL: result.photoURL ?? null,
                provider: 'google',
              });
              if (!saved) {
                Alert.alert(
                  'Profile Save Failed',
                  'Your Google account was verified but your profile could not be saved. Please check your connection and try again.'
                );
                return;
              }
            }
            router.replace('/(tabs)');
          }
        })
        .catch((err: any) => {
          console.warn('[GoogleSignIn] Firebase credential failed:', err?.message);
          let msg = 'Could not sign in with Google. Please try again.';
          if (err?.message === 'GOOGLE_ACCOUNT_EXISTS_DIFFERENT_CREDENTIAL') {
            msg = 'An account already exists with a different sign-in method. Please use email/password.';
          } else if (err?.message === 'NETWORK_ERROR') {
            msg = 'Network error. Please check your connection and try again.';
          } else if (String(err?.message || '').includes('permission') || String(err?.message || '').includes('firestore')) {
            msg = 'Signed in, but could not initialize your profile. Please try again.';
          }
          Alert.alert('Sign In Failed', msg);
        })
        .finally(() => setIsGoogleLoading(false));
    } else if (googleResponse?.type === 'error') {
      console.warn('[GoogleSignIn] Auth flow error:', googleResponse.error);
      setIsGoogleLoading(false);
    } else if (googleResponse?.type === 'dismiss' || googleResponse?.type === 'cancel') {
      setIsGoogleLoading(false);
    }
  }, [googleResponse]);

  const handleGoogleSignIn = async () => {
    if (!GOOGLE_CONFIGURED) {
      Alert.alert(
        'Google Sign-In Not Configured',
        'Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID and EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID in your .env file, then restart Expo with --clear.'
      );
      return;
    }
    try {
      setIsGoogleLoading(true);
      await googlePromptAsync();
    } catch (err: any) {
      console.warn('[GoogleSignIn] promptAsync failed:', err?.message);
      Alert.alert('Sign In Failed', 'Could not open Google sign-in. Please try again.');
      setIsGoogleLoading(false);
    }
  };

  const handleForgotPassword = () => {
    router.push('/(auth)/reset-password');
  };

  const handleAppleSignIn = async () => {
    try {
      const result = await loginWithApple();
      if (!result.success && result.cancelled) return; // user tapped Cancel — do nothing
      if (result.success) router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Login failed', 'Please try again.');
    }
  };


  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSignIn = async () => {
    if (!email.trim()) {
      Alert.alert('Email Required', 'Please enter your email.');
      return;
    }
    if (!validateEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email.');
      return;
    }
    if (!password.trim()) {
      Alert.alert('Password Required', 'Please enter your password.');
      return;
    }

    try {
      const user = await loginWithEmail({ email, password, loginUser });
      if (user?.id) {
        upsertUserProfile(user.id, {
          email: user.email ?? email,
          fullName: null,
          photoURL: null,
          provider: 'email',
        }).catch((err: any) => console.warn('[SignIn] Profile save failed (non-critical):', err?.message));
      }
      router.replace('/(tabs)');
    } catch (error: any) {
      const message = error?.message || 'Please try again.';
      Alert.alert('Login failed', message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Premium Logo */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>M</Text>
          </View>
        </View>

        {/* Title */}
        <ScreenEntrance delay={100}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to your membership</Text>
          </View>

        {/* Compact Form */}
        <View style={styles.form}>
          {/* Email Input */}
          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={20} color={LuxuryColors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={LuxuryColors.textTertiary}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <SecurePasswordInput
              ref={passwordInputRef}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                passwordInputRef.current?.refresh(text);
              }}
              visible={showPassword}
              onToggleVisibility={() => setShowPassword(!showPassword)}
              placeholder="Password"
              placeholderTextColor={LuxuryColors.textTertiary}
              iconColor={LuxuryColors.textSecondary}
              wrapperStyle={styles.inputWrapper}
              inputStyle={styles.input}
            />
          </View>

          {/* Forgot Password */}
          <TouchableOpacity 
            style={styles.forgotPassword}
            onPress={handleForgotPassword}
            activeOpacity={0.7}
          >
            <Text style={styles.forgotPasswordText}>Forgot password?</Text>
          </TouchableOpacity>

          {/* Sign In Button */}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleSignIn}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={LuxuryGradients.goldDeep}
              style={styles.gradientButton}
            >
              <Text style={styles.primaryButtonText}>Sign In</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Social Login Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social Login Buttons */}
          <TouchableOpacity
            style={styles.socialButton}
            onPress={handleAppleSignIn}
            activeOpacity={0.8}
          >
            <Ionicons name="logo-apple" size={24} color={LuxuryColors.textPrimary} />
            <Text style={styles.socialButtonText}>Continue with Apple</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.socialButton, (isGoogleLoading || !GOOGLE_CONFIGURED) && { opacity: 0.45 }]}
            onPress={handleGoogleSignIn}
            activeOpacity={0.8}
            disabled={isGoogleLoading}
          >
            <Ionicons name="logo-google" size={22} color={LuxuryColors.textPrimary} />
            <Text style={styles.socialButtonText}>
              {isGoogleLoading ? 'Connecting…' : 'Continue with Google'}
            </Text>
          </TouchableOpacity>


          {/* Continue as Guest */}
          <TouchableOpacity
            style={styles.guestButton}
            onPress={() => router.replace('/(tabs)')}
            activeOpacity={0.8}
          >
            <Ionicons name="person-outline" size={20} color={LuxuryColors.gold} />
            <Text style={styles.guestButtonText}>Continue as Guest</Text>
          </TouchableOpacity>

          {/* Create Account Link */}
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => router.push('/(auth)/signup')}
            activeOpacity={0.7}
          >
            <Text style={styles.linkText}>
              Don't have an account? <Text style={styles.linkHighlight}>Create Account</Text>
            </Text>
          </TouchableOpacity>
        </View>
        </ScreenEntrance>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LuxuryColors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: LuxurySpacing.xl,
    paddingVertical: LuxurySpacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: LuxurySpacing.lg,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: LuxuryColors.surfaceLight,
    borderWidth: 2,
    borderColor: LuxuryColors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    ...LuxuryShadow.gold,
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: LuxuryColors.gold,
  },
  titleContainer: {
    marginBottom: LuxurySpacing.xl,
    alignItems: 'center',
  },
  title: {
    fontSize: LuxuryFontSize.xxxl,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
    marginBottom: LuxurySpacing.sm,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: LuxuryFontSize.md,
    color: LuxuryColors.textSecondary,
    fontWeight: '400',
    textAlign: 'center',
  },
  form: {
    gap: LuxurySpacing.lg,
  },
  inputContainer: {
    gap: LuxurySpacing.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LuxuryColors.surfaceLight,
    borderWidth: 1,
    borderColor: LuxuryColors.divider,
    borderRadius: LuxuryBorderRadius.lg,
    paddingHorizontal: LuxurySpacing.md,
  },
  inputIcon: {
    marginRight: LuxurySpacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: LuxurySpacing.lg,
    fontSize: LuxuryFontSize.md,
    color: LuxuryColors.textPrimary,
    fontWeight: '500',
  },
  eyeIcon: {
    padding: LuxurySpacing.sm,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
  },
  forgotPasswordText: {
    color: LuxuryColors.violet,
    fontSize: LuxuryFontSize.sm,
    fontWeight: '600',
  },
  primaryButton: {
    borderRadius: LuxuryBorderRadius.xl,
    overflow: 'hidden',
    height: 56,
    marginTop: LuxurySpacing.sm,
    ...LuxuryShadow.medium,
  },
  gradientButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: LuxuryFontSize.lg,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.md,
    marginVertical: LuxurySpacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: LuxuryColors.divider,
  },
  dividerText: {
    color: LuxuryColors.textSecondary,
    fontSize: LuxuryFontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  socialButton: {
    backgroundColor: LuxuryColors.surfaceLight,
    borderWidth: 1,
    borderColor: LuxuryColors.divider,
    borderRadius: LuxuryBorderRadius.lg,
    paddingVertical: LuxurySpacing.lg,
    paddingHorizontal: LuxurySpacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: LuxurySpacing.sm,
  },
  socialButtonText: {
    color: LuxuryColors.textPrimary,
    fontSize: LuxuryFontSize.md,
    fontWeight: '600',
  },
  guestButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: LuxuryColors.gold,
    borderRadius: LuxuryBorderRadius.lg,
    paddingVertical: LuxurySpacing.lg,
    paddingHorizontal: LuxurySpacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: LuxurySpacing.sm,
  },
  guestButtonText: {
    color: LuxuryColors.gold,
    fontSize: LuxuryFontSize.md,
    fontWeight: '600',
  },
  linkButton: {
    alignItems: 'center',
    marginTop: LuxurySpacing.md,
  },
  linkText: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textSecondary,
  },
  linkHighlight: {
    color: LuxuryColors.gold,
    fontWeight: '700',
  },
});
