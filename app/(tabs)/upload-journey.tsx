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
} from '../../constants/luxuryTheme';
import { publishCreatorJourney, saveDraftJourney } from '../../lib/creatorJourneyService';
import {
  getCurrentUid,
  getMyApprovedCreatorProfile,
} from '../../lib/creatorService';
import type { BudgetLevel, JourneyUploadPayload } from '../../constants/creatorJourneyModel';
import type { Creator } from '../../constants/creators';

// ─── Local form types ─────────────────────────────────────────────────────────

interface ItineraryDayDraft {
  day: number;
  /** Comma-separated activities while editing */
  activitiesText: string;
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

function FieldLabel({ text }: { text: string }) {
  return <Text style={fieldStyles.label}>{text}</Text>;
}

const BUDGET_LEVELS: BudgetLevel[] = ['$', '$$', '$$$', '$$$$'];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function UploadJourneyScreen() {
  const insets = useSafeAreaInsets();

  // ── Auth + approval gate ─────────────────────────────────────────────
  const [checking, setChecking] = useState(true);
  const [creatorProfile, setCreatorProfile] = useState<Creator | null>(null);
  const [accessStatus, setAccessStatus] = useState<'no-auth' | 'not-creator' | 'approved' | null>(null);

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
          setAccessStatus('not-creator');
        }
        setChecking(false);
      }
    };
    checkAccess();
    return () => { cancelled = true; };
  }, []);

  const [publishing, setPublishing] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Journey Basics ──────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [region, setRegion] = useState('');
  const [duration, setDuration] = useState('');
  const [bestTime, setBestTime] = useState('');
  const [overview, setOverview] = useState('');

  // ── Budget ──────────────────────────────────────────────────────────
  const [budget, setBudget] = useState<BudgetLevel>('$$');
  const [dailyBudget, setDailyBudget] = useState('');

  // ── Image ────────────────────────────────────────────────────────────
  const [imageUrl, setImageUrl] = useState('');

  // ── Content ─────────────────────────────────────────────────────────
  const [places, setPlaces] = useState('');
  const [restaurants, setRestaurants] = useState('');
  const [experiences, setExperiences] = useState('');

  // ── Itinerary ────────────────────────────────────────────────────────
  const [itinerary, setItinerary] = useState<ItineraryDayDraft[]>([
    { day: 1, activitiesText: '' },
  ]);

  // ── Itinerary helpers ────────────────────────────────────────────────

  const addDay = useCallback(() => {
    setItinerary((prev) => [
      ...prev,
      { day: prev.length + 1, activitiesText: '' },
    ]);
  }, []);

  const removeDay = useCallback((index: number) => {
    setItinerary((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((d, i) => ({ ...d, day: i + 1 }))
    );
  }, []);

  const updateDayText = useCallback((index: number, text: string) => {
    setItinerary((prev) =>
      prev.map((d, i) => (i === index ? { ...d, activitiesText: text } : d))
    );
  }, []);

  // ── Build payload ────────────────────────────────────────────────────

  const buildPayload = useCallback((): JourneyUploadPayload => {
    return {
      creatorId: creatorProfile?.id ?? getCurrentUid() ?? 'unknown',
      creatorName: creatorProfile?.name ?? 'Creator',
      title: title.trim(),
      destination: destination.trim(),
      region: region.trim(),
      duration: duration.trim(),
      bestTime: bestTime.trim(),
      overview: overview.trim(),
      budget,
      dailyBudget: dailyBudget.trim(),
      imageUri: imageUrl.trim() || null,
      places: splitTags(places),
      restaurants: splitTags(restaurants),
      experiences: splitTags(experiences),
      itinerary: itinerary.map((d) => ({
        day: d.day,
        activities: splitTags(d.activitiesText),
      })),
    };
  }, [
    creatorProfile,
    title,
    destination,
    region,
    duration,
    bestTime,
    overview,
    budget,
    dailyBudget,
    imageUrl,
    places,
    restaurants,
    experiences,
    itinerary,
  ]);

  // ── Validation ───────────────────────────────────────────────────────

  const validate = useCallback((): boolean => {
    if (!title.trim()) {
      Alert.alert('Missing field', 'Please enter a journey title.');
      return false;
    }
    if (!destination.trim()) {
      Alert.alert('Missing field', 'Please enter a destination.');
      return false;
    }
    if (!overview.trim()) {
      Alert.alert('Missing field', 'Please write a short overview.');
      return false;
    }
    return true;
  }, [title, destination, overview]);

  // ── Actions ──────────────────────────────────────────────────────────

  const handlePublish = useCallback(async () => {
    if (!validate()) return;
    setPublishing(true);
    try {
      await publishCreatorJourney(buildPayload());
      Alert.alert(
        'Journey Published',
        'Your journey is now live in the marketplace.',
        [{ text: 'Done', onPress: () => router.back() }]
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not publish. Try again.';
      Alert.alert('Publish failed', msg);
    } finally {
      setPublishing(false);
    }
  }, [validate, buildPayload]);

  const handleSaveDraft = useCallback(async () => {
    if (!title.trim()) {
      Alert.alert('Missing field', 'Enter a title before saving as draft.');
      return;
    }
    setSaving(true);
    try {
      await saveDraftJourney(buildPayload());
      Alert.alert('Draft saved', 'You can find and publish it later from your profile.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not save draft.';
      Alert.alert('Save failed', msg);
    } finally {
      setSaving(false);
    }
  }, [title, buildPayload]);

  // ── Access gate ──────────────────────────────────────────────────────

  if (checking) {
    return (
      <View style={[gateStyles.center, { backgroundColor: LuxuryColors.background }]}>
        <ActivityIndicator color={LuxuryColors.gold} />
      </View>
    );
  }

  if (accessStatus !== 'approved') {
    const isNoAuth = accessStatus === 'no-auth';

    const icon: keyof typeof Ionicons.glyphMap = isNoAuth
      ? 'person-circle-outline'
      : 'create-outline';

    const title = isNoAuth ? 'Sign In Required' : 'Become a Creator First';

    const body = isNoAuth
      ? 'You need a Voya account to upload journeys.'
      : 'Go to your Profile to activate your free creator account instantly — no approval needed.';

    const ctaLabel = isNoAuth ? 'Sign In' : 'Go to Profile';
    const ctaAction = isNoAuth
      ? () => router.replace('/(auth)/login')
      : () => router.push('/(tabs)/profile');

    return (
      <View
        style={[
          gateStyles.center,
          { backgroundColor: LuxuryColors.background, paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={gateStyles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={LuxuryColors.textPrimary} />
        </TouchableOpacity>
        <View style={gateStyles.body}>
          <Ionicons
            name={icon}
            size={52}
            color={isNoAuth ? LuxuryColors.textTertiary : LuxuryColors.gold}
          />
          <Text style={gateStyles.title}>{title}</Text>
          <Text style={gateStyles.body2}>{body}</Text>
          <TouchableOpacity style={gateStyles.cta} onPress={ctaAction} activeOpacity={0.85}>
            <Text style={gateStyles.ctaText}>{ctaLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={LuxuryColors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Upload Journey</Text>
          <TouchableOpacity
            style={[styles.draftBtn, saving && styles.btnDisabled]}
            onPress={handleSaveDraft}
            disabled={saving || publishing}
          >
            {saving
              ? <ActivityIndicator size="small" color={LuxuryColors.textSecondary} />
              : <Text style={styles.draftBtnText}>Save Draft</Text>}
          </TouchableOpacity>
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
          {/* ── Creator Subscription Gate ────────────────────────────── */}
          <TouchableOpacity
            style={styles.subscriptionBanner}
            onPress={() => router.push('/(tabs)/creator-subscription')}
            activeOpacity={0.85}
          >
            <Ionicons name="diamond-outline" size={16} color={LuxuryColors.gold} />
            <Text style={styles.subscriptionText}>
              Creator Subscription required to publish journeys
            </Text>
            <Ionicons name="chevron-forward" size={14} color={LuxuryColors.gold} />
          </TouchableOpacity>

          {/* ── Section 1 – Journey Basics ────────────────────────────── */}
          <SectionHeader title="Journey Basics" />

          <FieldLabel text="Journey Title *" />
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Hidden Gems of Kyoto"
            placeholderTextColor={LuxuryColors.textTertiary}
          />

          <FieldLabel text="Destination *" />
          <TextInput
            style={styles.input}
            value={destination}
            onChangeText={setDestination}
            placeholder="e.g. Kyoto, Japan"
            placeholderTextColor={LuxuryColors.textTertiary}
          />

          <FieldLabel text="Region" />
          <TextInput
            style={styles.input}
            value={region}
            onChangeText={setRegion}
            placeholder="e.g. East Asia"
            placeholderTextColor={LuxuryColors.textTertiary}
          />

          <FieldLabel text="Duration" />
          <TextInput
            style={styles.input}
            value={duration}
            onChangeText={setDuration}
            placeholder="e.g. 7 Days"
            placeholderTextColor={LuxuryColors.textTertiary}
          />

          <FieldLabel text="Best Travel Dates" />
          <TextInput
            style={styles.input}
            value={bestTime}
            onChangeText={setBestTime}
            placeholder="e.g. Mar – May"
            placeholderTextColor={LuxuryColors.textTertiary}
          />

          <FieldLabel text="Overview *" />
          <TextInput
            style={[styles.input, styles.textArea]}
            value={overview}
            onChangeText={setOverview}
            placeholder="Describe your journey in a few sentences…"
            placeholderTextColor={LuxuryColors.textTertiary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          {/* ── Section 2 – Budget ────────────────────────────────────── */}
          <SectionHeader title="Budget" />

          <FieldLabel text="Budget Level" />
          <View style={styles.budgetRow}>
            {BUDGET_LEVELS.map((level) => (
              <TouchableOpacity
                key={level}
                style={[styles.budgetChip, budget === level && styles.budgetChipActive]}
                onPress={() => setBudget(level)}
              >
                <Text
                  style={[
                    styles.budgetChipText,
                    budget === level && styles.budgetChipTextActive,
                  ]}
                >
                  {level}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <FieldLabel text="Daily Budget Range" />
          <TextInput
            style={styles.input}
            value={dailyBudget}
            onChangeText={setDailyBudget}
            placeholder="e.g. $150–300/day"
            placeholderTextColor={LuxuryColors.textTertiary}
          />

          {/* ── Section 3 – Destination Image ────────────────────────── */}
          <SectionHeader title="Destination Image" />

          <FieldLabel text="Image URL" />
          <TextInput
            style={styles.input}
            value={imageUrl}
            onChangeText={setImageUrl}
            placeholder="https://images.unsplash.com/…"
            placeholderTextColor={LuxuryColors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Text style={styles.hint}>
            Paste a publicly accessible image URL. Native upload support coming soon.
          </Text>

          {/* ── Section 4 – Places to Visit ──────────────────────────── */}
          <SectionHeader title="Places to Visit" />

          <TextInput
            style={[styles.input, styles.textArea]}
            value={places}
            onChangeText={setPlaces}
            placeholder="Arashiyama Bamboo Grove, Fushimi Inari Shrine, Nishiki Market"
            placeholderTextColor={LuxuryColors.textTertiary}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
          <Text style={styles.hint}>Separate each place with a comma.</Text>

          {/* ── Section 5 – Restaurants & Cafés ──────────────────────── */}
          <SectionHeader title="Restaurants & Cafés" />

          <TextInput
            style={[styles.input, styles.textArea]}
            value={restaurants}
            onChangeText={setRestaurants}
            placeholder="Kikunoi Honten, Nishiki Warai, Ippudo Ramen"
            placeholderTextColor={LuxuryColors.textTertiary}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
          <Text style={styles.hint}>Separate each restaurant with a comma.</Text>

          {/* ── Section 6 – Local Experiences ────────────────────────── */}
          <SectionHeader title="Local Experiences" />

          <TextInput
            style={[styles.input, styles.textArea]}
            value={experiences}
            onChangeText={setExperiences}
            placeholder="Tea ceremony, Geisha district walk, Zen garden meditation"
            placeholderTextColor={LuxuryColors.textTertiary}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
          <Text style={styles.hint}>Separate each experience with a comma.</Text>

          {/* ── Section 7 – Day-by-Day Itinerary ─────────────────────── */}
          <SectionHeader title="Day-by-Day Itinerary" />

          {itinerary.map((day, idx) => (
            <View key={idx} style={styles.itineraryRow}>
              <View style={styles.dayBadge}>
                <Text style={styles.dayBadgeText}>Day</Text>
                <Text style={styles.dayBadgeNum}>{day.day}</Text>
              </View>
              <TextInput
                style={[styles.input, styles.itineraryInput]}
                value={day.activitiesText}
                onChangeText={(t) => updateDayText(idx, t)}
                placeholder="Arrival, city tour, rooftop dinner…"
                placeholderTextColor={LuxuryColors.textTertiary}
                multiline
                textAlignVertical="top"
              />
              {itinerary.length > 1 && (
                <TouchableOpacity
                  onPress={() => removeDay(idx)}
                  style={styles.removeDayBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={LuxuryColors.textTertiary}
                  />
                </TouchableOpacity>
              )}
            </View>
          ))}

          <TouchableOpacity style={styles.addDayBtn} onPress={addDay}>
            <Ionicons name="add-circle-outline" size={18} color={LuxuryColors.gold} />
            <Text style={styles.addDayText}>Add Day</Text>
          </TouchableOpacity>

          {/* ── Publish ───────────────────────────────────────────────── */}
          <TouchableOpacity
            style={[styles.publishBtnLarge, publishing && styles.btnDisabled]}
            onPress={handlePublish}
            disabled={publishing || saving}
            activeOpacity={0.85}
          >
            {publishing
              ? <ActivityIndicator color={LuxuryColors.background} />
              : <Text style={styles.publishBtnLargeText}>Publish Journey</Text>}
          </TouchableOpacity>

          <Text style={styles.publishNote}>
            By publishing you confirm this is your original content and you hold a valid
            Creator Subscription.
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
});

// ─── Screen styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },

  container: {
    flex: 1,
    backgroundColor: LuxuryColors.background,
  },

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
  draftBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: LuxuryBorderRadius.sm,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  draftBtnText: {
    color: LuxuryColors.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
  btnDisabled: { opacity: 0.45 },

  scrollContent: {
    paddingHorizontal: LuxurySpacing.md,
    paddingTop: LuxurySpacing.md,
  },

  // Subscription banner
  subscriptionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(212,175,55,0.07)',
    borderRadius: LuxuryBorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 4,
  },
  subscriptionText: {
    flex: 1,
    color: LuxuryColors.gold,
    fontSize: 13,
    fontWeight: '600',
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
  textArea: {
    minHeight: 84,
    paddingTop: 12,
  },
  hint: {
    color: LuxuryColors.textTertiary,
    fontSize: 12,
    marginTop: -6,
    marginBottom: 14,
  },

  // Budget chips
  budgetRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  budgetChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: LuxuryBorderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: LuxuryColors.surface,
  },
  budgetChipActive: {
    borderColor: LuxuryColors.gold,
    backgroundColor: 'rgba(212,175,55,0.1)',
  },
  budgetChipText: {
    color: LuxuryColors.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  budgetChipTextActive: { color: LuxuryColors.gold },

  // Itinerary
  itineraryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  dayBadge: {
    backgroundColor: 'rgba(212,175,55,0.1)',
    borderRadius: LuxuryBorderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minWidth: 52,
    alignItems: 'center',
  },
  dayBadgeText: {
    color: LuxuryColors.textTertiary,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  dayBadgeNum: {
    color: LuxuryColors.gold,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  itineraryInput: {
    flex: 1,
    marginBottom: 0,
  },
  removeDayBtn: { paddingTop: 12 },

  addDayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    marginBottom: 8,
  },
  addDayText: {
    color: LuxuryColors.gold,
    fontSize: 14,
    fontWeight: '600',
  },

  // Publish button
  publishBtnLarge: {
    backgroundColor: LuxuryColors.gold,
    borderRadius: LuxuryBorderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  publishBtnLargeText: {
    color: LuxuryColors.background,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  publishNote: {
    color: LuxuryColors.textTertiary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 18,
  },
});


const gateStyles = StyleSheet.create({
  center: {
    flex: 1,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  backBtn: {
    position: 'absolute',
    top: 0,
    left: 16,
    padding: 8,
  },
  body: {
    alignItems: 'center',
    gap: 16,
    maxWidth: 320,
  },
  title: {
    color: LuxuryColors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  body2: {
    color: LuxuryColors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  cta: {
    backgroundColor: LuxuryColors.gold,
    borderRadius: LuxuryBorderRadius.md,
    paddingHorizontal: 32,
    paddingVertical: 14,
    marginTop: 8,
  },
  ctaText: {
    color: LuxuryColors.background,
    fontWeight: '800',
    fontSize: 15,
  },
});
