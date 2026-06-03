/**
 * create-journey.tsx
 *
 * Creator journey submission form.
 *
 * Approval gate: only approved creators reach the form.
 * Save Draft  → status: 'draft'        (private, editable)
 * Submit      → status: 'pending_review' (queued for editorial review)
 *
 * Navigation: reached from creator-dashboard "Create Journey" button.
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
  LuxuryBorderRadius,
  LuxurySpacing,
  LuxuryFontSize,
} from '../../constants/luxuryTheme';
import { saveDraftJourney, submitJourneyForReview } from '../../lib/creatorJourneyService';
import {
  getMyApprovedCreatorProfile,
} from '../../lib/creatorService';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirebaseApp } from '../../lib/firebase';
import type { BudgetLevel } from '../../constants/creatorJourneyModel';
import type { Creator } from '../../constants/creators';

// ─── Local form type ──────────────────────────────────────────────────────────

interface ItineraryDayDraft {
  day: number;
  activitiesText: string; // comma-separated while editing
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function splitTags(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

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

const BUDGET_LEVELS: BudgetLevel[] = ['$', '$$', '$$$', '$$$$'];

// ─── Access gate ──────────────────────────────────────────────────────────────

type AccessStatus = 'no-auth' | 'not-creator' | 'approved';

function AccessGateView({
  status,
  onBack,
}: {
  status: AccessStatus;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();

  const messages: Record<AccessStatus, { icon: keyof typeof Ionicons.glyphMap; color: string; title: string; body: string }> = {
    'no-auth': {
      icon: 'person-circle-outline',
      color: LuxuryColors.textTertiary,
      title: 'Sign In Required',
      body: 'You need a Voya account to create journeys.',
    },
    'not-creator': {
      icon: 'create-outline',
      color: LuxuryColors.gold,
      title: 'Become a Creator First',
      body: 'Go to your Profile to activate your free creator account instantly — no approval needed.',
    },
    approved: {
      icon: 'checkmark-circle',
      color: LuxuryColors.success,
      title: 'Approved',
      body: '',
    },
  };

  const m = messages[status];

  return (
    <View style={[gateStyles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
      <TouchableOpacity onPress={onBack} style={gateStyles.backBtn}>
        <Ionicons name="arrow-back" size={22} color={LuxuryColors.textPrimary} />
      </TouchableOpacity>
      <View style={gateStyles.body}>
        <View style={[gateStyles.iconWrap, { borderColor: `${m.color}22` }]}>
          <Ionicons name={m.icon} size={48} color={m.color} />
        </View>
        <Text style={gateStyles.title}>{m.title}</Text>
        <Text style={gateStyles.bodyText}>{m.body}</Text>
        <TouchableOpacity style={gateStyles.cta} onPress={onBack} activeOpacity={0.85}>
          <Text style={gateStyles.ctaText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CreateJourneyScreen() {
  const insets = useSafeAreaInsets();

  // ── Auth + approval gate ─────────────────────────────────────────────
  const [checking, setChecking] = useState(true);
  const [authUid, setAuthUid] = useState<string | null>(null);
  const [creatorProfile, setCreatorProfile] = useState<Creator | null>(null);
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null);

  useEffect(() => {
    const auth = getAuth(getFirebaseApp());
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const uid = user?.uid ?? null;
      setAuthUid(uid);
      if (!uid) {
        setAccessStatus('no-auth');
        setChecking(false);
        return;
      }
      const profile = await getMyApprovedCreatorProfile(uid);
      if (profile) {
        setCreatorProfile(profile);
        setAccessStatus('approved');
      } else {
        setAccessStatus('not-creator');
      }
      setChecking(false);
      unsubscribe();
    });
    return unsubscribe;
  }, []);

  // ── Form state ───────────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [duration, setDuration] = useState('');
  const [budget, setBudget] = useState<BudgetLevel>('$$');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [description, setDescription] = useState('');
  const [itineraryDays, setItineraryDays] = useState<ItineraryDayDraft[]>([
    { day: 1, activitiesText: '' },
  ]);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ── Itinerary helpers ────────────────────────────────────────────────
  const addDay = useCallback(() => {
    setItineraryDays((prev) => [
      ...prev,
      { day: prev.length + 1, activitiesText: '' },
    ]);
  }, []);

  const removeDay = useCallback((index: number) => {
    setItineraryDays((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((d, i) => ({ ...d, day: i + 1 }))
    );
  }, []);

  const updateDayText = useCallback((index: number, text: string) => {
    setItineraryDays((prev) =>
      prev.map((d, i) => (i === index ? { ...d, activitiesText: text } : d))
    );
  }, []);

  // ── Validation ────────────────────────────────────────────────────────
  function validate(): string | null {
    if (!title.trim()) return 'Journey Title is required.';
    if (!country.trim()) return 'Country is required.';
    if (!city.trim()) return 'City is required.';
    if (!duration.trim()) return 'Duration is required.';
    if (!description.trim()) return 'Short Description is required.';
    return null;
  }

  // ── Build payload ────────────────────────────────────────────────────
  function buildPayload() {
    const destination = city.trim()
      ? `${city.trim()}, ${country.trim()}`
      : country.trim();

    return {
      creatorId: authUid ?? '',
      creatorName: creatorProfile?.name ?? '',
      title: title.trim(),
      destination,
      region: country.trim(),
      duration: duration.trim(),
      bestTime: '',
      overview: description.trim(),
      budget,
      dailyBudget: '',
      places: [],
      restaurants: [],
      experiences: [],
      itinerary: itineraryDays.map((d) => ({
        day: d.day,
        activities: splitTags(d.activitiesText),
      })),
      imageUri: coverImageUrl.trim() || null,
      rating: 0,
      savedCount: 0,
    };
  }

  // ── Save draft ────────────────────────────────────────────────────────
  const handleSaveDraft = useCallback(async () => {
    if (!title.trim()) {
      Alert.alert('Title Required', 'Please enter a journey title before saving a draft.');
      return;
    }
    setSaving(true);
    try {
      await saveDraftJourney(buildPayload() as Parameters<typeof saveDraftJourney>[0]);
      Alert.alert('Draft Saved', 'Your journey has been saved as a draft.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      Alert.alert('Save Failed', msg);
    } finally {
      setSaving(false);
    }
  }, [title, country, city, duration, budget, coverImageUrl, description, itineraryDays, creatorProfile]);

  // ── Submit for review ─────────────────────────────────────────────────
  const handleSubmitForReview = useCallback(async () => {
    const err = validate();
    if (err) {
      Alert.alert('Missing Information', err);
      return;
    }
    Alert.alert(
      'Submit for Review',
      'Your journey will be reviewed before being published. This cannot be undone. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            setSubmitting(true);
            try {
              await submitJourneyForReview(buildPayload() as Parameters<typeof submitJourneyForReview>[0]);
              Alert.alert(
                'Submitted',
                'Your journey is now under review. You will be notified when it is approved.',
                [{ text: 'OK', onPress: () => router.back() }]
              );
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : 'Unknown error';
              Alert.alert('Submission Failed', msg);
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  }, [title, country, city, duration, budget, coverImageUrl, description, itineraryDays, creatorProfile]);

  // ── Render states ─────────────────────────────────────────────────────
  if (checking) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={LuxuryColors.gold} size="large" />
      </View>
    );
  }

  if (accessStatus && accessStatus !== 'approved') {
    return (
      <AccessGateView
        status={accessStatus}
        onBack={() => router.back()}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: LuxuryColors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={LuxuryColors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Journey</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.divider} />

        {/* ── Basic Info ── */}
        <SectionHeader title="Journey Details" />

        <FieldLabel text="Journey Title" required />
        <TextInput
          style={styles.input}
          placeholder="e.g. Hidden Gems of Kyoto"
          placeholderTextColor={LuxuryColors.textTertiary}
          value={title}
          onChangeText={setTitle}
          maxLength={80}
        />

        <View style={styles.row}>
          <View style={styles.flex1}>
            <FieldLabel text="Country" required />
            <TextInput
              style={styles.input}
              placeholder="Japan"
              placeholderTextColor={LuxuryColors.textTertiary}
              value={country}
              onChangeText={setCountry}
              maxLength={60}
            />
          </View>
          <View style={styles.spacer} />
          <View style={styles.flex1}>
            <FieldLabel text="City" required />
            <TextInput
              style={styles.input}
              placeholder="Kyoto"
              placeholderTextColor={LuxuryColors.textTertiary}
              value={city}
              onChangeText={setCity}
              maxLength={60}
            />
          </View>
        </View>

        <FieldLabel text="Duration" required />
        <TextInput
          style={styles.input}
          placeholder="e.g. 7 Days"
          placeholderTextColor={LuxuryColors.textTertiary}
          value={duration}
          onChangeText={setDuration}
          maxLength={30}
        />

        {/* Budget */}
        <FieldLabel text="Budget Level" required />
        <View style={styles.budgetRow}>
          {BUDGET_LEVELS.map((level) => (
            <TouchableOpacity
              key={level}
              style={[styles.budgetBtn, budget === level && styles.budgetBtnActive]}
              onPress={() => setBudget(level)}
              activeOpacity={0.7}
            >
              <Text style={[styles.budgetText, budget === level && styles.budgetTextActive]}>
                {level}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Media ── */}
        <SectionHeader title="Cover Image" />

        <FieldLabel text="Cover Image URL" />
        <TextInput
          style={styles.input}
          placeholder="https://example.com/image.jpg"
          placeholderTextColor={LuxuryColors.textTertiary}
          value={coverImageUrl}
          onChangeText={setCoverImageUrl}
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={500}
        />
        <Text style={styles.hint}>Paste a public image URL for your journey cover photo.</Text>

        {/* ── Description ── */}
        <SectionHeader title="Description" />

        <FieldLabel text="Short Description" required />
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe this journey in 2–3 sentences…"
          placeholderTextColor={LuxuryColors.textTertiary}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          maxLength={600}
          textAlignVertical="top"
        />

        {/* ── Itinerary ── */}
        <SectionHeader title="Itinerary" />
        <Text style={styles.hint}>Add activities for each day (comma-separated).</Text>

        {itineraryDays.map((day, index) => (
          <View key={index} style={styles.dayCard}>
            <View style={styles.dayHeader}>
              <View style={styles.dayBadge}>
                <Text style={styles.dayBadgeText}>Day {day.day}</Text>
              </View>
              {itineraryDays.length > 1 && (
                <TouchableOpacity
                  onPress={() => removeDay(index)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle-outline" size={20} color={LuxuryColors.error} />
                </TouchableOpacity>
              )}
            </View>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Visit Fushimi Inari, Tea ceremony, Gion walk…"
              placeholderTextColor={LuxuryColors.textTertiary}
              value={day.activitiesText}
              onChangeText={(text) => updateDayText(index, text)}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        ))}

        <TouchableOpacity style={styles.addDayBtn} onPress={addDay} activeOpacity={0.7}>
          <Ionicons name="add-circle-outline" size={20} color={LuxuryColors.gold} />
          <Text style={styles.addDayText}>Add Another Day</Text>
        </TouchableOpacity>

        {/* ── Actions ── */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={[styles.draftBtn, saving && styles.btnDisabled]}
            onPress={handleSaveDraft}
            disabled={saving || submitting}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color={LuxuryColors.gold} size="small" />
            ) : (
              <Text style={styles.draftBtnText}>Save Draft</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.btnDisabled]}
            onPress={handleSubmitForReview}
            disabled={saving || submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color={LuxuryColors.background} size="small" />
            ) : (
              <Text style={styles.submitBtnText}>Submit For Review</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: LuxuryColors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: LuxuryColors.background,
  },
  content: {
    paddingHorizontal: LuxurySpacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: LuxurySpacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: LuxuryFontSize.lg,
    fontWeight: '600',
    color: LuxuryColors.textPrimary,
    letterSpacing: 0.3,
  },
  divider: {
    height: 1,
    backgroundColor: LuxuryColors.divider,
    marginBottom: LuxurySpacing.lg,
  },
  input: {
    backgroundColor: LuxuryColors.surface,
    borderWidth: 1,
    borderColor: LuxuryColors.divider,
    borderRadius: LuxuryBorderRadius.md,
    paddingHorizontal: LuxurySpacing.md,
    paddingVertical: LuxurySpacing.sm + 4,
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textPrimary,
    marginBottom: LuxurySpacing.md,
  },
  textArea: {
    minHeight: 88,
    paddingTop: LuxurySpacing.sm + 4,
  },
  row: {
    flexDirection: 'row',
  },
  flex1: {
    flex: 1,
  },
  spacer: {
    width: LuxurySpacing.sm,
  },
  hint: {
    fontSize: LuxuryFontSize.xs,
    color: LuxuryColors.textTertiary,
    marginBottom: LuxurySpacing.md,
    marginTop: -LuxurySpacing.sm,
  },
  budgetRow: {
    flexDirection: 'row',
    gap: LuxurySpacing.sm,
    marginBottom: LuxurySpacing.md,
  },
  budgetBtn: {
    flex: 1,
    paddingVertical: LuxurySpacing.sm + 2,
    borderRadius: LuxuryBorderRadius.md,
    borderWidth: 1,
    borderColor: LuxuryColors.divider,
    backgroundColor: LuxuryColors.surface,
    alignItems: 'center',
  },
  budgetBtnActive: {
    borderColor: LuxuryColors.gold,
    backgroundColor: `${LuxuryColors.gold}18`,
  },
  budgetText: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textTertiary,
    fontWeight: '500',
  },
  budgetTextActive: {
    color: LuxuryColors.gold,
  },
  dayCard: {
    backgroundColor: LuxuryColors.surface,
    borderRadius: LuxuryBorderRadius.md,
    padding: LuxurySpacing.md,
    marginBottom: LuxurySpacing.md,
    borderWidth: 1,
    borderColor: LuxuryColors.divider,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: LuxurySpacing.sm,
  },
  dayBadge: {
    backgroundColor: `${LuxuryColors.gold}18`,
    borderRadius: LuxuryBorderRadius.sm,
    paddingHorizontal: LuxurySpacing.sm,
    paddingVertical: 3,
  },
  dayBadgeText: {
    fontSize: LuxuryFontSize.xs,
    color: LuxuryColors.gold,
    fontWeight: '600',
  },
  addDayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.xs,
    marginBottom: LuxurySpacing.lg,
  },
  addDayText: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.gold,
    fontWeight: '500',
  },
  actionsSection: {
    gap: LuxurySpacing.sm,
    marginTop: LuxurySpacing.sm,
  },
  draftBtn: {
    borderWidth: 1,
    borderColor: LuxuryColors.gold,
    borderRadius: LuxuryBorderRadius.lg,
    paddingVertical: LuxurySpacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftBtnText: {
    fontSize: LuxuryFontSize.md,
    fontWeight: '600',
    color: LuxuryColors.gold,
    letterSpacing: 0.3,
  },
  submitBtn: {
    backgroundColor: LuxuryColors.gold,
    borderRadius: LuxuryBorderRadius.lg,
    paddingVertical: LuxurySpacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    fontSize: LuxuryFontSize.md,
    fontWeight: '700',
    color: LuxuryColors.background,
    letterSpacing: 0.3,
  },
  btnDisabled: {
    opacity: 0.5,
  },
});

