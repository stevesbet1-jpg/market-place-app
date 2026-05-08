import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { LuxuryColors, LuxurySpacing, LuxuryBorderRadius, LuxuryFontSize, LuxuryGradients, LuxuryShadow } from '../../constants/luxuryTheme';
import { validatePassword } from './authStorage';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { registerWithFirebaseEmail, isFirebaseConfigured } from '../../lib/firebaseAuth';

export default function SignupScreen() {
  const insets = useSafeAreaInsets();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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
    setPassword(suggestedPassword);
    setConfirmPassword(suggestedPassword);
    Alert.alert('Password Generated', 'A strong password has been generated and filled in both password fields.');
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

    if (!isSupabaseConfigured()) {
      console.error('SIGNUP: Supabase not configured');
      Alert.alert('Error', 'Account creation is not available at this time.');
      return;
    }

    try {
      console.log('SIGNUP: Attempting Supabase signup for', email.trim().toLowerCase());

      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
        },
      });

      if (error) {
        console.error('SIGNUP_ERROR:', error);
        Alert.alert('Error', error.message || 'Failed to create account');
        return;
      }

      console.log('SIGNUP: Supabase success', data);

      // Also create user in Firebase Auth for password reset support
      if (isFirebaseConfigured()) {
        try {
          const firebaseResult = await registerWithFirebaseEmail(
            email.trim().toLowerCase(),
            password
          );
          console.log('SIGNUP: Firebase registration result', firebaseResult);
        } catch (firebaseError: any) {
          console.log('SIGNUP: Firebase registration error (non-critical)', firebaseError.message);
        }
      }

      // Send welcome email via Edge Function
      try {
        const { data: emailData, error: emailError } = await supabase.functions.invoke('send-signup-email', {
          body: {
            email: email.trim().toLowerCase(),
            fullName: fullName.trim(),
          },
        });

        console.log('SIGNUP: Email response', emailData, emailError);

        if (emailError) {
          console.error('SIGNUP: Email failed', emailError);
          // Continue anyway - account was created successfully
        }
      } catch (emailError: any) {
        console.error('SIGNUP: Email error', emailError);
        // Continue anyway - account was created successfully
      }

      Alert.alert(
        'Account Created',
        'Your account has been created successfully.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(auth)/login'),
          },
        ]
      );
    } catch (error: any) {
      console.error('SIGNUP_ERROR:', error);
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
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color={LuxuryColors.textTertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
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
                    color={LuxuryColors.textTertiary} 
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color={LuxuryColors.textTertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={LuxuryColors.textTertiary}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                >
                  <Ionicons 
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'} 
                    size={20} 
                    color={LuxuryColors.textTertiary} 
                  />
                </TouchableOpacity>
              </View>
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
