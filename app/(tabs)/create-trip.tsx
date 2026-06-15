import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirebaseApp } from '../../lib/firebase';
import {
  LuxuryBorderRadius,
  LuxuryColors,
  LuxuryFontSize,
  LuxuryShadow,
  LuxurySpacing,
} from '../../constants/luxuryTheme';
import {
  durationLabelFromDates,
  formatTripDate,
  getCreateTripDraft,
  parseTripDate,
  patchCreateTripDraft,
} from '../../constants/createTripDraftStore';

const CYAN = '#8AE6FF';
const STEPS = [
  { label: 'Trip Info', route: '/(tabs)/create-trip' },
  { label: 'Itinerary', route: '/(tabs)/create-trip-itinerary' },
  { label: 'Photos', route: '/(tabs)/create-trip-photos' },
  { label: 'Experience', route: '/(tabs)/create-trip-experiences' },
  { label: 'Review', route: '/(tabs)/create-trip-review' },
] as const;
const ACTIVE_STEP = 0;
const TRIP_TYPES = ['Luxury', 'Adventure', 'Food', 'Romantic', 'Family'] as const;
const HIGHLIGHT_OPTIONS = ['Sunrise Views', 'Hidden Gems', 'Fine Dining', 'Wellness', 'Nightlife', 'Local Markets'] as const;
const TRAVELER_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1);
function travelersLabel(n: number): string {
  return n === 1 ? '1 Traveler' : `${n} Travelers`;
}

type TripType = (typeof TRIP_TYPES)[number];
type DateField = 'start' | 'end';

function buildAutoTripTitle(destination: string, startDate: string, endDate: string): string {
  const normalizedDestination = destination.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  if (normalizedDestination) {
    return `${normalizedDestination} Adventure`;
  }

  const normalizedStartDate = startDate.trim();
  const normalizedEndDate = endDate.trim();
  if (normalizedStartDate && normalizedEndDate) {
    return `Adventure ${normalizedStartDate} - ${normalizedEndDate}`;
  }
  if (normalizedStartDate) {
    return `Adventure ${normalizedStartDate}`;
  }

  return 'My Adventure';
}

