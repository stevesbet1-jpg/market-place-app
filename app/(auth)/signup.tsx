import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, LogBox } from 'react-native';

// Suppress expected secondary-request network errors that don't affect Firebase auth.
// Supabase may be paused or unreachable; those failures are logged as warnings only.
LogBox.ignoreLogs([
  'Network request failed',
  'TypeError: Network request failed',
]);
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { LuxuryColors, LuxurySpacing, LuxuryBorderRadius, LuxuryFontSize, LuxuryGradients, LuxuryShadow } from '../../constants/luxuryTheme';
import { validatePassword } from './authStorage';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { registerWithFirebaseEmail, isFirebaseConfigured } from '../../lib/firebaseAuth';
import { getFirebaseConfigStatus } from '../../lib/firebase';
import {
  SecurePasswordInput,
  type SecurePasswordInputRef,
} from '../../components/SecurePasswordInput';

export default function SignupScreen() {
  const insets = useSafeAreaInsets();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordInputRef = useRef<SecurePasswordInputRef>(null);
  const confirmInputRef = useRef<SecurePasswordInputRef>(null);

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
    const suggestedPassword = generateStrongPassword();

    // Clear first so hidden dots visually disappear, then set new value
    setPassword('');
    setConfirmPassword('');

    requestAnimationFrame(() => {
      setPassword(suggestedPassword);
      setConfirmPassword(suggestedPassword);

      requestAnimationFrame(() => {
        // iOS: force native UITextField to refresh its secure text dots
        passwordInputRef.current?.refresh(suggestedPassword);
        confirmInputRef.current?.refresh(suggestedPassword);
      });
    });
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
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
      Alert.alert('Invalid Email', 'Please enter a valid email.');
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
      console.error('[SignUp] Firebase NOT configured. Missing:', cfgStatus.missing);
      console.error('[SignUp] Placeholders:', cfgStatus.placeholders);
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

      if (!firebaseResult.success) {
        console.error('[SignUp] Firebase registration FAILED:', firebaseResult.error);
        // Map Firebase error codes to user-friendly messages
        Alert.alert('Signup Failed', firebaseResult.error || 'Unable to create account. Please try again.');
        return;
      }

      console.log('[SignUp] Firebase registration SUCCESS ✅ UID:', firebaseResult.userId);

      // ── SECONDARY: Supabase profile (fire-and-forget, truly non-blocking) ─
      // Show "Account Created" immediately — do NOT await these calls.
      // If Supabase is paused/unreachable the Firebase account still works.
      if (isSupabaseConfigured()) {
        supabase.auth
          .signUp({
            email: normalizedEmail,
            password,
            options: { data: { full_name: fullName.trim() } },
          })
          .then(({ error }) => {
            if (error) console.warn('[SignUp] Supabase secondary (non-critical):', error.message);
            else console.log('[SignUp] Supabase secondary success.');
          })
          .catch((err: any) =>
            console.warn('[SignUp] Supabase secondary exception (non-critical):', err.message)
          );

        supabase.functions
          .invoke('send-signup-email', {
            body: { email: normalizedEmail, fullName: fullName.trim() },
          })
          .then(({ error }) => {
            if (error) console.warn('[SignUp] Welcome email non-critical:', error);
            else console.log('[SignUp] Welcome email sent.');
          })
          .catch((err: any) =>
            console.warn('[SignUp] Welcome email exception (non-critical):', err.message)
          );
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
      console.error('[SignUp] UNCAUGHT EXCEPTION:', error.message);
      if (error?.code) console.error('[SignUp]   code:', error.code);
      if (error?.stack) console.error('[SignUp]   stack:', error.stack);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
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
                visible={showConfirmPassword}
                onToggleVisibility={() => setShowConfirmPassword((prev) => !prev)}
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
});
