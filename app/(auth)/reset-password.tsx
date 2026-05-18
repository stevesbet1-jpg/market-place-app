import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  LuxuryColors, LuxurySpacing, LuxuryBorderRadius,
  LuxuryFontSize, LuxuryGradients,
} from '../../constants/luxuryTheme';
import {
  sendPasswordResetViaBackend,
  sendPasswordChangedEmailViaBackend,
  warmUpBackend,
  confirmFirebasePasswordReset,
  verifyResetCode,
  isFirebaseConfigured,
} from '../../lib/firebaseAuth';

/**
 * STRICT MODE SECURITY MODEL
 * ==========================
 * send     → email input + "Send Reset Link" (default, always safe)
 * verifying→ ActivityIndicator while verifying oobCode (transient)
 * reset    → new password form (ONLY after verifyPasswordResetCode succeeds)
 * success  → inline success + "Go to Sign In" (after confirmPasswordReset succeeds)
 * error    → error banner + "Request New Link" (when oobCode verification fails)
 *
 * NO mode other than 'send' can be reached without a VALID, VERIFIED oobCode.
 * Opening /reset-password directly from login screen ALWAYS starts in 'send' mode.
 */
type ResetMode = 'send' | 'verifying' | 'reset' | 'success' | 'error';

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const { oobCode, mode } = useLocalSearchParams<{ oobCode?: string; mode?: string }>();

  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [screenMode, setScreenMode] = useState<ResetMode>('send');
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // ─── Bulletproof duplicate-send guard ──────────────────────────────
  // Prevents race conditions when user double-taps the button.
  const sendAttemptRef = useRef(false);

  // ─── On mount: determine mode from deep link params ────────────────
  useEffect(() => {
    const code = typeof oobCode === 'string' && oobCode.trim().length > 0
      ? oobCode.trim()
      : undefined;
    const linkMode = typeof mode === 'string' ? mode : undefined;

    console.log('[ResetPassword] Mount. oobCode:', code ? 'present' : 'missing', '| mode:', linkMode);

    if (code) {
      // We have an oobCode — enter verifying mode and validate it
      setScreenMode('verifying');
      setErrorMessage(null);
      verifyCodeAndEnterReset(code);
    } else {
      // No oobCode — FORCE send mode, no matter what
      setScreenMode('send');
      setErrorMessage(null);
      console.log('[ResetPassword] No oobCode. Screen locked to send mode.');
    }
  }, [oobCode, mode]);

  // ─── Verify oobCode via Firebase ─────────────────────────────────
  const verifyCodeAndEnterReset = async (code: string) => {
    console.log('[ResetPassword] Verifying oobCode:', code.substring(0, 8) + '...');

    try {
      const associatedEmail = await verifyResetCode(code);
      setVerifiedEmail(associatedEmail);
      setScreenMode('reset');
      setErrorMessage(null);
      console.log('[ResetPassword] oobCode VERIFIED. Email:', associatedEmail);
    } catch (error: any) {
      const msg = error?.message || 'This reset link is invalid or has expired.';
      setVerifiedEmail(null);
      setScreenMode('error');
      setErrorMessage(msg);
      console.log('[ResetPassword] oobCode verification FAILED:', msg);
    }
  };

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // ─── SEND RESET EMAIL — Backend ONLY, no fallback ──
  const handleSendResetLink = async () => {
    // Guard 1: already in flight
    if (sendAttemptRef.current) {
      console.log('[ResetPassword] Ignoring duplicate click — send already in progress');
      return;
    }

    // Guard 2: basic validation
    if (!email.trim()) {
      Alert.alert('Email Required', 'Please enter your email address.');
      return;
    }
    if (!validateEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    if (!isFirebaseConfigured()) {
      Alert.alert(
        'Firebase Not Configured',
        'Password reset is not available. Please add Firebase credentials to your .env file.'
      );
      return;
    }

    // Lock the gate
    sendAttemptRef.current = true;
    setIsLoading(true);

    const t0 = Date.now();
    const normalizedEmail = email.trim().toLowerCase();
    console.log('[ResetPassword] === SEND RESET EMAIL ===');
    console.log(`[ResetPassword] T+0ms    User tapped Send Reset Link`);
    console.log(`[ResetPassword] T+0ms    Email: ${normalizedEmail}`);
    console.log(`[ResetPassword] T+0ms    EXPO_PUBLIC_RESET_API_URL:`, process.env.EXPO_PUBLIC_RESET_API_URL || '(using default)');

    try {
      // ── 1. Warm up Render backend (free tier sleeps) ─────
      console.log(`[ResetPassword] T+${Date.now() - t0}ms  Warming up backend...`);
      await warmUpBackend();

      // ── 2. Call Resend backend API ──────────────────────────
      const backendResult = await sendPasswordResetViaBackend(normalizedEmail);
      console.log('[RESET EMAIL RESULT]', backendResult);

      if (backendResult.success && backendResult.emailId) {
        const t1 = Date.now();
        console.log(`[ResetPassword] T+${t1 - t0}ms  Resend backend SUCCESS. emailId: ${backendResult.emailId}`);
        console.log('[RESET EMAIL]', true, backendResult.emailId, normalizedEmail);
        Alert.alert(
          'Reset Link Sent',
          'Reset link sent. Check your email.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
        return;
      }

      // Backend returned error — show exact error, do NOT show success
      console.error('[EMAIL ERROR]', backendResult.error || 'Unknown backend error');
      console.log('[RESET EMAIL]', false, null, normalizedEmail);
      Alert.alert(
        'Error',
        backendResult.error || 'Failed to send reset email. Please try again.'
      );

    } catch (error: any) {
      const tFail = Date.now();
      const errorMsg = error?.message || 'Failed to send reset email. Please try again.';
      console.error('[EMAIL ERROR]', errorMsg);
      console.log(`[ResetPassword] T+${tFail - t0}ms  Flow FAILED:`, errorMsg);
      Alert.alert('Error', errorMsg);
    } finally {
      setIsLoading(false);
      sendAttemptRef.current = false;
      console.log('[ResetPassword] Send gate reset. Button is active again.');
    }
  };

  // ─── CONFIRM NEW PASSWORD ────────────────────────────────────────
  const handleConfirmReset = async () => {
    const code = typeof oobCode === 'string' && oobCode.trim().length > 0
      ? oobCode.trim()
      : null;

    if (!code) {
      Alert.alert('Error', 'Invalid reset link. Please request a new one.');
      setScreenMode('send');
      return;
    }
    if (!newPassword.trim()) {
      Alert.alert('Password Required', 'Please enter your new password.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Invalid Password', 'Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return;
    }
    if (!isFirebaseConfigured()) {
      Alert.alert('Error', 'Firebase is not configured.');
      return;
    }

    setIsLoading(true);
    console.log('[ResetPassword] Confirming password reset for:', verifiedEmail || 'unknown email');

    try {
      await confirmFirebasePasswordReset(code, newPassword);
      console.log('[PASSWORD_CHANGE] confirmPasswordReset success');

      // Defensive: if verifiedEmail was lost, re-extract it from the code
      let targetEmail = verifiedEmail;
      if (!targetEmail) {
        console.log('[ResetPassword] verifiedEmail missing — re-verifying code to extract email...');
        try {
          targetEmail = await verifyResetCode(code);
          console.log('[ResetPassword] Re-verified email from code:', targetEmail);
        } catch (e: any) {
          console.error('[ResetPassword] Could not re-verify code for email:', e.message);
        }
      }
      console.log('[PASSWORD_CHANGE] target email:', targetEmail);

      if (!targetEmail) {
        console.error('[PASSWORD_CHANGE] error: Missing verifiedEmail');
        Alert.alert('Error', 'Password was reset but we could not determine your email to send a confirmation.');
        setIsLoading(false);
        return;
      }

      console.log('[PASSWORD_CHANGE] sending confirmation email to:', targetEmail);
      const result = await sendPasswordChangedEmailViaBackend(targetEmail);
      console.log('[PASSWORD_CHANGE] confirmation email result:', result);

      if (result.success === true) {
        console.log('[PASSWORD_CHANGE] confirmation email sent. emailId:', result.emailId, '| recipient:', targetEmail);
        setScreenMode('success');
      } else {
        console.error('[PASSWORD_CHANGE] confirmation email failed');
        console.error('[PASSWORD_CHANGE] error:', result.error || 'Confirmation email failed');
        Alert.alert('Error', result.error || 'Password was reset but confirmation email failed.');
      }
    } catch (error: any) {
      console.error('[PASSWORD_CHANGE] error:', error.message || error);
      console.log('[ResetPassword] CONFIRM_RESET_ERROR:', error.message || error);
      const message = error?.message || 'Failed to reset password. The link may have expired.';
      Alert.alert('Error', message);
    } finally {
      setIsLoading(false);
    }
  };

  const goToLogin = () => {
    router.replace('/(auth)/login');
  };

  const requestNewLink = () => {
    setScreenMode('send');
    setErrorMessage(null);
    setVerifiedEmail(null);
    setNewPassword('');
    setConfirmPassword('');
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER: verifying mode
  // ═══════════════════════════════════════════════════════════════
  if (screenMode === 'verifying') {
    return (
      <View style={[styles.container, styles.centered, { paddingBottom: insets.bottom }]}>
        <ActivityIndicator size="large" color={LuxuryColors.gold} />
        <Text style={[styles.description, { marginTop: LuxurySpacing.lg }]}>
          Verifying reset link…
        </Text>
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER: success mode
  // ═══════════════════════════════════════════════════════════════
  if (screenMode === 'success') {
    return (
      <View style={[styles.container, styles.centered, { paddingBottom: insets.bottom }]}>
        <View style={styles.successIcon}>
          <Ionicons name="checkmark-circle" size={64} color={LuxuryColors.gold} />
        </View>
        <Text style={styles.title}>Password Updated</Text>
        <Text style={[styles.description, { textAlign: 'center', marginTop: LuxurySpacing.md }]}>
          Your password has been reset successfully.{'\n'}
          Please sign in with your new password.
        </Text>
        <TouchableOpacity
          style={[styles.resetButton, { marginTop: LuxurySpacing.xl, width: '100%' }]}
          onPress={goToLogin}
          activeOpacity={0.8}
        >
          <LinearGradient colors={LuxuryGradients.goldDeep} style={styles.gradientButton}>
            <Text style={styles.resetButtonText}>Go to Sign In</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER: error mode
  // ═══════════════════════════════════════════════════════════════
  if (screenMode === 'error') {
    return (
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color={LuxuryColors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.title}>Reset Password</Text>
          </View>

          <View style={styles.errorBanner}>
            <Ionicons name="warning-outline" size={20} color="#FF6B6B" />
            <Text style={styles.errorBannerText}>
              {errorMessage || 'This reset link is invalid or has expired.'}
            </Text>
          </View>

          <Text style={[styles.description, { textAlign: 'center', marginBottom: LuxurySpacing.xl }]}>
            The link you used may have expired or already been used. Request a new one below.
          </Text>

          <TouchableOpacity
            style={styles.resetButton}
            onPress={requestNewLink}
            activeOpacity={0.8}
          >
            <LinearGradient colors={LuxuryGradients.goldDeep} style={styles.gradientButton}>
              <Text style={styles.resetButtonText}>Request New Link</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.backToLoginButton} onPress={goToLogin} activeOpacity={0.7}>
            <Text style={styles.backToLoginText}>
              <Text style={styles.backToLoginHighlight}>Back to Sign In</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER: send mode OR reset mode (shared shell)
  // ═══════════════════════════════════════════════════════════════
  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={LuxuryColors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Reset Password</Text>
        </View>

        {/* Description */}
        <View style={styles.descriptionContainer}>
          <Text style={styles.description}>
            {screenMode === 'reset' && verifiedEmail
              ? `Reset password for ${verifiedEmail}`
              : screenMode === 'reset'
              ? 'Enter your new password below.'
              : 'Enter your email and we will send you a reset link.'}
          </Text>
        </View>

        {/* Verified email banner (reset mode only) */}
        {screenMode === 'reset' && verifiedEmail && (
          <View style={styles.infoBanner}>
            <Ionicons name="shield-checkmark-outline" size={20} color={LuxuryColors.gold} />
            <Text style={styles.infoBannerText}>
              Reset code verified for {verifiedEmail}
            </Text>
          </View>
        )}

        {screenMode === 'reset' ? (
          <>
            {/* NEW PASSWORD FORM — ONLY shown after verified oobCode */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>New Password</Text>
              <View style={styles.inputWrapper}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={LuxuryColors.textSecondary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Enter new password (min 8 chars)"
                  placeholderTextColor={LuxuryColors.textSecondary}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((prev) => !prev)}
                  activeOpacity={0.7}
                  style={styles.toggleIcon}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={LuxuryColors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.inputWrapper}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={LuxuryColors.textSecondary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm new password"
                  placeholderTextColor={LuxuryColors.textSecondary}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((prev) => !prev)}
                  activeOpacity={0.7}
                  style={styles.toggleIcon}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={LuxuryColors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.resetButton, isLoading && styles.resetButtonDisabled]}
              onPress={handleConfirmReset}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <LinearGradient colors={LuxuryGradients.goldDeep} style={styles.gradientButton}>
                <Text style={styles.resetButtonText}>
                  {isLoading ? 'Resetting…' : 'Reset Password'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* EMAIL INPUT FORM — default, always safe */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputWrapper}>
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color={LuxuryColors.textSecondary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor={LuxuryColors.textSecondary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.resetButton, isLoading && styles.resetButtonDisabled]}
              onPress={handleSendResetLink}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <LinearGradient colors={LuxuryGradients.goldDeep} style={styles.gradientButton}>
                <Text style={styles.resetButtonText}>
                  {isLoading ? 'Sending…' : 'Send Reset Link'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity
          style={styles.backToLoginButton}
          onPress={goToLogin}
          activeOpacity={0.7}
        >
          <Text style={styles.backToLoginText}>
            Remember your password? <Text style={styles.backToLoginHighlight}>Sign In</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LuxuryColors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: LuxurySpacing.xl,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: LuxurySpacing.xl,
    paddingVertical: LuxurySpacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: LuxurySpacing.lg,
  },
  backButton: {
    padding: LuxurySpacing.sm,
    marginRight: LuxurySpacing.sm,
  },
  title: {
    fontSize: LuxuryFontSize.xl,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
  },
  descriptionContainer: {
    marginBottom: LuxurySpacing.xl,
  },
  description: {
    fontSize: LuxuryFontSize.md,
    color: LuxuryColors.textSecondary,
    lineHeight: 24,
  },
  successIcon: {
    marginBottom: LuxurySpacing.lg,
  },
  inputContainer: {
    marginBottom: LuxurySpacing.lg,
  },
  label: {
    fontSize: LuxuryFontSize.sm,
    fontWeight: '600',
    color: LuxuryColors.textPrimary,
    marginBottom: LuxurySpacing.sm,
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
  toggleIcon: {
    marginLeft: LuxurySpacing.sm,
    padding: LuxurySpacing.xs,
  },
  input: {
    flex: 1,
    paddingVertical: LuxurySpacing.lg,
    fontSize: LuxuryFontSize.md,
    color: LuxuryColors.textPrimary,
  },
  resetButton: {
    marginTop: LuxurySpacing.md,
    borderRadius: LuxuryBorderRadius.lg,
    overflow: 'hidden',
  },
  resetButtonDisabled: {
    opacity: 0.6,
  },
  gradientButton: {
    paddingVertical: LuxurySpacing.lg,
    paddingHorizontal: LuxurySpacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButtonText: {
    fontSize: LuxuryFontSize.md,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  backToLoginButton: {
    alignItems: 'center',
    marginTop: LuxurySpacing.xl,
  },
  backToLoginText: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textSecondary,
  },
  backToLoginHighlight: {
    color: LuxuryColors.gold,
    fontWeight: '700',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderWidth: 1,
    borderColor: '#FF6B6B',
    borderRadius: LuxuryBorderRadius.lg,
    padding: LuxurySpacing.md,
    marginBottom: LuxurySpacing.lg,
    gap: LuxurySpacing.sm,
  },
  errorBannerText: {
    flex: 1,
    fontSize: LuxuryFontSize.sm,
    color: '#FF6B6B',
    fontWeight: '600',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderWidth: 1,
    borderColor: LuxuryColors.gold,
    borderRadius: LuxuryBorderRadius.lg,
    padding: LuxurySpacing.md,
    marginBottom: LuxurySpacing.lg,
    gap: LuxurySpacing.sm,
  },
  infoBannerText: {
    flex: 1,
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.gold,
    fontWeight: '600',
  },
});
