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

import React, { useState, useCallback, useEffect, useRef } from 'react';
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
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
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
  updateExperience,
  getExperienceById,
  publishExperience,
} from '../../lib/creatorExperienceService';
import {
  getMyApprovedCreatorProfile,
} from '../../lib/creatorService';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirebaseApp } from '../../lib/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  isValidRemoteImageUrl,
  remoteImageOrPlaceholder,
} from '../../lib/imageFallback';
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
  title: string;
  description: string;
}

interface HotelDraft { name: string; address: string; notes: string; mapsLink: string; }
interface RestaurantDraft { name: string; description: string; mapsLink: string; }
interface HiddenGemDraft { name: string; description: string; mapsLink: string; }

type AccessStatus = 'no-auth' | 'not-creator' | 'approved';

const draftKeyForUid = (uid: string | null) => `@createExp/draft:${uid ?? 'anon'}`;

const emptyDayPlan = [{ day: 1, title: '', description: '' }];

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
  const [authUid, setAuthUid] = useState<string | null>(null);
  const [creatorProfile, setCreatorProfile] = useState<Creator | null>(null);
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null);

  useEffect(() => {
    const auth = getAuth(getFirebaseApp());
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const uid = user?.uid ?? null;
      // Clear account-scoped state immediately on UID boundary changes.
      setCreatorProfile(null);
      setAccessStatus(null);
      setDraftRestored(false);
      setTitle('');
      setCountry('');
      setCity('');
      setTravelStyle('adventure');
      setDuration('');
      setBudget('$$');
      setCoverImage('');
      setLocalCoverPreviewUri('');
      setDescription('');
      setWhoIsItFor('');
      setHighlights([]);
      setCreatorNotes('');
      setTipsText('');
      setBestTimeToVisit('');
      setWarnings('');
      setGoogleMapsUrl('');
      setAppleMapsUrl('');
      setFreePreview(false);
      setDailyPlan(emptyDayPlan);
      setHotels([]);
      setRestaurants([]);
      setHiddenGems([]);
      setLoadingExisting(false);
      setSaving(false);
      setPublishing(false);
      setImageUploading(false);
      setChecking(true);

      setAuthUid(uid);
      console.log('[CreateExp] onAuthStateChanged uid:', uid);
      if (!uid) {
        setAccessStatus('no-auth');
        setChecking(false);
        return;
      }
      const profile = await getMyApprovedCreatorProfile(uid);
      console.log('[CreateExp] creator profile:', profile ? `id=${profile.id} name=${profile.name}` : 'null');
      if (profile) {
        setCreatorProfile(profile);
        setAccessStatus('approved');
        console.log('[CreateExp] access: granted');
      } else {
        console.log('[CreateExp] no creator profile → not-creator');
        setAccessStatus('not-creator');
      }
      setChecking(false);
    });
    return unsubscribe;
  }, []);

  // ── Form state ───────────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [travelStyle, setTravelStyle] = useState<TravelStyle>('adventure');
  const [duration, setDuration] = useState('');
  const [budget, setBudget] = useState<BudgetRange>('$$');
  const [coverImage, setCoverImage] = useState('');
  const [localCoverPreviewUri, setLocalCoverPreviewUri] = useState('');
  const [description, setDescription] = useState('');
  const [whoIsItFor, setWhoIsItFor] = useState('');
  const [highlights, setHighlights] = useState<string[]>([]);
  const [creatorNotes, setCreatorNotes] = useState('');
  const [tipsText, setTipsText] = useState('');
  const [bestTimeToVisit, setBestTimeToVisit] = useState('');
  const [warnings, setWarnings] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [appleMapsUrl, setAppleMapsUrl] = useState('');
  const [freePreview, setFreePreview] = useState(false);
  const [dailyPlan, setDailyPlan] = useState<DayDraft[]>([{ day: 1, title: '', description: '' }]);
  const [hotels, setHotels] = useState<HotelDraft[]>([]);
  const [restaurants, setRestaurants] = useState<RestaurantDraft[]>([]);
  const [hiddenGems, setHiddenGems] = useState<HiddenGemDraft[]>([]);

  const [loadingExisting, setLoadingExisting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePickCoverImage = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Needed', 'Please allow photo library access to upload a cover image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]?.uri) return;

    setImageUploading(true);
    try {
      // Keep local URI for session preview only; no Storage upload in this flow.
      setLocalCoverPreviewUri(result.assets[0].uri);
    } finally {
      setImageUploading(false);
    }
  }, []);

  // ── Restore draft on mount (create mode only) ────────────────────────
  useEffect(() => {
    if (isEditMode) return;
    if (!authUid) return;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(draftKeyForUid(authUid));
        if (!raw) return;
        const d = JSON.parse(raw);
        if (d.title) setTitle(d.title);
        if (d.country) setCountry(d.country);
        if (d.city) setCity(d.city);
        if (d.travelStyle) setTravelStyle(d.travelStyle);
        if (d.duration) setDuration(d.duration);
        if (d.budget) setBudget(d.budget);
        if (d.coverImage && isValidRemoteImageUrl(d.coverImage)) setCoverImage(d.coverImage);
        if (d.description) setDescription(d.description);
        if (d.whoIsItFor) setWhoIsItFor(d.whoIsItFor);
        if (Array.isArray(d.highlights)) setHighlights(d.highlights);
        if (d.creatorNotes) setCreatorNotes(d.creatorNotes);
        if (d.tipsText) setTipsText(d.tipsText);
        if (d.bestTimeToVisit) setBestTimeToVisit(d.bestTimeToVisit);
        if (d.warnings) setWarnings(d.warnings);
        if (d.googleMapsUrl) setGoogleMapsUrl(d.googleMapsUrl);
        if (d.appleMapsUrl) setAppleMapsUrl(d.appleMapsUrl);
        if (typeof d.freePreview === 'boolean') setFreePreview(d.freePreview);
        if (Array.isArray(d.dailyPlan) && d.dailyPlan.length > 0) setDailyPlan(d.dailyPlan);
        if (Array.isArray(d.hotels)) setHotels(d.hotels);
        if (Array.isArray(d.restaurants)) setRestaurants(d.restaurants);
        if (Array.isArray(d.hiddenGems)) setHiddenGems(d.hiddenGems);
        setDraftRestored(true);
      } catch {
        // silently ignore corrupted draft
      }
    })();
  }, [authUid, isEditMode]);

  // ── Auto-save draft (debounced, create mode only) ────────────────────
  useEffect(() => {
    if (isEditMode) return;
    if (!authUid) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(
        draftKeyForUid(authUid),
        JSON.stringify({
          title, country, city, travelStyle, duration, budget,
          coverImage, description, whoIsItFor, highlights,
          creatorNotes, tipsText, bestTimeToVisit, warnings,
          googleMapsUrl, appleMapsUrl, freePreview,
          dailyPlan, hotels, restaurants, hiddenGems,
        })
      ).catch(() => { /* ignore */ });
    }, 1500);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [
    authUid,
    isEditMode, title, country, city, travelStyle, duration, budget,
    coverImage, description, whoIsItFor, highlights,
    creatorNotes, tipsText, bestTimeToVisit, warnings,
    googleMapsUrl, appleMapsUrl, freePreview,
    dailyPlan, hotels, restaurants, hiddenGems,
  ]);

  // ── Load existing experience in edit mode ────────────────────────────
  useEffect(() => {
    if (!editId || !isEditMode || !creatorProfile?.id) return;
    let cancelled = false;
    const load = async () => {
      setLoadingExisting(true);
      try {
        const exp = await getExperienceById(editId);
        if (!cancelled && exp) {
          if (exp.creatorId !== creatorProfile.id) {
            Alert.alert('Access Denied', 'This experience does not belong to your creator account.');
            router.back();
            return;
          }
          setTitle(exp.title);
          setCountry(exp.country);
          setCity(exp.city);
          setTravelStyle(exp.travelStyle);
          setDuration(exp.duration);
          setBudget(exp.budget);
          setCoverImage(exp.coverImage ?? '');
          setDescription(exp.description);
          setWhoIsItFor(exp.whoIsItFor ?? '');
          setHighlights(exp.highlights ?? []);
          setCreatorNotes(exp.creatorNotes ?? '');
          setTipsText(exp.tips.join(', '));
          setBestTimeToVisit(exp.bestTimeToVisit ?? '');
          setWarnings(exp.warnings ?? '');
          setGoogleMapsUrl(exp.googleMapsUrl ?? '');
          setAppleMapsUrl(exp.appleMapsUrl ?? '');
          setFreePreview(exp.freePreview ?? false);
          setDailyPlan(
            exp.dailyPlan.length > 0
              ? exp.dailyPlan.map((d) => ({ day: d.day, title: d.title, description: d.description }))
              : [{ day: 1, title: '', description: '' }]
          );
          setHotels(exp.hotels.map((h) => ({ name: h.name, address: h.address, notes: h.notes ?? '', mapsLink: h.mapsLink ?? '' })));
          setRestaurants(exp.restaurants.map((r) => ({ name: r.name, description: r.description, mapsLink: r.mapsLink ?? '' })));
          setHiddenGems(exp.hiddenGems.map((g) => ({ name: g.name, description: g.description, mapsLink: g.mapsLink ?? '' })));
        }
      } finally {
        if (!cancelled) setLoadingExisting(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [creatorProfile?.id, editId, isEditMode]);

  // ── Itinerary helpers ────────────────────────────────────────────────
  const addDay = useCallback(() => {
    setDailyPlan((prev) => [...prev, { day: prev.length + 1, title: '', description: '' }]);
  }, []);

  const removeDay = useCallback((index: number) => {
    setDailyPlan((prev) =>
      prev.filter((_, i) => i !== index).map((d, i) => ({ ...d, day: i + 1 }))
    );
  }, []);

  const updateDay = useCallback((index: number, field: 'title' | 'description', text: string) => {
    setDailyPlan((prev) =>
      prev.map((d, i) => (i === index ? { ...d, [field]: text } : d))
    );
  }, []);

  // ── Highlight helpers ────────────────────────────────────────────────────
  const addHighlight = useCallback(() => setHighlights((p) => [...p, '']), []);
  const removeHighlight = useCallback((i: number) => setHighlights((p) => p.filter((_, idx) => idx !== i)), []);
  const updateHighlight = useCallback((i: number, v: string) => setHighlights((p) => p.map((h, idx) => idx === i ? v : h)), []);

  // ── Hotel helpers ────────────────────────────────────────────────────────
  const addHotel = useCallback(() => setHotels((p) => [...p, { name: '', address: '', notes: '', mapsLink: '' }]), []);
  const removeHotel = useCallback((i: number) => setHotels((p) => p.filter((_, idx) => idx !== i)), []);
  const updateHotel = useCallback((i: number, f: 'name' | 'address' | 'notes' | 'mapsLink', v: string) =>
    setHotels((p) => p.map((h, idx) => idx === i ? { ...h, [f]: v } : h)), []);

  // ── Restaurant helpers ────────────────────────────────────────────────────
  const addRestaurant = useCallback(() => setRestaurants((p) => [...p, { name: '', description: '', mapsLink: '' }]), []);
  const removeRestaurant = useCallback((i: number) => setRestaurants((p) => p.filter((_, idx) => idx !== i)), []);
  const updateRestaurant = useCallback((i: number, f: 'name' | 'description' | 'mapsLink', v: string) =>
    setRestaurants((p) => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r)), []);

  // ── Hidden Gem helpers ────────────────────────────────────────────────────
  const addHiddenGem = useCallback(() => setHiddenGems((p) => [...p, { name: '', description: '', mapsLink: '' }]), []);
  const removeHiddenGem = useCallback((i: number) => setHiddenGems((p) => p.filter((_, idx) => idx !== i)), []);
  const updateHiddenGem = useCallback((i: number, f: 'name' | 'description' | 'mapsLink', v: string) =>
    setHiddenGems((p) => p.map((g, idx) => idx === i ? { ...g, [f]: v } : g)), []);

  // ── Validation ────────────────────────────────────────────────────────
  function validate(): string | null {
    if (!title.trim()) return 'Experience Title is required.';
    if (!country.trim()) return 'Country is required.';
    if (!city.trim()) return 'City is required.';
    if (!duration.trim()) return 'Duration is required.';
    if (!description.trim()) return 'Short Description is required.';

    const incompleteDays = dailyPlan
      .filter((d) => !d.title.trim() || !d.description.trim())
      .map((d) => d.day)
      .sort((a, b) => a - b);

    if (incompleteDays.length > 0) {
      return `Complete Day Plan details before publishing. Missing title or description for Day ${incompleteDays.join(', Day ')}.`;
    }

    return null;
  }

  // ── Build payload ─────────────────────────────────────────────────────
  function buildPayload(): ExperienceUploadPayload {
    const creatorId = creatorProfile?.id ?? '';
    return {
      creatorId,
      creatorType: creatorProfile?.creatorType ?? 'community',
      creatorName: creatorProfile?.name ?? '',
      title: title.trim(),
      country: country.trim(),
      city: city.trim(),
      travelStyle,
      duration: duration.trim(),
      budget,
      coverImage: remoteImageOrPlaceholder(coverImage),
      description: description.trim(),
      whoIsItFor: whoIsItFor.trim(),
      highlights: highlights.map((h) => h.trim()).filter(Boolean),
      creatorNotes: creatorNotes.trim(),
      tips: tipsText.trim() ? [tipsText.trim()] : [],
      bestTimeToVisit: bestTimeToVisit.trim(),
      warnings: warnings.trim(),
      googleMapsUrl: googleMapsUrl.trim(),
      appleMapsUrl: appleMapsUrl.trim(),
      hiddenGems: hiddenGems.filter((g) => g.name.trim()).map((g) => ({
        name: g.name,
        description: g.description,
        ...(g.mapsLink.trim() ? { mapsLink: g.mapsLink.trim() } : {}),
      })),
      restaurants: restaurants.filter((r) => r.name.trim()).map((r) => ({
        name: r.name,
        description: r.description,
        ...(r.mapsLink.trim() ? { mapsLink: r.mapsLink.trim() } : {}),
      })),
      hotels: hotels.filter((h) => h.name.trim()).map((h) => ({
        name: h.name,
        address: h.address,
        ...(h.notes.trim() ? { notes: h.notes.trim() } : {}),
        ...(h.mapsLink.trim() ? { mapsLink: h.mapsLink.trim() } : {}),
      })),
      dailyPlan: dailyPlan.map((d) => ({
        day: d.day,
        title: d.title.trim(),
        description: d.description.trim(),
      })),
      freePreview,
      published: false,
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
                [{ text: 'OK', onPress: () => { AsyncStorage.removeItem(draftKeyForUid(authUid)).catch(() => {}); router.back(); } }]
      );
    } catch (e: unknown) {
      Alert.alert('Save Failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [title, country, city, travelStyle, duration, budget, coverImage, description, whoIsItFor, highlights, creatorNotes, tipsText, bestTimeToVisit, warnings, googleMapsUrl, appleMapsUrl, freePreview, hiddenGems, restaurants, hotels, dailyPlan, creatorProfile, isEditMode, editId]);

  // ── Publish ──────────────────────────────────────────────────────────
  const handlePublish = useCallback(async () => {
    const err = validate();
    if (err) { Alert.alert('Missing Information', err); return; }

    Alert.alert(
      'Publish Experience',
      'This will make your experience visible to all travelers. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Publish',
          onPress: async () => {
            setPublishing(true);
            try {
              let docId = editId;
              if (isEditMode && editId) {
                await updateExperience(editId, { ...buildPayload(), status: 'published', published: true });
              } else {
                docId = await saveExperienceDraft({ ...buildPayload(), published: false });
                await publishExperience(docId);
              }
              Alert.alert(
                'Published!',
                'Your experience is now live and visible to travelers.',
                [{ text: 'OK', onPress: () => { AsyncStorage.removeItem(draftKeyForUid(authUid)).catch(() => {}); router.back(); } }]
              );
            } catch (e: unknown) {
              Alert.alert('Publish Failed', e instanceof Error ? e.message : 'Unknown error');
            } finally {
              setPublishing(false);
            }
          },
        },
      ]
    );
  }, [title, country, city, travelStyle, duration, budget, coverImage, description, whoIsItFor, highlights, creatorNotes, tipsText, bestTimeToVisit, warnings, googleMapsUrl, appleMapsUrl, freePreview, hiddenGems, restaurants, hotels, dailyPlan, creatorProfile, isEditMode, editId]);

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

        {/* ── Draft restored banner ── */}
        {draftRestored && (
          <View style={styles.draftBanner}>
            <Ionicons name="document-text-outline" size={16} color={LuxuryColors.gold} />
            <Text style={styles.draftBannerText}>Draft restored — your last unsaved progress has been loaded.</Text>
            <TouchableOpacity onPress={() => { setDraftRestored(false); AsyncStorage.removeItem(draftKeyForUid(authUid)).catch(() => {}); }} hitSlop={8}>
              <Ionicons name="close" size={16} color={LuxuryColors.textTertiary} />
            </TouchableOpacity>
          </View>
        )}

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

        <TouchableOpacity
          style={[styles.imagePickBtn, imageUploading && styles.btnDisabled]}
          onPress={handlePickCoverImage}
          activeOpacity={0.8}
          disabled={imageUploading}
        >
          {imageUploading ? (
            <ActivityIndicator color={LuxuryColors.gold} size="small" />
          ) : (
            <>
              <Ionicons name="image-outline" size={18} color={LuxuryColors.gold} />
              <Text style={styles.imagePickText}>{localCoverPreviewUri || coverImage ? 'Replace Cover Image' : 'Pick Cover Image'}</Text>
            </>
          )}
        </TouchableOpacity>
        <Text style={styles.hint}>Select an image from your library for this session preview only.</Text>
        {localCoverPreviewUri || coverImage ? (
          <View style={styles.previewWrap}>
            <Image source={{ uri: localCoverPreviewUri || coverImage }} style={styles.previewImage} resizeMode="cover" />
          </View>
        ) : null}

        {/* ── Description ── */}
        <SectionHeader title="Description" />

        <FieldLabel text="Overview" required />
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

        <FieldLabel text="Who Is It For" />
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Solo adventurers, couples seeking romance, families with teens…"
          placeholderTextColor={LuxuryColors.textTertiary}
          value={whoIsItFor}
          onChangeText={setWhoIsItFor}
          multiline
          numberOfLines={2}
          maxLength={300}
          textAlignVertical="top"
        />

        <FieldLabel text="Highlights" />
        <Text style={styles.hint}>Key selling points — one per item.</Text>
        {highlights.map((hl, i) => (
          <View key={i} style={styles.inlineRow}>
            <TextInput
              style={[styles.input, styles.flex1, { marginBottom: 0 }]}
              placeholder={`Highlight ${i + 1}`}
              placeholderTextColor={LuxuryColors.textTertiary}
              value={hl}
              onChangeText={(v) => updateHighlight(i, v)}
              maxLength={120}
            />
            <TouchableOpacity onPress={() => removeHighlight(i)} style={styles.removeInlineBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle-outline" size={18} color={LuxuryColors.error} />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addRowBtn} onPress={addHighlight} activeOpacity={0.7}>
          <Ionicons name="add-circle-outline" size={18} color={LuxuryColors.gold} />
          <Text style={styles.addRowText}>Add Highlight</Text>
        </TouchableOpacity>

        <FieldLabel text="Creator Notes" />
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Personal observations, context, why this experience matters to you…"
          placeholderTextColor={LuxuryColors.textTertiary}
          value={creatorNotes}
          onChangeText={setCreatorNotes}
          multiline
          numberOfLines={3}
          maxLength={800}
          textAlignVertical="top"
        />

        {/* ── Creator Notes ── */}
        <SectionHeader title="Creator Notes" />

        <FieldLabel text="Local Tips" />
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

        <FieldLabel text="Best Time To Visit" />
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="April–May for cherry blossoms, avoid August humidity…"
          placeholderTextColor={LuxuryColors.textTertiary}
          value={bestTimeToVisit}
          onChangeText={setBestTimeToVisit}
          multiline
          numberOfLines={2}
          textAlignVertical="top"
          maxLength={400}
        />

        <FieldLabel text="Warnings" />
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Tourist traps to avoid, safety notes, seasonal closures…"
          placeholderTextColor={LuxuryColors.textTertiary}
          value={warnings}
          onChangeText={setWarnings}
          multiline
          numberOfLines={2}
          textAlignVertical="top"
          maxLength={400}
        />

        {/* ── Hidden Gems ── */}
        <SectionHeader title="Hidden Gems" />
        <Text style={styles.hint}>Off-the-beaten-path spots known only to insiders.</Text>

        {hiddenGems.map((gem, i) => (
          <View key={i} style={styles.subCard}>
            <View style={styles.subCardHeader}>
              <Text style={styles.subCardLabel}>Gem {i + 1}</Text>
              <TouchableOpacity onPress={() => removeHiddenGem(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle-outline" size={18} color={LuxuryColors.error} />
              </TouchableOpacity>
            </View>
            <FieldLabel text="Name" required />
            <TextInput
              style={styles.input}
              placeholder="Secret rooftop bar, hidden beach cove…"
              placeholderTextColor={LuxuryColors.textTertiary}
              value={gem.name}
              onChangeText={(v) => updateHiddenGem(i, 'name', v)}
              maxLength={100}
            />
            <FieldLabel text="Description" />
            <TextInput
              style={[styles.input, styles.textArea, { marginBottom: 0 }]}
              placeholder="Why it's special and how to find it…"
              placeholderTextColor={LuxuryColors.textTertiary}
              value={gem.description}
              onChangeText={(v) => updateHiddenGem(i, 'description', v)}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
              maxLength={300}
            />
            <FieldLabel text="Google Maps Link" />
            <TextInput
              style={[styles.input, { marginBottom: 0 }]}
              placeholder="https://maps.google.com/…"
              placeholderTextColor={LuxuryColors.textTertiary}
              value={gem.mapsLink}
              onChangeText={(v) => updateHiddenGem(i, 'mapsLink', v)}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={500}
            />
          </View>
        ))}
        <TouchableOpacity style={styles.addRowBtn} onPress={addHiddenGem} activeOpacity={0.7}>
          <Ionicons name="add-circle-outline" size={18} color={LuxuryColors.gold} />
          <Text style={styles.addRowText}>Add Hidden Gem</Text>
        </TouchableOpacity>

        {/* ── Restaurants ── */}
        <SectionHeader title="Restaurants" />
        <Text style={styles.hint}>Dining spots worth knowing about.</Text>

        {restaurants.map((r, i) => (
          <View key={i} style={styles.subCard}>
            <View style={styles.subCardHeader}>
              <Text style={styles.subCardLabel}>Restaurant {i + 1}</Text>
              <TouchableOpacity onPress={() => removeRestaurant(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle-outline" size={18} color={LuxuryColors.error} />
              </TouchableOpacity>
            </View>
            <FieldLabel text="Name" required />
            <TextInput
              style={styles.input}
              placeholder="Nishiki Market stall, Izakaya Yamamoto…"
              placeholderTextColor={LuxuryColors.textTertiary}
              value={r.name}
              onChangeText={(v) => updateRestaurant(i, 'name', v)}
              maxLength={100}
            />
            <FieldLabel text="Description" />
            <TextInput
              style={[styles.input, styles.textArea, { marginBottom: 0 }]}
              placeholder="What to order, atmosphere, price range…"
              placeholderTextColor={LuxuryColors.textTertiary}
              value={r.description}
              onChangeText={(v) => updateRestaurant(i, 'description', v)}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
              maxLength={300}
            />
            <FieldLabel text="Google Maps Link" />
            <TextInput
              style={[styles.input, { marginBottom: 0 }]}
              placeholder="https://maps.google.com/…"
              placeholderTextColor={LuxuryColors.textTertiary}
              value={r.mapsLink}
              onChangeText={(v) => updateRestaurant(i, 'mapsLink', v)}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={500}
            />
          </View>
        ))}
        <TouchableOpacity style={styles.addRowBtn} onPress={addRestaurant} activeOpacity={0.7}>
          <Ionicons name="add-circle-outline" size={18} color={LuxuryColors.gold} />
          <Text style={styles.addRowText}>Add Restaurant</Text>
        </TouchableOpacity>

        {/* ── Hotels & Stays ── */}
        <SectionHeader title="Hotels & Stays" />
        <Text style={styles.hint}>Where to stay during this experience.</Text>

        {hotels.map((h, i) => (
          <View key={i} style={styles.subCard}>
            <View style={styles.subCardHeader}>
              <Text style={styles.subCardLabel}>Stay {i + 1}</Text>
              <TouchableOpacity onPress={() => removeHotel(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle-outline" size={18} color={LuxuryColors.error} />
              </TouchableOpacity>
            </View>
            <FieldLabel text="Name" required />
            <TextInput
              style={styles.input}
              placeholder="Aman Kyoto, Hoshinoya Kyoto…"
              placeholderTextColor={LuxuryColors.textTertiary}
              value={h.name}
              onChangeText={(v) => updateHotel(i, 'name', v)}
              maxLength={100}
            />
            <FieldLabel text="Address" />
            <TextInput
              style={[styles.input, { marginBottom: 0 }]}
              placeholder="1 Okitayama Goryoshitacho, Kita-ku…"
              placeholderTextColor={LuxuryColors.textTertiary}
              value={h.address}
              onChangeText={(v) => updateHotel(i, 'address', v)}
              maxLength={200}
            />
            <FieldLabel text="Notes" />
            <TextInput
              style={[styles.input, styles.textArea, { marginBottom: 0 }]}
              placeholder="Check-in tips, best rooms, booking advice…"
              placeholderTextColor={LuxuryColors.textTertiary}
              value={h.notes}
              onChangeText={(v) => updateHotel(i, 'notes', v)}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
              maxLength={300}
            />
            <FieldLabel text="Google Maps Link" />
            <TextInput
              style={[styles.input, { marginBottom: 0 }]}
              placeholder="https://maps.google.com/…"
              placeholderTextColor={LuxuryColors.textTertiary}
              value={h.mapsLink}
              onChangeText={(v) => updateHotel(i, 'mapsLink', v)}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={500}
            />
          </View>
        ))}
        <TouchableOpacity style={styles.addRowBtn} onPress={addHotel} activeOpacity={0.7}>
          <Ionicons name="add-circle-outline" size={18} color={LuxuryColors.gold} />
          <Text style={styles.addRowText}>Add Hotel / Stay</Text>
        </TouchableOpacity>

        {/* ── Daily Plan ── */}
        <SectionHeader title="Daily Plan" />
        <Text style={styles.hint}>Build a day-by-day itinerary for travelers.</Text>

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
            <FieldLabel text="Day Title" required />
            <TextInput
              style={styles.input}
              placeholder="Temples & Traditional Crafts"
              placeholderTextColor={LuxuryColors.textTertiary}
              value={day.title}
              onChangeText={(text) => updateDay(index, 'title', text)}
              maxLength={80}
            />
            <FieldLabel text="Description" required />
            <TextInput
              style={[styles.input, styles.textArea, { marginBottom: 0 }]}
              placeholder="Start at Fushimi Inari at dawn, head to Arashiyama for lunch…"
              placeholderTextColor={LuxuryColors.textTertiary}
              value={day.description}
              onChangeText={(text) => updateDay(index, 'description', text)}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              maxLength={600}
            />
          </View>
        ))}

        <TouchableOpacity style={styles.addDayBtn} onPress={addDay} activeOpacity={0.7}>
          <Ionicons name="add-circle-outline" size={20} color={LuxuryColors.gold} />
          <Text style={styles.addDayText}>Add Another Day</Text>
        </TouchableOpacity>

        {/* ── Map Links ── */}
        <SectionHeader title="Map Links" />
        <Text style={styles.hint}>Primary location links for the experience destination.</Text>

        <FieldLabel text="Google Maps URL" />
        <TextInput
          style={styles.input}
          placeholder="https://maps.google.com/?q=Kyoto+Japan"
          placeholderTextColor={LuxuryColors.textTertiary}
          value={googleMapsUrl}
          onChangeText={setGoogleMapsUrl}
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={500}
        />

        <FieldLabel text="Apple Maps URL" />
        <TextInput
          style={styles.input}
          placeholder="https://maps.apple.com/?q=Kyoto"
          placeholderTextColor={LuxuryColors.textTertiary}
          value={appleMapsUrl}
          onChangeText={setAppleMapsUrl}
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={500}
        />

        {/* ── Pricing ── */}
        <SectionHeader title="Pricing" />
        <Text style={styles.hint}>Control what travelers can access before subscribing.</Text>

        <TouchableOpacity
          style={[styles.toggleRow, freePreview && styles.toggleRowActive]}
          onPress={() => setFreePreview((v) => !v)}
          activeOpacity={0.8}
        >
          <View style={styles.toggleInfo}>
            <Text style={[styles.toggleLabel, freePreview && styles.toggleLabelActive]}>
              Free Preview Enabled
            </Text>
            <Text style={styles.toggleSub}>
              First section visible to non-subscribers
            </Text>
          </View>
          <View style={[styles.toggleSwitch, freePreview && styles.toggleSwitchActive]}>
            <Ionicons
              name={freePreview ? 'checkmark-circle' : 'ellipse-outline'}
              size={22}
              color={freePreview ? LuxuryColors.success : LuxuryColors.textTertiary}
            />
          </View>
        </TouchableOpacity>

        <View style={[styles.toggleRow, !freePreview && styles.toggleRowActive]}>
          <View style={styles.toggleInfo}>
            <Text style={[styles.toggleLabel, !freePreview && styles.toggleLabelActive]}>
              Premium Content Locked
            </Text>
            <Text style={styles.toggleSub}>
              Full experience requires subscription
            </Text>
          </View>
          <View style={styles.toggleSwitch}>
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color={!freePreview ? LuxuryColors.gold : LuxuryColors.textTertiary}
            />
          </View>
        </View>

        {/* ── Actions ── */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={[styles.draftBtn, (saving || publishing) && styles.btnDisabled]}
            onPress={handleSaveDraft}
            disabled={saving || publishing}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color={LuxuryColors.gold} size="small" />
            ) : (
              <Text style={styles.draftBtnText}>Save Draft</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.publishBtn, (saving || publishing) && styles.btnDisabled]}
            onPress={handlePublish}
            disabled={saving || publishing}
            activeOpacity={0.85}
          >
            {publishing ? (
              <ActivityIndicator color={LuxuryColors.background} size="small" />
            ) : (
              <Text style={styles.publishBtnText}>Publish Experience</Text>
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
  draftBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.xs,
    backgroundColor: `${LuxuryColors.gold}18`,
    borderWidth: 1,
    borderColor: `${LuxuryColors.gold}44`,
    borderRadius: LuxuryBorderRadius.sm,
    padding: LuxurySpacing.sm,
    marginBottom: LuxurySpacing.md,
  },
  draftBannerText: {
    flex: 1,
    fontSize: LuxuryFontSize.xs,
    color: LuxuryColors.gold,
    lineHeight: 16,
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
  imagePickBtn: {
    height: 48,
    borderRadius: LuxuryBorderRadius.md,
    borderWidth: 1,
    borderColor: LuxuryColors.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: LuxurySpacing.xs,
    marginBottom: LuxurySpacing.sm,
  },
  imagePickText: {
    color: LuxuryColors.gold,
    fontSize: LuxuryFontSize.sm,
    fontWeight: '600',
  },
  previewWrap: {
    borderRadius: LuxuryBorderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: LuxuryColors.glassBorder,
    marginBottom: LuxurySpacing.md,
  },
  previewImage: {
    width: '100%',
    height: 170,
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
  subCard: {
    backgroundColor: LuxuryColors.surface,
    borderRadius: LuxuryBorderRadius.md,
    padding: LuxurySpacing.md,
    marginBottom: LuxurySpacing.md,
    borderWidth: 1,
    borderColor: LuxuryColors.divider,
  },
  subCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: LuxurySpacing.sm,
  },
  subCardLabel: {
    fontSize: LuxuryFontSize.xs,
    color: LuxuryColors.gold,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  addRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.xs,
    marginBottom: LuxurySpacing.lg,
  },
  addRowText: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.gold,
    fontWeight: '500',
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.sm,
    marginBottom: LuxurySpacing.sm,
  },
  removeInlineBtn: {
    padding: LuxurySpacing.xs,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LuxuryColors.surface,
    borderWidth: 1,
    borderColor: LuxuryColors.divider,
    borderRadius: LuxuryBorderRadius.md,
    padding: LuxurySpacing.md,
    marginBottom: LuxurySpacing.sm,
    gap: LuxurySpacing.md,
  },
  toggleRowActive: {
    borderColor: `${LuxuryColors.gold}60`,
    backgroundColor: `${LuxuryColors.gold}08`,
  },
  toggleInfo: {
    flex: 1,
    gap: 2,
  },
  toggleLabel: {
    fontSize: LuxuryFontSize.sm,
    fontWeight: '600',
    color: LuxuryColors.textSecondary,
  },
  toggleLabelActive: {
    color: LuxuryColors.textPrimary,
  },
  toggleSub: {
    fontSize: LuxuryFontSize.xs,
    color: LuxuryColors.textTertiary,
  },
  toggleSwitch: {
    width: 32,
    alignItems: 'center',
  },
  toggleSwitchActive: {},
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
  publishBtn: {
    backgroundColor: LuxuryColors.success,
    borderRadius: LuxuryBorderRadius.lg,
    paddingVertical: LuxurySpacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishBtnText: {
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
