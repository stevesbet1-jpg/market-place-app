import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  LuxuryColors,
  LuxurySpacing,
  LuxuryBorderRadius,
  LuxuryFontSize,
  LuxuryShadow,
} from '../../constants/luxuryTheme';
import { JOURNEYS, ImageKey, Journey } from '../../constants/journeys';
import { getCreatorById, formatFollowers, formatSaves } from '../../constants/creators';
import { getReviewsForJourney } from '../../constants/reviews';
import {
  consumeFreeJourney,
  getSavedIds,
  toggleSaved,
  FREE_JOURNEY_LIMIT,
} from '../../constants/journeyStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Image map ──────────────────────────────────────────────────────────────
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

// ─── Derived presentation helpers ───────────────────────────────────────────
type DifficultyInfo = { label: string; color: string; icon: keyof typeof Ionicons.glyphMap };

function getDifficulty(journey: Journey): DifficultyInfo {
  const days = parseInt(journey.duration, 10);
  if (!isNaN(days) && days >= 12) {
    return { label: 'Advanced', color: '#FF6B6B', icon: 'trending-up-outline' };
  }
  if (!isNaN(days) && days >= 7) {
    return { label: 'Moderate', color: '#FFA040', icon: 'flame-outline' };
  }
  return { label: 'Easy', color: '#4CAF80', icon: 'leaf-outline' };
}

function getTravelStyles(journey: Journey): string[] {
  const haystack = (journey.name + ' ' + journey.region + ' ' + journey.destination).toLowerCase();
  const tags: string[] = ['Luxury'];
  if (/ocean|sea|island|coast|beach|maldiv|seychell|zanzibar/.test(haystack)) tags.push('Beach');
  if (/mountain|alps|trek|safari|desert/.test(haystack)) tags.push('Adventure');
  if (/japan|bali|tokyo|kyoto|africa|temple|heritage/.test(haystack)) tags.push('Culture');
  if (journey.restaurants.length >= 4) tags.push('Food');
  return [...new Set(tags)].slice(0, 4);
}

// ─── Collapsible section header ─────────────────────────────────────────────
interface SectionHeaderProps {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
}

function SectionHeader({ label, isOpen, onToggle }: SectionHeaderProps) {
  return (
    <TouchableOpacity
      style={styles.sectionHeaderRow}
      onPress={onToggle}
      activeOpacity={0.7}
      hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
    >
      <Text style={styles.sectionLabel}>{label}</Text>
      <Ionicons
        name={isOpen ? 'chevron-up' : 'chevron-down'}
        size={13}
        color={LuxuryColors.gold}
      />
    </TouchableOpacity>
  );
}

