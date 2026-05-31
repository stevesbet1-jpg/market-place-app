import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  Share,
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
import type { ImageKey } from '../../constants/journeys';
import type { CreatorJourney } from '../../constants/creatorJourneyModel';
import { formatSaves } from '../../constants/creators';
import { getJourneyById } from '../../lib/creatorJourneyService';
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

function journeyImageSource(journey: CreatorJourney) {
  if (journey.imageUri) return { uri: journey.imageUri };
  const key = journey.imageKey as ImageKey | undefined;
  if (key && key in JOURNEY_IMAGES) return JOURNEY_IMAGES[key];
  return null;
}

function deriveInitials(name: string): string {
  return name.split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase();
}

// ─── Derived presentation helpers ───────────────────────────────────────────
type DifficultyInfo = { label: string; color: string; icon: keyof typeof Ionicons.glyphMap };

function getDifficulty(journey: CreatorJourney): DifficultyInfo {
  const days = parseInt(journey.duration, 10);
  if (!isNaN(days) && days >= 12) {
    return { label: 'Advanced', color: '#FF6B6B', icon: 'trending-up-outline' };
  }
  if (!isNaN(days) && days >= 7) {
    return { label: 'Moderate', color: '#FFA040', icon: 'flame-outline' };
  }
  return { label: 'Easy', color: '#4CAF80', icon: 'leaf-outline' };
}

function getTravelStyles(journey: CreatorJourney): string[] {
  const haystack = (journey.title + ' ' + journey.region + ' ' + journey.destination).toLowerCase();
  const tags: string[] = ['Luxury'];
  if (/ocean|sea|island|coast|beach|maldiv|seychell|zanzibar/.test(haystack)) tags.push('Beach');
  if (/mountain|alps|trek|safari|desert/.test(haystack)) tags.push('Adventure');
  if (/japan|bali|tokyo|kyoto|africa|temple|heritage/.test(haystack)) tags.push('Culture');
  if (journey.restaurants.length >= 4) tags.push('Food');
  return [...new Set(tags)].slice(0, 4);
}

