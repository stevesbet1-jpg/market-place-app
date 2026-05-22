import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, Keyboard } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { LuxuryColors, LuxurySpacing, LuxuryBorderRadius, LuxuryFontSize, LuxuryGradients, LuxuryShadow } from '../../constants/luxuryTheme';
import * as WebBrowser from 'expo-web-browser';
import * as GoogleProvider from 'expo-auth-session/providers/google';
import { validatePassword } from './authStorage';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { registerWithFirebaseEmail, signInWithFirebaseGoogle, isFirebaseConfigured } from '../../lib/firebaseAuth';
import { getFirebaseConfigStatus } from '../../lib/firebase';
import { upsertUserProfile } from '../../lib/userProfile';
import {
  SecurePasswordInput,
  type SecurePasswordInputRef,
} from '../../components/SecurePasswordInput';

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

export default function SignupScreen() {
  const insets = useSafeAreaInsets();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const passwordInputRef = useRef<SecurePasswordInputRef>(null);
  const confirmInputRef = useRef<SecurePasswordInputRef>(null);

  const [, googleResponse, googlePromptAsync] = GoogleProvider.useAuthRequest({
    webClientId: _hookWebClientId,
    iosClientId: _hookIosClientId,
    ...(_iosRedirectUri ? { redirectUri: _iosRedirectUri } : {}),
  });

  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const idToken = googleResponse.authentication?.idToken ?? null;
      const accessToken = googleResponse.authentication?.accessToken ?? null;
      if (!idToken && !accessToken) {
        console.warn('[GoogleSignIn] No token in authentication response');
        Alert.alert('Sign Up Failed', 'Could not get Google token. Please try again.');
        setIsGoogleLoading(false);
        return;
      }
      signInWithFirebaseGoogle(idToken, accessToken)
        .then((result) => {
          if (result.success) {
            if (result.userId) {
              upsertUserProfile(result.userId, {
                email: result.email ?? null,
                fullName: result.displayName ?? null,
                photoURL: result.photoURL ?? null,
                provider: 'google',
              }).catch((err: any) => console.warn('[GoogleSignUp] Profile save failed (non-critical):', err?.message));
            }
            router.replace('/(tabs)');
          }
        })
        .catch((err: any) => {
          console.warn('[GoogleSignIn] Firebase credential failed:', err?.message);
          let msg = 'Could not sign up with Google. Please try again.';
          if (err?.message === 'GOOGLE_ACCOUNT_EXISTS_DIFFERENT_CREDENTIAL') {
            msg = 'An account already exists with a different sign-in method. Please use email/password.';
          } else if (err?.message === 'NETWORK_ERROR') {
            msg = 'Network error. Please check your connection and try again.';
          }
          Alert.alert('Sign Up Failed', msg);
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
      Alert.alert('Sign Up Failed', 'Could not open Google sign-in. Please try again.');
      setIsGoogleLoading(false);
    }
  };

  const generateStrongPassword = () => {
    const length = Math.floor(Math.random() * 5) + 14; // 14-18 chars
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    const allChars = uppercase + lowercase + numbers + symbols;
    let password = '';
    
    // Ensure at least one of each type
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  };

  const handleSuggestPassword = () => {
    Keyboard.dismiss();
    const suggestedPassword = generateStrongPassword();
    setPassword(suggestedPassword);
    setConfirmPassword(suggestedPassword);
  };

  const validateEmail = (email: string) => {
    // Requires: local@domain.tld
    // - local: letters, numbers, dots, underscores, percent, plus, hyphens
    // - domain: letters, numbers, dots, hyphens
    // - TLD: 2+ letters only (rejects .c, .1, missing TLD)
    const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email.trim());
  };

  const handleSignUp = async () => {
    if (!fullName.trim()) {
      Alert.alert('Name Required', 'Please enter your full name.');
      return;
    }
    if (!email.trim()) {
      Alert.alert('Email Required', 'Please enter your email.');
      return;
    }
    if (!validateEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a real and valid email address.');
      return;
    }
    if (!password.trim()) {
      Alert.alert('Password Required', 'Please enter a password.');
      return;
    }
    
    // Validate password rules
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      Alert.alert('Invalid Password', passwordValidation.error);
      return;
    }
    
    if (!confirmPassword.trim()) {
      Alert.alert('Confirm Password', 'Please confirm your password.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return;
    }

    // ── Firebase config gate (primary auth) ───────────────────────
    if (!isFirebaseConfigured()) {
      const cfgStatus = getFirebaseConfigStatus();
      console.warn('[SignUp] Firebase NOT configured. Missing:', cfgStatus.missing);
      console.warn('[SignUp] Placeholders:', cfgStatus.placeholders);
      Alert.alert('Error', 'Account creation is unavailable. Firebase is not configured.');
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    try {
      // ── Diagnostics ──────────────────────────────────────────────
      const cfgStatus = getFirebaseConfigStatus();
      console.log('[SignUp] ============================================');
      console.log('[SignUp] === SIGNUP ATTEMPT ===');
      console.log('[SignUp] email (raw)        :', email);
      console.log('[SignUp] email (normalized) :', normalizedEmail);
      console.log('[SignUp] Firebase isReady   :', cfgStatus.isReady);
      console.log('[SignUp] Firebase projectId :', cfgStatus.projectId);
      console.log('[SignUp] Firebase authDomain:', cfgStatus.authDomain);
      console.log('[SignUp] Firebase apiKey    :', cfgStatus.apiKey);
      console.log('[SignUp] Timestamp          :', new Date().toISOString());

      // ── PRIMARY: Firebase Auth ────────────────────────────────────
      console.log('[SignUp] Calling registerWithFirebaseEmail (primary)...');
      const t0 = Date.now();
      const firebaseResult = await registerWithFirebaseEmail(normalizedEmail, password);
      const elapsed = Date.now() - t0;

      console.log('[SignUp] registerWithFirebaseEmail returned in', elapsed, 'ms');
      console.log('[SignUp] Firebase result:', JSON.stringify(firebaseResult));

      // registerWithFirebaseEmail throws on any failure — reaching here means success.
      console.log('[SignUp] Firebase registration SUCCESS ✅ UID:', firebaseResult.userId);

      // ── Save user profile to Firestore (fire-and-forget) ─────────
      if (firebaseResult.userId) {
        upsertUserProfile(firebaseResult.userId, {
          email: normalizedEmail,
          fullName: fullName.trim() || null,
          photoURL: null,
          provider: 'email',
        }).catch((err: any) => console.warn('[SignUp] Profile save failed (non-critical):', err?.message));
      }

      // ── SECONDARY: Supabase profile (fire-and-forget, truly non-blocking) ─
      // Show "Account Created" immediately — do NOT await these calls.
      // If Supabase is paused/unreachable the Firebase account still works.
      if (isSupabaseConfigured()) {
        // Outer try-catch handles synchronous throws from supabase getters.
        // Promise.allSettled never rejects — all network failures are caught.
        try {
          Promise.allSettled([
            supabase.auth.signUp({
              email: normalizedEmail,
              password,
              options: { data: { full_name: fullName.trim() } },
            }),
            supabase.functions.invoke('send-signup-email', {
              body: { email: normalizedEmail, fullName: fullName.trim() },
            }),
          ]).then((results) => {
            const [signUpResult, emailResult] = results;
            if (signUpResult.status === 'rejected') {
              console.warn('[SignUp] Post-signup sync failed, account already created.', signUpResult.reason?.message);
            } else if (signUpResult.value?.error) {
              console.warn('[SignUp] Supabase secondary (non-critical):', signUpResult.value.error.message);
            } else {
              console.log('[SignUp] Supabase secondary success.');
            }
            if (emailResult.status === 'rejected') {
              console.warn('[SignUp] Post-signup sync failed, account already created.', emailResult.reason?.message);
            } else if (emailResult.value?.error) {
              console.warn('[SignUp] Welcome email (non-critical):', emailResult.value.error);
            } else {
              console.log('[SignUp] Welcome email sent.');
            }
          }).catch((err: any) => {
            console.warn('[SignUp] Post-signup sync failed, account already created.', err?.message);
          });
        } catch (syncErr: any) {
          console.warn('[SignUp] Post-signup sync failed, account already created.', syncErr?.message);
        }
      } else {
        console.log('[SignUp] Supabase not configured — skipping secondary calls.');
      }

      // ── Show success immediately (Firebase is the source of truth) ─
      Alert.alert(
        'Account Created',
        'Your account has been created successfully.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
      );
    } catch (error: any) {
      // Expected auth errors — no console.error, no red RN overlay
      switch (error.message) {
        case 'EMAIL_EXISTS':
          Alert.alert(
            'Account already exists',
            'This email is already registered. Please sign in or reset your password.'
          );
          return;
        case 'WEAK_PASSWORD':
          Alert.alert('Weak password', 'Password must be stronger.');
          return;
        case 'INVALID_EMAIL':
          Alert.alert('Invalid email', 'Please enter a valid email.');
          return;
        case 'NETWORK_ERROR':
          Alert.alert('Network error', 'Check your internet connection and try again.');
          return;
        case 'TOO_MANY_REQUESTS':
          Alert.alert('Too many attempts', 'Please wait a moment and try again.');
          return;
        default:
          // Truly unexpected — only case where console.error is appropriate
          console.error('[SignUp] Unexpected error:', error.message);
          Alert.alert('Signup failed', 'Something went wrong. Please try again.');
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.backgroundGradient} />
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Back Button */}
        <TouchableOpacity
          style={[styles.backButton, { top: insets.top + LuxurySpacing.lg }]}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={LuxuryColors.textPrimary} />
        </TouchableOpacity>

        {/* Premium Logo */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>M</Text>
          </View>
        </View>

        {/* Membership Application Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Request Membership</Text>
          <Text style={styles.subtitle}>Join the exclusive travel community</Text>
        </View>

        {/* Glassmorphism Form Card */}
        <View style={styles.card}>
          <View style={styles.form}>
            {/* Full Name Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Full Name</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={20} color={LuxuryColors.textTertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="John Doe"
                  placeholderTextColor={LuxuryColors.textTertiary}
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email Address</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={20} color={LuxuryColors.textTertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="your@email.com"
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
              <Text style={styles.label}>Password</Text>
              <SecurePasswordInput
                ref={passwordInputRef}
                value={password}
                onChangeText={setPassword}
                visible={showPassword}
                onToggleVisibility={() => setShowPassword((prev) => !prev)}
                placeholder="••••••••"
                placeholderTextColor={LuxuryColors.textTertiary}
                wrapperStyle={styles.inputWrapper}
                inputStyle={styles.input}
                toggleStyle={styles.eyeIcon}
                iconColor={LuxuryColors.textTertiary}
              />
            </View>

            {/* Confirm Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm Password</Text>
              <SecurePasswordInput
                ref={confirmInputRef}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                visible={showPassword}
                onToggleVisibility={() => setShowPassword((prev) => !prev)}
                placeholder="••••••••"
                placeholderTextColor={LuxuryColors.textTertiary}
                wrapperStyle={styles.inputWrapper}
                inputStyle={styles.input}
                toggleStyle={styles.eyeIcon}
                iconColor={LuxuryColors.textTertiary}
              />
            </View>

            {/* Suggest Password Button */}
            <TouchableOpacity
              style={styles.suggestPasswordButton}
              onPress={handleSuggestPassword}
              activeOpacity={0.8}
            >
              <Ionicons name="key-outline" size={18} color={LuxuryColors.gold} />
              <Text style={styles.suggestPasswordText}>Suggest strong password</Text>
            </TouchableOpacity>

            {/* Submit Application Button */}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleSignUp}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={LuxuryGradients.violetGold}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradientButton}
              >
                <Text style={styles.primaryButtonText}>Submit Application</Text>
                <Ionicons name="arrow-forward" size={24} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>

            {/* Google Sign-Up Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Sign-Up Button */}
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

            {/* Back to Login Link */}
            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Text style={styles.linkText}>
                Already a member? <Text style={styles.linkHighlight}>Sign In</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LuxuryColors.surface,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: LuxuryColors.surface,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: LuxurySpacing.xl,
    paddingVertical: LuxurySpacing.xl,
  },
  backButton: {
    position: 'absolute',
    left: LuxurySpacing.md,
    zIndex: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: LuxurySpacing.lg,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: LuxuryColors.surfaceLight,
    borderWidth: 2,
    borderColor: LuxuryColors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    ...LuxuryShadow.gold,
  },
  logoText: {
    fontSize: 36,
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
  card: {
    backgroundColor: LuxuryColors.glass,
    borderWidth: 1,
    borderColor: LuxuryColors.glassBorder,
    borderRadius: LuxuryBorderRadius.xxxl,
    padding: LuxurySpacing.xl,
    ...LuxuryShadow.soft,
  },
  form: {
    gap: LuxurySpacing.lg,
  },
  inputContainer: {
    gap: LuxurySpacing.xs,
  },
  label: {
    fontSize: LuxuryFontSize.xs,
    color: LuxuryColors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
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
  primaryButton: {
    borderRadius: LuxuryBorderRadius.xl,
    overflow: 'hidden',
    height: 64,
    marginTop: LuxurySpacing.sm,
    ...LuxuryShadow.medium,
  },
  gradientButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: LuxurySpacing.sm,
  },
  primaryButtonText: {
    color: LuxuryColors.textPrimary,
    fontSize: LuxuryFontSize.lg,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  suggestPasswordButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: LuxuryColors.gold,
    borderRadius: LuxuryBorderRadius.lg,
    paddingVertical: LuxurySpacing.md,
    paddingHorizontal: LuxurySpacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: LuxurySpacing.sm,
    marginTop: LuxurySpacing.sm,
  },
  suggestPasswordText: {
    color: LuxuryColors.gold,
    fontSize: LuxuryFontSize.sm,
    fontWeight: '600',
  },
  linkButton: {
    alignItems: 'center',
    paddingVertical: LuxurySpacing.md,
  },
  linkText: {
    color: LuxuryColors.textTertiary,
    fontSize: LuxuryFontSize.sm,
    fontWeight: '500',
  },
  linkHighlight: {
    color: LuxuryColors.gold,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.md,
    marginVertical: LuxurySpacing.sm,
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
});
