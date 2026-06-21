import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LuxuryBorderRadius,
  LuxuryColors,
  LuxuryShadow,
  LuxurySpacing,
} from '../../constants/luxuryTheme';
import {
  getCreateTripDraft,
  type ExperienceDraft,
  type PhotoEntryDraft,
} from '../../constants/createTripDraftStore';
import { normalizePhotoCategory as normalizeSharedPhotoCategory } from '../../lib/photoCategory';

const CYAN = '#8AE6FF';
const STEPS = [
  { label: 'Trip Info', route: '/(tabs)/create-trip' },
  { label: 'Itinerary', route: '/(tabs)/create-trip-itinerary' },
  { label: 'Photos', route: '/(tabs)/create-trip-photos' },
  { label: 'Experience', route: '/(tabs)/create-trip-experiences' },
  { label: 'Review', route: '/(tabs)/create-trip-review' },
] as const;
const ACTIVE_STEP = 3;
const EXPERIENCE_CATEGORIES = ['Dining', 'Adventure', 'Culture', 'Relaxation', 'Nightlife'] as const;

type Experience = ExperienceDraft;

const PLACE_TITLES = ['Best Place', 'Landmark Visit', 'Scenic Spot', 'Historic Site'] as const;
const FOOD_TITLES = ['Best Food', 'Local Cuisine', 'Restaurant Experience', 'Must Try Dish'] as const;
const ACTIVITY_TITLES = ['Top Experience', 'Adventure Activity', 'Outdoor Experience', 'Memorable Moment'] as const;
const MONTH_LOOKUP: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function composeLocationDate(location: string, dateDay: string): string {
  const left = location.trim();
  const right = dateDay.trim();
  if (left && right) return `${left} - ${right}`;
  return left || right;
}

function formatDisplayDate(input: string): string {
  const raw = input.trim();
  if (!raw) return 'Date TBD';

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;

  return parsed.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

function parseTripDateInput(value: string): Date | null {
  const raw = value.trim();
  if (!raw) return null;

  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) return direct;

  const compactDayMonth = raw.match(/^(\d{1,2})\s+([A-Za-z]{3,})(?:\s+(\d{4}))?$/);
  if (compactDayMonth) {
    const day = Number(compactDayMonth[1]);
    const month = MONTH_LOOKUP[compactDayMonth[2].slice(0, 3).toLowerCase()];
    const year = compactDayMonth[3] ? Number(compactDayMonth[3]) : new Date().getFullYear();
    if (month !== undefined) {
      const built = new Date(year, month, day);
      if (!Number.isNaN(built.getTime())) return built;
    }
  }

  const monthDay = raw.match(/^([A-Za-z]{3,})\s+(\d{1,2})(?:,\s*(\d{4}))?$/);
  if (monthDay) {
    const month = MONTH_LOOKUP[monthDay[1].slice(0, 3).toLowerCase()];
    const day = Number(monthDay[2]);
    const year = monthDay[3] ? Number(monthDay[3]) : new Date().getFullYear();
    if (month !== undefined) {
      const built = new Date(year, month, day);
      if (!Number.isNaN(built.getTime())) return built;
    }
  }

  const normalized = raw.replace(/\//g, '-').replace(/,/g, '').replace(/\s+/g, ' ').trim();
  const dmy = normalized.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]) - 1;
    const year = Number(dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]);
    const built = new Date(year, month, day);
    if (!Number.isNaN(built.getTime())) return built;
  }

  return null;
}

function isLegacyFallbackExperience(exp: Experience): boolean {
  const haystack = `${exp.title} ${exp.locationDate} ${exp.location ?? ''} ${exp.dateDay ?? ''}`.toLowerCase();
  return haystack.includes('sunset catamaran') || haystack.includes('capri') || haystack.includes('aug 14');
}

