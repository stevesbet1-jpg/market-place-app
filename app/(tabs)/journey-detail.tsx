import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LuxuryColors,
  LuxurySpacing,
  LuxuryBorderRadius,
  LuxuryFontSize,
  LuxuryShadow,
} from '../../constants/luxuryTheme';
import { JOURNEYS, ImageKey } from '../../constants/journeys';
import {
  consumeFreeJourney,
  getSavedIds,
  toggleSaved,
  FREE_JOURNEY_LIMIT,
} from '../../constants/journeyStore';

const JOURNEY_IMAGES: Record<ImageKey, ReturnType<typeof require>> = {
  islands:    require('../../assets/collections/private-islands.jpg'),
  villas:     require('../../assets/collections/super-villas.jpg'),
  yacht:      require('../../assets/collections/yacht-escapes.jpg'),
  desert:     require('../../assets/collections/desert-retreats.jpg'),
  mountain:   require('../../assets/collections/alpine-mountains.jpg'),
  city:       require('../../assets/collections/japanese-city.jpg'),
  temple:     require('../../assets/collections/japanese-temple.jpg'),
  bali:       require('../../assets/collections/bali-rice.jpg'),
  seychelles: require('../../assets/collections/seychelles-beach.jpg'),
  zanzibar:   require('../../assets/collections/zanzibar-coast.jpg'),
  lakecomo:   require('../../assets/collections/lake-como-view.jpg'),
  alps:       require('../../assets/collections/swiss-alps-day.jpg'),
};

const ALL_IMAGE_KEYS: readonly ImageKey[] = [
  'islands', 'villas', 'yacht', 'desert', 'mountain', 'city', 'temple',
  'bali', 'seychelles', 'zanzibar', 'lakecomo', 'alps',
];