const sectionStyles = StyleSheet.create({
  wrapper: {
    marginTop: LuxurySpacing.lg,
    marginBottom: LuxurySpacing.md,
  },
  title: {
    fontSize: LuxuryFontSize.xs,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: LuxurySpacing.xs,
  },
  line: {
    height: 1,
    backgroundColor: `${LuxuryColors.gold}30`,
  },
});

const fieldStyles = StyleSheet.create({
  label: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textSecondary,
    marginBottom: LuxurySpacing.xs,
    fontWeight: '500',
  },
  required: {
    color: LuxuryColors.error,
  },
});

const gateStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LuxuryColors.background,
    paddingHorizontal: LuxurySpacing.lg,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: LuxurySpacing.xl,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: LuxurySpacing.xxxl,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: LuxurySpacing.lg,
  },
  title: {
    fontSize: LuxuryFontSize.xl,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
    textAlign: 'center',
    marginBottom: LuxurySpacing.sm,
  },
  bodyText: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: LuxurySpacing.lg,
    marginBottom: LuxurySpacing.xl,
  },
  cta: {
    borderWidth: 1,
    borderColor: LuxuryColors.gold,
    borderRadius: LuxuryBorderRadius.lg,
    paddingVertical: LuxurySpacing.md,
    paddingHorizontal: LuxurySpacing.xl,
  },
  ctaText: {
    fontSize: LuxuryFontSize.md,
    fontWeight: '600',
    color: LuxuryColors.gold,
  },
});
