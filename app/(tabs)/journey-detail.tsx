import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  ActivityIndicator,
  Alert,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Dimensions,
  Share,
  Animated,
  type ImageSourcePropType,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import {
  LuxuryBorderRadius,
  LuxuryColors,
  LuxuryFontSize,
  LuxuryShadow,
  LuxurySpacing,
} from '../../constants/luxuryTheme';
import type { ImageKey } from '../../constants/journeys';
import type { CreatorJourney } from '../../constants/creatorJourneyModel';
import { getFirebaseApp } from '../../lib/firebase';
import { isValidRemoteImageUrl } from '../../lib/imageFallback';
import { checkMembership } from '../../lib/membershipService';
import { getJourneyById } from '../../lib/creatorJourneyService';
import { getJourneyReviews, type JourneyReview } from '../../lib/reviewService';
import {
  consumeFreeJourney,
  FREE_JOURNEY_LIMIT,
  getSavedIds,
  setJourneyStoreUid,
  toggleSaved,
} from '../../constants/journeyStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CONTENT_WIDTH = SCREEN_WIDTH - LuxurySpacing.lg * 2;
const MEMORY_TILE_WIDTH = (CONTENT_WIDTH - LuxurySpacing.md) / 2;
const CYAN = '#8AE6FF';

const JOURNEY_IMAGES: Record<ImageKey, ReturnType<typeof require>> = {
  islands: require('../../assets/collections/private-islands.jpg'),
  villas: require('../../assets/collections/super-villas.jpg'),
  yacht: require('../../assets/collections/yacht-escapes.jpg'),
  desert: require('../../assets/collections/desert-retreats.jpg'),
  mountain: require('../../assets/collections/alpine-mountains.jpg'),
  city: require('../../assets/collections/japanese-city.jpg'),
  temple: require('../../assets/collections/japanese-temple.jpg'),
  bali: require('../../assets/collections/bali-rice.jpg'),
  seychelles: require('../../assets/collections/seychelles-beach.jpg'),
  zanzibar: require('../../assets/collections/zanzibar-coast.jpg'),
  lakecomo: require('../../assets/collections/lake-como-view.jpg'),
  alps: require('../../assets/collections/swiss-alps-day.jpg'),
};

type HighlightCard = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  value: string;
  caption: string;
};

type InsightCard = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
};

type MemoryTile = {
  id: string;
  label: string;
  caption: string;
  source: ImageSourcePropType | null;
  tall: boolean;
};

type RouteStop = {
  id: string;
  label: string;
  subtitle: string;
};

type TimelineItem = {
  id: string;
  day: number;
  dateLabel: string;
  title: string;
  description: string;
  source: ImageSourcePropType | null;
};

function journeyImageSource(journey: CreatorJourney): ImageSourcePropType | null {
  if (isValidRemoteImageUrl(journey.imageUri)) return { uri: journey.imageUri!.trim() };
  const key = journey.imageKey as ImageKey | undefined;
  if (key && key in JOURNEY_IMAGES) return JOURNEY_IMAGES[key];
  return null;
}

function deriveInitials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function durationDays(duration: string): number {
  const match = duration.match(/\d+/);
  if (!match) return 5;
  const parsed = Number.parseInt(match[0], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
}

function formatCompactCurrency(value: number): string {
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  }
  return `$${Math.round(value)}`;
}

function estimateSpend(journey: CreatorJourney): string {
  const matches = [...journey.dailyBudget.matchAll(/\d+/g)].map((match) => Number.parseInt(match[0], 10));
  const days = durationDays(journey.duration);
  if (matches.length >= 2) {
    const average = (matches[0] + matches[1]) / 2;
    return formatCompactCurrency(average * days);
  }
  if (matches.length === 1) {
    return formatCompactCurrency(matches[0] * days);
  }
  const fallback: Record<CreatorJourney['budget'], number> = {
    $: 120,
    $$: 260,
    $$$: 520,
    $$$$: 980,
  };
  return formatCompactCurrency(fallback[journey.budget] * days);
}

function inferWeather(journey: CreatorJourney): string {
  const text = `${journey.destination} ${journey.region} ${journey.bestTime}`.toLowerCase();
  if (/desert|dune|dubai|morocco/.test(text)) return '31C sunny';
  if (/alps|mountain|swiss/.test(text)) return '14C alpine';
  if (/island|beach|coast|seychell|zanzibar|bali/.test(text)) return '28C coastal';
  if (/japan|kyoto|tokyo|city/.test(text)) return '22C clear';
  return '24C mild';
}