function buildTripDateRange(startDate: string, endDate: string): Date[] {
  const start = parseTripDateInput(startDate);
  const end = parseTripDateInput(endDate || startDate);
  if (!start || !end) return [];

  const startOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const low = startOnly.getTime() <= endOnly.getTime() ? startOnly : endOnly;
  const high = startOnly.getTime() <= endOnly.getTime() ? endOnly : startOnly;

  const days: Date[] = [];
  const cursor = new Date(low);
  while (cursor.getTime() <= high.getTime()) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function pickDistributedTripDate(position: number, total: number, dates: Date[]): Date | null {
  if (!dates.length) return null;
  if (total <= 1) return dates[0];

  const ratio = position / (total - 1);
  const idx = Math.min(dates.length - 1, Math.max(0, Math.floor(ratio * (dates.length - 1))));
  return dates[idx];
}

function formatDateFromObject(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

function buildExperienceSubtitle(exp: Experience, distributedDate: Date | null): string {
  const [fallbackLocation, fallbackDate] = (exp.locationDate ?? '').split(' - ');
  const location = (exp.location ?? fallbackLocation ?? '').trim() || 'Location TBD';
  const date = distributedDate
    ? formatDateFromObject(distributedDate)
    : formatDisplayDate((exp.dateDay ?? fallbackDate ?? '').trim());
  return `${location} • ${date}`;
}

function normalizePhotoCategory(category: string | undefined): 'food' | 'activities' | 'places' | null {
  const normalized = normalizeSharedPhotoCategory(category);
  if (normalized === 'other') return null;
  return normalized;
}

function pickGeneratedTitle(category: 'food' | 'activities' | 'places', idx: number): string {
  if (category === 'food') return FOOD_TITLES[idx % FOOD_TITLES.length];
  if (category === 'activities') return ACTIVITY_TITLES[idx % ACTIVITY_TITLES.length];
  return PLACE_TITLES[idx % PLACE_TITLES.length];
}

function mappedExperienceCategory(category: 'food' | 'activities' | 'places'): 'Food' | 'Activity' | 'Place' {
  if (category === 'food') return 'Food';
  if (category === 'activities') return 'Activity';
  return 'Place';
}

function generateExperiencesFromPhotos(
  photos: PhotoEntryDraft[],
  fallbackLocation?: string,
  fallbackDateDay?: string,
): Experience[] {
  const seenPhotoIds = new Set<string>();
  const seenTitleKeys = new Set<string>();
  const generated: Experience[] = [];

  for (let i = 0; i < photos.length; i += 1) {
    const photo = photos[i];
    const normalized = normalizePhotoCategory(photo.category);
    if (!normalized) continue;

    const sourcePhotoId = (photo.id ?? '').trim();
    if (!sourcePhotoId || seenPhotoIds.has(sourcePhotoId)) continue;

    const title = pickGeneratedTitle(normalized, i);
    const titleKey = `${normalized}:${title.toLowerCase()}`;
    if (seenTitleKeys.has(titleKey)) continue;

    const location = (fallbackLocation ?? '').trim() || 'Location TBD';
    const dateDay = (fallbackDateDay ?? '').trim() || 'Day TBD';

    generated.push({
      id: uid(),
      title,
      category: mappedExperienceCategory(normalized),
      sourcePhotoId,
      aiGenerated: true,
      location,
      dateDay,
      locationDate: composeLocationDate(location, dateDay),
      rating: 0,
      imageUri: photo.uri,
      notes: `Auto-generated from ${normalized} photo classification.`,
    });

    seenPhotoIds.add(sourcePhotoId);
    seenTitleKeys.add(titleKey);
  }

  return generated;
}

function mergeExperiences(generated: Experience[], manual: Experience[]): Experience[] {
  const merged: Experience[] = [];
  const seenGeneratedByPhoto = new Set<string>();
  const seenManualById = new Set<string>();

  for (const item of generated) {
    const key = (item.sourcePhotoId ?? '').trim();
    if (!key || seenGeneratedByPhoto.has(key)) continue;
    merged.push(item);
    seenGeneratedByPhoto.add(key);
  }

  for (const item of manual) {
    const idKey = (item.id ?? '').trim();
    if (idKey && seenManualById.has(idKey)) continue;
    merged.push(item);
    if (idKey) seenManualById.add(idKey);
  }

  return merged;
}

function Stepper() {
  return (
    <View style={styles.stepperWrap}>
      {STEPS.map((step, index) => {
        const active = index === ACTIVE_STEP;
        const done = index < ACTIVE_STEP;
        return (
          <React.Fragment key={step.label}>
            <TouchableOpacity style={styles.stepCol} onPress={() => router.replace(step.route)} activeOpacity={0.82}>
              <View style={[styles.stepDot, active && styles.stepDotActive, done && styles.stepDotDone]}>
                {done ? (
                  <Ionicons name="checkmark" size={9} color={LuxuryColors.success} />
                ) : (
                  <Text style={[styles.stepDotText, active && styles.stepDotTextActive]}>{index + 1}</Text>
                )}
              </View>
              <Text numberOfLines={1} ellipsizeMode="clip" style={[styles.stepText, active && styles.stepTextActive]}>{step.label}</Text>
            </TouchableOpacity>
            {index < STEPS.length - 1 ? <View style={styles.stepLine} /> : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}
export default function CreateTripExperiencesScreen() {
  const insets = useSafeAreaInsets();
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [tripDates, setTripDates] = useState<Date[]>([]);
  const [tripDestination, setTripDestination] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formTitle, setFormTitle] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formDateDay, setFormDateDay] = useState('');
  const [formCategory, setFormCategory] = useState<(typeof EXPERIENCE_CATEGORIES)[number]>('Dining');
  const [formNotes, setFormNotes] = useState('');
  const [formImageUri, setFormImageUri] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const draft = await getCreateTripDraft();
        if (!alive) return;

        const generated = generateExperiencesFromPhotos(
          draft.photos,
          draft.tripInfo.destination,
          draft.tripInfo.startDate,
        );

        const manual = (Array.isArray(draft.experiences) ? draft.experiences : []).filter((exp) => !isLegacyFallbackExperience(exp));
        setExperiences(mergeExperiences(generated, manual));
        setTripDates(buildTripDateRange(draft.tripInfo.startDate, draft.tripInfo.endDate));
        setTripDestination((draft.tripInfo.destination ?? '').trim());
      } catch {
        if (alive) {
          setExperiences([]);
          setTripDates([]);
          setTripDestination('');
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const openAddModal = useCallback(() => {
    setEditingId(null);
    setFormTitle('');
    setFormLocation('');
    setFormDateDay('');
    setFormCategory('Dining');
    setFormNotes('');
    setFormImageUri('');
    setModalVisible(true);
  }, []);

  const openEditModal = useCallback((exp: Experience) => {
    const [fallbackLocation, fallbackDate] = exp.locationDate.split(' - ');
    setEditingId(exp.id);
    setFormTitle(exp.title);
    setFormLocation(exp.location ?? fallbackLocation ?? '');
    setFormDateDay(exp.dateDay ?? fallbackDate ?? '');
    setFormCategory((exp.category as (typeof EXPERIENCE_CATEGORIES)[number]) ?? 'Dining');
    setFormNotes(exp.notes ?? '');
    setFormImageUri(exp.imageUri ?? '');
    setModalVisible(true);
  }, []);

  const pickExperienceImage = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Needed', 'Allow photo access to choose an experience image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setFormImageUri(result.assets[0].uri);
  }, []);

  const saveExperience = useCallback(() => {
    const title = formTitle.trim();
    const location = formLocation.trim();
    const dateDay = formDateDay.trim();
    const notes = formNotes.trim();

    if (!title || !location || !dateDay) {
      Alert.alert('Missing Details', 'Please provide title, location, and date/day.');
      return;
    }

    const next: Experience = {
      id: editingId ?? uid(),
      title,
      locationDate: composeLocationDate(location, dateDay),
      rating: 0,
      imageUri: formImageUri.trim(),
      location,
      dateDay,
      category: formCategory,
      notes,
    };

    setExperiences((prev) => {
      if (!editingId) return [...prev, next];
      return prev.map((exp) => (exp.id === editingId ? next : exp));
    });
    setModalVisible(false);
  }, [editingId, formTitle, formLocation, formDateDay, formImageUri, formCategory, formNotes]);

  const removeExp = useCallback((id: string) => {
    Alert.alert(
      'Delete Experience',
      'Are you sure you want to remove this experience?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => setExperiences((prev) => prev.filter((exp) => exp.id !== id)),
        },
      ]
    );
  }, []);

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient colors={['#071120', '#091A2A', '#06101D']} style={StyleSheet.absoluteFill} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.circleBtn} onPress={() => router.replace('/(tabs)/create-trip-photos')} activeOpacity={0.84}>
            <Ionicons name="arrow-back" size={19} color={LuxuryColors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Experiences</Text>
            <Text style={styles.headerSub}>Step 4 of 5 - Highlights list</Text>
          </View>
          <Pressable style={styles.draftBtn} onPress={() => Alert.alert('Draft Saved', 'Experiences draft saved.')}> 
            <Text style={styles.draftText}>Save Draft</Text>
          </Pressable>
        </View>

        <Stepper />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Experiences</Text>
          <TouchableOpacity style={styles.addBtn} onPress={openAddModal} activeOpacity={0.86}>
            <Ionicons name="add" size={15} color={CYAN} />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.listWrap}>
          {experiences.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="sparkles-outline" size={18} color="rgba(138,230,255,0.7)" />
              <Text style={styles.emptyTitle}>No experiences yet</Text>
              <Text style={styles.emptySub}>Add your first experience to enrich this trip.</Text>
              <TouchableOpacity style={styles.emptyCta} onPress={openAddModal} activeOpacity={0.86}>
                <Ionicons name="add" size={14} color={CYAN} />
                <Text style={styles.emptyCtaText}>Add your first experience</Text>
              </TouchableOpacity>
            </View>
          ) : experiences.map((exp, index) => {
            const distributedDate = pickDistributedTripDate(index, experiences.length, tripDates);
            const [fallbackLocation] = (exp.locationDate ?? '').split(' - ');
            const locationText = tripDestination || (exp.location ?? fallbackLocation ?? '').trim() || 'Destination TBD';
            const [, fallbackDate] = (exp.locationDate ?? '').split(' - ');
            const dateText = distributedDate
              ? formatDateFromObject(distributedDate)
              : formatDisplayDate((exp.dateDay ?? fallbackDate ?? '').trim());
            const subtitleText = `${locationText} • ${dateText}`;
            return (
            <TouchableOpacity key={exp.id} style={styles.expOuterCard} activeOpacity={0.9} onPress={() => openEditModal(exp)}>
              {exp.imageUri ? (
                <Image source={{ uri: exp.imageUri }} style={styles.expThumb} resizeMode="cover" />
              ) : (
                <View style={[styles.expThumb, styles.expThumbEmpty]}>
                  <Ionicons name="image-outline" size={20} color={LuxuryColors.textTertiary} />
                </View>
              )}

              <View style={styles.expContentArea}>
                <Text style={styles.expTitle} numberOfLines={1}>{exp.title}</Text>
                <Text style={styles.expMeta}>{subtitleText}</Text>
              </View>

              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.deleteCircle}
                  onPress={() => removeExp(exp.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={14} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingId ? 'Edit Experience' : 'Add Experience'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={18} color={LuxuryColors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <TextInput
                style={styles.modalInput}
                value={formTitle}
                onChangeText={setFormTitle}
                placeholder="Title"
                placeholderTextColor={LuxuryColors.textTertiary}
              />
              <TextInput
                style={styles.modalInput}
                value={formLocation}
                onChangeText={setFormLocation}
                placeholder="Location"
                placeholderTextColor={LuxuryColors.textTertiary}
              />
              <TextInput
                style={styles.modalInput}
                value={formDateDay}
                onChangeText={setFormDateDay}
                placeholder="Date / Day (e.g. 3 Aug or Day 3)"
                placeholderTextColor={LuxuryColors.textTertiary}
              />

              <View style={styles.categoryChipsRow}>
                {EXPERIENCE_CATEGORIES.map((category) => (
                  <TouchableOpacity
                    key={category}
                    style={[styles.categoryChip, formCategory === category && styles.categoryChipActive]}
                    onPress={() => setFormCategory(category)}
                    activeOpacity={0.84}
                  >
                    <Text style={[styles.categoryChipText, formCategory === category && styles.categoryChipTextActive]}>{category}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={[styles.modalInput, styles.modalTextarea]}
                value={formNotes}
                onChangeText={setFormNotes}
                placeholder="Notes"
                placeholderTextColor={LuxuryColors.textTertiary}
                multiline
              />

              <TouchableOpacity style={styles.imagePickerBtn} onPress={pickExperienceImage} activeOpacity={0.86}>
                <Ionicons name="image-outline" size={14} color={CYAN} />
                <Text style={styles.imagePickerText}>{formImageUri ? 'Change image' : 'Add image (optional)'}</Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setModalVisible(false)} activeOpacity={0.86}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={saveExperience} activeOpacity={0.86}>
                <Text style={styles.modalSaveText}>{editingId ? 'Save Changes' : 'Add Experience'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={[styles.dock, { paddingBottom: 4 }]}> 
        <TouchableOpacity style={styles.cta} onPress={() => router.push('/(tabs)/create-trip-review')} activeOpacity={0.88}>
          <Text style={styles.ctaText}>Continue to Review</Text>
          <Ionicons name="arrow-forward" size={17} color={LuxuryColors.background} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: LuxuryColors.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: LuxurySpacing.lg, gap: 12 },

  headerRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', position: 'relative' },
  headerCenter: { position: 'absolute', left: 0, right: 0, alignItems: 'center', pointerEvents: 'none' },
  headerTitle: { color: LuxuryColors.textPrimary, fontSize: 18, fontWeight: '700' },
  headerSub: { color: LuxuryColors.textSecondary, fontSize: 11, marginTop: 2 },
  circleBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(138,230,255,0.16)' },
  draftBtn: { minHeight: 36, paddingHorizontal: 12, borderRadius: LuxuryBorderRadius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(138,230,255,0.10)', borderWidth: 1, borderColor: 'rgba(138,230,255,0.26)' },
  draftText: { color: CYAN, fontSize: 12, fontWeight: '700' },

  stepperWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, paddingVertical: 3, marginTop: -4, borderRadius: LuxuryBorderRadius.xl, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(138,230,255,0.15)', ...LuxuryShadow.soft },
  stepCol: { flex: 1, alignItems: 'center', gap: 2 },
  stepDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.04)' },
  stepDotActive: { backgroundColor: 'rgba(138,230,255,0.20)', borderColor: CYAN },
  stepDotDone: { backgroundColor: 'rgba(46,213,115,0.16)', borderColor: 'rgba(46,213,115,0.44)' },
  stepDotText: { color: LuxuryColors.textSecondary, fontSize: 9, fontWeight: '700', textAlign: 'center', lineHeight: 10 },
  stepDotTextActive: { color: CYAN },
  stepText: { color: LuxuryColors.textTertiary, fontSize: 7.5, fontWeight: '600', textAlign: 'center', lineHeight: 9, flexWrap: 'nowrap' },
  stepTextActive: { color: LuxuryColors.textPrimary },
  stepLine: { width: 10, flexShrink: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(138,230,255,0.18)', marginHorizontal: 1 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: -4 },
  sectionTitle: { color: LuxuryColors.textPrimary, fontSize: 16, fontWeight: '700' },
  addBtn: {
    minHeight: 32,
    paddingHorizontal: 11,
    borderRadius: LuxuryBorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(138,230,255,0.36)',
    backgroundColor: 'rgba(138,230,255,0.10)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  addBtnText: { color: CYAN, fontSize: 12, fontWeight: '700' },

  listWrap: {
    borderRadius: LuxuryBorderRadius.xxl,
    borderWidth: 1,
    borderColor: 'rgba(138,230,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 8,
    gap: 8,
    ...LuxuryShadow.soft,
  },
  expOuterCard: {
    minHeight: 88,
    maxHeight: 92,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  expThumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  expThumbEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  expContentArea: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 64,
    paddingRight: 0,
  },
  expTitle: { color: LuxuryColors.textPrimary, fontSize: 15, fontWeight: '600' },
  expMeta: { color: LuxuryColors.textSecondary, fontSize: 12, marginTop: 2, lineHeight: 14 },
  cardActions: {
    alignSelf: 'stretch',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    minWidth: 36,
  },
  deleteCircle: {
    width: 29,
    height: 29,
    borderRadius: 14.5,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyState: {
    minHeight: 140,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 6,
  },
  emptyTitle: { color: LuxuryColors.textPrimary, fontSize: 13, fontWeight: '700' },
  emptySub: { color: LuxuryColors.textSecondary, fontSize: 11, textAlign: 'center' },
  emptyCta: {
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: LuxuryBorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(138,230,255,0.35)',
    backgroundColor: 'rgba(138,230,255,0.10)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  emptyCtaText: { color: CYAN, fontSize: 11, fontWeight: '700' },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: LuxurySpacing.lg,
  },
  modalCard: {
    borderRadius: LuxuryBorderRadius.xxl,
    backgroundColor: 'rgba(7,17,32,0.98)',
    borderWidth: 1,
    borderColor: 'rgba(138,230,255,0.18)',
    padding: 12,
    ...LuxuryShadow.soft,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modalTitle: {
    color: LuxuryColors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  modalScroll: {
    maxHeight: 420,
  },
  modalInput: {
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(7,17,32,0.72)',
    color: LuxuryColors.textPrimary,
    fontSize: 12,
    paddingHorizontal: 11,
    marginBottom: 8,
  },
  modalTextarea: {
    minHeight: 74,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  categoryChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  categoryChip: {
    minHeight: 30,
    borderRadius: LuxuryBorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChipActive: {
    borderColor: 'rgba(138,230,255,0.42)',
    backgroundColor: 'rgba(138,230,255,0.14)',
  },
  categoryChipText: {
    color: LuxuryColors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  categoryChipTextActive: {
    color: CYAN,
  },
  imagePickerBtn: {
    minHeight: 34,
    borderRadius: LuxuryBorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(138,230,255,0.36)',
    backgroundColor: 'rgba(138,230,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  imagePickerText: {
    color: CYAN,
    fontSize: 11,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  modalCancelBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: LuxuryBorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  modalCancelText: {
    color: LuxuryColors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  modalSaveBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: LuxuryBorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CYAN,
  },
  modalSaveText: {
    color: LuxuryColors.background,
    fontSize: 12,
    fontWeight: '800',
  },

  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: LuxurySpacing.lg, paddingTop: 2, backgroundColor: 'rgba(7,17,32,0.95)', borderTopWidth: 1, borderTopColor: 'rgba(138,230,255,0.14)' },
  cta: { minHeight: 52, borderRadius: LuxuryBorderRadius.full, backgroundColor: CYAN, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, ...LuxuryShadow.gold },
  ctaText: { color: LuxuryColors.background, fontSize: 14, fontWeight: '800' },
});