function SectionCard({ title, children, style }: { title: string; children: React.ReactNode; style?: object }) {
  return (
    <View style={[styles.card, style]}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function AuthGate() {
  const insets = useSafeAreaInsets();
  const handleSafeBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/explore');
  };

  return (
    <View style={[styles.gateRoot, { paddingTop: insets.top + LuxurySpacing.xl, paddingBottom: insets.bottom + LuxurySpacing.xl }]}>
      <TouchableOpacity style={styles.circleIconBtn} onPress={handleSafeBack} activeOpacity={0.8}>
        <Ionicons name="arrow-back" size={20} color={LuxuryColors.textPrimary} />
      </TouchableOpacity>
      <View style={styles.gateCard}>
        <View style={styles.gateIconWrap}>
          <Ionicons name="lock-closed-outline" size={28} color={CYAN} />
        </View>
        <Text style={styles.gateTitle}>Sign in to create a trip</Text>
        <Text style={styles.gateBody}>Your trip draft flow is account-based, so sign in first and continue building it.</Text>
        <TouchableOpacity style={styles.ctaButton} onPress={() => router.replace('/(auth)/login')} activeOpacity={0.86}>
          <Text style={styles.ctaButtonText}>Go to Sign In</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
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

export default function CreateTripScreen() {
  const insets = useSafeAreaInsets();
  const handleSafeBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/explore');
  }, []);

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authUid, setAuthUid] = useState<string | null>(null);

  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [galleryUris, setGalleryUris] = useState<string[]>([]);

  const [destination, setDestination] = useState('Amalfi Coast, Italy');
  const [startDate, setStartDate] = useState('May 14, 2026');
  const [endDate, setEndDate] = useState('May 21, 2026');
  const [tripTitle, setTripTitle] = useState('Seven Days of Coastal Indulgence');
  const [travelers, setTravelers] = useState('2');
  const [tripType, setTripType] = useState<TripType>('Luxury');

  const [budget, setBudget] = useState('4200');
  const [flightCost, setFlightCost] = useState('1400');
  const [stayCost, setStayCost] = useState('1800');
  const [foodCost, setFoodCost] = useState('700');
  const [activitiesCost, setActivitiesCost] = useState('300');

  const [notes, setNotes] = useState('Capture the villa check-in moment, reserve the tasting menu early, and keep a flexible final evening for discoveries.');
  const [highlights, setHighlights] = useState<string[]>(['Sunrise Views', 'Fine Dining']);
  const [isHydrated, setIsHydrated] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerField, setPickerField] = useState<DateField>('start');
  const [pendingStartDate, setPendingStartDate] = useState<Date>(parseTripDate(startDate));
  const [pendingEndDate, setPendingEndDate] = useState<Date>(parseTripDate(endDate));
  const pendingEndDateRef = useRef<Date>(parseTripDate(endDate));
  const [travelersPickerVisible, setTravelersPickerVisible] = useState(false);

  useEffect(() => {
    const auth = getAuth(getFirebaseApp());
    return onAuthStateChanged(auth, (user) => {
      setAuthUid(user?.uid ?? null);
      setCheckingAuth(false);
    });
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const draft = await getCreateTripDraft();
        if (!alive) return;
        const info = draft.tripInfo;
        setCoverUri(info.coverUri);
        setGalleryUris(info.galleryUris);
        setDestination(info.destination);
        setStartDate(info.startDate);
        setEndDate(info.endDate);
        setTripTitle(info.tripTitle);
        setTravelers(info.travelers);
        setTripType(info.tripType as TripType);
        setBudget(info.budget);
        setFlightCost(info.flightCost);
        setStayCost(info.stayCost);
        setFoodCost(info.foodCost);
        setActivitiesCost(info.activitiesCost);
        setNotes(info.notes);
        setHighlights(info.highlights);
      } finally {
        if (alive) setIsHydrated(true);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const draft = await getCreateTripDraft();
          if (!active) return;
          if (draft.tripInfo.endDate) {
            setEndDate(draft.tripInfo.endDate);
            const parsedEnd = parseTripDate(draft.tripInfo.endDate);
            setPendingEndDate(parsedEnd);
            pendingEndDateRef.current = parsedEnd;
          }
        } catch {
          // Keep existing local state when draft refresh fails.
        }
      })();

      return () => {
        active = false;
      };
    }, []),
  );

  useEffect(() => {
    if (!isHydrated) return;
    const start = parseTripDate(startDate);
    const end = parseTripDate(endDate);
    const earlier = start.getTime() <= end.getTime() ? start : end;
    const later = start.getTime() <= end.getTime() ? end : start;
    patchCreateTripDraft({
      tripInfo: {
      destination,
      startDate,
      endDate,
      tripTitle,
      duration: durationLabelFromDates(earlier, later),
      travelers,
      tripType,
      budget,
      flightCost,
      stayCost,
      foodCost,
      activitiesCost,
      notes,
      highlights,
      coverUri,
      galleryUris,
      },
    }).catch(() => {});
  }, [
    isHydrated,
    destination,
    startDate,
    endDate,
    tripTitle,
    travelers,
    tripType,
    budget,
    flightCost,
    stayCost,
    foodCost,
    activitiesCost,
    notes,
    highlights,
    coverUri,
    galleryUris,
  ]);

  useEffect(() => {
    if (!destination.trim()) return;
    if (tripTitle.trim()) return;
    setTripTitle(buildAutoTripTitle(destination, startDate, endDate));
  }, [destination, startDate, endDate, tripTitle]);

  const durationLabel = useMemo(() => {
    const start = parseTripDate(startDate);
    const end = parseTripDate(endDate);
    const earlier = start.getTime() <= end.getTime() ? start : end;
    const later = start.getTime() <= end.getTime() ? end : start;
    return durationLabelFromDates(earlier, later);
  }, [startDate, endDate]);

  const openDatePicker = useCallback((field: DateField) => {
    const current = field === 'start' ? parseTripDate(startDate) : parseTripDate(endDate);
    if (field === 'start') {
      setPendingStartDate(current);
    } else {
      console.log('[CreateTrip][EndDate] opening end date picker');
      setPendingEndDate(current);
      pendingEndDateRef.current = current;
    }
    setPickerField(field);
    setPickerVisible(true);
  }, [startDate, endDate]);

  const handleDatePickerDone = useCallback(() => {
    if (pickerField === 'start') {
      setStartDate(formatTripDate(pendingStartDate));
      setPickerVisible(false);
      return;
    }

    const selectedEndDate = pendingEndDateRef.current;
    console.log('[CreateTrip][EndDate] Done pressed for end date', {
      pending: selectedEndDate.toISOString(),
    });

    const parsedStart = parseTripDate(startDate);
    const normalizedEnd = selectedEndDate.getTime() < parsedStart.getTime() ? parsedStart : selectedEndDate;
    const finalEnd = formatTripDate(normalizedEnd);
    setEndDate(finalEnd);
    console.log('[CreateTrip][EndDate] final endDate saved', finalEnd);
    setPickerVisible(false);
  }, [pickerField, pendingStartDate, startDate]);

  const pickSingleImage = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Needed', 'Please allow photo access to select an image.');
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.9,
    });

    if (result.canceled || !result.assets?.[0]?.uri) return null;
    return result.assets[0].uri;
  }, []);

  const handlePickCover = useCallback(async () => {
    const uri = await pickSingleImage();
    if (uri) setCoverUri(uri);
  }, [pickSingleImage]);

  const handlePickGallery = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Needed', 'Please allow photo access to select gallery images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      orderedSelection: true,
      selectionLimit: 8,
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.length) return;

    setGalleryUris((current) => {
      const next = [...current];
      for (const asset of result.assets) {
        if (asset.uri && !next.includes(asset.uri)) next.push(asset.uri);
      }
      return next.slice(0, 8);
    });
  }, []);

  const toggleHighlight = useCallback((value: string) => {
    setHighlights((current) => (current.includes(value) ? current.filter((x) => x !== value) : [...current, value]));
  }, []);

  const budgetSummary = useMemo(() => {
    const total = Number(budget) || 0;
    const allocated = (Number(flightCost) || 0) + (Number(stayCost) || 0) + (Number(foodCost) || 0) + (Number(activitiesCost) || 0);
    const pct = total > 0 ? Math.min(100, Math.round((allocated / total) * 100)) : 0;
    return { allocated, pct };
  }, [activitiesCost, budget, flightCost, foodCost, stayCost]);

  const tripStats = useMemo(() => {
    const selectedPhotos = galleryUris;
    const photoCount = `${selectedPhotos.length}`;
    return [
      { icon: 'time-outline' as const, label: 'Duration', value: durationLabel },
      { icon: 'people-outline' as const, label: 'Travelers', value: travelers || '2' },
      { icon: 'images-outline' as const, label: 'Photos', value: photoCount },
    ];
  }, [durationLabel, galleryUris, travelers]);

  if (checkingAuth) {
    return (
      <View style={styles.loadingRoot}>
        <ActivityIndicator color={CYAN} />
      </View>
    );
  }

  if (!authUid) return <AuthGate />;

  const handleContinueToItinerary = async () => {
    const finalTitle = tripTitle.trim() || buildAutoTripTitle(destination, startDate, endDate);
    if (finalTitle !== tripTitle) {
      setTripTitle(finalTitle);
      try {
        const start = parseTripDate(startDate);
        const end = parseTripDate(endDate);
        const earlier = start.getTime() <= end.getTime() ? start : end;
        const later = start.getTime() <= end.getTime() ? end : start;
        await patchCreateTripDraft({
          tripInfo: {
            destination,
            startDate,
            endDate,
            tripTitle: finalTitle,
            duration: durationLabelFromDates(earlier, later),
            travelers,
            tripType,
            budget,
            flightCost,
            stayCost,
            foodCost,
            activitiesCost,
            notes,
            highlights,
            coverUri,
            galleryUris,
          },
        });
      } catch {
        // Continue navigation with local state if draft persistence fails.
      }
    }

    router.push('/(tabs)/create-trip-itinerary');
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient colors={['#071120', '#091A2A', '#06101D']} style={StyleSheet.absoluteFill} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 88 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.circleIconBtn} onPress={handleSafeBack} activeOpacity={0.84}>
            <Ionicons name="arrow-back" size={19} color={LuxuryColors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Create Trip</Text>
            <Text style={styles.headerSubtitle}>Add your trip details</Text>
          </View>

          <TouchableOpacity
            style={styles.saveDraftBtn}
            onPress={() => Alert.alert('Draft Saved', 'Trip draft saved locally for this flow.')}
            activeOpacity={0.84}
          >
            <Text style={styles.saveDraftText}>Save Draft</Text>
          </TouchableOpacity>
        </View>

        <Stepper />

        <SectionCard title="Basic Information" style={styles.basicInfoCard}>
          <View style={styles.basicRow}>
            <TouchableOpacity style={styles.coverLeft} onPress={handlePickCover} activeOpacity={0.86}>
              {coverUri ? (
                <Image source={{ uri: coverUri }} style={styles.coverImage} resizeMode="cover" />
              ) : (
                <View style={styles.coverPlaceholder}>
                  <Ionicons name="image-outline" size={24} color={CYAN} />
                  <Text style={styles.coverHint}>Cover Image</Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.basicFields}>
              <TextInput style={styles.compactInput} value={destination} onChangeText={setDestination} placeholder="Destination" placeholderTextColor={LuxuryColors.textTertiary} />
              <View style={styles.twoCol}>
                <TouchableOpacity style={styles.compactInputHalf} onPress={() => openDatePicker('start')} activeOpacity={0.86}>
                  <Text style={[styles.dateFieldText, !startDate && styles.dateFieldPlaceholder]} numberOfLines={1}>{startDate || 'Start Date'}</Text>
                  <Ionicons name="calendar-outline" size={14} color={LuxuryColors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.compactInputHalf} onPress={() => openDatePicker('end')} activeOpacity={0.86}>
                  <Text style={[styles.dateFieldText, !endDate && styles.dateFieldPlaceholder]} numberOfLines={1}>{endDate || 'End Date'}</Text>
                  <Ionicons name="calendar-outline" size={14} color={LuxuryColors.textSecondary} />
                </TouchableOpacity>
              </View>
              <TextInput style={styles.compactInput} value={tripTitle} onChangeText={setTripTitle} placeholder="Trip Title" placeholderTextColor={LuxuryColors.textTertiary} />
              <View style={styles.bottomFields}>
                <View style={styles.threeCol}>
                <View style={styles.compactInputThird}>
                  <Text style={styles.durationText}>{durationLabel}</Text>
                </View>
                <TouchableOpacity style={styles.compactInputThird} onPress={() => setTravelersPickerVisible(true)} activeOpacity={0.86}>
                  <Text style={styles.travelerFieldText}>{travelers ? travelersLabel(Number(travelers)) : 'Travelers'}</Text>
                  <Ionicons name="chevron-down" size={12} color={LuxuryColors.textSecondary} />
                </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
          <View style={styles.categoryWrapFull}>
            <View style={styles.categoryWrap}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoryScroll}
                contentContainerStyle={styles.typeChipsRow}
              >
                {TRIP_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeChip, tripType === type && styles.typeChipActive]}
                    onPress={() => setTripType(type)}
                    activeOpacity={0.84}
                  >
                    <Text style={[styles.typeChipText, tripType === type && styles.typeChipTextActive]}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </SectionCard>

        <SectionCard title="Gallery">
          <View style={styles.galleryTopRow}>
            <TouchableOpacity style={styles.addPhotosBtn} onPress={handlePickGallery} activeOpacity={0.86}>
              <Ionicons name="images-outline" size={15} color={CYAN} />
              <Text style={styles.addPhotosText}>Add Photos</Text>
            </TouchableOpacity>
            <Text style={styles.galleryCount}>{galleryUris.length} selected</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryRow}>
            {galleryUris.length === 0 ? (
              <View style={styles.galleryEmptyThumb}>
                <Ionicons name="camera-outline" size={16} color={LuxuryColors.textTertiary} />
              </View>
            ) : null}
            {galleryUris.map((uri) => (
              <Image key={uri} source={{ uri }} style={styles.galleryThumb} resizeMode="cover" />
            ))}
          </ScrollView>
        </SectionCard>

        <SectionCard title="Budget & Expenses">
          <View style={styles.budgetGrid}>
            <View style={styles.budgetLeft}>
              <Text style={styles.smallLabel}>Budget</Text>
              <View style={styles.budgetInputWrap}>
                <Text style={styles.currencyText}>$</Text>
                <TextInput
                  style={styles.budgetInput}
                  value={budget}
                  onChangeText={setBudget}
                  placeholder="4200"
                  placeholderTextColor={LuxuryColors.textTertiary}
                  keyboardType="number-pad"
                />
              </View>

              <View style={styles.costRow}>
                <Text style={styles.costLabel}>Flights</Text>
                <TextInput style={styles.costInput} value={flightCost} onChangeText={setFlightCost} keyboardType="number-pad" />
              </View>
              <View style={styles.costRow}>
                <Text style={styles.costLabel}>Stay</Text>
                <TextInput style={styles.costInput} value={stayCost} onChangeText={setStayCost} keyboardType="number-pad" />
              </View>
              <View style={styles.costRow}>
                <Text style={styles.costLabel}>Food</Text>
                <TextInput style={styles.costInput} value={foodCost} onChangeText={setFoodCost} keyboardType="number-pad" />
              </View>
              <View style={styles.costRow}>
                <Text style={styles.costLabel}>Activities</Text>
                <TextInput style={styles.costInput} value={activitiesCost} onChangeText={setActivitiesCost} keyboardType="number-pad" />
              </View>
            </View>

            <View style={styles.budgetRight}>
              <View style={styles.progressRingOuter}>
                <View style={styles.progressRingInner}>
                  <Text style={styles.progressPct}>{budgetSummary.pct}%</Text>
                  <Text style={styles.progressSub}>Allocated</Text>
                </View>
              </View>
              <Text style={styles.allocatedText}>${budgetSummary.allocated} planned</Text>
            </View>
          </View>
        </SectionCard>

        <SectionCard title="Notes">
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add planning notes, reservations, and reminders..."
            placeholderTextColor={LuxuryColors.textTertiary}
            multiline
          />
        </SectionCard>

        <SectionCard title="Highlights">
          <View style={styles.chipsWrap}>
            {HIGHLIGHT_OPTIONS.map((item) => (
              <TouchableOpacity
                key={item}
                style={[styles.highlightChip, highlights.includes(item) && styles.highlightChipActive]}
                onPress={() => toggleHighlight(item)}
                activeOpacity={0.84}
              >
                <Text style={[styles.highlightChipText, highlights.includes(item) && styles.highlightChipTextActive]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </SectionCard>

        <SectionCard title="Trip Stats">
          <View style={styles.statsRow}>
            {tripStats.map((item) => (
              <View key={item.label} style={styles.statCard}>
                <Ionicons name={item.icon} size={14} color={CYAN} />
                <Text style={styles.statValue}>{item.value}</Text>
                <Text style={styles.statLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </SectionCard>
      </ScrollView>

      <Modal visible={travelersPickerVisible} transparent animationType="fade" onRequestClose={() => setTravelersPickerVisible(false)}>
        <View style={styles.datePickerBackdrop}>
          <View style={styles.datePickerCard}>
            <View style={styles.datePickerHeader}>
              <Text style={styles.datePickerTitle}>Number of Travelers</Text>
              <TouchableOpacity onPress={() => setTravelersPickerVisible(false)}>
                <Ionicons name="close" size={18} color={LuxuryColors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.travelersScroll} showsVerticalScrollIndicator={false}>
              {TRAVELER_OPTIONS.map((n) => {
                const selected = Number(travelers) === n;
                return (
                  <TouchableOpacity
                    key={n}
                    style={[styles.travelerOption, selected && styles.travelerOptionActive]}
                    onPress={() => { setTravelers(String(n)); setTravelersPickerVisible(false); }}
                    activeOpacity={0.84}
                  >
                    <Text style={[styles.travelerOptionText, selected && styles.travelerOptionTextActive]}>{travelersLabel(n)}</Text>
                    {selected ? <Ionicons name="checkmark" size={14} color={CYAN} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={pickerVisible} transparent animationType="fade" onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.datePickerBackdrop}>
          <View style={styles.datePickerCard}>
            <View style={styles.datePickerHeader}>
              <Text style={styles.datePickerTitle}>{pickerField === 'start' ? 'Start Date' : 'End Date'}</Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <Ionicons name="close" size={18} color={LuxuryColors.textSecondary} />
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={pickerField === 'start' ? pendingStartDate : pendingEndDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
              onChange={(event, selectedDate) => {
                if (!selectedDate) {
                  if (Platform.OS === 'android') {
                    setPickerVisible(false);
                  }
                  return;
                }

                if (pickerField === 'start') {
                  setPendingStartDate(selectedDate);
                } else {
                  setPendingEndDate(selectedDate);
                  pendingEndDateRef.current = selectedDate;
                  console.log('[CreateTrip][EndDate] selected end date value', selectedDate.toISOString());
                }

                if (Platform.OS === 'android' && event?.type === 'dismissed') {
                  setPickerVisible(false);
                }
              }}
              style={styles.datePicker}
            />
            <View style={styles.datePickerActions}>
              <TouchableOpacity style={styles.datePickerCancel} onPress={() => setPickerVisible(false)} activeOpacity={0.86}>
                <Text style={styles.datePickerCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.datePickerSave}
                onPress={handleDatePickerDone}
                activeOpacity={0.86}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.datePickerSaveText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={[styles.fixedDock, { paddingBottom: 4 }]}> 
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={handleContinueToItinerary}
          activeOpacity={0.88}
        >
          <Text style={styles.ctaButtonText}>Continue to Itinerary</Text>
          <Ionicons name="arrow-forward" size={17} color={LuxuryColors.background} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: LuxuryColors.background,
  },
  loadingRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LuxuryColors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: LuxurySpacing.lg,
    gap: 12,
  },
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
  headerTitle: {
    color: LuxuryColors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: LuxuryColors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
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
  saveDraftText: {
    color: CYAN,
    fontSize: 12,
    fontWeight: '700',
  },
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
  stepCol: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
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
  stepDotActive: {
    backgroundColor: 'rgba(138,230,255,0.20)',
    borderColor: CYAN,
  },
  stepDotDone: {
    backgroundColor: 'rgba(46,213,115,0.16)',
    borderColor: 'rgba(46,213,115,0.44)',
  },
  stepDotText: {
    color: LuxuryColors.textSecondary,
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 10,
  },
  stepDotTextActive: {
    color: CYAN,
  },
  stepText: {
    color: LuxuryColors.textTertiary,
    fontSize: 7.5,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 9,
    flexWrap: 'nowrap',
  },
  stepTextActive: {
    color: LuxuryColors.textPrimary,
  },
  stepLine: {
    width: 10,
    flexShrink: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(138,230,255,0.18)',
    marginHorizontal: 1,
  },
  card: {
    borderRadius: LuxuryBorderRadius.xxl,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(138,230,255,0.14)',
    ...LuxuryShadow.soft,
  },
  basicInfoCard: {
    paddingBottom: 8,
  },
  cardTitle: {
    color: LuxuryColors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  basicRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  coverLeft: {
    width: 118,
    height: 148,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(138,230,255,0.25)',
    backgroundColor: 'rgba(6,14,25,0.95)',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  coverHint: {
    color: LuxuryColors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  basicFields: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  compactInput: {
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(7,17,32,0.72)',
    color: LuxuryColors.textPrimary,
    fontSize: 12,
    paddingHorizontal: 11,
    width: '100%',
  },
  twoCol: {
    flexDirection: 'row',
    gap: 8,
  },
  compactInputHalf: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(7,17,32,0.72)',
    fontSize: 12,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  threeCol: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  bottomFields: {
    gap: 6,
  },
  categoryWrapFull: {
    marginTop: 8,
  },
  compactInputThird: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(7,17,32,0.72)',
    fontSize: 12,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  dateFieldText: {
    flex: 1,
    color: LuxuryColors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  dateFieldPlaceholder: {
    color: LuxuryColors.textTertiary,
    fontWeight: '500',
  },
  durationText: {
    color: LuxuryColors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  travelerFieldText: {
    flex: 1,
    color: LuxuryColors.textPrimary,
    fontSize: 11,
    fontWeight: '600',
  },
  travelersScroll: {
    maxHeight: 320,
  },
  travelerOption: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  travelerOptionActive: {
    borderColor: 'rgba(138,230,255,0.42)',
    backgroundColor: 'rgba(138,230,255,0.12)',
  },
  travelerOptionText: {
    color: LuxuryColors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  travelerOptionTextActive: {
    color: CYAN,
    fontWeight: '700',
  },
  typeChipsRow: {
    gap: 6,
    paddingLeft: 0,
    paddingRight: 2,
  },
  categoryWrap: {
    minWidth: 0,
    gap: 0,
    overflow: 'hidden',
  },
  categoryScroll: {
    marginLeft: 0,
    paddingLeft: 0,
  },
  typeChip: {
    minHeight: 34,
    borderRadius: LuxuryBorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    flexShrink: 0,
  },
  typeChipActive: {
    borderColor: 'rgba(138,230,255,0.42)',
    backgroundColor: 'rgba(138,230,255,0.14)',
  },
  typeChipText: {
    color: LuxuryColors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  typeChipTextActive: {
    color: CYAN,
  },
  galleryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addPhotosBtn: {
    minHeight: 34,
    borderRadius: LuxuryBorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(138,230,255,0.36)',
    backgroundColor: 'rgba(138,230,255,0.10)',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  addPhotosText: {
    color: CYAN,
    fontSize: 11,
    fontWeight: '700',
  },
  galleryCount: {
    color: LuxuryColors.textSecondary,
    fontSize: 11,
  },
  galleryRow: {
    gap: 8,
    paddingRight: 6,
  },
  galleryEmptyThumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryThumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  budgetGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  budgetLeft: {
    flex: 1,
    gap: 7,
  },
  budgetRight: {
    width: 116,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  smallLabel: {
    color: LuxuryColors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  budgetInputWrap: {
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(7,17,32,0.72)',
    paddingHorizontal: 10,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  currencyText: {
    color: CYAN,
    fontSize: 15,
    fontWeight: '800',
  },
  budgetInput: {
    flex: 1,
    color: LuxuryColors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  costRow: {
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  costLabel: {
    flex: 1,
    color: LuxuryColors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  costInput: {
    minWidth: 52,
    textAlign: 'right',
    color: LuxuryColors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    paddingVertical: 0,
  },
  progressRingOuter: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 6,
    borderColor: 'rgba(138,230,255,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(138,230,255,0.08)',
  },
  progressRingInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(7,17,32,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressPct: {
    color: CYAN,
    fontSize: 15,
    fontWeight: '800',
  },
  progressSub: {
    color: LuxuryColors.textSecondary,
    fontSize: 9,
    marginTop: 1,
  },
  allocatedText: {
    color: LuxuryColors.textSecondary,
    fontSize: 11,
  },
  notesInput: {
    minHeight: 92,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(7,17,32,0.72)',
    color: LuxuryColors.textPrimary,
    fontSize: 12,
    paddingHorizontal: 11,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  highlightChip: {
    minHeight: 34,
    borderRadius: LuxuryBorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.11)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightChipActive: {
    borderColor: 'rgba(138,230,255,0.42)',
    backgroundColor: 'rgba(138,230,255,0.14)',
  },
  highlightChipText: {
    color: LuxuryColors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  highlightChipTextActive: {
    color: CYAN,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    minHeight: 72,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  statValue: {
    color: LuxuryColors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  statLabel: {
    color: LuxuryColors.textSecondary,
    fontSize: 10,
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
    minHeight: 48,
    borderRadius: LuxuryBorderRadius.full,
    backgroundColor: CYAN,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    ...LuxuryShadow.gold,
  },
  ctaButtonText: {
    color: LuxuryColors.background,
    fontSize: 14,
    fontWeight: '800',
  },
  datePickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: LuxurySpacing.lg,
  },
  datePickerCard: {
    borderRadius: LuxuryBorderRadius.xxl,
    backgroundColor: 'rgba(7,17,32,0.98)',
    borderWidth: 1,
    borderColor: 'rgba(138,230,255,0.18)',
    padding: 12,
    ...LuxuryShadow.soft,
  },
  datePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  datePickerTitle: {
    color: LuxuryColors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  datePicker: {
    alignSelf: 'stretch',
    marginBottom: 6,
  },
  datePickerActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    position: 'relative',
    zIndex: 8,
    elevation: 8,
  },
  datePickerCancel: {
    flex: 1,
    minHeight: 38,
    borderRadius: LuxuryBorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  datePickerCancelText: {
    color: LuxuryColors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  datePickerSave: {
    flex: 1,
    minHeight: 38,
    borderRadius: LuxuryBorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CYAN,
  },
  datePickerSaveText: {
    color: LuxuryColors.background,
    fontSize: 12,
    fontWeight: '800',
  },
  gateRoot: {
    flex: 1,
    backgroundColor: LuxuryColors.background,
    paddingHorizontal: LuxurySpacing.xl,
  },
  gateCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  gateIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(138,230,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(138,230,255,0.24)',
  },
  gateTitle: {
    color: LuxuryColors.textPrimary,
    fontSize: LuxuryFontSize.xl,
    fontWeight: '700',
  },
  gateBody: {
    color: LuxuryColors.textSecondary,
    fontSize: LuxuryFontSize.sm,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 320,
  },
});