// ─── Experience icon cycle ───────────────────────────────────────────────────
const EXP_ICONS: ReadonlyArray<keyof typeof Ionicons.glyphMap> = [
  'star-outline', 'heart-outline', 'camera-outline', 'map-outline',
  'musical-notes-outline', 'leaf-outline', 'wine-outline', 'boat-outline',
];

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function JourneyDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const journey = JOURNEYS.find((j) => j.id === id);

  const [saved, setSaved] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [followed, setFollowed] = useState(false);
  const [freeRemaining, setFreeRemaining] = useState<number>(FREE_JOURNEY_LIMIT);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const [sections, setSections] = useState({
    places: true,
    restaurants: true,
    experiences: true,
    itinerary: true,
    gallery: true,
    reviews: true,
  });

  const saveScale = useRef(new Animated.Value(1)).current;

  const toggleSection = useCallback((key: keyof typeof sections) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  useEffect(() => {
    if (!id) return;
    consumeFreeJourney(id).then(setFreeRemaining);
    getSavedIds().then((ids) => setSaved(ids.includes(id)));
  }, [id]);

  const handleToggleSave = async () => {
    if (!id || saveLoading) return;
    setSaveLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.spring(saveScale, { toValue: 0.93, useNativeDriver: true, speed: 40, bounciness: 6 }),
      Animated.spring(saveScale, { toValue: 1.00, useNativeDriver: true, speed: 20, bounciness: 8 }),
    ]).start();
    const newIds = await toggleSaved(id);
    setSaved(newIds.includes(id));
    setSaveLoading(false);
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

  const galleryKeys: ImageKey[] = [
    journey.imageKey,
    ...ALL_IMAGE_KEYS.filter((k) => k !== journey.imageKey).slice(0, 3),
  ];

  const difficulty = getDifficulty(journey);
  const travelStyles = getTravelStyles(journey);
  const creator = getCreatorById(journey.creatorId);
  const reviews = getReviewsForJourney(journey.id);

  return (
    <>
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
            colors={['rgba(7,17,32,0.40)', 'transparent', 'rgba(7,17,32,0.97)'] as const}
            style={StyleSheet.absoluteFill}
          />

          {/* Back */}
          <TouchableOpacity
            style={[styles.backBtn, { top: insets.top + LuxurySpacing.sm }]}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Save in hero */}
          <TouchableOpacity
            style={[styles.saveHeroBtn, { top: insets.top + LuxurySpacing.sm }]}
            onPress={handleToggleSave}
            activeOpacity={0.8}
          >
            <Ionicons
              name={saved ? 'bookmark' : 'bookmark-outline'}
              size={20}
              color={saved ? LuxuryColors.gold : '#FFFFFF'}
            />
          </TouchableOpacity>

          {/* Hero text */}
          <View style={styles.heroOverlay}>
            <Text style={styles.heroRegion}>{journey.region}</Text>
            <Text style={styles.heroTitle}>{journey.name}</Text>

            <View style={styles.heroMetaRow}>
              <View style={styles.heroMetaItem}>
                <Ionicons name="time-outline" size={12} color={LuxuryColors.gold} />
                <Text style={styles.heroMetaText}>{journey.duration}</Text>
              </View>
              <View style={styles.heroMetaDot} />
              <View style={styles.heroMetaItem}>
                <Ionicons name="sunny-outline" size={12} color={LuxuryColors.gold} />
                <Text style={styles.heroMetaText}>{journey.bestTime}</Text>
              </View>
              <View style={styles.heroMetaDot} />
              <View style={styles.heroMetaItem}>
                <Ionicons name="cash-outline" size={12} color={LuxuryColors.gold} />
                <Text style={styles.heroMetaText}>{journey.budget} · {journey.dailyBudget}</Text>
              </View>
            </View>

            {/* Difficulty + style tags */}
            <View style={styles.heroTagsRow}>
              <View style={[styles.heroTag, { borderColor: difficulty.color + '66' }]}>
                <Ionicons name={difficulty.icon} size={9} color={difficulty.color} />
                <Text style={[styles.heroTagText, { color: difficulty.color }]}>
                  {difficulty.label}
                </Text>
              </View>
              {travelStyles.map((s) => (
                <View key={s} style={styles.heroTag}>
                  <Text style={styles.heroTagText}>{s}</Text>
                </View>
              ))}
            </View>

            {/* Counter */}
            <View style={styles.freeCounterBadge}>
              <Ionicons name="diamond-outline" size={10} color={LuxuryColors.gold} />
              <Text style={styles.freeCounterText}>
                {freeRemaining} of {FREE_JOURNEY_LIMIT} complimentary remaining
              </Text>
            </View>
          </View>
        </View>

        {/* ── Creator strip ───────────────────────────────── */}
        {creator && (
          <View style={styles.creatorStrip}>
            {/* Top row: avatar + info + follow */}
            <View style={styles.creatorTopRow}>
              <View style={styles.creatorAvatar}>
                <Text style={styles.creatorAvatarText}>{creator.initials}</Text>
              </View>
              <View style={styles.creatorInfo}>
                <Text style={styles.creatorNameText}>{creator.name}</Text>
                <View style={styles.creatorRatingRow}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Ionicons
                      key={s}
                      name={s <= Math.round(creator.rating) ? 'star' : 'star-outline'}
                      size={10}
                      color={LuxuryColors.gold}
                    />
                  ))}
                  <Text style={styles.creatorRatingVal}> {creator.rating.toFixed(1)}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.followBtn, followed && styles.followBtnActive]}
                onPress={() => setFollowed((f) => !f)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={followed ? 'checkmark' : 'person-add-outline'}
                  size={12}
                  color={followed ? LuxuryColors.background : LuxuryColors.gold}
                />
                <Text style={[styles.followBtnText, followed && styles.followBtnTextActive]}>
                  {followed ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
            </View>
            {/* Bottom row: stats + view profile */}
            <View style={styles.creatorBottomRow}>
              <View style={styles.creatorStat}>
                <Ionicons name="people-outline" size={11} color={LuxuryColors.textTertiary} />
                <Text style={styles.creatorStatText}>{formatFollowers(creator.followers)} followers</Text>
              </View>
              <View style={styles.creatorStatDot} />
              <View style={styles.creatorStat}>
                <Ionicons name="heart-outline" size={11} color={LuxuryColors.textTertiary} />
                <Text style={styles.creatorStatText}>{formatSaves(journey.savedCount)} saves</Text>
              </View>
              <View style={styles.creatorStatDot} />
              <View style={styles.creatorStat}>
                <Ionicons name="star" size={11} color={LuxuryColors.gold} />
                <Text style={[styles.creatorStatText, { color: LuxuryColors.gold }]}>{journey.rating.toFixed(1)}</Text>
              </View>
              <View style={{ flex: 1 }} />
              <TouchableOpacity
                onPress={() =>
                  router.push({ pathname: '/(tabs)/creator-profile', params: { id: creator.id } })
                }
                activeOpacity={0.7}
              >
                <Text style={styles.viewProfileText}>Profile →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Content ──────────────────────────────────────── */}
        <View style={styles.content}>

          {/* Overview — always visible */}
          <View style={styles.overviewSection}>
            <Text style={styles.sectionLabel}>Overview</Text>
            <Text style={styles.bodyText}>{journey.overview}</Text>
          </View>

          <View style={styles.divider} />

          {/* Places to Explore */}
          <View style={styles.sectionOuter}>
            <SectionHeader
              label="Places to Explore"
              isOpen={sections.places}
              onToggle={() => toggleSection('places')}
            />
            {sections.places && (
              <View style={styles.sectionBody}>
                {journey.places.map((place) => (
                  <View key={place} style={styles.listRow}>
                    <View style={styles.bulletDiamond} />
                    <Text style={styles.listText}>{place}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.divider} />

          {/* Restaurants & Cafés */}
          <View style={styles.sectionOuter}>
            <SectionHeader
              label="Restaurants & Cafés"
              isOpen={sections.restaurants}
              onToggle={() => toggleSection('restaurants')}
            />
            {sections.restaurants && (
              <View style={styles.sectionBody}>
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
            )}
          </View>

          <View style={styles.divider} />

          {/* Local Experiences — 2-col cards */}
          <View style={styles.sectionOuter}>
            <SectionHeader
              label="Local Experiences"
              isOpen={sections.experiences}
              onToggle={() => toggleSection('experiences')}
            />
            {sections.experiences && (
              <View style={[styles.sectionBody, styles.expGrid]}>
                {journey.experiences.map((exp, idx) => (
                  <View key={exp} style={styles.expCard}>
                    <View style={styles.expCardIconWrap}>
                      <Ionicons
                        name={EXP_ICONS[idx % EXP_ICONS.length]}
                        size={15}
                        color={LuxuryColors.gold}
                      />
                    </View>
                    <Text style={styles.expCardText} numberOfLines={2}>{exp}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.divider} />

          {/* Day-by-Day Itinerary — luxury cards */}
          <View style={styles.sectionOuter}>
            <SectionHeader
              label="Day-by-Day Itinerary"
              isOpen={sections.itinerary}
              onToggle={() => toggleSection('itinerary')}
            />
            {sections.itinerary && (
              <View style={styles.sectionBody}>
                {journey.itinerary.map((dayPlan) => (
                  <View key={dayPlan.day} style={styles.itineraryCard}>
                    <View style={styles.itineraryCardHeader}>
                      <View style={styles.itineraryDayBadge}>
                        <Text style={styles.itineraryDayNum}>Day {dayPlan.day}</Text>
                      </View>
                    </View>
                    <View style={styles.itineraryActivities}>
                      {dayPlan.activities.map((activity, idx) => (
                        <View key={idx} style={styles.itineraryActivityRow}>
                          <Ionicons
                            name="location-outline"
                            size={11}
                            color={LuxuryColors.gold}
                            style={styles.itineraryActivityIcon}
                          />
                          <Text style={styles.itineraryActivityText}>{activity}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.divider} />

          {/* Photo Gallery — horizontal scroll + tap for fullscreen */}
          <View style={styles.sectionOuter}>
            <SectionHeader
              label="Photo Gallery"
              isOpen={sections.gallery}
              onToggle={() => toggleSection('gallery')}
            />
            {sections.gallery && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.galleryScroll}
                style={styles.galleryScrollWrap}
              >
                {galleryKeys.map((key, i) => (
                  <TouchableOpacity
                    key={`${key}-${i}`}
                    style={styles.galleryCard}
                    onPress={() => setGalleryIndex(i)}
                    activeOpacity={0.88}
                  >
                    <Image
                      source={JOURNEY_IMAGES[key]}
                      style={styles.galleryImage}
                      resizeMode="cover"
                    />
                    <LinearGradient
                      colors={['transparent', 'rgba(7,17,32,0.50)'] as const}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.galleryExpandIcon}>
                      <Ionicons name="expand-outline" size={14} color="rgba(255,255,255,0.85)" />
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

          <View style={styles.divider} />

          {/* Traveler Reviews */}
          <View style={styles.sectionOuter}>
            <SectionHeader
              label={`Traveler Reviews  (${reviews.length})`}
              isOpen={sections.reviews}
              onToggle={() => toggleSection('reviews')}
            />
            {sections.reviews && (
              <View style={styles.sectionBody}>
                {/* Summary bar */}
                <View style={styles.reviewSummary}>
                  <Text style={styles.reviewAvgScore}>{journey.rating.toFixed(1)}</Text>
                  <View style={styles.reviewAvgStars}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Ionicons
                        key={s}
                        name={s <= Math.round(journey.rating) ? 'star' : 'star-outline'}
                        size={14}
                        color={LuxuryColors.gold}
                      />
                    ))}
                  </View>
                  <Text style={styles.reviewAvgLabel}>{reviews.length} reviews</Text>
                </View>
                {/* Review cards */}
                {reviews.map((review) => (
                  <View key={review.id} style={styles.reviewCard}>
                    <View style={styles.reviewCardHeader}>
                      <View style={styles.reviewAvatar}>
                        <Text style={styles.reviewAvatarText}>{review.initials}</Text>
                      </View>
                      <View style={styles.reviewMeta}>
                        <Text style={styles.reviewAuthor}>{review.author}</Text>
                        <Text style={styles.reviewLocation}>{review.location}</Text>
                      </View>
                      <View style={styles.reviewRating}>
                        {Array.from({ length: review.rating }).map((_, i) => (
                          <Ionicons key={i} name="star" size={10} color={LuxuryColors.gold} />
                        ))}
                      </View>
                    </View>
                    <Text style={styles.reviewText}>{review.text}</Text>
                    <Text style={styles.reviewDate}>{review.date}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Save Journey CTA — animated + haptic */}
          <Animated.View style={{ transform: [{ scale: saveScale }] }}>
            <TouchableOpacity
              style={[styles.saveCta, saved && styles.saveCtaSaved]}
              onPress={handleToggleSave}
              activeOpacity={0.85}
              disabled={saveLoading}
            >
              <Ionicons
                name={saved ? 'bookmark' : 'bookmark-outline'}
                size={16}
                color={saved ? LuxuryColors.background : LuxuryColors.gold}
              />
              <Text style={[styles.saveCtaText, saved && styles.saveCtaTextSaved]}>
                {saved ? 'Saved  ✓' : 'Save Journey'}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          <View style={{ height: 80 + insets.bottom }} />
        </View>
      </ScrollView>

      {/* ── Full-screen Gallery Modal ────────────────────────── */}
      <Modal
        visible={galleryIndex !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setGalleryIndex(null)}
      >
        <View style={styles.modalBg}>
          <TouchableOpacity
            style={[styles.modalClose, { top: insets.top + 12 }]}
            onPress={() => setGalleryIndex(null)}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          {galleryIndex !== null && (
            <Image
              source={JOURNEY_IMAGES[galleryKeys[galleryIndex]]}
              style={styles.modalImage}
              resizeMode="contain"
            />
          )}

          <View style={[styles.modalNavRow, { paddingBottom: insets.bottom + 16 }]}>
            <TouchableOpacity
              style={[styles.modalNavBtn, galleryIndex === 0 && styles.modalNavBtnDisabled]}
              onPress={() => setGalleryIndex((i) => (i !== null ? Math.max(0, i - 1) : 0))}
              disabled={galleryIndex === 0}
              activeOpacity={0.7}
            >
              <Ionicons
                name="chevron-back"
                size={22}
                color={galleryIndex === 0 ? 'rgba(255,255,255,0.25)' : '#FFFFFF'}
              />
            </TouchableOpacity>
            <Text style={styles.modalCounter}>
              {(galleryIndex ?? 0) + 1} / {galleryKeys.length}
            </Text>
            <TouchableOpacity
              style={[
                styles.modalNavBtn,
                galleryIndex === galleryKeys.length - 1 && styles.modalNavBtnDisabled,
              ]}
              onPress={() =>
                setGalleryIndex((i) =>
                  i !== null ? Math.min(galleryKeys.length - 1, i + 1) : 0,
                )
              }
              disabled={galleryIndex === galleryKeys.length - 1}
              activeOpacity={0.7}
            >
              <Ionicons
                name="chevron-forward"
                size={22}
                color={
                  galleryIndex === galleryKeys.length - 1
                    ? 'rgba(255,255,255,0.25)'
                    : '#FFFFFF'
                }
              />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
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

  // ── Hero ────────────────────────────────────────────────
  heroWrap: {
    height: 330,
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
  saveHeroBtn: {
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
    gap: 7,
  },
  heroRegion: {
    fontSize: 9,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 2.8,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    lineHeight: 31,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: LuxurySpacing.sm,
  },
  heroMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroMetaText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.80)',
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  heroMetaDot: {
    width: 3,
    height: 3,
    borderRadius: LuxuryBorderRadius.full,
    backgroundColor: LuxuryColors.gold,
    opacity: 0.55,
  },
  heroTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  heroTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(7,17,32,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.28)',
    borderRadius: LuxuryBorderRadius.full,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  heroTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.82)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
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
    color: 'rgba(255,255,255,0.70)',
    letterSpacing: 0.2,
    fontWeight: '500',
  },

  // ── Creator strip ────────────────────────────────────────
  creatorStrip: {
    paddingHorizontal: LuxurySpacing.xl,
    paddingVertical: LuxurySpacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: LuxuryColors.surface,
    gap: LuxurySpacing.sm,
  },
  creatorTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.sm,
  },
  creatorAvatar: {
    width: 44,
    height: 44,
    borderRadius: LuxuryBorderRadius.full,
    backgroundColor: 'rgba(212,175,55,0.14)',
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.40)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorAvatarText: {
    fontSize: 13,
    fontWeight: '800',
    color: LuxuryColors.gold,
    letterSpacing: 0.3,
  },
  creatorInfo: {
    flex: 1,
    gap: 3,
  },
  creatorNameText: {
    fontSize: LuxuryFontSize.md,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
    letterSpacing: 0.1,
  },
  creatorRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  creatorRatingVal: {
    fontSize: 11,
    fontWeight: '700',
    color: LuxuryColors.gold,
    marginLeft: 2,
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: LuxuryBorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.45)',
    backgroundColor: 'transparent',
  },
  followBtnActive: {
    backgroundColor: LuxuryColors.gold,
    borderColor: LuxuryColors.gold,
  },
  followBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 0.4,
  },
  followBtnTextActive: {
    color: LuxuryColors.background,
  },
  creatorBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  creatorStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  creatorStatText: {
    fontSize: 11,
    color: LuxuryColors.textTertiary,
    letterSpacing: 0.1,
  },
  creatorStatDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(122,118,104,0.35)',
  },
  viewProfileText: {
    fontSize: 11,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 0.3,
  },

  // ── Content ─────────────────────────────────────────────
  content: {
    paddingTop: LuxurySpacing.lg,
  },
  overviewSection: {
    paddingHorizontal: LuxurySpacing.xl,
    paddingVertical: LuxurySpacing.md,
    gap: LuxurySpacing.sm,
  },
  sectionOuter: {
    paddingHorizontal: LuxurySpacing.xl,
    paddingTop: LuxurySpacing.md,
    paddingBottom: LuxurySpacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: LuxurySpacing.sm,
  },
  sectionBody: {
    gap: LuxurySpacing.sm,
    paddingTop: 2,
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
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

  // ── List rows ───────────────────────────────────────────
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
    marginTop: 7,
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

  // ── Local Experiences 2-col grid ────────────────────────
  expGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: LuxurySpacing.sm,
  },
  expCard: {
    width: (SCREEN_WIDTH - LuxurySpacing.xl * 2 - LuxurySpacing.sm) / 2,
    backgroundColor: 'rgba(13,21,37,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.12)',
    borderRadius: LuxuryBorderRadius.lg,
    padding: LuxurySpacing.md,
    gap: LuxurySpacing.xs,
    ...LuxuryShadow.soft,
  },
  expCardIconWrap: {
    width: 30,
    height: 30,
    borderRadius: LuxuryBorderRadius.sm,
    backgroundColor: 'rgba(212,175,55,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  expCardText: {
    fontSize: 11,
    color: LuxuryColors.textSecondary,
    lineHeight: 16,
    letterSpacing: 0.1,
  },

  // ── Itinerary cards ─────────────────────────────────────
  itineraryCard: {
    backgroundColor: 'rgba(13,21,37,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.10)',
    borderRadius: LuxuryBorderRadius.lg,
    overflow: 'hidden',
    marginBottom: LuxurySpacing.sm,
    ...LuxuryShadow.soft,
  },
  itineraryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: LuxurySpacing.md,
    paddingTop: LuxurySpacing.md,
    paddingBottom: LuxurySpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212,175,55,0.08)',
  },
  itineraryDayBadge: {
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderRadius: LuxuryBorderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  itineraryDayNum: {
    fontSize: 10,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  itineraryActivities: {
    paddingHorizontal: LuxurySpacing.md,
    paddingTop: LuxurySpacing.sm,
    paddingBottom: LuxurySpacing.md,
    gap: 8,
  },
  itineraryActivityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
  },
  itineraryActivityIcon: {
    marginTop: 2,
    flexShrink: 0,
  },
  itineraryActivityText: {
    flex: 1,
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textSecondary,
    lineHeight: 20,
    letterSpacing: 0.1,
  },

  // ── Gallery ─────────────────────────────────────────────
  galleryScrollWrap: {
    marginHorizontal: -LuxurySpacing.xl,
  },
  galleryScroll: {
    paddingHorizontal: LuxurySpacing.xl,
    paddingBottom: LuxurySpacing.sm,
    gap: LuxurySpacing.sm,
  },
  galleryCard: {
    width: SCREEN_WIDTH * 0.62,
    height: 200,
    borderRadius: LuxuryBorderRadius.xl,
    overflow: 'hidden',
    ...LuxuryShadow.medium,
  },
  galleryImage: {
    width: '100%',
    height: '100%',
  },
  galleryExpandIcon: {
    position: 'absolute',
    bottom: LuxurySpacing.sm,
    right: LuxurySpacing.sm,
    width: 28,
    height: 28,
    borderRadius: LuxuryBorderRadius.full,
    backgroundColor: 'rgba(7,17,32,0.60)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Save CTA ────────────────────────────────────────────
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
    borderColor: LuxuryColors.gold,
  },
  saveCtaText: {
    fontSize: LuxuryFontSize.sm,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  saveCtaTextSaved: {
    color: LuxuryColors.background,
  },

  // ── Fullscreen gallery modal ────────────────────────────
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(3,10,20,0.97)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalClose: {
    position: 'absolute',
    right: LuxurySpacing.lg,
    width: 36,
    height: 36,
    borderRadius: LuxuryBorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 1.2,
  },
  modalNavRow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: LuxurySpacing.xxl,
    paddingTop: LuxurySpacing.lg,
    backgroundColor: 'rgba(3,10,20,0.70)',
  },
  modalNavBtn: {
    width: 44,
    height: 44,
    borderRadius: LuxuryBorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalNavBtnDisabled: {
    opacity: 0.35,
  },
  modalCounter: {
    fontSize: LuxuryFontSize.sm,
    color: 'rgba(255,255,255,0.70)',
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  // ── Reviews ──────────────────────────────────────────────
  reviewSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.sm,
    paddingVertical: LuxurySpacing.sm,
    marginBottom: LuxurySpacing.sm,
  },
  reviewAvgScore: {
    fontSize: LuxuryFontSize.xxl,
    fontWeight: '800',
    color: LuxuryColors.textPrimary,
    letterSpacing: -0.5,
  },
  reviewAvgStars: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewAvgLabel: {
    fontSize: 11,
    color: LuxuryColors.textTertiary,
    letterSpacing: 0.2,
  },
  reviewCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: LuxuryBorderRadius.lg,
    padding: LuxurySpacing.md,
    gap: LuxurySpacing.sm,
    marginBottom: LuxurySpacing.sm,
  },
  reviewCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.sm,
  },
  reviewAvatar: {
    width: 32,
    height: 32,
    borderRadius: LuxuryBorderRadius.full,
    backgroundColor: 'rgba(212,175,55,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAvatarText: {
    fontSize: 10,
    fontWeight: '800',
    color: LuxuryColors.gold,
    letterSpacing: 0.3,
  },
  reviewMeta: {
    flex: 1,
    gap: 1,
  },
  reviewAuthor: {
    fontSize: LuxuryFontSize.sm,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
    letterSpacing: 0.1,
  },
  reviewLocation: {
    fontSize: 10,
    color: LuxuryColors.textTertiary,
    letterSpacing: 0.2,
  },
  reviewRating: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewText: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textSecondary,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  reviewDate: {
    fontSize: 10,
    color: LuxuryColors.textTertiary,
    letterSpacing: 0.3,
    textAlign: 'right',
  },
});
