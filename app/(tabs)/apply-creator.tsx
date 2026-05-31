/**
 * apply-creator.tsx
 *
 * Creator onboarding application form.
 *
 * Flow:
 *   1. Applicant fills in name, bio, social links, motivation.
 *   2. Application is written to Firestore as status='pending'.
 *   3. Admin reviews and flips status to 'approved' — creator then appears
 *      in the live Discover feed and can publish journeys.
 *
 * Until approval:
 *   - Their profile is NOT shown to users.
 *   - They cannot publish journeys.
 *   - They receive a confirmation that their application is under review.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LuxuryColors,
  LuxurySpacing,
  LuxuryBorderRadius,
  LuxuryFontSize,
} from '../../constants/luxuryTheme';
import { submitCreatorApplication } from '../../lib/creatorService';

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={sectionStyles.wrapper}>
      <Text style={sectionStyles.title}>{title}</Text>
      <View style={sectionStyles.line} />
    </View>
  );
}

function FieldLabel({ text, required }: { text: string; required?: boolean }) {
  return (
    <Text style={fieldStyles.label}>
      {text}
      {required && <Text style={fieldStyles.required}> *</Text>}
    </Text>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ApplyCreatorScreen() {
  const insets = useSafeAreaInsets();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [instagram, setInstagram] = useState('');
  const [youtube, setYoutube] = useState('');
  const [website, setWebsite] = useState('');
  const [motivation, setMotivation] = useState('');

  const validate = useCallback((): boolean => {
    if (!name.trim()) {
      Alert.alert('Missing field', 'Please enter your full name.');
      return false;
    }
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Missing field', 'Please enter a valid email address.');
      return false;
    }
    if (!bio.trim()) {
      Alert.alert('Missing field', 'Please write a short bio.');
      return false;
    }
    if (!motivation.trim()) {
      Alert.alert('Missing field', 'Please tell us why you want to join.');
      return false;
    }
    return true;
  }, [name, email, bio, motivation]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await submitCreatorApplication({
        name: name.trim(),
        email: email.trim(),
        bio: bio.trim(),
        instagram: instagram.trim() || undefined,
        youtube: youtube.trim() || undefined,
        website: website.trim() || undefined,
        motivation: motivation.trim(),
        applicantUid: 'pending-auth', // TODO: replace with real auth UID
      });
      setSubmitted(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not submit. Please try again.';
      Alert.alert('Submission failed', msg);
    } finally {
      setSubmitting(false);
    }
  }, [validate, name, email, bio, instagram, youtube, website, motivation]);

  // ── Success state ────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <View style={[styles.successContainer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.successIconWrap}>
          <Ionicons name="checkmark-circle" size={52} color={LuxuryColors.gold} />
        </View>
        <Text style={styles.successTitle}>Application Submitted</Text>
        <Text style={styles.successBody}>
          Thank you! We review every application personally. You will hear back at{' '}
          <Text style={styles.successEmail}>{email}</Text> within 3–5 business days.
        </Text>
        <Text style={styles.successNote}>
          Once approved, you can create a profile, upload journeys, and reach thousands
          of premium travellers.
        </Text>
        <TouchableOpacity
          style={styles.successBtn}
          onPress={() => router.back()}
          activeOpacity={0.85}
        >
          <Text style={styles.successBtnText}>Back to Discover</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={LuxuryColors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Apply as Creator</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 48 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Intro */}
          <View style={styles.intro}>
            <View style={styles.introBadge}>
              <Ionicons name="people-outline" size={16} color={LuxuryColors.gold} />
              <Text style={styles.introBadgeText}>Creator Marketplace</Text>
            </View>
            <Text style={styles.introTitle}>
              Share Your Travel Knowledge
            </Text>
            <Text style={styles.introBody}>
              We are selecting the first wave of creators to publish their handcrafted
              journeys. Applications are reviewed by our team before approval.
            </Text>
          </View>

          {/* How it works */}
          <View style={styles.stepsCard}>
            {[
              { n: '1', text: 'Submit your application below' },
              { n: '2', text: 'We review and approve your profile' },
              { n: '3', text: 'You upload journeys with a Creator Subscription' },
              { n: '4', text: 'Your itineraries reach premium travellers' },
            ].map((step) => (
              <View key={step.n} style={styles.stepRow}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>{step.n}</Text>
                </View>
                <Text style={styles.stepText}>{step.text}</Text>
              </View>
            ))}
          </View>

          {/* ── About You ────────────────────────────────────────────────── */}
          <SectionHeader title="About You" />

          <FieldLabel text="Full Name" required />
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your full name"
            placeholderTextColor={LuxuryColors.textTertiary}
            autoCapitalize="words"
          />

          <FieldLabel text="Email Address" required />
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={LuxuryColors.textTertiary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <FieldLabel text="Short Bio" required />
          <TextInput
            style={[styles.input, styles.textArea]}
            value={bio}
            onChangeText={setBio}
            placeholder="Where do you travel? What makes your perspective unique?"
            placeholderTextColor={LuxuryColors.textTertiary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={400}
          />
          <Text style={styles.hint}>{bio.length}/400 characters</Text>

          {/* ── Social Presence ───────────────────────────────────────────── */}
          <SectionHeader title="Social Presence" />
          <Text style={styles.sectionNote}>
            At least one social channel helps us verify your content and audience.
          </Text>

          <FieldLabel text="Instagram Handle" />
          <TextInput
            style={styles.input}
            value={instagram}
            onChangeText={setInstagram}
            placeholder="@yourhandle"
            placeholderTextColor={LuxuryColors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <FieldLabel text="YouTube Channel" />
          <TextInput
            style={styles.input}
            value={youtube}
            onChangeText={setYoutube}
            placeholder="YourChannelName or full URL"
            placeholderTextColor={LuxuryColors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <FieldLabel text="Website / Blog" />
          <TextInput
            style={styles.input}
            value={website}
            onChangeText={setWebsite}
            placeholder="yoursite.com"
            placeholderTextColor={LuxuryColors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          {/* ── Motivation ───────────────────────────────────────────────── */}
          <SectionHeader title="Why Join?" />

          <FieldLabel text="Tell us about your travel style" required />
          <TextInput
            style={[styles.input, styles.textAreaLg]}
            value={motivation}
            onChangeText={setMotivation}
            placeholder="What type of journeys would you publish? Who is your audience? Why do you want to share on this platform?"
            placeholderTextColor={LuxuryColors.textTertiary}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            maxLength={800}
          />
          <Text style={styles.hint}>{motivation.length}/800 characters</Text>

          {/* ── Submit ───────────────────────────────────────────────────── */}
          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting
              ? <ActivityIndicator color={LuxuryColors.background} />
              : <Text style={styles.submitBtnText}>Submit Application</Text>}
          </TouchableOpacity>

          <Text style={styles.submitNote}>
            Applications are reviewed manually. We do not auto-approve. You will be
            notified by email when your application is processed.
          </Text>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Sub-component styles ─────────────────────────────────────────────────────

const sectionStyles = StyleSheet.create({
  wrapper: { marginTop: 28, marginBottom: 12 },
  title: {
    color: LuxuryColors.gold,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  line: {
    height: 1,
    backgroundColor: 'rgba(212,175,55,0.15)',
    marginTop: 8,
  },
});

const fieldStyles = StyleSheet.create({
  label: {
    color: LuxuryColors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  required: {
    color: LuxuryColors.gold,
  },
});

// ─── Screen styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: LuxuryColors.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: LuxurySpacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212,175,55,0.1)',
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: {
    flex: 1,
    color: LuxuryColors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  headerSpacer: { width: 30 },
  btnDisabled: { opacity: 0.45 },

  scrollContent: {
    paddingHorizontal: LuxurySpacing.md,
    paddingTop: LuxurySpacing.md,
  },

  // Intro
  intro: { alignItems: 'center', paddingVertical: 24, gap: 12 },
  introBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderRadius: LuxuryBorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  introBadgeText: {
    color: LuxuryColors.gold,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  introTitle: {
    color: LuxuryColors.textPrimary,
    fontSize: LuxuryFontSize.xxl,
    fontWeight: '800',
    textAlign: 'center',
  },
  introBody: {
    color: LuxuryColors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },

  // Steps card
  stepsCard: {
    backgroundColor: LuxuryColors.surface,
    borderRadius: LuxuryBorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: LuxurySpacing.md,
    gap: 14,
    marginBottom: 8,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(212,175,55,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepNumText: {
    color: LuxuryColors.gold,
    fontSize: 12,
    fontWeight: '800',
  },
  stepText: {
    color: LuxuryColors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },

  sectionNote: {
    color: LuxuryColors.textTertiary,
    fontSize: 12,
    marginTop: -6,
    marginBottom: 12,
    lineHeight: 18,
  },

  // Inputs
  input: {
    backgroundColor: LuxuryColors.surface,
    borderRadius: LuxuryBorderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    color: LuxuryColors.textPrimary,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  textArea: { minHeight: 84, paddingTop: 12 },
  textAreaLg: { minHeight: 120, paddingTop: 12 },
  hint: {
    color: LuxuryColors.textTertiary,
    fontSize: 12,
    marginTop: -6,
    marginBottom: 14,
  },

  // Submit
  submitBtn: {
    backgroundColor: LuxuryColors.gold,
    borderRadius: LuxuryBorderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  submitBtnText: {
    color: LuxuryColors.background,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  submitNote: {
    color: LuxuryColors.textTertiary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 18,
  },

  // Success state
  successContainer: {
    flex: 1,
    backgroundColor: LuxuryColors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  successIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(212,175,55,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  successTitle: {
    color: LuxuryColors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  successBody: {
    color: LuxuryColors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 24,
  },
  successEmail: {
    color: LuxuryColors.gold,
    fontWeight: '600',
  },
  successNote: {
    color: LuxuryColors.textTertiary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  successBtn: {
    marginTop: 16,
    backgroundColor: LuxuryColors.gold,
    borderRadius: LuxuryBorderRadius.md,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  successBtnText: {
    color: LuxuryColors.background,
    fontWeight: '800',
    fontSize: 15,
  },
});