// ─── Paywall gate ────────────────────────────────────────────────────────────
function PaywallBanner({ sectionName }: { sectionName: string }) {
  return (
    <View style={styles.paywallBanner}>
      <View style={styles.paywallIconCircle}>
        <Ionicons name="lock-closed" size={22} color={LuxuryColors.gold} />
      </View>
      <Text style={styles.paywallTitle}>Club Members Only</Text>
      <Text style={styles.paywallDesc}>
        Unlock the full {sectionName}, hotels, insider tips and creator notes
        with a Club membership.
      </Text>
      <TouchableOpacity
        style={styles.paywallCta}
        onPress={() => router.push('/(tabs)/membership')}
        activeOpacity={0.85}
      >
        <Ionicons name="diamond" size={12} color={LuxuryColors.background} />
        <Text style={styles.paywallCtaText}>Unlock with Club</Text>
      </TouchableOpacity>
    </View>
  );
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
  const [journey, setJourney] = useState<CreatorJourney | null>(null);
  const [loading, setLoading] = useState(true);

  const [saved, setSaved] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [followed, setFollowed] = useState(false);
  const [freeRemaining, setFreeRemaining] = useState<number>(FREE_JOURNEY_LIMIT);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [sections, setSections] = useState({
    places: true,
    restaurants: true,
    experiences: true,
    itinerary: true,
    hotels: true,
    map: true,
    insiderTips: true,
    gallery: true,
    reviews: true,
  });

  const saveScale = useRef(new Animated.Value(1)).current;

  const toggleSection = useCallback((key: keyof typeof sections) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!id) { setLoading(false); return; }
    getJourneyById(id).then((j) => {
      if (!cancelled) { setJourney(j); setLoading(false); }
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    consumeFreeJourney(id).then(setFreeRemaining);
    getSavedIds().then((ids) => setSaved(ids.includes(id)));
  }, [id]);

  const handleShare = useCallback(async () => {
    if (!journey) return;
    try {
      await Share.share({
        title: journey.title,
        message: `${journey.title} — ${journey.destination}\n\nDiscover this ${journey.duration} journey curated by a top travel creator. ${journey.overview.slice(0, 120)}…`,
      });
    } catch (_) { /* user dismissed */ }
  }, [journey]);

  const handleStartPlanning = useCallback(() => {
    if (!journey) return;
    router.push({
      pathname: '/(tabs)/ai-concierge',
      params: { query: `${journey.duration} in ${journey.destination}` },
    });
  }, [journey]);

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

  if (loading) {
    return (
      <View style={[styles.container, styles.notFoundWrap]}>
        <ActivityIndicator color={LuxuryColors.gold} />
      </View>
    );
  }

  if (!journey) {
    return (
      <View style={[styles.container, styles.notFoundWrap]}>
        <Ionicons name="map-outline" size={36} color={LuxuryColors.textTertiary} />
        <Text style={styles.notFoundText}>Journey not available</Text>
        <Text style={styles.notFoundSub}>
          This journey may still be under review or has not been published yet.
        </Text>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8}>
          <Text style={styles.backFallback}>← Back to Journeys</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const galleryImageSrc = journeyImageSource(journey);
  const galleryKeys: ImageKey[] = journey.imageKey
    ? ([journey.imageKey] as ImageKey[])
    : [];

  const difficulty = getDifficulty(journey);
  const travelStyles = getTravelStyles(journey);
  const creatorInitials = deriveInitials(journey.creatorName || 'Creator');

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
          {galleryImageSrc ? (
            <Image
              source={galleryImageSrc}
              style={styles.heroImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.heroImage, { backgroundColor: LuxuryColors.surface }]} />
          )}
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

          {/* Share in hero */}
          <TouchableOpacity
            style={[styles.shareHeroBtn, { top: insets.top + LuxurySpacing.sm }]}
            onPress={handleShare}
            activeOpacity={0.8}
          >
            <Ionicons name="share-outline" size={20} color="#FFFFFF" />
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
            <Text style={styles.heroTitle}>{journey.title}</Text>

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
        {journey.creatorName ? (
          <View style={styles.creatorStrip}>
            {/* Top row: avatar + info + follow */}
            <View style={styles.creatorTopRow}>
              <TouchableOpacity
                onPress={() => router.push({ pathname: '/(tabs)/creator-profile', params: { id: journey.creatorId } })}
                activeOpacity={0.8}
              >
                <View style={styles.creatorAvatar}>
                  <Text style={styles.creatorAvatarText}>{creatorInitials}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.creatorInfo}
                onPress={() => router.push({ pathname: '/(tabs)/creator-profile', params: { id: journey.creatorId } })}
                activeOpacity={0.8}
              >
                <Text style={styles.creatorNameText}>{journey.creatorName}</Text>
                {journey.rating > 0 && (
                  <View style={styles.creatorRatingRow}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Ionicons
                        key={s}
                        name={s <= Math.round(journey.rating) ? 'star' : 'star-outline'}
                        size={10}
                        color={LuxuryColors.gold}
                      />
                    ))}
                    <Text style={styles.creatorRatingVal}> {journey.rating.toFixed(1)}</Text>
                  </View>
                )}
              </TouchableOpacity>
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
              {journey.savedCount > 0 && (
                <>
                  <View style={styles.creatorStat}>
                    <Ionicons name="heart-outline" size={11} color={LuxuryColors.textTertiary} />
                    <Text style={styles.creatorStatText}>{formatSaves(journey.savedCount)} saves</Text>
                  </View>
                  <View style={styles.creatorStatDot} />
                </>
              )}
              {journey.rating > 0 && (
                <View style={styles.creatorStat}>
                  <Ionicons name="star" size={11} color={LuxuryColors.gold} />
                  <Text style={[styles.creatorStatText, { color: LuxuryColors.gold }]}>{journey.rating.toFixed(1)}</Text>
                </View>
              )}
              <View style={{ flex: 1 }} />
              <TouchableOpacity
                onPress={() =>
                  router.push({ pathname: '/(tabs)/creator-profile', params: { id: journey.creatorId } })
                }
                activeOpacity={0.7}
              >
                <Text style={styles.viewProfileText}>Profile →</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

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

          {/* Restaurants & Cafés — first item visible, rest locked */}
          <View style={styles.sectionOuter}>
            <SectionHeader
              label="Restaurants & Cafés"
              isOpen={sections.restaurants}
              onToggle={() => toggleSection('restaurants')}
            />
            {sections.restaurants && (
              <View style={styles.sectionBody}>
                {/* Always show the first restaurant as a teaser */}
                {journey.restaurants.slice(0, 1).map((r) => (
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
                {/* Gate the rest */}
                {isPremium ? (
                  journey.restaurants.slice(1).map((r) => (
                    <View key={r} style={styles.listRow}>
                      <Ionicons
                        name="restaurant-outline"
                        size={12}
                        color={LuxuryColors.gold}
                        style={styles.listIcon}
                      />
                      <Text style={styles.listText}>{r}</Text>
                    </View>
                  ))
                ) : (
                  journey.restaurants.length > 1 && (
                    <PaywallBanner sectionName="restaurant list" />
                  )
                )}
              </View>
            )}
          </View>

          <View style={styles.divider} />

          {/* Hotels — locked for members */}
          <View style={styles.sectionOuter}>
            <SectionHeader
              label="Where to Stay"
              isOpen={sections.hotels}
              onToggle={() => toggleSection('hotels')}
            />
            {sections.hotels && (
              <View style={styles.sectionBody}>
                {isPremium ? (
                  <Text style={styles.bodyText}>
                    Hotel recommendations will be added by the creator.
                  </Text>
                ) : (
                  <PaywallBanner sectionName="hotel recommendations" />
                )}
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

          {/* Day-by-Day Itinerary — Day 1 free, rest locked */}
          <View style={styles.sectionOuter}>
            <SectionHeader
              label="Day-by-Day Itinerary"
              isOpen={sections.itinerary}
              onToggle={() => toggleSection('itinerary')}
            />
            {sections.itinerary && (
              <View style={styles.sectionBody}>
                {/* Day 1 always visible */}
                {journey.itinerary.slice(0, 1).map((dayPlan) => (
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
                {/* Remaining days gated */}
                {isPremium ? (
                  journey.itinerary.slice(1).map((dayPlan) => (
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
                  ))
                ) : (
                  journey.itinerary.length > 1 && (
                    <PaywallBanner sectionName={`full ${journey.itinerary.length}-day itinerary`} />
                  )
                )}
              </View>
            )}
          </View>

          <View style={styles.divider} />

          {/* Journey Route Map placeholder */}
          <View style={styles.sectionOuter}>
            <SectionHeader
              label="Journey Route"
              isOpen={sections.map}
              onToggle={() => toggleSection('map')}
            />
            {sections.map && (
              isPremium ? (
                <View style={styles.mapPlaceholder}>
                  <Ionicons name="map" size={32} color="rgba(212,175,55,0.35)" />
                  <Text style={styles.mapTitle}>{journey.destination} Route</Text>
                  <Text style={styles.mapSub}>
                    {journey.places.length} stops · {journey.duration}
                  </Text>
                  <View style={styles.mapStopsRow}>
                    {journey.places.slice(0, 4).map((place, i) => (
                      <View key={place} style={styles.mapStop}>
                        <View style={styles.mapStopDot} />
                        {i < Math.min(journey.places.length, 4) - 1 && (
                          <View style={styles.mapStopLine} />
                        )}
                        <Text style={styles.mapStopName} numberOfLines={1}>{place}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : (
                <PaywallBanner sectionName="journey route map" />
              )
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
            {sections.gallery && galleryImageSrc && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.galleryScroll}
                style={styles.galleryScrollWrap}
              >
                {galleryKeys.length > 0 ? galleryKeys.map((key, i) => (
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
                )) : (
                  <TouchableOpacity
                    style={styles.galleryCard}
                    onPress={() => setGalleryIndex(0)}
                    activeOpacity={0.88}
                  >
                    <Image
                      source={galleryImageSrc}
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
                )}
              </ScrollView>
            )}
          </View>

          <View style={styles.divider} />

          {/* Traveler Reviews */}
          <View style={styles.sectionOuter}>
            <SectionHeader
              label="Traveler Reviews"
              isOpen={sections.reviews}
              onToggle={() => toggleSection('reviews')}
            />
            {sections.reviews && (
              <View style={styles.sectionBody}>
                <Text style={styles.bodyText}>No reviews yet.</Text>
              </View>
            )}
          </View>

          {/* Insider Tips — Creator notes, gated */}
          <View style={styles.sectionOuter}>
            <SectionHeader
              label="Creator's Insider Tips"
              isOpen={sections.insiderTips}
              onToggle={() => toggleSection('insiderTips')}
            />
            {sections.insiderTips && (
              <View style={styles.sectionBody}>
                {isPremium ? (
                  <Text style={styles.bodyText}>Insider tips will appear here once the creator adds them.</Text>
                ) : (
                  <PaywallBanner sectionName="insider tips" />
                )}
              </View>
            )}
          </View>

          <View style={styles.divider} />

          {/* Action buttons row */}
          <View style={styles.actionRow}>
            {/* Start Planning */}
            <TouchableOpacity
              style={styles.startPlanningBtn}
              onPress={handleStartPlanning}
              activeOpacity={0.85}
            >
              <Ionicons name="sparkles-outline" size={16} color={LuxuryColors.background} />
              <Text style={styles.startPlanningText}>Start Planning</Text>
            </TouchableOpacity>

            {/* Share */}
            <TouchableOpacity
              style={styles.shareBtn}
              onPress={handleShare}
              activeOpacity={0.85}
            >
              <Ionicons name="share-outline" size={16} color={LuxuryColors.gold} />
            </TouchableOpacity>
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
              source={galleryKeys.length > 0 ? JOURNEY_IMAGES[galleryKeys[galleryIndex]] : galleryImageSrc!}
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
  notFoundSub: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: LuxurySpacing.xl,
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
  shareHeroBtn: {
    position: 'absolute',
    right: LuxurySpacing.lg + 44,
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

  // ── Similar Journeys ─────────────────────────────────────
  similarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: LuxuryBorderRadius.lg,
    overflow: 'hidden',
    marginBottom: LuxurySpacing.sm,
    gap: LuxurySpacing.md,
    paddingRight: LuxurySpacing.md,
  },
  similarCardThumb: {
    width: 72,
    height: 72,
    flexShrink: 0,
  },
  similarCardInfo: {
    flex: 1,
    gap: 2,
    paddingVertical: LuxurySpacing.xs,
  },
  similarCardName: {
    fontSize: LuxuryFontSize.sm,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
    letterSpacing: 0.1,
  },
  similarCardDest: {
    fontSize: 10,
    color: LuxuryColors.textSecondary,
    letterSpacing: 0.1,
  },
  similarCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  similarCardRating: {
    fontSize: 10,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 0.2,
  },
  similarCardBudget: {
    fontSize: 10,
    color: LuxuryColors.textTertiary,
    letterSpacing: 0.1,
  },

  // ── Action row ───────────────────────────────────────────
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.sm,
    paddingHorizontal: LuxurySpacing.xl,
    paddingVertical: LuxurySpacing.md,
  },
  startPlanningBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: LuxurySpacing.sm,
    backgroundColor: LuxuryColors.gold,
    borderRadius: LuxuryBorderRadius.full,
    paddingVertical: 13,
  },
  startPlanningText: {
    fontSize: LuxuryFontSize.sm,
    fontWeight: '800',
    color: LuxuryColors.background,
    letterSpacing: 0.3,
  },
  shareBtn: {
    width: 46,
    height: 46,
    borderRadius: LuxuryBorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    backgroundColor: 'transparent',
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

  // ── Paywall Banner ───────────────────────────────────────
  paywallBanner: {
    alignItems: 'center',
    gap: LuxurySpacing.md,
    backgroundColor: 'rgba(212,175,55,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.18)',
    borderRadius: LuxuryBorderRadius.xl,
    paddingVertical: LuxurySpacing.xl,
    paddingHorizontal: LuxurySpacing.xl,
    marginTop: LuxurySpacing.sm,
  },
  paywallIconCircle: {
    width: 52,
    height: 52,
    borderRadius: LuxuryBorderRadius.full,
    backgroundColor: 'rgba(212,175,55,0.10)',
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paywallTitle: {
    fontSize: LuxuryFontSize.md,
    fontWeight: '800',
    color: LuxuryColors.textPrimary,
    letterSpacing: 0.2,
  },
  paywallDesc: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  paywallCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.sm,
    backgroundColor: LuxuryColors.gold,
    borderRadius: LuxuryBorderRadius.full,
    paddingVertical: 11,
    paddingHorizontal: LuxurySpacing.xl,
    marginTop: 4,
  },
  paywallCtaText: {
    fontSize: LuxuryFontSize.sm,
    fontWeight: '800',
    color: LuxuryColors.background,
    letterSpacing: 0.4,
  },

  // ── Hotels ───────────────────────────────────────────────
  hotelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: LuxuryBorderRadius.lg,
    padding: LuxurySpacing.md,
    gap: LuxurySpacing.sm,
  },
  hotelCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.sm,
    flex: 1,
  },
  hotelIconWrap: {
    width: 38,
    height: 38,
    borderRadius: LuxuryBorderRadius.md,
    backgroundColor: 'rgba(212,175,55,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  hotelInfo: {
    flex: 1,
    gap: 2,
  },
  hotelName: {
    fontSize: LuxuryFontSize.sm,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
    letterSpacing: 0.1,
  },
  hotelStars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  hotelType: {
    fontSize: 10,
    color: LuxuryColors.textTertiary,
    letterSpacing: 0.2,
  },
  hotelPrice: {
    fontSize: 11,
    fontWeight: '600',
    color: LuxuryColors.gold,
    letterSpacing: 0.1,
  },
  hotelNoteBadge: {
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderRadius: LuxuryBorderRadius.sm,
    paddingHorizontal: 7,
    paddingVertical: 3,
    flexShrink: 0,
  },
  hotelNoteText: {
    fontSize: 9,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 0.3,
  },

  // ── Journey Route Map Placeholder ────────────────────────
  mapPlaceholder: {
    alignItems: 'center',
    gap: LuxurySpacing.md,
    backgroundColor: 'rgba(13,21,37,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.12)',
    borderRadius: LuxuryBorderRadius.xl,
    paddingVertical: LuxurySpacing.xl,
    paddingHorizontal: LuxurySpacing.xl,
    marginTop: LuxurySpacing.sm,
  },
  mapTitle: {
    fontSize: LuxuryFontSize.md,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
    letterSpacing: 0.1,
  },
  mapSub: {
    fontSize: 11,
    color: LuxuryColors.textTertiary,
    letterSpacing: 0.2,
  },
  mapStopsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 0,
    marginTop: LuxurySpacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  mapStop: {
    alignItems: 'center',
    gap: 4,
    width: 70,
  },
  mapStopDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: LuxuryColors.gold,
    borderWidth: 2,
    borderColor: 'rgba(212,175,55,0.30)',
  },
  mapStopLine: {
    position: 'absolute',
    top: 4,
    left: '50%',
    width: 70,
    height: 2,
    backgroundColor: 'rgba(212,175,55,0.20)',
  },
  mapStopName: {
    fontSize: 9,
    color: LuxuryColors.textSecondary,
    letterSpacing: 0.2,
    textAlign: 'center',
  },

  // ── Insider Tips ─────────────────────────────────────────
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: LuxurySpacing.sm,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.10)',
    borderRadius: LuxuryBorderRadius.lg,
    padding: LuxurySpacing.md,
  },
  tipNumBadge: {
    width: 22,
    height: 22,
    borderRadius: LuxuryBorderRadius.full,
    backgroundColor: 'rgba(212,175,55,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  tipNum: {
    fontSize: 10,
    fontWeight: '800',
    color: LuxuryColors.gold,
    letterSpacing: 0.2,
  },
  tipText: {
    flex: 1,
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textSecondary,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
});
