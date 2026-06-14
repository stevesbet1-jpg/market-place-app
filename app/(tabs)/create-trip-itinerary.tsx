import React, { useEffect, useMemo, useState } from 'react';
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
  patchCreateTripDraft,
  syncTripInfoWithDayCount,
  type ItineraryDayDraft,
} from '../../constants/createTripDraftStore';

const CYAN = '#8AE6FF';
const STEPS = [
  { label: 'Trip Info', route: '/(tabs)/create-trip' },
  { label: 'Itinerary', route: '/(tabs)/create-trip-itinerary' },
  { label: 'Photos', route: '/(tabs)/create-trip-photos' },
  { label: 'Experience', route: '/(tabs)/create-trip-experiences' },
  { label: 'Review', route: '/(tabs)/create-trip-review' },
] as const;

type ItineraryRow = ItineraryDayDraft;

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function relabelRows(rows: ItineraryRow[]): ItineraryRow[] {
  return rows.map((row, index) => ({
    ...row,
    dayLabel: `Day ${index + 1}`,
  }));
}

const INITIAL_ROWS: ItineraryRow[] = [
  {
    id: 'd1',
    dayLabel: 'Day 1',
    dateLabel: 'Aug 12',
    title: 'Arrival in Amalfi Coast',
    subtitle: 'Private transfer, check-in, sunset marina walk',
    imageUri: 'https://images.unsplash.com/photo-1521295121783-8a321d551ad2?auto=format&fit=crop&w=420&q=80',
    activities: ['Private transfer', 'Sunset marina walk'],
  },
  {
    id: 'd2',
    dayLabel: 'Day 2',
    dateLabel: 'Aug 13',
    title: 'Positano Exploration',
    subtitle: 'Beach morning, boutique lunch, cliffside dinner',
    imageUri: 'https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=420&q=80',
    activities: ['Beach morning', 'Cliffside dinner'],
  },
  {
    id: 'd3',
    dayLabel: 'Day 3',
    dateLabel: 'Aug 14',
    title: 'Capri Yacht Day',
    subtitle: 'Blue Grotto swim stop and coastal tasting route',
    imageUri: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=420&q=80',
    activities: ['Blue Grotto route'],
  },
  {
    id: 'd4',
    dayLabel: 'Day 4',
    dateLabel: 'Aug 15',
    title: 'Ravello Culture Circuit',
    subtitle: 'Villa gardens, artisan studio visits, terrace concert',
    imageUri: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=420&q=80',
    activities: ['Villa gardens', 'Terrace concert'],
  },
];

