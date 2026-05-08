import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { LuxuryColors, LuxurySpacing, LuxuryBorderRadius, LuxuryFontSize, LuxuryGradients } from '../../constants/luxuryTheme';
import {
  sendFirebasePasswordReset,
  confirmFirebasePasswordReset,
  isFirebaseConfigured,
} from '../../lib/firebaseAuth';

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const { oobCode, mode } = useLocalSearchParams<{ oobCode?: string; mode?: string }>();

  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasOobCode, setHasOobCode] = useState(false);

  useEffect(() => {
    if (oobCode && mode === 'resetPassword') {
      setHasOobCode(true);
    }
  }, [oobCode, mode]);

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

    try {
      await sendFirebasePasswordReset(email.trim().toLowerCase());
      Alert.alert(
        'Reset Email Sent',
        'Check your inbox for a password reset link. Tap the link to open the app and set your new password.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      console.error('SEND_RESET_ERROR:', error);
      const message = error?.message || 'Failed to send reset email. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setIsLoading(false);
    }
  };

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

    if (!oobCode) {
      Alert.alert('Error', 'Invalid reset link. Please request a new one.');
      return;
    }

    if (!isFirebaseConfigured()) {
      Alert.alert('Error', 'Firebase is not configured.');
      return;
    }

    setIsLoading(true);

    try {
      await confirmFirebasePasswordReset(oobCode, newPassword);
      Alert.alert(
        'Password Reset',
        'Your password has been updated successfully. Please sign in with your new password.',
        [{ text: 'Sign In', onPress: () => router.replace('/(auth)/login') }]
      );
    } catch (error: any) {
      console.error('CONFIRM_RESET_ERROR:', error);
      const message = error?.message || 'Failed to reset password. The link may have expired.';
      Alert.alert('Error', message);
    } finally {
      setIsLoading(false);
    }
  };

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
            {hasOobCode
              ? 'Enter your new password below.'
              : 'Enter your email and we will send you a reset link.'}
          </Text>
        </View>

        {hasOobCode ? (
          <>
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
                  placeholder="Enter new password"
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
});
