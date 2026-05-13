import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, Platform as OS } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { LuxuryColors, LuxurySpacing, LuxuryBorderRadius, LuxuryFontSize, LuxuryGradients, LuxuryShadow } from '../../constants/luxuryTheme';
import { checkEmailExists, loginUser } from './authStorage';
import { loginWithApple, loginWithEmail } from '../../lib/authService';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleForgotPassword = () => {
    router.push('/(auth)/reset-password');
  };

  const handleAppleSignIn = async () => {
    try {
      await loginWithApple();
      router.replace('/(tabs)');
    } catch (error: any) {
      if (error?.code === 'ERR_CANCELED' || error?.code === 'ERR_REQUEST_CANCELED' || error?.code === 'user_cancelled' || error.message?.toLowerCase().includes('cancel')) {
        return;
      }
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
      await loginWithEmail({ email, password, loginUser });
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
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color={LuxuryColors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={LuxuryColors.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
              >
                <Ionicons 
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'} 
                  size={20} 
                  color={LuxuryColors.textSecondary} 
                />
              </TouchableOpacity>
            </View>
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