function Stepper() {
  return (
    <View style={styles.stepperWrap}>
      {STEPS.map((step, index) => {
        const active = index === 1;
        const done = index < 1;
        return (
          <React.Fragment key={step.label}>
            <TouchableOpacity style={styles.stepCol} onPress={() => router.replace(step.route)} activeOpacity={0.82}>
              <View style={[styles.stepDot, active && styles.stepDotActive, done && styles.stepDotDone]}>
                {done
                  ? <Ionicons name="checkmark" size={9} color={LuxuryColors.success} />
                  : <Text style={[styles.stepDotText, active && styles.stepDotTextActive]}>{index + 1}</Text>}
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

function TimelineRow({
  item,
  isLast,
  onOpen,
  onChangeImage,
  onAddActivity,
  onDeleteDay,
  onMoveDown,
}: {
  item: ItineraryRow;
  isLast: boolean;
  onOpen: () => void;
  onChangeImage: () => void;
  onAddActivity: () => void;
  onDeleteDay: () => void;
  onMoveDown: () => void;
}) {
  return (
    <View style={styles.timelineRowWrap}>
      <View style={styles.timelineRailCol}>
        <View style={styles.timelineDotOuter}>
          <View style={styles.timelineDotInner} />
        </View>
        {!isLast ? <View style={styles.timelineLine} /> : null}
      </View>

      <TouchableOpacity style={styles.rowCard} activeOpacity={0.88} onPress={onOpen}>
        <TouchableOpacity style={styles.rowImageWrap} activeOpacity={0.86} onPress={onChangeImage}>
          {item.imageUri ? (
            <Image source={{ uri: item.imageUri }} style={styles.rowImage} resizeMode="cover" />
          ) : (
            <View style={styles.rowImagePlaceholder}>
              <Ionicons name="image-outline" size={18} color={LuxuryColors.textSecondary} />
            </View>
          )}
          <View style={styles.rowImageEditBadge}>
            <Ionicons name="camera-outline" size={11} color={CYAN} />
          </View>
        </TouchableOpacity>

        <View style={styles.rowTextBlock}>
          <Text style={styles.rowMeta}>{item.dayLabel} - {item.dateLabel}</Text>
          <Text style={styles.rowTitle}>{item.title}</Text>
          <Text style={styles.rowSubtitle} numberOfLines={1}>{item.subtitle}</Text>
          <Text style={styles.rowActivityPreview} numberOfLines={1}>
            {item.activities[0]?.trim() ? item.activities[0] : 'No activities yet'}
          </Text>
          <TouchableOpacity style={styles.inlineAddBtn} onPress={onAddActivity} activeOpacity={0.86}>
            <Ionicons name="add" size={12} color={CYAN} />
            <Text style={styles.inlineAddText}>Add Activity</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.rowIconCol}>
          <TouchableOpacity style={styles.rowIconWrap} onPress={onMoveDown}>
            <Ionicons name="reorder-three-outline" size={18} color={LuxuryColors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.rowIconWrap} onPress={onDeleteDay}>
            <Ionicons name="trash-outline" size={16} color="rgba(255,75,75,0.82)" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </View>
  );
}

export default function CreateTripItineraryScreen() {
  const insets = useSafeAreaInsets();

  const [timelineRows, setTimelineRows] = useState<ItineraryRow[]>(INITIAL_ROWS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const draft = await getCreateTripDraft();
        if (!alive) return;
        if (draft.itineraryDays.length > 0) {
          setTimelineRows(draft.itineraryDays);
        }
      } catch {
        // Keep default seed rows if persisted state is unavailable.
      } finally {
        if (alive) setIsHydrated(true);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    let alive = true;
    (async () => {
      try {
        const currentDraft = await getCreateTripDraft();
        if (!alive) return;
        const syncedTripInfo = syncTripInfoWithDayCount(currentDraft.tripInfo, timelineRows.length);
        await patchCreateTripDraft({
          itineraryDays: timelineRows,
          tripInfo: syncedTripInfo,
        });
      } catch {
        // Ignore transient persistence failures; local UI state remains source of truth.
      }
    })();

    return () => {
      alive = false;
    };
  }, [isHydrated, timelineRows]);

  const editingDay = useMemo(
    () => timelineRows.find((row) => row.id === editingId) ?? null,
    [timelineRows, editingId],
  );

  const updateDay = (dayId: string, patch: Partial<ItineraryRow>) => {
    setTimelineRows((prev) => prev.map((row) => (row.id === dayId ? { ...row, ...patch } : row)));
  };

  const pickDayImage = async (dayId: string) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Needed', 'Allow photo access to set day cover image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.9,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    updateDay(dayId, { imageUri: result.assets[0].uri });
  };

  const addDay = () => {
    setTimelineRows((prev) => {
      const index = prev.length + 1;
      return relabelRows([
        ...prev,
        {
          id: uid(),
          dayLabel: `Day ${index}`,
          dateLabel: 'TBD',
          title: 'New itinerary day',
          subtitle: 'Tap to edit day details',
          imageUri: '',
          activities: [],
        },
      ]);
    });
  };

  const deleteDay = (dayId: string) => {
    setTimelineRows((prev) => {
      if (prev.length <= 1) return prev;
      return relabelRows(prev.filter((row) => row.id !== dayId));
    });
    if (editingId === dayId) {
      setEditingId(null);
    }
  };

  const moveDayDown = (dayId: string) => {
    setTimelineRows((prev) => {
      const index = prev.findIndex((row) => row.id === dayId);
      if (index < 0 || index >= prev.length - 1) return prev;
      const next = [...prev];
      const current = next[index];
      next[index] = next[index + 1];
      next[index + 1] = current;
      return relabelRows(next);
    });
  };

  const addActivity = (dayId: string) => {
    setTimelineRows((prev) => prev.map((row) => {
      if (row.id !== dayId) return row;
      return {
        ...row,
        activities: [...row.activities, ''],
      };
    }));
    setEditingId(dayId);
  };

  const updateActivity = (dayId: string, index: number, value: string) => {
    setTimelineRows((prev) => prev.map((row) => {
      if (row.id !== dayId) return row;
      return {
        ...row,
        activities: row.activities.map((act, i) => (i === index ? value : act)),
      };
    }));
  };

  const deleteActivity = (dayId: string, index: number) => {
    setTimelineRows((prev) => prev.map((row) => {
      if (row.id !== dayId) return row;
      return {
        ...row,
        activities: row.activities.filter((_, i) => i !== index),
      };
    }));
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient colors={['#071120', '#091A2A', '#06101D']} style={StyleSheet.absoluteFill} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 106 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.circleIconBtn} onPress={() => router.replace('/(tabs)/create-trip')} activeOpacity={0.84}>
            <Ionicons name="arrow-back" size={19} color={LuxuryColors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Itinerary</Text>
            <Text style={styles.headerSubtitle}>Step 2 of 5 - Day-by-day planner</Text>
          </View>
          <Pressable style={styles.saveDraftBtn} onPress={() => Alert.alert('Draft Saved', 'Itinerary draft saved locally.')}>
            <Text style={styles.saveDraftText}>Save Draft</Text>
          </Pressable>
        </View>

        <Stepper />

        <View style={styles.timelineSection}>
          <Text style={styles.timelineHeading}>Trip Timeline</Text>
          <Text style={styles.timelineCaption}>Drag rows to reorder your day sequence.</Text>

          <View style={styles.timelineList}>
            {timelineRows.map((row, index) => (
              <TimelineRow
                key={row.id}
                item={row}
                isLast={index === timelineRows.length - 1}
                onOpen={() => setEditingId(row.id)}
                onChangeImage={() => pickDayImage(row.id)}
                onAddActivity={() => addActivity(row.id)}
                onDeleteDay={() => deleteDay(row.id)}
                onMoveDown={() => moveDayDown(row.id)}
              />
            ))}
          </View>

          <TouchableOpacity style={styles.addDayBtn} onPress={addDay} activeOpacity={0.86}>
            <Ionicons name="add" size={16} color={CYAN} />
            <Text style={styles.addDayText}>Add Day</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={!!editingDay} transparent animationType="fade" onRequestClose={() => setEditingId(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Day</Text>
              <TouchableOpacity onPress={() => setEditingId(null)}>
                <Ionicons name="close" size={20} color={LuxuryColors.textSecondary} />
              </TouchableOpacity>
            </View>

            {editingDay ? (
              <View style={styles.modalContent}>
                <TextInput
                  style={styles.modalInput}
                  value={editingDay.dayLabel}
                  onChangeText={(value) => updateDay(editingDay.id, { dayLabel: value })}
                  placeholder="Day label"
                  placeholderTextColor={LuxuryColors.textTertiary}
                />
                <TextInput
                  style={styles.modalInput}
                  value={editingDay.dateLabel}
                  onChangeText={(value) => updateDay(editingDay.id, { dateLabel: value })}
                  placeholder="Date label"
                  placeholderTextColor={LuxuryColors.textTertiary}
                />
                <TextInput
                  style={styles.modalInput}
                  value={editingDay.title}
                  onChangeText={(value) => updateDay(editingDay.id, { title: value })}
                  placeholder="Day title"
                  placeholderTextColor={LuxuryColors.textTertiary}
                />
                <TextInput
                  style={[styles.modalInput, styles.modalTextarea]}
                  value={editingDay.subtitle}
                  onChangeText={(value) => updateDay(editingDay.id, { subtitle: value })}
                  placeholder="Day subtitle"
                  placeholderTextColor={LuxuryColors.textTertiary}
                  multiline
                />

                <View style={styles.modalSectionTop}>
                  <Text style={styles.modalSectionTitle}>Activities</Text>
                  <TouchableOpacity style={styles.inlineAddBtn} onPress={() => addActivity(editingDay.id)}>
                    <Ionicons name="add" size={12} color={CYAN} />
                    <Text style={styles.inlineAddText}>Add Activity</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.inlineAddBtn} onPress={() => pickDayImage(editingDay.id)}>
                  <Ionicons name="camera-outline" size={12} color={CYAN} />
                  <Text style={styles.inlineAddText}>Change Cover Image</Text>
                </TouchableOpacity>

                <ScrollView
                  style={styles.activitiesListScroll}
                  contentContainerStyle={styles.activitiesListContent}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                >
                  {editingDay.activities.map((activity, index) => (
                    <View key={`${editingDay.id}-activity-${index}`} style={styles.activityRow}>
                      <TextInput
                        style={[styles.modalInput, styles.activityInput]}
                        value={activity}
                        onChangeText={(value) => updateActivity(editingDay.id, index, value)}
                        placeholder="Activity name"
                        placeholderTextColor={LuxuryColors.textTertiary}
                      />
                      <TouchableOpacity style={styles.activityDeleteBtn} onPress={() => deleteActivity(editingDay.id, index)}>
                        <Ionicons name="trash-outline" size={15} color="rgba(255,75,75,0.86)" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>

                <TouchableOpacity style={styles.doneBtn} onPress={() => setEditingId(null)} activeOpacity={0.88}>
                  <Text style={styles.doneBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>

      <View style={[styles.fixedDock, { paddingBottom: 4 }]}> 
        <TouchableOpacity style={styles.ctaButton} onPress={() => router.push('/(tabs)/create-trip-photos')} activeOpacity={0.88}>
          <Text style={styles.ctaButtonText}>Continue to Photos</Text>
          <Ionicons name="arrow-forward" size={17} color={LuxuryColors.background} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: LuxuryColors.background },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: LuxurySpacing.lg, gap: 12 },

  headerRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },
  headerCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'none',
  },
  headerTitle: { color: LuxuryColors.textPrimary, fontSize: 18, fontWeight: '700' },
  headerSubtitle: { color: LuxuryColors.textSecondary, fontSize: 11, marginTop: 2 },
  circleIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(138,230,255,0.16)',
  },
  saveDraftBtn: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: LuxuryBorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(138,230,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(138,230,255,0.26)',
  },
  saveDraftText: { color: CYAN, fontSize: 12, fontWeight: '700' },

  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginTop: -4,
    borderRadius: LuxuryBorderRadius.xl,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(138,230,255,0.15)',
    ...LuxuryShadow.soft,
  },
  stepCol: { flex: 1, alignItems: 'center', gap: 2 },
  stepDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  stepDotActive: { backgroundColor: 'rgba(138,230,255,0.20)', borderColor: CYAN },
  stepDotDone: { backgroundColor: 'rgba(46,213,115,0.16)', borderColor: 'rgba(46,213,115,0.44)' },
  stepDotText: { color: LuxuryColors.textSecondary, fontSize: 9, fontWeight: '700', textAlign: 'center', lineHeight: 10 },
  stepDotTextActive: { color: CYAN },
  stepText: { color: LuxuryColors.textTertiary, fontSize: 7.5, fontWeight: '600', textAlign: 'center', lineHeight: 9, flexWrap: 'nowrap' },
  stepTextActive: { color: LuxuryColors.textPrimary },
  stepLine: { width: 10, flexShrink: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(138,230,255,0.18)', marginHorizontal: 1 },

  timelineSection: {
    borderRadius: LuxuryBorderRadius.xxl,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(138,230,255,0.14)',
    paddingTop: 14,
    paddingBottom: 10,
    ...LuxuryShadow.soft,
  },
  timelineHeading: { color: LuxuryColors.textPrimary, fontSize: 16, fontWeight: '700' },
  timelineCaption: { color: LuxuryColors.textSecondary, fontSize: 11, marginTop: 3, marginBottom: 10 },
  timelineList: { gap: 8 },

  timelineRowWrap: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 88,
  },
  timelineRailCol: {
    width: 26,
    alignItems: 'center',
  },
  timelineDotOuter: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(138,230,255,0.20)',
    borderWidth: 1,
    borderColor: 'rgba(138,230,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  timelineDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: CYAN,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: 'rgba(138,230,255,0.38)',
    marginTop: 6,
    borderRadius: 1,
  },

  rowCard: {
    flex: 1,
    minHeight: 84,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(7,17,32,0.70)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: 10,
  },
  rowImageWrap: {
    width: 66,
    height: 66,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(138,230,255,0.32)',
    position: 'relative',
  },
  rowImage: {
    width: '100%',
    height: '100%',
  },
  rowImagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  rowImageEditBadge: {
    position: 'absolute',
    right: 3,
    bottom: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(138,230,255,0.36)',
    backgroundColor: 'rgba(7,17,32,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextBlock: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  rowMeta: {
    color: LuxuryColors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  rowTitle: {
    color: LuxuryColors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  rowSubtitle: {
    color: LuxuryColors.textSecondary,
    fontSize: 11,
  },
  rowActivityPreview: {
    color: CYAN,
    fontSize: 10,
    marginTop: 2,
  },
  inlineAddBtn: {
    minHeight: 24,
    borderRadius: LuxuryBorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(138,230,255,0.34)',
    backgroundColor: 'rgba(138,230,255,0.10)',
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  inlineAddText: {
    color: CYAN,
    fontSize: 10,
    fontWeight: '700',
  },
  rowIconCol: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  rowIconWrap: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addDayBtn: {
    minHeight: 36,
    borderRadius: LuxuryBorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(138,230,255,0.34)',
    backgroundColor: 'rgba(138,230,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  addDayText: { color: CYAN, fontSize: 12, fontWeight: '700' },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: LuxurySpacing.lg,
    justifyContent: 'center',
  },
  modalCard: {
    maxHeight: '82%',
    borderRadius: LuxuryBorderRadius.xxl,
    borderWidth: 1,
    borderColor: 'rgba(138,230,255,0.16)',
    backgroundColor: 'rgba(7,17,32,0.98)',
    padding: 12,
    ...LuxuryShadow.soft,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTitle: { color: LuxuryColors.textPrimary, fontSize: 16, fontWeight: '700' },
  modalContent: { gap: 8, paddingBottom: 4 },
  modalInput: {
    minHeight: 38,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    color: LuxuryColors.textPrimary,
    fontSize: 12,
    paddingHorizontal: 10,
  },
  modalTextarea: {
    minHeight: 64,
    paddingTop: 9,
    paddingBottom: 9,
    textAlignVertical: 'top',
  },
  modalSectionTop: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalSectionTitle: { color: LuxuryColors.textSecondary, fontSize: 11, fontWeight: '700' },
  activitiesListScroll: {
    maxHeight: 220,
  },
  activitiesListContent: {
    gap: 8,
    paddingBottom: 2,
  },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  activityInput: { flex: 1 },
  activityDeleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255,75,75,0.35)',
    backgroundColor: 'rgba(255,75,75,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtn: {
    minHeight: 34,
    borderRadius: LuxuryBorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(138,230,255,0.34)',
    backgroundColor: 'rgba(138,230,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  doneBtnText: {
    color: CYAN,
    fontSize: 12,
    fontWeight: '700',
  },

  fixedDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: LuxurySpacing.lg,
    paddingTop: 2,
    backgroundColor: 'rgba(7,17,32,0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(138,230,255,0.14)',
  },
  ctaButton: {
    minHeight: 52,
    borderRadius: LuxuryBorderRadius.full,
    backgroundColor: CYAN,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    ...LuxuryShadow.gold,
  },
  ctaButtonText: { color: LuxuryColors.background, fontSize: 14, fontWeight: '800' },
});