function tripRangeLabel(journey: CreatorJourney): string {
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const lower = journey.bestTime.toLowerCase();
  const monthIndex = months.findIndex((month) => lower.includes(month));
  const start = new Date();
  if (monthIndex >= 0) {
    start.setMonth(monthIndex);
  }
  start.setDate(12);
  const end = new Date(start);
  end.setDate(start.getDate() + Math.max(durationDays(journey.duration) - 1, 0));
  const fmt = (date: Date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${fmt(start)} - ${fmt(end)}`;
}

function buildJourneyStory(journey: CreatorJourney): string {
  const days = durationDays(journey.duration);
  const places = journey.places.slice(0, 3).join(', ');
  const experiences = journey.experiences.slice(0, 2).join(', ');
  if (places || experiences) {
    return `${days} unforgettable days through ${journey.destination}, weaving together ${places || journey.region.toLowerCase()} with ${experiences || 'immersive local moments'} and a distinctly curated luxury rhythm.`;
  }
  return `${days} unforgettable days exploring ${journey.destination}, blending refined stays, cinematic viewpoints, and thoughtful local discoveries into one polished journey memory.`;
}

function buildRouteStops(journey: CreatorJourney, showFullJourney: boolean): RouteStop[] {
  const baseStops = journey.places.length > 0 ? journey.places : [journey.destination, journey.region];
  return baseStops.slice(0, showFullJourney ? 5 : 3).map((place, index) => ({
    id: `${place}-${index}`,
    label: place,
    subtitle: index === 0 ? 'Arrival' : index === baseStops.length - 1 ? 'Final memory' : `Stop ${index + 1}`,
  }));
}

function buildTimeline(journey: CreatorJourney, source: ImageSourcePropType | null, showFullJourney: boolean): TimelineItem[] {
  const base = new Date();
  const itinerary = journey.itinerary.length > 0
    ? journey.itinerary
    : [{ day: 1, activities: [journey.overview || `Arrival in ${journey.destination}`] }];

  return itinerary.slice(0, showFullJourney ? itinerary.length : 2).map((entry, index) => {
    const date = new Date(base);
    date.setDate(base.getDate() + index);
    const dateLabel = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const title = entry.activities[0] ?? `Day ${entry.day} in ${journey.destination}`;
    const description = entry.activities.slice(1, 3).join(' • ') || 'A beautifully paced sequence of moments unfolds.';
    return {
      id: `day-${entry.day}`,
      day: entry.day,
      dateLabel,
      title,
      description,
      source,
    };
  });
}

function buildHighlights(journey: CreatorJourney): HighlightCard[] {
  return [
    {
      icon: 'trophy-outline',
      title: 'Best Moment',
      value: journey.experiences[0] ?? `Golden hour in ${journey.destination}`,
      caption: 'The memory that defined the trip',
    },
    {
      icon: 'location-outline',
      title: 'Favorite Spot',
      value: journey.places[0] ?? journey.destination,
      caption: 'Most revisited destination moment',
    },
    {
      icon: 'restaurant-outline',
      title: 'Best Restaurant',
      value: journey.restaurants[0] ?? 'Private chef table',
      caption: 'Most memorable meal',
    },
    {
      icon: 'camera-outline',
      title: 'Most Photographed',
      value: journey.places[1] ?? journey.destination,
      caption: 'The frame everyone kept',
    },
    {
      icon: 'heart-outline',
      title: 'User Favorite',
      value: journey.savedCount > 0 ? `${journey.savedCount} saves` : 'Loved by early explorers',
      caption: 'Audience sentiment snapshot',
    },
  ];
}

function buildMemoryTiles(journey: CreatorJourney, source: ImageSourcePropType | null): MemoryTile[] {
  const labels = [
    ...journey.places,
    ...journey.experiences,
    ...journey.restaurants,
    journey.destination,
    journey.region,
  ].filter(Boolean);

  const unique = labels.filter((label, index) => labels.indexOf(label) === index).slice(0, 6);
  return unique.map((label, index) => ({
    id: `memory-${index}-${label}`,
    label,
    caption: index % 2 === 0 ? 'Saved to the highlight reel' : 'A frame worth keeping forever',
    source,
    tall: index % 3 !== 1,
  }));
}

function buildAchievements(journey: CreatorJourney): string[] {
  const badges = ['City Explorer', 'Luxury Traveler'];
  const text = `${journey.destination} ${journey.region} ${journey.overview}`.toLowerCase();
  if (/desert|dune/.test(text)) badges.push('Desert Adventurer');
  if (/beach|coast|island|ocean/.test(text)) badges.push('Coastal Collector');
  if (journey.places.length >= 4) badges.push('Photo Master');
  if (journey.restaurants.length >= 3) badges.push('Table Hunter');
  return badges.slice(0, 4);
}

function buildInsights(journey: CreatorJourney, memoryCount: number): InsightCard[] {
  const days = durationDays(journey.duration);
  return [
    { icon: 'walk-outline', label: 'Distance Walked', value: `${(journey.places.length * 4.6 + days * 1.9).toFixed(0)} km` },
    { icon: 'camera-outline', label: 'Photos Taken', value: String(memoryCount) },
    { icon: 'wallet-outline', label: 'Budget Used', value: estimateSpend(journey) },
    { icon: 'map-outline', label: 'Locations Visited', value: String(Math.max(journey.places.length, 1)) },
    { icon: 'sunny-outline', label: 'Average Weather', value: inferWeather(journey) },
  ];
}

function GradientFallback({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}) {
  return (
    <LinearGradient colors={['#11243F', '#09131F']} style={styles.fallbackGradient}>
      <View style={styles.fallbackIconWrap}>
        <Ionicons name={icon} size={26} color={CYAN} />
      </View>
      <Text style={styles.fallbackTitle}>{title}</Text>
      <Text style={styles.fallbackSubtitle}>{subtitle}</Text>
    </LinearGradient>
  );
}

function PremiumUnlockCard() {
  return (
    <LinearGradient colors={['rgba(19,45,72,0.94)', 'rgba(7,17,32,0.98)']} style={styles.unlockCard}>
      <View style={styles.unlockIconWrap}>
        <Ionicons name="diamond-outline" size={18} color={CYAN} />
      </View>
      <View style={styles.unlockBody}>
        <Text style={styles.unlockTitle}>Unlock the complete memory trail</Text>
        <Text style={styles.unlockText}>
          Club access reveals the full route, every day on the timeline, expanded memories, and the creator’s full premium curation.
        </Text>
      </View>
      <TouchableOpacity
        style={styles.unlockButton}
        onPress={() => router.push('/(tabs)/membership')}
        activeOpacity={0.86}
      >
        <Text style={styles.unlockButtonText}>Unlock</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
}

export default function JourneyDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [journey, setJourney] = useState<CreatorJourney | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [freeRemaining, setFreeRemaining] = useState<number>(FREE_JOURNEY_LIMIT);
  const [isPremium, setIsPremium] = useState(false);
  const [reviews, setReviews] = useState<JourneyReview[]>([]);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const saveScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let cancelled = false;
    if (!id) {
      setLoading(false);
      return;
    }

    getJourneyById(id)
      .then((next) => {
        if (!cancelled) {
          setJourney(next);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    consumeFreeJourney(id).then(setFreeRemaining).catch(() => {});
    getSavedIds().then((ids) => setSaved(ids.includes(id))).catch(() => {});
    getJourneyReviews(id, 6).then(setReviews).catch(() => setReviews([]));
  }, [id]);

  useEffect(() => {
    const auth = getAuth(getFirebaseApp());
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setJourneyStoreUid(user?.uid ?? null);
      if (!user) {
        setIsPremium(false);
        return;
      }
      const active = await checkMembership(user.uid).catch(() => false);
      setIsPremium(active);
    });
    return unsubscribe;
  }, []);

  const handleToggleSave = useCallback(async () => {
    if (!id || saveLoading) return;
    setSaveLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Animated.sequence([
      Animated.spring(saveScale, { toValue: 0.92, useNativeDriver: true, speed: 40, bounciness: 6 }),
      Animated.spring(saveScale, { toValue: 1, useNativeDriver: true, speed: 22, bounciness: 8 }),
    ]).start();
    try {
      const nextIds = await toggleSaved(id);
      setSaved(nextIds.includes(id));
    } finally {
      setSaveLoading(false);
    }
  }, [id, saveLoading, saveScale]);

  const handleShare = useCallback(async () => {
    if (!journey) return;
    try {
      await Share.share({
        title: journey.title,
        message: `${journey.title} in ${journey.destination}\n\n${buildJourneyStory(journey)}`,
      });
    } catch {
      // ignore dismissed share
    }
  }, [journey]);

  const handleCreateReel = useCallback(() => {
    if (!journey) return;
    router.push({
      pathname: '/(tabs)/ai-concierge',
      params: { query: `Create a cinematic travel reel concept for ${journey.title} in ${journey.destination}` },
    });
  }, [journey]);

  const handleDownloadMemories = useCallback(async () => {
    if (!journey) return;
    const mediaUrl = isValidRemoteImageUrl(journey.imageUri) ? journey.imageUri!.trim() : undefined;
    try {
      await Share.share({
        title: `${journey.title} memories`,
        message: `Memories from ${journey.title} in ${journey.destination}`,
        url: mediaUrl,
      });
    } catch {
      Alert.alert('Memories', 'Could not open the share sheet right now.');
    }
  }, [journey]);

  const noteText = useMemo(() => {
    const topReview = reviews[0]?.comment?.trim();
    if (topReview) return topReview;
    if (journey?.overview) return journey.overview;
    return 'A beautifully paced journey worth revisiting again and again.';
  }, [journey, reviews]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={CYAN} size="large" />
      </View>
    );
  }

  if (!journey) {
    return (
      <View style={styles.loadingWrap}>
        <Ionicons name="map-outline" size={40} color={LuxuryColors.textTertiary} />
        <Text style={styles.emptyTitle}>Journey not available</Text>
        <Text style={styles.emptyBody}>This journey may still be under review or is no longer available.</Text>
        <TouchableOpacity style={styles.backGhostButton} onPress={() => router.back()} activeOpacity={0.82}>
          <Text style={styles.backGhostButtonText}>Back to journeys</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const heroSource = journeyImageSource(journey);
  const showFullJourney = isPremium;
  const memories = buildMemoryTiles(journey, heroSource);
  const visibleMemories = showFullJourney ? memories : memories.slice(0, 4);
  const reviewsAverage = reviews.length > 0
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0;
  const displayRating = journey.rating > 0 ? journey.rating : reviewsAverage;
  const totalMemories = Math.max((journey.places.length + journey.experiences.length + journey.restaurants.length) * 7, 24);
  const travelDates = tripRangeLabel(journey);
  const story = buildJourneyStory(journey);
  const routeStops = buildRouteStops(journey, showFullJourney);
  const timeline = buildTimeline(journey, heroSource, showFullJourney);
  const highlights = buildHighlights(journey);
  const insights = buildInsights(journey, totalMemories);
  const achievements = buildAchievements(journey);
  const quickInsights = [
    { icon: 'airplane-outline' as const, value: `${Math.max(1, Math.ceil(durationDays(journey.duration) / 5))}`, label: 'Flights' },
    { icon: 'location-outline' as const, value: `${Math.max(journey.places.length, 1)}`, label: 'Places Visited' },
    { icon: 'camera-outline' as const, value: `${totalMemories}`, label: 'Photos' },
    { icon: 'wallet-outline' as const, value: estimateSpend(journey), label: 'Total Spent' },
  ];

  return (
    <>
      <ScrollView
        style={styles.screen}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + LuxurySpacing.xxl }}
      >
        <View style={styles.heroSection}>
          {heroSource ? (
            <Image source={heroSource} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <GradientFallback icon="airplane-outline" title={journey.destination} subtitle="Curated journey memory" />
          )}
          <LinearGradient colors={['rgba(6,12,20,0.08)', 'rgba(6,12,20,0.48)', 'rgba(6,12,20,0.94)']} style={StyleSheet.absoluteFillObject} />

          <View style={[styles.heroActions, { top: insets.top + LuxurySpacing.sm }]}>
            <TouchableOpacity style={styles.heroActionButton} onPress={() => router.back()} activeOpacity={0.84}>
              <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.heroActionRowRight}>
              <TouchableOpacity style={styles.heroActionButton} onPress={handleShare} activeOpacity={0.84}>
                <Ionicons name="share-social-outline" size={19} color="#FFFFFF" />
              </TouchableOpacity>
              <Animated.View style={{ transform: [{ scale: saveScale }] }}>
                <TouchableOpacity style={styles.heroActionButton} onPress={handleToggleSave} activeOpacity={0.84} disabled={saveLoading}>
                  <Ionicons name={saved ? 'heart' : 'heart-outline'} size={19} color={saved ? CYAN : '#FFFFFF'} />
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>

          <View style={styles.heroContent}>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusBadgeText}>Completed Trip</Text>
            </View>

            <Text style={styles.destinationTitle}>{journey.destination}</Text>
            <Text style={styles.countryText}>{journey.region}</Text>

            <TouchableOpacity
              style={styles.creatorPill}
              onPress={() => router.push({ pathname: '/(tabs)/creator-profile', params: { id: journey.creatorId } })}
              activeOpacity={0.84}
            >
              <View style={styles.creatorAvatarMini}>
                <Text style={styles.creatorAvatarMiniText}>{deriveInitials(journey.creatorName || 'Creator')}</Text>
              </View>
              <Text style={styles.creatorPillText}>{journey.creatorName || 'Curated by creator'}</Text>
            </TouchableOpacity>

            <View style={styles.heroMetaGrid}>
              <View style={styles.heroMetaChip}>
                <Ionicons name="calendar-outline" size={14} color={CYAN} />
                <Text style={styles.heroMetaValue}>{travelDates}</Text>
              </View>
              <View style={styles.heroMetaChip}>
                <Ionicons name="time-outline" size={14} color={CYAN} />
                <Text style={styles.heroMetaValue}>{journey.duration}</Text>
              </View>
              <View style={styles.heroMetaChip}>
                <Ionicons name="star-outline" size={14} color={CYAN} />
                <Text style={styles.heroMetaValue}>{displayRating > 0 ? displayRating.toFixed(1) : 'New'}</Text>
              </View>
              <View style={styles.heroMetaChip}>
                <Ionicons name="images-outline" size={14} color={CYAN} />
                <Text style={styles.heroMetaValue}>{totalMemories} memories</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.contentWrap}>
          <View style={styles.sectionHeaderWrap}>
            <Text style={styles.sectionEyebrow}>Quick Insights</Text>
            <Text style={styles.sectionHeading}>A premium snapshot of the journey</Text>
          </View>

          <View style={styles.quickGrid}>
            {quickInsights.map((item) => (
              <LinearGradient key={item.label} colors={['rgba(18,39,60,0.95)', 'rgba(9,18,29,0.95)']} style={styles.quickCard}>
                <View style={styles.quickCardGlow} />
                <View style={styles.quickIconWrap}>
                  <Ionicons name={item.icon} size={18} color={CYAN} />
                </View>
                <Text style={styles.quickValue}>{item.value}</Text>
                <Text style={styles.quickLabel}>{item.label}</Text>
              </LinearGradient>
            ))}
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionEyebrow}>Journey Story</Text>
            <LinearGradient colors={['rgba(17,39,62,0.92)', 'rgba(8,17,30,0.98)']} style={styles.storyCard}>
              <View style={styles.storyIconWrap}>
                <Ionicons name="sparkles-outline" size={18} color={CYAN} />
              </View>
              <Text style={styles.storyText}>{story}</Text>
            </LinearGradient>
          </View>

          {!showFullJourney ? <PremiumUnlockCard /> : null}

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionEyebrow}>Trip Route</Text>
            <LinearGradient colors={['rgba(14,27,43,0.96)', 'rgba(7,15,26,0.98)']} style={styles.routeCard}>
              <View style={styles.routeMapBackdrop}>
                <View style={styles.routeGlowLarge} />
                <View style={styles.routeGlowSmall} />
              </View>
              <View style={styles.routeCanvas}>
                <View style={styles.routeLineTrack} />
                {routeStops.map((stop, index) => (
                  <View key={stop.id} style={[styles.routeStop, { left: `${10 + index * 20}%`, top: index % 2 === 0 ? 28 : 92 }]}>
                    <View style={styles.routeMarker}>
                      <View style={styles.routeMarkerInner} />
                    </View>
                  </View>
                ))}
              </View>
              <View style={styles.routeStopsList}>
                {routeStops.map((stop) => (
                  <View key={stop.id} style={styles.routeStopRow}>
                    <View style={styles.routeStopBadge}>
                      <Ionicons name="navigate-outline" size={12} color={CYAN} />
                    </View>
                    <View style={styles.routeStopTextWrap}>
                      <Text style={styles.routeStopTitle}>{stop.label}</Text>
                      <Text style={styles.routeStopSubtitle}>{stop.subtitle}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </LinearGradient>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionEyebrow}>Itinerary Timeline</Text>
            <View style={styles.timelineWrap}>
              {timeline.map((item) => (
                <View key={item.id} style={styles.timelineRow}>
                  <View style={styles.timelineRailWrap}>
                    <View style={styles.timelineRail} />
                    <LinearGradient colors={['#8AE6FF', '#4DA8FF']} style={styles.timelineNode}>
                      <Text style={styles.timelineNodeText}>{item.day}</Text>
                    </LinearGradient>
                  </View>
                  <LinearGradient colors={['rgba(20,38,59,0.96)', 'rgba(8,17,30,0.98)']} style={styles.timelineCard}>
                    <View style={styles.timelineThumbWrap}>
                      {item.source ? (
                        <Image source={item.source} style={styles.timelineThumb} resizeMode="cover" />
                      ) : (
                        <GradientFallback icon="images-outline" title={item.title} subtitle={item.dateLabel} />
                      )}
                    </View>
                    <View style={styles.timelineBody}>
                      <Text style={styles.timelineDate}>{item.dateLabel}</Text>
                      <Text style={styles.timelineTitle}>{item.title}</Text>
                      <Text style={styles.timelineDescription}>{item.description}</Text>
                    </View>
                  </LinearGradient>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionEyebrow}>Trip Highlights</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.highlightsRow}>
              {highlights.slice(0, showFullJourney ? highlights.length : 3).map((item) => (
                <LinearGradient key={item.title} colors={['rgba(17,39,62,0.94)', 'rgba(9,17,28,0.98)']} style={styles.highlightCard}>
                  <View style={styles.highlightIconBadge}>
                    <Ionicons name={item.icon} size={16} color={CYAN} />
                  </View>
                  <Text style={styles.highlightTitle}>{item.title}</Text>
                  <Text style={styles.highlightValue} numberOfLines={2}>{item.value}</Text>
                  <Text style={styles.highlightCaption}>{item.caption}</Text>
                </LinearGradient>
              ))}
            </ScrollView>
          </View>

          <View style={styles.sectionBlock}>
            <View style={styles.memoriesHeaderRow}>
              <View>
                <Text style={styles.sectionEyebrow}>Travel Memories</Text>
                <Text style={styles.sectionHeading}>A visual reel of the trip</Text>
              </View>
              <TouchableOpacity onPress={() => setGalleryVisible(true)} activeOpacity={0.84}>
                <Text style={styles.memoriesActionText}>Open gallery</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.masonryRow}>
              <View style={styles.masonryColumn}>
                {visibleMemories.filter((_, index) => index % 2 === 0).map((tile) => (
                  <TouchableOpacity key={tile.id} style={[styles.memoryTile, tile.tall ? styles.memoryTileTall : styles.memoryTileShort]} onPress={() => setGalleryVisible(true)} activeOpacity={0.88}>
                    {tile.source ? (
                      <Image source={tile.source} style={styles.memoryImage} resizeMode="cover" />
                    ) : (
                      <GradientFallback icon="camera-outline" title={tile.label} subtitle={tile.caption} />
                    )}
                    <LinearGradient colors={['transparent', 'rgba(6,12,20,0.82)']} style={StyleSheet.absoluteFillObject} />
                    <View style={styles.memoryOverlay}>
                      <Text style={styles.memoryLabel}>{tile.label}</Text>
                      <Text style={styles.memoryCaption}>{tile.caption}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.masonryColumn}>
                {visibleMemories.filter((_, index) => index % 2 === 1).map((tile, index, arr) => {
                  const isLast = index === arr.length - 1;
                  return (
                    <TouchableOpacity key={tile.id} style={[styles.memoryTile, tile.tall ? styles.memoryTileTall : styles.memoryTileShort]} onPress={() => setGalleryVisible(true)} activeOpacity={0.88}>
                      {tile.source ? (
                        <Image source={tile.source} style={styles.memoryImage} resizeMode="cover" />
                      ) : (
                        <GradientFallback icon="camera-outline" title={tile.label} subtitle={tile.caption} />
                      )}
                      <LinearGradient colors={['transparent', 'rgba(6,12,20,0.86)']} style={StyleSheet.absoluteFillObject} />
                      <View style={styles.memoryOverlay}>
                        <Text style={styles.memoryLabel}>{tile.label}</Text>
                        <Text style={styles.memoryCaption}>{tile.caption}</Text>
                      </View>
                      {isLast ? (
                        <View style={styles.moreMemoriesBadge}>
                          <Text style={styles.moreMemoriesText}>+99 memories</Text>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionEyebrow}>Trip Insights</Text>
            <View style={styles.insightsGrid}>
              {insights.slice(0, showFullJourney ? insights.length : 4).map((item) => (
                <View key={item.label} style={styles.insightCard}>
                  <View style={styles.insightIconWrap}>
                    <Ionicons name={item.icon} size={15} color={CYAN} />
                  </View>
                  <Text style={styles.insightValue}>{item.value}</Text>
                  <Text style={styles.insightLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionEyebrow}>User Notes</Text>
            <LinearGradient colors={['rgba(18,41,63,0.96)', 'rgba(8,17,30,0.98)']} style={styles.notesCard}>
              <Text style={styles.quoteMark}>“</Text>
              <Text style={styles.notesText}>{noteText}</Text>
              <Text style={styles.notesAttribution}>{journey.creatorName || 'Traveler note'}</Text>
            </LinearGradient>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionEyebrow}>Achievements</Text>
            <View style={styles.achievementWrap}>
              {achievements.map((badge) => (
                <LinearGradient key={badge} colors={['rgba(27,72,105,0.92)', 'rgba(10,26,40,0.98)']} style={styles.achievementBadge}>
                  <View style={styles.achievementGlow} />
                  <Ionicons name="ribbon-outline" size={14} color={CYAN} />
                  <Text style={styles.achievementText}>{badge}</Text>
                </LinearGradient>
              ))}
            </View>
          </View>

          <View style={styles.bottomActionsWrap}>
            <TouchableOpacity style={styles.secondaryAction} onPress={handleShare} activeOpacity={0.86}>
              <Ionicons name="share-social-outline" size={17} color="#D8F7FF" />
              <Text style={styles.secondaryActionText}>Share Journey</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryAction} onPress={handleCreateReel} activeOpacity={0.88}>
              <LinearGradient colors={['#8AE6FF', '#3FA7FF']} style={styles.primaryActionFill}>
                <Ionicons name="sparkles-outline" size={18} color="#04111E" />
                <Text style={styles.primaryActionText}>Create Reel</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryAction} onPress={handleDownloadMemories} activeOpacity={0.86}>
              <Ionicons name="download-outline" size={17} color="#D8F7FF" />
              <Text style={styles.secondaryActionText}>Download Memories</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <Modal visible={galleryVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setGalleryVisible(false)}>
        <View style={styles.galleryModalBackdrop}>
          <TouchableOpacity style={[styles.galleryModalClose, { top: insets.top + LuxurySpacing.sm }]} onPress={() => setGalleryVisible(false)} activeOpacity={0.82}>
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <ScrollView contentContainerStyle={{ paddingTop: insets.top + 72, paddingBottom: insets.bottom + 48 }} showsVerticalScrollIndicator={false}>
            <View style={styles.galleryModalGrid}>
              {memories.map((tile) => (
                <View key={tile.id} style={[styles.galleryModalTile, tile.tall ? styles.galleryModalTileTall : styles.galleryModalTileShort]}>
                  {tile.source ? (
                    <Image source={tile.source} style={styles.memoryImage} resizeMode="cover" />
                  ) : (
                    <GradientFallback icon="images-outline" title={tile.label} subtitle={tile.caption} />
                  )}
                  <LinearGradient colors={['transparent', 'rgba(6,12,20,0.85)']} style={StyleSheet.absoluteFillObject} />
                  <View style={styles.memoryOverlay}>
                    <Text style={styles.memoryLabel}>{tile.label}</Text>
                    <Text style={styles.memoryCaption}>{tile.caption}</Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#050C15',
  },
  loadingWrap: {
    flex: 1,
    backgroundColor: '#050C15',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: LuxurySpacing.xl,
    gap: LuxurySpacing.md,
  },
  emptyTitle: {
    color: LuxuryColors.textPrimary,
    fontSize: LuxuryFontSize.xl,
    fontWeight: '700',
  },
  emptyBody: {
    color: LuxuryColors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  backGhostButton: {
    paddingHorizontal: LuxurySpacing.lg,
    paddingVertical: LuxurySpacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(138,230,255,0.35)',
  },
  backGhostButtonText: {
    color: CYAN,
    fontWeight: '700',
  },
  heroSection: {
    height: 470,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#081423',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroActions: {
    position: 'absolute',
    left: LuxurySpacing.md,
    right: LuxurySpacing.md,
    zIndex: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroActionRowRight: {
    flexDirection: 'row',
    gap: LuxurySpacing.sm,
  },
  heroActionButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(7, 19, 31, 0.44)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroContent: {
    position: 'absolute',
    left: LuxurySpacing.lg,
    right: LuxurySpacing.lg,
    bottom: LuxurySpacing.xl,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(9, 29, 45, 0.48)',
    borderWidth: 1,
    borderColor: 'rgba(138,230,255,0.20)',
    marginBottom: LuxurySpacing.md,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: CYAN,
  },
  statusBadgeText: {
    color: '#E6FAFF',
    fontWeight: '700',
    fontSize: 12,
  },
  destinationTitle: {
    color: '#FFFFFF',
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -1,
  },
  countryText: {
    color: 'rgba(230,250,255,0.72)',
    fontSize: 16,
    marginTop: 6,
    marginBottom: LuxurySpacing.md,
  },
  creatorPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: LuxurySpacing.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(7,18,30,0.44)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  creatorAvatarMini: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(138,230,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorAvatarMiniText: {
    color: CYAN,
    fontSize: 10,
    fontWeight: '800',
  },
  creatorPillText: {
    color: '#EAFDFF',
    fontSize: 12,
    fontWeight: '600',
  },
  heroMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: LuxurySpacing.sm,
  },
  heroMetaChip: {
    minWidth: (CONTENT_WIDTH - LuxurySpacing.sm) / 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(10, 24, 37, 0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  heroMetaValue: {
    color: '#F2FCFF',
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  contentWrap: {
    marginTop: -LuxurySpacing.xl,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: '#050C15',
    paddingTop: LuxurySpacing.xl,
    paddingHorizontal: LuxurySpacing.lg,
  },
  sectionHeaderWrap: {
    marginBottom: LuxurySpacing.md,
  },
  sectionEyebrow: {
    color: CYAN,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.7,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  sectionHeading: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: LuxurySpacing.md,
  },
  quickCard: {
    width: (CONTENT_WIDTH - LuxurySpacing.md) / 2,
    borderRadius: 28,
    padding: LuxurySpacing.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(138,230,255,0.12)',
    ...LuxuryShadow.medium,
  },
  quickCardGlow: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(77,168,255,0.16)',
  },
  quickIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(138,230,255,0.10)',
    marginBottom: LuxurySpacing.md,
  },
  quickValue: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  quickLabel: {
    color: 'rgba(230,250,255,0.72)',
    fontSize: 13,
    fontWeight: '600',
  },
  sectionBlock: {
    marginTop: LuxurySpacing.xl,
  },
  storyCard: {
    borderRadius: 30,
    padding: LuxurySpacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(138,230,255,0.12)',
    ...LuxuryShadow.medium,
  },
  storyIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(138,230,255,0.10)',
    marginBottom: LuxurySpacing.md,
  },
  storyText: {
    color: '#F4FCFF',
    fontSize: 17,
    lineHeight: 28,
    fontWeight: '600',
  },
  unlockCard: {
    marginTop: LuxurySpacing.xl,
    borderRadius: 28,
    padding: LuxurySpacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(138,230,255,0.18)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.md,
  },
  unlockIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(138,230,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockBody: {
    flex: 1,
  },
  unlockTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
    marginBottom: 4,
  },
  unlockText: {
    color: 'rgba(230,250,255,0.70)',
    lineHeight: 20,
    fontSize: 13,
  },
  unlockButton: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: CYAN,
  },
  unlockButtonText: {
    color: '#04111E',
    fontWeight: '800',
  },
  routeCard: {
    borderRadius: 30,
    padding: LuxurySpacing.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(138,230,255,0.10)',
  },
  routeMapBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 180,
  },
  routeGlowLarge: {
    position: 'absolute',
    right: -24,
    top: -20,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(77,168,255,0.14)',
  },
  routeGlowSmall: {
    position: 'absolute',
    left: 18,
    bottom: 18,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(138,230,255,0.12)',
  },
  routeCanvas: {
    height: 170,
    borderRadius: 24,
    backgroundColor: 'rgba(3,10,18,0.44)',
    marginBottom: LuxurySpacing.lg,
    overflow: 'hidden',
  },
  routeLineTrack: {
    position: 'absolute',
    left: '12%',
    right: '12%',
    top: 82,
    height: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(138,230,255,0.55)',
  },
  routeStop: {
    position: 'absolute',
  },
  routeMarker: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(138,230,255,0.24)',
  },
  routeMarkerInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: CYAN,
  },
  routeStopsList: {
    gap: LuxurySpacing.sm,
  },
  routeStopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.sm,
  },
  routeStopBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(138,230,255,0.10)',
  },
  routeStopTextWrap: {
    flex: 1,
  },
  routeStopTitle: {
    color: '#F2FCFF',
    fontSize: 15,
    fontWeight: '700',
  },
  routeStopSubtitle: {
    color: 'rgba(230,250,255,0.62)',
    fontSize: 12,
    marginTop: 2,
  },
  timelineWrap: {
    gap: LuxurySpacing.md,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  timelineRailWrap: {
    width: 34,
    alignItems: 'center',
  },
  timelineRail: {
    position: 'absolute',
    top: 18,
    bottom: -LuxurySpacing.md,
    width: 2,
    backgroundColor: 'rgba(138,230,255,0.18)',
  },
  timelineNode: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  timelineNodeText: {
    color: '#04111E',
    fontSize: 12,
    fontWeight: '800',
  },
  timelineCard: {
    flex: 1,
    marginLeft: LuxurySpacing.sm,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(138,230,255,0.10)',
    ...LuxuryShadow.soft,
  },
  timelineThumbWrap: {
    height: 160,
    backgroundColor: '#0A1623',
  },
  timelineThumb: {
    width: '100%',
    height: '100%',
  },
  timelineBody: {
    padding: LuxurySpacing.lg,
  },
  timelineDate: {
    color: CYAN,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  timelineTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    marginBottom: 8,
  },
  timelineDescription: {
    color: 'rgba(230,250,255,0.70)',
    lineHeight: 22,
  },
  highlightsRow: {
    paddingRight: LuxurySpacing.sm,
    gap: LuxurySpacing.md,
  },
  highlightCard: {
    width: 220,
    borderRadius: 28,
    padding: LuxurySpacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(138,230,255,0.10)',
  },
  highlightIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(138,230,255,0.12)',
    marginBottom: LuxurySpacing.md,
  },
  highlightTitle: {
    color: CYAN,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  highlightValue: {
    color: '#FFFFFF',
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  highlightCaption: {
    color: 'rgba(230,250,255,0.64)',
    lineHeight: 20,
    fontSize: 13,
  },
  memoriesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: LuxurySpacing.md,
  },
  memoriesActionText: {
    color: CYAN,
    fontWeight: '700',
  },
  masonryRow: {
    flexDirection: 'row',
    gap: LuxurySpacing.md,
  },
  masonryColumn: {
    flex: 1,
    gap: LuxurySpacing.md,
  },
  memoryTile: {
    width: MEMORY_TILE_WIDTH,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#0A1623',
  },
  memoryTileTall: {
    height: 240,
  },
  memoryTileShort: {
    height: 180,
  },
  memoryImage: {
    width: '100%',
    height: '100%',
  },
  memoryOverlay: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
  },
  memoryLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  memoryCaption: {
    color: 'rgba(230,250,255,0.74)',
    fontSize: 12,
    lineHeight: 17,
  },
  moreMemoriesBadge: {
    position: 'absolute',
    right: 14,
    top: 14,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(5,12,21,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  moreMemoriesText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  insightsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: LuxurySpacing.md,
  },
  insightCard: {
    width: (CONTENT_WIDTH - LuxurySpacing.md) / 2,
    borderRadius: 24,
    padding: LuxurySpacing.md,
    backgroundColor: 'rgba(11, 22, 34, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(138,230,255,0.09)',
  },
  insightIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(138,230,255,0.10)',
    marginBottom: 12,
  },
  insightValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  insightLabel: {
    color: 'rgba(230,250,255,0.64)',
    fontSize: 12,
    lineHeight: 17,
  },
  notesCard: {
    borderRadius: 30,
    padding: LuxurySpacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(138,230,255,0.12)',
  },
  quoteMark: {
    color: 'rgba(138,230,255,0.34)',
    fontSize: 52,
    lineHeight: 52,
    marginBottom: 12,
  },
  notesText: {
    color: '#F6FDFF',
    fontSize: 18,
    lineHeight: 29,
    fontWeight: '600',
    marginBottom: LuxurySpacing.lg,
  },
  notesAttribution: {
    color: CYAN,
    fontWeight: '700',
  },
  achievementWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: LuxurySpacing.md,
  },
  achievementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(138,230,255,0.10)',
  },
  achievementGlow: {
    position: 'absolute',
    right: -10,
    top: -10,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(138,230,255,0.18)',
  },
  achievementText: {
    color: '#F4FCFF',
    fontWeight: '700',
  },
  bottomActionsWrap: {
    marginTop: LuxurySpacing.xxl,
    gap: LuxurySpacing.md,
  },
  secondaryAction: {
    height: 58,
    borderRadius: 22,
    backgroundColor: 'rgba(11, 22, 34, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(138,230,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  secondaryActionText: {
    color: '#D8F7FF',
    fontWeight: '700',
    fontSize: 15,
  },
  primaryAction: {
    borderRadius: 26,
    overflow: 'hidden',
    ...LuxuryShadow.medium,
  },
  primaryActionFill: {
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  primaryActionText: {
    color: '#04111E',
    fontSize: 16,
    fontWeight: '800',
  },
  galleryModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(3, 8, 15, 0.96)',
  },
  galleryModalClose: {
    position: 'absolute',
    right: LuxurySpacing.md,
    zIndex: 5,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  galleryModalGrid: {
    paddingHorizontal: LuxurySpacing.lg,
    gap: LuxurySpacing.md,
  },
  galleryModalTile: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#0A1623',
  },
  galleryModalTileTall: {
    height: 280,
  },
  galleryModalTileShort: {
    height: 210,
  },
  fallbackGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: LuxurySpacing.lg,
  },
  fallbackIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(138,230,255,0.10)',
    marginBottom: LuxurySpacing.md,
  },
  fallbackTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  fallbackSubtitle: {
    color: 'rgba(230,250,255,0.64)',
    textAlign: 'center',
    lineHeight: 20,
  },
});
