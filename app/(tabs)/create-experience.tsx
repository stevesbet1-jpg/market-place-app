/**
 * create-experience.tsx
 *
 * Creator experience submission form.
 * Supports both Create (no id param) and Edit (id param) modes.
 *
 * Approval gate: only approved creators can access this screen.
 *
 * Save Draft   → status: 'draft'        (private, editable)
 * Submit       → status: 'pending_review' (queued for editorial review)
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
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LuxuryColors,
  LuxuryBorderRadius,
  LuxurySpacing,
  LuxuryFontSize,
} from '../../constants/luxuryTheme';
import {
  saveExperienceDraft,
  submitExperienceForReview,
  updateExperience,
  getExperienceById,
} from '../../lib/creatorExperienceService';
import {
  getCurrentUid,
  getMyApprovedCreatorProfile,
  getMyApplicationStatus,
} from '../../lib/creatorService';
import {
  TRAVEL_STYLES,
  BUDGET_RANGES,
  type TravelStyle,
  type BudgetRange,
  type ExperienceUploadPayload,
} from '../../constants/creatorExperienceModel';
import type { Creator } from '../../constants/creators';

// ─── Local types ──────────────────────────────────────────────────────────────

interface DayDraft {
  day: number;
  activitiesText: string; // comma-separated during editing
}

type AccessStatus = 'no-auth' | 'none' | 'pending' | 'rejected' | 'approved';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function splitTags(raw: string): string[] {
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
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

// ─── Access gate ──────────────────────────────────────────────────────────────

function AccessGateView({ status, onBack }: { status: AccessStatus; onBack: () => void }) {
  const insets = useSafeAreaInsets();

  const cfg: Record<
    AccessStatus,
    { icon: keyof typeof Ionicons.glyphMap; color: string; title: string; body: string }
  > = {
    'no-auth': {
      icon: 'person-circle-outline',
      color: LuxuryColors.textTertiary,
      title: 'Sign In Required',
      body: 'You need a Voya account to create experiences.',
    },
    none: {
      icon: 'create-outline',
      color: LuxuryColors.gold,
      title: 'Apply as Creator First',
      body: 'Submit a creator application before you can create experiences.',
    },
    pending: {
      icon: 'time-outline',
      color: LuxuryColors.gold,
      title: 'Application Under Review',
      body: 'Your application is being reviewed. You will be notified by email when approved.',
    },
    rejected: {
      icon: 'close-circle-outline',
      color: LuxuryColors.error,
      title: 'Application Not Accepted',
      body: 'Your creator application was not accepted at this time.',
    },
    approved: {
      icon: 'checkmark-circle',
      color: LuxuryColors.success,
      title: 'Approved',
      body: '',
    },
  };

  const m = cfg[status];

  return (
    <View
      style={[
        gateStyles.container,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
      ]}
    >
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

export default function CreateExperienceScreen() {
  const insets = useSafeAreaInsets();
  const { id: editId } = useLocalSearchParams<{ id?: string }>();
  const isEditMode = Boolean(editId);

  // ── Auth + approval gate ─────────────────────────────────────────────
  const [checking, setChecking] = useState(true);
  const [creatorProfile, setCreatorProfile] = useState<Creator | null>(null);
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    const checkAccess = async () => {
      const uid = getCurrentUid();
      if (!uid) {
        if (!cancelled) { setAccessStatus('no-auth'); setChecking(false); }
        return;
      }
      const profile = await getMyApprovedCreatorProfile(uid);
      if (!cancelled) {
        if (profile) {
          setCreatorProfile(profile);
          setAccessStatus('approved');
        } else {
          const status = await getMyApplicationStatus(uid);
          setAccessStatus(status === 'none' ? 'none' : (status as AccessStatus));
        }
        setChecking(false);
      }
    };
    checkAccess();
    return () => { cancelled = true; };
  }, []);

  // ── Form state ───────────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [travelStyle, setTravelStyle] = useState<TravelStyle>('adventure');
  const [duration, setDuration] = useState('');
  const [budget, setBudget] = useState<BudgetRange>('$$');
  const [coverImage, setCoverImage] = useState('');
  const [description, setDescription] = useState('');
  const [tipsText, setTipsText] = useState('');
  const [hiddenGemsText, setHiddenGemsText] = useState('');
  const [restaurantsText, setRestaurantsText] = useState('');
  const [hotelsText, setHotelsText] = useState('');
  const [dailyPlan, setDailyPlan] = useState<DayDraft[]>([{ day: 1, activitiesText: '' }]);

  const [loadingExisting, setLoadingExisting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ── Load existing experience in edit mode ────────────────────────────
  useEffect(() => {
    if (!editId || !isEditMode) return;
    let cancelled = false;
    const load = async () => {
      setLoadingExisting(true);
      try {
        const exp = await getExperienceById(editId);
        if (!cancelled && exp) {
          setTitle(exp.title);
          setCountry(exp.country);
          setCity(exp.city);
          setTravelStyle(exp.travelStyle);
          setDuration(exp.duration);
          setBudget(exp.budget);
          setCoverImage(exp.coverImage ?? '');
          setDescription(exp.description);
          setTipsText(exp.tips.join(', '));
          setHiddenGemsText(exp.hiddenGems.join(', '));
          setRestaurantsText(exp.restaurants.join(', '));
          setHotelsText(exp.hotels.join(', '));
          setDailyPlan(
            exp.dailyPlan.length > 0
              ? exp.dailyPlan.map((d) => ({ day: d.day, activitiesText: d.activities.join(', ') }))
              : [{ day: 1, activitiesText: '' }]
          );
        }
      } finally {
        if (!cancelled) setLoadingExisting(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [editId, isEditMode]);

  // ── Itinerary helpers ────────────────────────────────────────────────
  const addDay = useCallback(() => {
    setDailyPlan((prev) => [...prev, { day: prev.length + 1, activitiesText: '' }]);
  }, []);

  const removeDay = useCallback((index: number) => {
    setDailyPlan((prev) =>
      prev.filter((_, i) => i !== index).map((d, i) => ({ ...d, day: i + 1 }))
    );
  }, []);

  const updateDayText = useCallback((index: number, text: string) => {
    setDailyPlan((prev) =>
      prev.map((d, i) => (i === index ? { ...d, activitiesText: text } : d))
    );
  }, []);

  // ── Validation ────────────────────────────────────────────────────────
  function validate(): string | null {
    if (!title.trim()) return 'Experience Title is required.';
    if (!country.trim()) return 'Country is required.';
    if (!city.trim()) return 'City is required.';
    if (!duration.trim()) return 'Duration is required.';
    if (!description.trim()) return 'Short Description is required.';
    return null;
  }

  // ── Build payload ─────────────────────────────────────────────────────
  function buildPayload(): ExperienceUploadPayload {
    const uid = getCurrentUid();
    return {
      creatorId: uid ?? '',
      creatorName: creatorProfile?.name ?? '',
      title: title.trim(),
      country: country.trim(),
      city: city.trim(),
      travelStyle,
      duration: duration.trim(),
      budget,
      coverImage: coverImage.trim() || null,
      description: description.trim(),
      tips: splitTags(tipsText),
      hiddenGems: splitTags(hiddenGemsText),
      restaurants: splitTags(restaurantsText),
      hotels: splitTags(hotelsText),
      dailyPlan: dailyPlan.map((d) => ({
        day: d.day,
        activities: splitTags(d.activitiesText),
      })),
    };
  }

  // ── Save Draft ────────────────────────────────────────────────────────
  const handleSaveDraft = useCallback(async () => {
    if (!title.trim()) {
      Alert.alert('Title Required', 'Please enter an experience title before saving a draft.');
      return;
    }
    setSaving(true);
    try {
      if (isEditMode && editId) {
        await updateExperience(editId, { ...buildPayload(), status: 'draft' });
      } else {
        await saveExperienceDraft(buildPayload());
      }
      Alert.alert(
        'Draft Saved',
        'Your experience has been saved as a draft.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e: unknown) {
      Alert.alert('Save Failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [title, country, city, travelStyle, duration, budget, coverImage, description, tipsText, hiddenGemsText, restaurantsText, hotelsText, dailyPlan, creatorProfile, isEditMode, editId]);

  // ── Submit For Review ─────────────────────────────────────────────────
  const handleSubmitForReview = useCallback(async () => {
    const err = validate();
    if (err) { Alert.alert('Missing Information', err); return; }

    Alert.alert(
      'Submit for Review',
      'Your experience will be reviewed before being published. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            setSubmitting(true);
            try {
              if (isEditMode && editId) {
                await updateExperience(editId, { ...buildPayload(), status: 'pending_review' });
              } else {
                await submitExperienceForReview(buildPayload());
              }
              Alert.alert(
                'Submitted',
                'Your experience is now under review. You will be notified when it is approved.',
                [{ text: 'OK', onPress: () => router.back() }]
              );
            } catch (e: unknown) {
              Alert.alert('Submission Failed', e instanceof Error ? e.message : 'Unknown error');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  }, [title, country, city, travelStyle, duration, budget, coverImage, description, tipsText, hiddenGemsText, restaurantsText, hotelsText, dailyPlan, creatorProfile, isEditMode, editId]);

  // ── Render states ─────────────────────────────────────────────────────
  if (checking || loadingExisting) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={LuxuryColors.gold} size="large" />
      </View>
    );
  }

  if (accessStatus && accessStatus !== 'approved') {
    return <AccessGateView status={accessStatus} onBack={() => router.back()} />;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: LuxuryColors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 48 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={LuxuryColors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isEditMode ? 'Edit Experience' : 'Create Experience'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.divider} />

        {/* ── Basic Details ── */}
        <SectionHeader title="Experience Details" />

        <FieldLabel text="Experience Title" required />
        <TextInput
          style={styles.input}
          placeholder="e.g. Hidden Temples of Kyoto"
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

        {/* Travel Style */}
        <FieldLabel text="Travel Style" required />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.styleRow}
        >
          {TRAVEL_STYLES.map((s) => (
            <TouchableOpacity
              key={s.value}
              style={[styles.styleChip, travelStyle === s.value && styles.styleChipActive]}
              onPress={() => setTravelStyle(s.value)}
              activeOpacity={0.7}
            >
              <Text style={styles.styleIcon}>{s.icon}</Text>
              <Text style={[styles.styleText, travelStyle === s.value && styles.styleTextActive]}>
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Budget */}
        <FieldLabel text="Budget Range" required />
        <View style={styles.budgetRow}>
          {BUDGET_RANGES.map((level) => (
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

        {/* ── Cover Image ── */}
        <SectionHeader title="Cover Image" />

        <FieldLabel text="Cover Image URL" />
        <TextInput
          style={styles.input}
          placeholder="https://example.com/image.jpg"
          placeholderTextColor={LuxuryColors.textTertiary}
          value={coverImage}
          onChangeText={setCoverImage}
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={500}
        />
        <Text style={styles.hint}>Paste a public image URL for your experience cover photo.</Text>

        {/* ── Description ── */}
        <SectionHeader title="Description" />

        <FieldLabel text="Short Description" required />
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe this experience in 2–3 sentences…"
          placeholderTextColor={LuxuryColors.textTertiary}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          maxLength={600}
          textAlignVertical="top"
        />

        {/* ── Creator Tips ── */}
        <SectionHeader title="Creator Tips" />

        <FieldLabel text="Personal Tips" />
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Best time to visit, local etiquette, must-know tips… (comma-separated)"
          placeholderTextColor={LuxuryColors.textTertiary}
          value={tipsText}
          onChangeText={setTipsText}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          maxLength={800}
        />

        <FieldLabel text="Hidden Gems" />
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Off-the-beaten-path spots (comma-separated)"
          placeholderTextColor={LuxuryColors.textTertiary}
          value={hiddenGemsText}
          onChangeText={setHiddenGemsText}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          maxLength={600}
        />

        {/* ── Restaurants & Hotels ── */}
        <SectionHeader title="Recommendations" />

        <FieldLabel text="Restaurants" />
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Restaurant name, another place… (comma-separated)"
          placeholderTextColor={LuxuryColors.textTertiary}
          value={restaurantsText}
          onChangeText={setRestaurantsText}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          maxLength={600}
        />

        <FieldLabel text="Hotels & Stays" />
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Hotel name, ryokan, boutique stay… (comma-separated)"
          placeholderTextColor={LuxuryColors.textTertiary}
          value={hotelsText}
          onChangeText={setHotelsText}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          maxLength={600}
        />

        {/* ── Daily Plan ── */}
        <SectionHeader title="Daily Plan" />
        <Text style={styles.hint}>Add activities for each day (comma-separated).</Text>

        {dailyPlan.map((day, index) => (
          <View key={index} style={styles.dayCard}>
            <View style={styles.dayHeader}>
              <View style={styles.dayBadge}>
                <Text style={styles.dayBadgeText}>Day {day.day}</Text>
              </View>
              {dailyPlan.length > 1 && (
                <TouchableOpacity
                  onPress={() => removeDay(index)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle-outline" size={20} color={LuxuryColors.error} />
                </TouchableOpacity>
              )}
            </View>
            <TextInput
              style={[styles.input, styles.textArea, { marginBottom: 0 }]}
              placeholder="Visit Fushimi Inari, Tea ceremony, Gion night walk…"
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
            style={[styles.draftBtn, (saving || submitting) && styles.btnDisabled]}
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
            style={[styles.submitBtn, (saving || submitting) && styles.btnDisabled]}
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
  flex1: { flex: 1 },
  spacer: { width: LuxurySpacing.sm },
  hint: {
    fontSize: LuxuryFontSize.xs,
    color: LuxuryColors.textTertiary,
    marginBottom: LuxurySpacing.md,
    marginTop: -LuxurySpacing.sm,
  },
  styleRow: {
    paddingBottom: LuxurySpacing.md,
    gap: LuxurySpacing.sm,
  },
  styleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.xs,
    paddingHorizontal: LuxurySpacing.md,
    paddingVertical: LuxurySpacing.sm,
    borderRadius: LuxuryBorderRadius.full,
    borderWidth: 1,
    borderColor: LuxuryColors.divider,
    backgroundColor: LuxuryColors.surface,
  },
  styleChipActive: {
    borderColor: LuxuryColors.gold,
    backgroundColor: `${LuxuryColors.gold}18`,
  },
  styleIcon: { fontSize: 14 },
  styleText: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textTertiary,
    fontWeight: '500',
  },
  styleTextActive: { color: LuxuryColors.gold },
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
  budgetTextActive: { color: LuxuryColors.gold },
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
  btnDisabled: { opacity: 0.5 },
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
  required: { color: LuxuryColors.error },
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
