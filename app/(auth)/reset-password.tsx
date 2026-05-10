import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { LuxuryColors, LuxurySpacing, LuxuryBorderRadius, LuxuryFontSize, LuxuryGradients } from '../../constants/luxuryTheme';
import {
  sendFirebasePasswordReset,
  confirmFirebasePasswordReset,
  verifyResetCode,
  isFirebaseConfigured,
} from '../../lib/firebaseAuth';

type ResetMode = 'send' | 'verify' | 'reset';

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const { oobCode, mode } = useLocalSearchParams<{ oobCode?: string; mode?: string }>();

  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [manualOobCode, setManualOobCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [screenMode, setScreenMode] = useState<ResetMode>('send');
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);

  // Determine initial mode from deep link params
  useEffect(() => {
    const code = typeof oobCode === 'string' ? oobCode : undefined;
    const linkMode = typeof mode === 'string' ? mode : undefined;

    console.log('[ResetPassword] Mount. oobCode:', code ? 'present' : 'missing', 'mode:', linkMode);

    if (code && code.length > 0) {
      setScreenMode('verify');
      setManualOobCode(code);
      verifyCodeOnMount(code);
    }
  }, [oobCode, mode]);

  const verifyCodeOnMount = async (code: string) => {
    setIsLoading(true);
    setCodeError(null);
    console.log('[ResetPassword] Verifying oobCode on mount:', code.substring(0, 8) + '...');

    try {
      const associatedEmail = await verifyResetCode(code);
      setVerifiedEmail(associatedEmail);
      setScreenMode('reset');
      console.log('[ResetPassword] Code verified. Associated email:', associatedEmail);
    } catch (error: any) {
      const msg = error?.message || 'Invalid or expired reset link.';
      setCodeError(msg);
      setScreenMode('send');
      console.error('[ResetPassword] Code verification failed:', msg);
    } finally {
      setIsLoading(false);
    }
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSendResetLink = async () => {
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

    setIsLoading(true);

    const normalizedEmail = email.trim().toLowerCase();
    console.log('[ResetPassword] Requesting reset for email:', normalizedEmail);

    try {
      await sendFirebasePasswordReset(normalizedEmail);
      console.log('[ResetPassword] Firebase sendPasswordResetEmail returned success for:', normalizedEmail);
      Alert.alert(
        'Reset Email Sent',
        'If this account exists, a reset email was sent.\n\nCheck your inbox (and spam/promotions folder). It may take 1-5 minutes to arrive.\n\nIf you do not see it, the email may not be registered in Firebase Auth.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      console.error('[ResetPassword] SEND_RESET_ERROR:', error);
      const message = error?.message || 'Failed to send reset email. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setIsLoading(false);
    }
  };

  const activeOobCode = typeof oobCode === 'string' && oobCode.length > 0 ? oobCode : manualOobCode.trim();

  const handleConfirmReset = async () => {
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

    if (!activeOobCode) {
      Alert.alert('Error', 'Invalid reset link. Please request a new one.');
      return;
    }

    if (!isFirebaseConfigured()) {
      Alert.alert('Error', 'Firebase is not configured.');
      return;
    }

    setIsLoading(true);
    console.log('[ResetPassword] Confirming password reset for:', verifiedEmail || 'unknown email');

    try {
      await confirmFirebasePasswordReset(activeOobCode, newPassword);
      console.log('[ResetPassword] Password reset confirmed successfully');
      Alert.alert(
        'Password Reset',
        'Your password has been updated successfully. Please sign in with your new password.',
        [{ text: 'Sign In', onPress: () => router.replace('/(auth)/login') }]
      );
    } catch (error: any) {
      console.error('[ResetPassword] CONFIRM_RESET_ERROR:', error);
      const message = error?.message || 'Failed to reset password. The link may have expired.';
      Alert.alert('Error', message);
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Loading state while verifying code ─────────────────────────
  if (screenMode === 'verify') {
    return (
      <View style={[styles.container, { paddingBottom: insets.bottom, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={LuxuryColors.gold} />
        <Text style={[styles.description, { marginTop: LuxurySpacing.lg }]}>
          Verifying reset link...
        </Text>
      </View>
    );
  }

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

        {/* Error banner for invalid code */}
        {codeError && (
          <View style={styles.errorBanner}>
            <Ionicons name="warning-outline" size={20} color="#FF6B6B" />
            <Text style={styles.errorBannerText}>{codeError}</Text>
          </View>
        )}

        {screenMode === 'reset' ? (
          <>
            {verifiedEmail && (
              <View style={styles.infoBanner}>
                <Ionicons name="shield-checkmark-outline" size={20} color={LuxuryColors.gold} />
                <Text style={styles.infoBannerText}>Reset code verified for {verifiedEmail}</Text>
              </View>
            )}

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
                  secureTextEntry
                  autoCapitalize="none"
                />
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
                  secureTextEntry
                  autoCapitalize="none"
                />
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
                  {isLoading ? 'Resetting...' : 'Reset Password'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        ) : (
          <>
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
                  {isLoading ? 'Sending...' : 'Send Reset Link'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}

        {/* Manual code entry toggle */}
        {screenMode === 'send' && (
          <>
            {!manualOobCode && (
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => {
                  setScreenMode('reset');
                  setCodeError(null);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.linkText}>
                  Have a reset code? <Text style={styles.linkHighlight}>Enter it manually</Text>
                </Text>
              </TouchableOpacity>
            )}

            {manualOobCode && (
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => {
                  setManualOobCode('');
                  setScreenMode('send');
                  setCodeError(null);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.linkText}>
                  <Text style={styles.linkHighlight}>Back to email reset</Text>
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}

        <TouchableOpacity
          style={styles.backToLoginButton}
          onPress={() => router.back()}
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
  linkButton: {
    alignItems: 'center',
    marginTop: LuxurySpacing.lg,
  },
  linkText: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textSecondary,
  },
  linkHighlight: {
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