export default function JourneyDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const journey = JOURNEYS.find((j) => j.id === id);

  const [saved, setSaved] = useState(false);
  const [freeRemaining, setFreeRemaining] = useState<number>(FREE_JOURNEY_LIMIT);

  useEffect(() => {
    if (!id) return;
    // Consume free slot (no-op if already opened) then read latest state
    consumeFreeJourney(id).then((remaining) => {
      setFreeRemaining(remaining);
    });
    // Load saved state
    getSavedIds().then((ids) => setSaved(ids.includes(id)));
  }, [id]);

  const handleToggleSave = async () => {
    if (!id) return;
    const newIds = await toggleSaved(id);
    setSaved(newIds.includes(id));
  };

  if (!journey) {
    return (
      <View style={[styles.container, styles.notFoundWrap]}>
        <Text style={styles.notFoundText}>Journey not found</Text>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8}>
          <Text style={styles.backFallback}>← Back to Journeys</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Gallery: hero key first, then two other keys
  const galleryKeys: ImageKey[] = [
    journey.imageKey,
    ...ALL_IMAGE_KEYS.filter((k) => k !== journey.imageKey).slice(0, 2),
  ];

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      bounces={false}
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}
    >
      {/* ── Hero ─────────────────────────────────────────── */}
      <View style={styles.heroWrap}>
        <Image
          source={JOURNEY_IMAGES[journey.imageKey]}
          style={styles.heroImage}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['rgba(7,17,32,0.50)', 'transparent', 'rgba(7,17,32,0.92)'] as const}
          style={StyleSheet.absoluteFill}
        />

        {/* Back button */}
        <TouchableOpacity
          style={[styles.backBtn, { top: insets.top + LuxurySpacing.sm }]}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveBtn, { top: insets.top + LuxurySpacing.sm }]}
          onPress={handleToggleSave}
          activeOpacity={0.8}
        >
          <Ionicons
            name={saved ? 'bookmark' : 'bookmark-outline'}
            size={20}
            color={saved ? LuxuryColors.gold : '#FFFFFF'}
          />
        </TouchableOpacity>

        {/* Hero text overlay */}
        <View style={styles.heroOverlay}>
          <Text style={styles.heroRegion}>{journey.region}</Text>
          <Text style={styles.heroTitle}>{journey.name}</Text>
          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaItem}>
              <Ionicons name="time-outline" size={13} color={LuxuryColors.gold} />
              <Text style={styles.heroMetaText}>{journey.duration}</Text>
            </View>
            <View style={styles.heroMetaDot} />
            <View style={styles.heroMetaItem}>
              <Ionicons name="sunny-outline" size={13} color={LuxuryColors.gold} />
              <Text style={styles.heroMetaText}>{journey.bestTime}</Text>
            </View>
            <View style={styles.heroMetaDot} />
            <View style={styles.heroMetaItem}>
              <Ionicons name="cash-outline" size={13} color={LuxuryColors.gold} />
              <Text style={styles.heroMetaText}>{journey.budget} · {journey.dailyBudget}</Text>
            </View>
          </View>
          {/* Free counter badge */}
          <View style={styles.freeCounterBadge}>
            <Ionicons name="diamond-outline" size={10} color={LuxuryColors.gold} />
            <Text style={styles.freeCounterText}>
              {freeRemaining} of {FREE_JOURNEY_LIMIT} complimentary remaining
            </Text>
          </View>
        </View>
      </View>

      {/* ── Content ──────────────────────────────────────── */}
      <View style={styles.content}>

        {/* Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Overview</Text>
          <Text style={styles.bodyText}>{journey.overview}</Text>
        </View>

        <View style={styles.divider} />

        {/* Places to Explore */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Places to Explore</Text>
          {journey.places.map((place) => (
            <View key={place} style={styles.listRow}>
              <View style={styles.bulletDiamond} />
              <Text style={styles.listText}>{place}</Text>
            </View>
          ))}
        </View>

        <View style={styles.divider} />

        {/* Restaurants & Cafés */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Restaurants & Cafés</Text>
          {journey.restaurants.map((r) => (
            <View key={r} style={styles.listRow}>
              <Ionicons
                name="restaurant-outline"
                size={12}
                color={LuxuryColors.gold}
                style={styles.listIcon}
              />
              <Text style={styles.listText}>{r}</Text>
            </View>
          ))}
        </View>

        <View style={styles.divider} />

        {/* Local Experiences */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Local Experiences</Text>
          <View style={styles.experienceGrid}>
            {journey.experiences.map((exp) => (
              <View key={exp} style={styles.experienceChip}>
                <Ionicons name="star-outline" size={11} color={LuxuryColors.gold} />
                <Text style={styles.experienceText}>{exp}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.divider} />

        {/* Day-by-Day Itinerary */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Day-by-Day Itinerary</Text>
          {journey.itinerary.map((dayPlan) => (
            <View key={dayPlan.day} style={styles.itineraryDay}>
              <View style={styles.itineraryDayHeader}>
                <View style={styles.itineraryDayBadge}>
                  <Text style={styles.itineraryDayNum}>Day {dayPlan.day}</Text>
                </View>
              </View>
              {dayPlan.activities.map((activity, idx) => (
                <View key={idx} style={styles.listRow}>
                  <View style={styles.bulletDiamond} />
                  <Text style={styles.listText}>{activity}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        <View style={styles.divider} />
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Photo Gallery</Text>
          <View style={styles.gallery}>
            {galleryKeys.map((key, i) => (
              <View
                key={`${key}-${i}`}
                style={[styles.galleryItem, i === 0 && styles.galleryItemLarge]}
              >
                <Image
                  source={JOURNEY_IMAGES[key]}
                  style={styles.galleryImage}
                  resizeMode="cover"
                />
                <LinearGradient
                  colors={['transparent', 'rgba(7,17,32,0.40)'] as const}
                  style={StyleSheet.absoluteFill}
                />
              </View>
            ))}
          </View>
        </View>

        {/* Save Journey CTA */}
        <TouchableOpacity
          style={[styles.saveCta, saved && styles.saveCtaSaved]}
          onPress={handleToggleSave}
          activeOpacity={0.8}
        >
          <Ionicons
            name={saved ? 'bookmark' : 'bookmark-outline'}
            size={16}
            color={saved ? LuxuryColors.background : LuxuryColors.gold}
          />
          <Text style={[styles.saveCtaText, saved && styles.saveCtaTextSaved]}>
            {saved ? 'Journey Saved' : 'Save Journey'}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 64 + insets.bottom }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LuxuryColors.background,
  },
  notFoundWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: LuxurySpacing.md,
  },
  notFoundText: {
    fontSize: LuxuryFontSize.lg,
    color: LuxuryColors.textSecondary,
  },
  backFallback: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.gold,
    fontWeight: '600',
  },
  // ── Hero ───────────────────────────────────────────────
  heroWrap: {
    height: 280,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  backBtn: {
    position: 'absolute',
    left: LuxurySpacing.lg,
    width: 36,
    height: 36,
    borderRadius: LuxuryBorderRadius.full,
    backgroundColor: 'rgba(7,17,32,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  saveBtn: {
    position: 'absolute',
    right: LuxurySpacing.lg,
    width: 36,
    height: 36,
    borderRadius: LuxuryBorderRadius.full,
    backgroundColor: 'rgba(7,17,32,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: LuxurySpacing.xl,
    paddingBottom: LuxurySpacing.xl,
    gap: 6,
  },
  heroRegion: {
    fontSize: 10,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: LuxuryFontSize.xxl,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.sm,
  },
  heroMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  heroMetaText: {
    fontSize: LuxuryFontSize.sm,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  heroMetaDot: {
    width: 3,
    height: 3,
    borderRadius: LuxuryBorderRadius.full,
    backgroundColor: LuxuryColors.gold,
    opacity: 0.6,
  },
  // ── Content ────────────────────────────────────────────
  content: {
    paddingTop: LuxurySpacing.lg,
  },
  section: {
    paddingHorizontal: LuxurySpacing.xl,
    paddingVertical: LuxurySpacing.md,
    gap: LuxurySpacing.sm,
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: LuxurySpacing.xl,
  },
  bodyText: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textSecondary,
    lineHeight: 22,
    letterSpacing: 0.1,
  },
  // ── List items ────────────────────────────────────────
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: LuxurySpacing.sm,
    paddingVertical: 3,
  },
  bulletDiamond: {
    width: 5,
    height: 5,
    backgroundColor: LuxuryColors.gold,
    transform: [{ rotate: '45deg' }],
    marginTop: 6,
    flexShrink: 0,
  },
  listIcon: {
    marginTop: 2,
    flexShrink: 0,
  },
  listText: {
    flex: 1,
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textSecondary,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  // ── Experiences ───────────────────────────────────────
  experienceGrid: {
    gap: LuxurySpacing.sm,
  },
  experienceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.sm,
    backgroundColor: 'rgba(212,175,55,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.15)',
    borderRadius: LuxuryBorderRadius.md,
    paddingHorizontal: LuxurySpacing.md,
    paddingVertical: LuxurySpacing.sm,
  },
  experienceText: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textSecondary,
    letterSpacing: 0.1,
    flex: 1,
  },
  // ── Gallery ───────────────────────────────────────────
  gallery: {
    flexDirection: 'row',
    gap: LuxurySpacing.sm,
    height: 160,
  },
  galleryItem: {
    flex: 1,
    borderRadius: LuxuryBorderRadius.lg,
    overflow: 'hidden',
    ...LuxuryShadow.soft,
  },
  galleryItemLarge: {
    flex: 2,
  },
  galleryImage: {
    width: '100%',
    height: '100%',
  },
  // ── Save CTA ─────────────────────────────────────────
  saveCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: LuxurySpacing.sm,
    marginHorizontal: LuxurySpacing.xl,
    marginTop: LuxurySpacing.xl,
    paddingVertical: 16,
    borderRadius: LuxuryBorderRadius.xl,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: LuxuryColors.gold,
  },
  saveCtaSaved: {
    backgroundColor: LuxuryColors.gold,
  },
  saveCtaText: {
    fontSize: LuxuryFontSize.sm,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  saveCtaTextSaved: {
    color: LuxuryColors.background,
  },
  // ── Free counter badge ────────────────────────────────
  freeCounterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(7,17,32,0.50)',
    borderRadius: LuxuryBorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  freeCounterText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 0.2,
    fontWeight: '500',
  },
  // ── Day-by-Day Itinerary ──────────────────────────────
  itineraryDay: {
    gap: 4,
    marginBottom: LuxurySpacing.md,
  },
  itineraryDayHeader: {
    marginBottom: 2,
  },
  itineraryDayBadge: {
    backgroundColor: 'rgba(212,175,55,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.20)',
    borderRadius: LuxuryBorderRadius.sm,
    paddingHorizontal: 9,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  itineraryDayNum: {
    fontSize: 10,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
});
