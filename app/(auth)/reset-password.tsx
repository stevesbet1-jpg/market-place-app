import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { LuxuryColors, LuxurySpacing, LuxuryBorderRadius, LuxuryFontSize, LuxuryGradients, LuxuryShadow } from '../../constants/luxuryTheme';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export default function ResetPasswordScreen() {
  console.log("🔥 ACTIVE RESET PASSWORD SCREEN LOADED");
  const insets = useSafeAreaInsets();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    if (token) {
      console.log("🔥 TOKEN FROM DEEP LINK:", token);
      setHasToken(true);
    }
  }, [token]);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSendResetLink = async () => {
    console.log("🔥 RESET BUTTON PRESSED");
    console.log("EMAIL SENT FROM UI:", email);

    if (!email.trim()) {
      Alert.alert('Email Required', 'Please enter your email address.');
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    if (!isSupabaseConfigured()) {
      console.error('RESET_PASSWORD: Supabase not configured');
      Alert.alert('Error', 'Password reset is not available at this time.');
      return;
    }

    setIsLoading(true);

    try {
      console.log('RESET_PASSWORD: Calling Edge Function for', email.trim().toLowerCase());

      const { data, error } = await supabase.functions.invoke('send-reset-email', {
        body: { email: email.trim().toLowerCase() },
      });

      console.log("🔥 FUNCTION DATA:", JSON.stringify(data, null, 2));
      console.log("🔥 FUNCTION ERROR:", JSON.stringify(error, null, 2));

      if (error) {
        console.error('RESET_PASSWORD_ERROR:', error);
        Alert.alert("Reset Error", JSON.stringify(error, null, 2));
        return;
      }

      console.log('RESET_PASSWORD: Success, email sent');
      Alert.alert(
        'Success',
        'Password reset email sent successfully.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      console.error('RESET_PASSWORD_ERROR:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    console.log("🔥 RESET PASSWORD WITH TOKEN:", token);

    if (!newPassword.trim()) {
      Alert.alert('Password Required', 'Please enter your new password.');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Invalid Password', 'Password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return;
    }

    if (!isSupabaseConfigured()) {
      console.error('RESET_PASSWORD: Supabase not configured');
      Alert.alert('Error', 'Password reset is not available at this time.');
      return;
    }

    setIsLoading(true);

    try {
      console.log('RESET_PASSWORD: Calling reset-password Edge Function with token');

      const { data, error } = await supabase.functions.invoke('reset-password', {
        body: {
          token,
          newPassword,
        },
      });

      console.log("🔥 FUNCTION DATA:", JSON.stringify(data, null, 2));
      console.log("🔥 FUNCTION ERROR:", JSON.stringify(error, null, 2));

      if (error) {
        console.error('RESET_PASSWORD_ERROR:', error);
        Alert.alert("Reset Error", JSON.stringify(error, null, 2));
        return;
      }

      console.log('RESET_PASSWORD: Success, password updated');
      Alert.alert(
        'Success',
        'Your password has been reset successfully. Please sign in with your new password.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(auth)/login'),
          },
        ]
      );
    } catch (error: any) {
      console.error('RESET_PASSWORD_ERROR:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
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
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={LuxuryColors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Reset Password</Text>
        </View>

        {/* Description */}
        <View style={styles.descriptionContainer}>
          <Text style={styles.description}>
            {hasToken
              ? 'Enter your new password below to reset your password.'
              : 'Enter your email address and we\'ll send you a link to reset your password.'}
          </Text>
        </View>

        {hasToken ? (
          <>
            {/* New Password Input */}
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

            {/* Confirm Password Input */}
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

            {/* Reset Password Button */}
            <TouchableOpacity
              style={[styles.resetButton, isLoading && styles.resetButtonDisabled]}
              onPress={handleResetPassword}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={LuxuryGradients.goldDeep}
                style={styles.gradientButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {isLoading ? (
                  <Text style={styles.resetButtonText}>Resetting...</Text>
                ) : (
                  <Text style={styles.resetButtonText}>Reset Password</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* Email Input */}
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

            {/* Send Reset Link Button */}
            <TouchableOpacity
              style={[styles.resetButton, isLoading && styles.resetButtonDisabled]}
              onPress={handleSendResetLink}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={LuxuryGradients.goldDeep}
                style={styles.gradientButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {isLoading ? (
                  <Text style={styles.resetButtonText}>Sending...</Text>
                ) : (
                  <Text style={styles.resetButtonText}>Send Reset Link</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}

        {/* Back to Login */}
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
