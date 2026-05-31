/**
 * apply-creator.tsx
 *
 * Creator onboarding application form.
 *
 * On mount:
 *   1. Reads the current Firebase Auth UID.
 *   2. Queries Firestore for an existing application from this UID.
 *   3. Shows the correct state:
 *        - 'none'     → show the form
 *        - 'pending'  → "Application Under Review"
 *        - 'approved' → "You're Approved — go upload"
 *        - 'rejected' → "Not accepted" with option to contact
 *        - no auth    → "Sign in to apply"
 *
 * Submission is idempotent: the service rejects duplicate applications.
 */

import React, { useState, useCallback, useEffect } from 'react';
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
import {
  submitCreatorApplication,
  getMyApplicationStatus,
  getCurrentUid,
} from '../../lib/creatorService';
import type { ApplicationStatus } from '../../lib/creatorService';

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

// ─── Status gate views ────────────────────────────────────────────────────────

function StatusView({
  status,
  email,
  onBack,
}: {
  status: ApplicationStatus | 'no-auth';
  email?: string;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();

  const config = {
    'no-auth': {
      icon: 'person-circle-outline' as const,
      iconColor: LuxuryColors.textTertiary,
      title: 'Sign in to Apply',
      body: 'You need a Voya account to apply as a creator. Sign in or create an account first.',
      cta: 'Go to Sign In',
      ctaAction: () => router.replace('/(auth)/login'),
      ctaStyle: 'gold' as const,
    },
    pending: {
      icon: 'time-outline' as const,
      iconColor: LuxuryColors.gold,
      title: 'Application Under Review',
      body: `Your application has been received and is being reviewed by our team. We'll be in touch at${email ? ` ${email}` : ' your registered email'} within 3–5 business days.`,
      cta: 'Back to Discover',
      ctaAction: onBack,
      ctaStyle: 'outline' as const,
    },
    approved: {
      icon: 'checkmark-circle' as const,
      iconColor: LuxuryColors.success,
      title: "You're Approved",
      body: 'Your creator application was approved. Subscribe to the Creator plan and start publishing journeys.',
      cta: 'Upload a Journey',
      ctaAction: () => router.push('/(tabs)/upload-journey'),
      ctaStyle: 'gold' as const,
    },
    rejected: {
      icon: 'close-circle-outline' as const,
      iconColor: LuxuryColors.error,
      title: 'Application Not Accepted',
      body: 'We were not able to approve your application at this time. This may be due to content focus, audience fit, or capacity. You are welcome to reapply in 60 days.',
      cta: 'Back to Discover',
      ctaAction: onBack,
      ctaStyle: 'outline' as const,
    },
  };

  const c = config[status as keyof typeof config];

  return (
    <View
      style={[
        statusStyles.container,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <TouchableOpacity onPress={onBack} style={statusStyles.backBtn}>
        <Ionicons name="arrow-back" size={22} color={LuxuryColors.textPrimary} />
      </TouchableOpacity>

      <View style={statusStyles.body}>
        <View style={[statusStyles.iconWrap, { borderColor: `${c.iconColor}22` }]}>
          <Ionicons name={c.icon} size={48} color={c.iconColor} />
        </View>

        <Text style={statusStyles.title}>{c.title}</Text>
        <Text style={statusStyles.bodyText}>{c.body}</Text>

        {status === 'pending' && (
          <View style={statusStyles.stepsCard}>
            {[
              'Application submitted ✓',
              'Team review (3–5 business days)',
              'Email notification sent',
              'Creator subscription + journey upload',
            ].map((step, i) => (
              <View key={i} style={statusStyles.stepRow}>
                <View
                  style={[
                    statusStyles.stepDot,
                    i === 0 && statusStyles.stepDotDone,
                    i === 1 && statusStyles.stepDotActive,
                  ]}
                />
                <Text
                  style={[
                    statusStyles.stepText,
                    i === 0 && statusStyles.stepTextDone,
                    i > 1 && statusStyles.stepTextFuture,
                  ]}
                >
                  {step}
                </Text>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[
            statusStyles.cta,
            c.ctaStyle === 'outline' && statusStyles.ctaOutline,
          ]}
          onPress={c.ctaAction}
          activeOpacity={0.85}
        >
          <Text
            style={[
              statusStyles.ctaText,
              c.ctaStyle === 'outline' && statusStyles.ctaTextOutline,
            ]}
          >
            {c.cta}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ApplyCreatorScreen() {
  const insets = useSafeAreaInsets();

  // ── Auth + existing status ────────────────────────────────────────────
  const [checking, setChecking] = useState(true);
  const [uid, setUid] = useState<string | null>(null);
  const [existingStatus, setExistingStatus] = useState<ApplicationStatus | 'no-auth' | null>(null);
  const [existingEmail, setExistingEmail] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;

    const resolveStatus = async () => {
      const currentUid = getCurrentUid();
      if (!currentUid) {
        if (!cancelled) {
          setExistingStatus('no-auth');
          setChecking(false);
        }
        return;
      }
      setUid(currentUid);

      const status = await getMyApplicationStatus(currentUid);
      if (!cancelled) {
        // 'none' means first visit — show the form, not a status view
        setExistingStatus(status === 'none' ? null : status);
        setChecking(false);
      }
    };

    resolveStatus();
    return () => { cancelled = true; };
  }, []);

  // ── Form state ────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [instagram, setInstagram] = useState('');
  const [youtube, setYoutube] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [website, setWebsite] = useState('');
  const [countriesVisited, setCountriesVisited] = useState('');
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
  // nb: tiktok, countriesVisited, website are optional — not validated

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;

    // Re-check auth at submit time
    const currentUid = getCurrentUid();
    if (!currentUid) {
      Alert.alert('Not signed in', 'Please sign in before applying.');
      return;
    }

    setSubmitting(true);
    try {
      await submitCreatorApplication({
        userId: currentUid,
        fullName: name.trim(),
        email: email.trim(),
        travelExperience: bio.trim(),
        instagram: instagram.trim() || undefined,
        youtube: youtube.trim() || undefined,
        tiktok: tiktok.trim() || undefined,
        website: website.trim() || undefined,
        countriesVisited: countriesVisited.trim() || undefined,
        motivation: motivation.trim(),
      });
      setExistingEmail(email.trim());
      setSubmitted(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not submit. Please try again.';
      Alert.alert('Submission failed', msg);
    } finally {
      setSubmitting(false);
    }
  }, [validate, name, email, bio, instagram, youtube, tiktok, website, countriesVisited, motivation]);

  // ── Loading ────────────────────────────────────────────────────────────

  if (checking) {
    return (
      <View style={[loadStyles.center, { backgroundColor: LuxuryColors.background }]}>
        <ActivityIndicator color={LuxuryColors.gold} />
      </View>
    );
  }

  // ── Status gate views ─────────────────────────────────────────────────

  if (existingStatus === 'no-auth') {
    return (
      <StatusView status="no-auth" onBack={() => router.back()} />
    );
  }

  if (submitted || existingStatus === 'pending') {
    return (
      <StatusView
        status="pending"
        email={existingEmail}
        onBack={() => router.back()}
      />
    );
  }

  if (existingStatus === 'approved') {
    return <StatusView status="approved" onBack={() => router.back()} />;
  }

  if (existingStatus === 'rejected') {
    return <StatusView status="rejected" onBack={() => router.back()} />;
  }

  // ── Form (status === null, i.e. first-time applicant) ─────────────────

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
            <Text style={styles.introTitle}>Share Your Travel Knowledge</Text>
            <Text style={styles.introBody}>
              Applications are reviewed by our team before approval.
              Approved creators can subscribe and publish journeys.
            </Text>
          </View>

          {/* How it works */}
          <View style={styles.stepsCard}>
            {[
              { n: '1', text: 'Submit your application below' },
              { n: '2', text: 'We review and approve your profile' },
              { n: '3', text: 'Subscribe to the Creator plan' },
              { n: '4', text: 'Upload journeys — reach premium travellers' },
            ].map((step) => (
              <View key={step.n} style={styles.stepRow}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>{step.n}</Text>
                </View>
                <Text style={styles.stepText}>{step.text}</Text>
              </View>
            ))}
          </View>

          {/* About You */}
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

          <FieldLabel text="Travel Experience" required />
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
          <Text style={styles.hint}>{bio.length}/400</Text>

          <FieldLabel text="Countries Visited" />
          <TextInput
            style={styles.input}
            value={countriesVisited}
            onChangeText={setCountriesVisited}
            placeholder="e.g. Japan, Morocco, Peru, Iceland"
            placeholderTextColor={LuxuryColors.textTertiary}
            autoCapitalize="words"
            autoCorrect={false}
          />

          {/* Social Presence */}
          <SectionHeader title="Social Presence" />
          <Text style={styles.sectionNote}>
            At least one channel helps us verify your content and audience.
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

          <FieldLabel text="TikTok Handle" />
          <TextInput
            style={styles.input}
            value={tiktok}
            onChangeText={setTiktok}
            placeholder="@yourhandle"
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

          {/* Motivation */}
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
          <Text style={styles.hint}>{motivation.length}/800</Text>

          {/* Submit */}
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
            Applications are reviewed manually. You will be notified by email when
            your application is processed.
          </Text>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Status view styles ───────────────────────────────────────────────────────

const statusStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LuxuryColors.background,
    paddingHorizontal: LuxurySpacing.md,
  },
  backBtn: { padding: 4, marginBottom: 8 },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 8,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    color: LuxuryColors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  bodyText: {
    color: LuxuryColors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
  stepsCard: {
    width: '100%',
    backgroundColor: LuxuryColors.surface,
    borderRadius: LuxuryBorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: LuxurySpacing.md,
    gap: 12,
    marginVertical: 4,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    flexShrink: 0,
  },
  stepDotDone: { backgroundColor: LuxuryColors.success },
  stepDotActive: { backgroundColor: LuxuryColors.gold },
  stepText: { color: LuxuryColors.textSecondary, fontSize: 13 },
  stepTextDone: { color: LuxuryColors.success },
  stepTextFuture: { color: LuxuryColors.textTertiary },
  cta: {
    backgroundColor: LuxuryColors.gold,
    borderRadius: LuxuryBorderRadius.md,
    paddingHorizontal: 32,
    paddingVertical: 14,
    marginTop: 8,
  },
  ctaOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  ctaText: {
    color: LuxuryColors.background,
    fontWeight: '800',
    fontSize: 15,
  },
  ctaTextOutline: { color: LuxuryColors.textSecondary },
});

const loadStyles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

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
  line: { height: 1, backgroundColor: 'rgba(212,175,55,0.15)', marginTop: 8 },
});

const fieldStyles = StyleSheet.create({
  label: { color: LuxuryColors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  required: { color: LuxuryColors.gold },
});

// ─── Screen styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: LuxuryColors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: LuxurySpacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212,175,55,0.1)',
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: { flex: 1, color: LuxuryColors.textPrimary, fontSize: 17, fontWeight: '700' },
  headerSpacer: { width: 30 },
  btnDisabled: { opacity: 0.45 },
  scrollContent: { paddingHorizontal: LuxurySpacing.md, paddingTop: LuxurySpacing.md },
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
  introTitle: { color: LuxuryColors.textPrimary, fontSize: LuxuryFontSize.xxl, fontWeight: '800', textAlign: 'center' },
  introBody: { color: LuxuryColors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 22, maxWidth: 320 },
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
  stepNumText: { color: LuxuryColors.gold, fontSize: 12, fontWeight: '800' },
  stepText: { color: LuxuryColors.textSecondary, fontSize: 13, lineHeight: 18 },
  sectionNote: { color: LuxuryColors.textTertiary, fontSize: 12, marginTop: -6, marginBottom: 12, lineHeight: 18 },
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
  hint: { color: LuxuryColors.textTertiary, fontSize: 12, marginTop: -6, marginBottom: 14 },
  submitBtn: {
    backgroundColor: LuxuryColors.gold,
    borderRadius: LuxuryBorderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  submitBtnText: { color: LuxuryColors.background, fontWeight: '800', fontSize: 16, letterSpacing: 0.5 },
  submitNote: { color: LuxuryColors.textTertiary, fontSize: 12, textAlign: 'center', marginTop: 12, lineHeight: 18 },
});
