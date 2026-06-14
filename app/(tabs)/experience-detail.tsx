import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import {
  LuxuryBorderRadius,
  LuxuryColors,
  LuxuryFontSize,
  LuxuryShadow,
  LuxurySpacing,
} from '../../constants/luxuryTheme';
import type {
  CreatorExperience,
  DailyPlanEntry,
  HiddenGem,
  Hotel,
  Restaurant,
} from '../../constants/creatorExperienceModel';
import { travelStyleLabel } from '../../constants/creatorExperienceModel';
import { getFirebaseApp } from '../../lib/firebase';
import { checkMembership } from '../../lib/membershipService';
import { safeOpenUrl } from '../../lib/linkingUtils';
import { isValidRemoteImageUrl } from '../../lib/imageFallback';
import {
  getExperienceById,
  incrementExperienceUnlocks,
  incrementExperienceViews,
} from '../../lib/creatorExperienceService';
import {
  confirmExperiencePurchase,
  createExperiencePurchaseIntent,
  hasPurchasedExperience,
} from '../../lib/paymentService';
import {
  getSavedExperienceIds,
  setExperienceStoreUid,
  toggleSavedExperience,
} from '../../constants/experienceStore';
import { useExperienceConfirmPayment } from '../../lib/useExperienceConfirmPayment';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CONTENT_WIDTH = SCREEN_WIDTH - LuxurySpacing.lg * 2;
const MEMORY_TILE_WIDTH = (CONTENT_WIDTH - LuxurySpacing.md) / 2;
const CYAN = '#8AE6FF';

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

function coverSource(experience: CreatorExperience): ImageSourcePropType | null {
  if (isValidRemoteImageUrl(experience.coverImage)) {
    return { uri: experience.coverImage!.trim() };
  }
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

function estimateSpend(experience: CreatorExperience): string {
  const baseByBudget: Record<CreatorExperience['budget'], number> = {
    $: 130,
    $$: 260,
    $$$: 520,
    $$$$: 980,
  };
  return formatCompactCurrency(baseByBudget[experience.budget] * durationDays(experience.duration));
}

function formatCompactCurrency(value: number): string {
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  }
  return `$${Math.round(value)}`;
}

function deriveSeason(experience: CreatorExperience): string {
  const explicit = experience.bestTimeToVisit?.trim();
  if (explicit) return explicit;
  const text = `${experience.description} ${experience.country} ${experience.city}`.toLowerCase();
  if (/ski|snow|winter|alps|iceland/.test(text)) return 'Winter';
  if (/spring|cherry|bloom|flower/.test(text)) return 'Spring';
  if (/monsoon|rainy|wet season/.test(text)) return 'Dry Season';
  if (/beach|summer|ocean|sea|tropical/.test(text)) return 'Summer';
  return 'Year-round';
}

function tripRangeLabel(experience: CreatorExperience): string {
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const lower = deriveSeason(experience).toLowerCase();
  const monthIndex = months.findIndex((month) => lower.includes(month));
  const start = new Date();
  if (monthIndex >= 0) {
    start.setMonth(monthIndex);
  }
  start.setDate(12);
  const end = new Date(start);
  end.setDate(start.getDate() + Math.max(durationDays(experience.duration) - 1, 0));
  const fmt = (date: Date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${fmt(start)} - ${fmt(end)}`;
}

function buildStory(experience: CreatorExperience): string {
  const days = durationDays(experience.duration);
  const highlights = experience.highlights.slice(0, 3).join(', ');
  const hiddenGems = experience.hiddenGems.slice(0, 2).map((gem) => gem.name).join(', ');
  const details = [highlights, hiddenGems].filter(Boolean).join(', ');
  if (details) {
    return `${days} unforgettable days exploring ${experience.city}'s skyline, culture, and signature moments, stitched together with ${details} and a premium sense of flow from sunrise to late night.`;
  }
  return `${days} unforgettable days exploring ${experience.city}'s skyline, luxury stays, local discoveries, and beautifully paced cultural moments.`;
}

function buildRouteStops(experience: CreatorExperience, hasPremiumAccess: boolean): RouteStop[] {
  const hotelStops = experience.hotels.slice(0, 2).map((hotel) => hotel.name);
  const restaurantStops = experience.restaurants.slice(0, 2).map((restaurant) => restaurant.name);
  const gemStops = experience.hiddenGems.slice(0, 2).map((gem) => gem.name);
  const base = [experience.city, ...hotelStops, ...restaurantStops, ...gemStops].filter(Boolean);
  const unique = base.filter((label, index) => base.indexOf(label) === index);
  return unique.slice(0, hasPremiumAccess ? 5 : 3).map((label, index) => ({
    id: `${label}-${index}`,
    label,
    subtitle: index === 0 ? 'Arrival' : index === unique.length - 1 ? 'Final stop' : `Stop ${index + 1}`,
  }));
}

function buildTimeline(
  experience: CreatorExperience,
  source: ImageSourcePropType | null,
  hasPremiumAccess: boolean,
): TimelineItem[] {
  const itinerary = experience.dailyPlan.length > 0
    ? experience.dailyPlan
    : [{ day: 1, title: `Arrival in ${experience.city}`, description: experience.description || 'A curated first impression of the destination.' }];

  return itinerary.slice(0, hasPremiumAccess ? itinerary.length : 1).map((entry, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    return {
      id: `day-${entry.day}`,
      day: entry.day,
      dateLabel: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      title: entry.title?.trim() || `Day ${entry.day}`,
      description: entry.description?.trim() || 'A beautifully paced sequence of moments unfolds.',
      source,
    };
  });
}

function buildHighlights(experience: CreatorExperience): HighlightCard[] {
  return [
    {
      icon: 'trophy-outline',
      title: 'Best Moment',
      value: experience.highlights[0] ?? experience.dailyPlan[0]?.title ?? `Golden hour in ${experience.city}`,
      caption: 'The memory that defined the trip',
    },
    {
      icon: 'location-outline',
      title: 'Favorite Spot',
      value: experience.hiddenGems[0]?.name ?? experience.city,
      caption: 'Most revisited destination moment',
    },
    {
      icon: 'restaurant-outline',
      title: 'Best Restaurant',
      value: experience.restaurants[0]?.name ?? 'Private chef table',
      caption: 'Most memorable meal',
    },
    {
      icon: 'camera-outline',
      title: 'Most Photographed',
      value: experience.highlights[1] ?? experience.hiddenGems[0]?.name ?? experience.city,
      caption: 'The frame everyone kept',
    },
    {
      icon: 'heart-outline',
      title: 'User Favorite',
      value: experience.savedCount > 0 ? `${experience.savedCount} saves` : 'Loved by early explorers',
      caption: 'Audience sentiment snapshot',
    },
  ];
}

function buildInsights(experience: CreatorExperience, memoryCount: number): InsightCard[] {
  const days = durationDays(experience.duration);
  return [
    { icon: 'walk-outline', label: 'Distance Walked', value: `${(experience.hiddenGems.length * 3.8 + days * 2.1).toFixed(0)} km` },
    { icon: 'camera-outline', label: 'Photos Taken', value: String(memoryCount) },
    { icon: 'wallet-outline', label: 'Budget Used', value: estimateSpend(experience) },
    { icon: 'map-outline', label: 'Locations Visited', value: String(Math.max(experience.hiddenGems.length + experience.restaurants.length + experience.hotels.length, 1)) },
    { icon: 'sunny-outline', label: 'Average Weather', value: deriveSeason(experience) },
  ];
}

function buildAchievements(experience: CreatorExperience): string[] {
  const badges = ['City Explorer', 'Luxury Traveler'];
  const text = `${experience.city} ${experience.country} ${experience.description} ${experience.warnings}`.toLowerCase();
  if (/desert|dune/.test(text)) badges.push('Desert Adventurer');
  if (/food|chef|dining|restaurant/.test(text) || experience.restaurants.length >= 3) badges.push('Taste Curator');
  if (experience.hiddenGems.length >= 3) badges.push('Photo Master');
  return badges.slice(0, 4);
}

function buildMemoryTiles(experience: CreatorExperience, source: ImageSourcePropType | null): MemoryTile[] {
  const labels = [
    ...experience.hiddenGems.map((gem) => gem.name),
    ...experience.restaurants.map((restaurant) => restaurant.name),
    ...experience.hotels.map((hotel) => hotel.name),
    ...experience.highlights,
    experience.city,
    experience.country,
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

function UnlockCard({
  onPurchase,
  purchasing,
}: {
  onPurchase: () => void;
  purchasing: boolean;
}) {
  return (
    <LinearGradient colors={['rgba(19,45,72,0.94)', 'rgba(7,17,32,0.98)']} style={styles.unlockCard}>
      <View style={styles.unlockIconWrap}>
        <Ionicons name="diamond-outline" size={18} color={CYAN} />
      </View>
      <View style={styles.unlockBody}>
        <Text style={styles.unlockTitle}>Unlock the complete memory trail</Text>
        <Text style={styles.unlockText}>
          Club access reveals every day on the timeline, the full route, restaurants, hidden gems, stays, and premium local notes.
        </Text>
      </View>
      <View style={styles.unlockActions}>
        <TouchableOpacity
          style={styles.unlockButtonSecondary}
          onPress={() => router.push('/(tabs)/membership')}
          activeOpacity={0.86}
        >
          <Text style={styles.unlockButtonSecondaryText}>Club</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.unlockButton, purchasing && { opacity: 0.6 }]}
          onPress={onPurchase}
          activeOpacity={0.86}
          disabled={purchasing}
        >
          {purchasing ? (
            <ActivityIndicator color={LuxuryColors.background} />
          ) : (
            <Text style={styles.unlockButtonText}>Purchase</Text>
          )}
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

export default function ExperienceDetailScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const experienceId = params.id;

  const [experience, setExperience] = useState<CreatorExperience | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savingToggle, setSavingToggle] = useState(false);
  const [isClubMember, setIsClubMember] = useState(false);
  const [hasPurchasedCurrentExperience, setHasPurchasedCurrentExperience] = useState(false);
  const [accessLoading, setAccessLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const confirmPayment = useExperienceConfirmPayment();
  const saveScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const auth = getAuth(getFirebaseApp());
    let cancelled = false;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setExperienceStoreUid(user?.uid ?? null);
      setAccessLoading(true);

      if (!user) {
        if (!cancelled) {
          setIsClubMember(false);
          setHasPurchasedCurrentExperience(false);
          setAccessLoading(false);
        }
        return;
      }

      try {
        const [active, purchased] = await Promise.all([
          checkMembership(user.uid).catch(() => false),
          experienceId ? hasPurchasedExperience(experienceId as string).catch(() => false) : Promise.resolve(false),
        ]);
        if (!cancelled) {
          setIsClubMember(active);
          setHasPurchasedCurrentExperience(purchased);
        }
      } finally {
        if (!cancelled) setAccessLoading(false);
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [experienceId]);

  useEffect(() => {
    if (!experienceId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function load() {
      try {
        const [exp, savedIds] = await Promise.all([
          getExperienceById(experienceId as string),
          getSavedExperienceIds(),
        ]);

        if (cancelled) return;

        if (!exp) {
          setNotFound(true);
        } else {
          setExperience(exp);
          setIsSaved(savedIds.includes(experienceId as string));
          incrementExperienceViews(experienceId as string);
        }
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [experienceId]);

  const hasPremiumAccess = isClubMember || hasPurchasedCurrentExperience;

  const handlePurchase = useCallback(async () => {
    if (!experienceId || hasPremiumAccess || purchasing) return;
    try {
      setPurchasing(true);
      const intent = await createExperiencePurchaseIntent(experienceId as string);
      if (!intent.alreadyPurchased) {
        const result = await confirmPayment(intent.clientSecret, {
          paymentMethodType: 'Card',
          paymentMethodData: {
            paymentMethodId: intent.paymentMethodId,
          },
        });
        if (result.error) {
          throw new Error(result.error.message || 'Payment could not be confirmed.');
        }
        await confirmExperiencePurchase(intent.paymentIntentId);
      }
      setHasPurchasedCurrentExperience(true);
      incrementExperienceUnlocks(experienceId as string);
      Alert.alert('Unlocked', 'This full journey is now available.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not complete purchase.';
      if (/payment method|card/i.test(message)) {
        Alert.alert('Add a card', message, [{ text: 'OK' }]);
      } else {
        Alert.alert('Purchase failed', message);
      }
    } finally {
      setPurchasing(false);
    }
  }, [confirmPayment, experienceId, hasPremiumAccess, purchasing]);

  const handleToggleSave = useCallback(async () => {
    if (!experienceId || savingToggle) return;
    setSavingToggle(true);
    Animated.sequence([
      Animated.spring(saveScale, { toValue: 0.92, useNativeDriver: true, speed: 40, bounciness: 6 }),
      Animated.spring(saveScale, { toValue: 1, useNativeDriver: true, speed: 22, bounciness: 8 }),
    ]).start();
    try {
      const newSaved = await toggleSavedExperience(experienceId as string);
      setIsSaved(newSaved.includes(experienceId as string));
    } catch {
      Alert.alert('Error', 'Could not update saved state.');
    } finally {
      setSavingToggle(false);
    }
  }, [experienceId, saveScale, savingToggle]);

  const handleShare = useCallback(async () => {
    if (!experience) return;
    try {
      await Share.share({
        title: experience.title,
        message: `${experience.title} in ${experience.city}, ${experience.country}\n\n${buildStory(experience)}`,
      });
    } catch {
      // ignore dismissed share
    }
  }, [experience]);

  const handleCreateReel = useCallback(() => {
    if (!experience) return;
    router.push({
      pathname: '/(tabs)/ai-concierge',
      params: { query: `Create a cinematic reel concept for ${experience.title} in ${experience.city}, ${experience.country}` },
    });
  }, [experience]);

  const handleDownloadMemories = useCallback(async () => {
    if (!experience) return;
    const mediaUrl = isValidRemoteImageUrl(experience.coverImage) ? experience.coverImage!.trim() : undefined;
    try {
      await Share.share({
        title: `${experience.title} memories`,
        message: `Memories from ${experience.title} in ${experience.city}, ${experience.country}`,
        url: mediaUrl,
      });
    } catch {
      Alert.alert('Memories', 'Could not open the share sheet right now.');
    }
  }, [experience]);

  const handleOpenMaps = useCallback((url?: string) => {
    if (!url) return;
    safeOpenUrl(url, 'Could not open Maps.');
  }, []);

  if (loading || accessLoading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={CYAN} size="large" />
      </View>
    );
  }

  if (notFound || !experience) {
    return (
      <View style={styles.loadingWrap}>
        <Ionicons name="compass-outline" size={40} color={LuxuryColors.textTertiary} />
        <Text style={styles.emptyTitle}>Experience not available</Text>
        <Text style={styles.emptyBody}>This experience may have been removed or is not yet published.</Text>
        <TouchableOpacity style={styles.backGhostButton} onPress={() => router.back()} activeOpacity={0.82}>
          <Text style={styles.backGhostButtonText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const heroSource = coverSource(experience);
  const story = buildStory(experience);
  const memoryCount = Math.max(
    (experience.hiddenGems.length + experience.restaurants.length + experience.hotels.length + experience.dailyPlan.length) * 7,
    24,
  );
  const routeStops = buildRouteStops(experience, hasPremiumAccess);
  const timeline = buildTimeline(experience, heroSource, hasPremiumAccess);
  const highlights = buildHighlights(experience);
  const visibleHighlights = hasPremiumAccess ? highlights : highlights.slice(0, 3);
  const insights = buildInsights(experience, memoryCount);
  const visibleInsights = hasPremiumAccess ? insights : insights.slice(0, 4);
  const achievements = buildAchievements(experience);
  const memories = buildMemoryTiles(experience, heroSource);
  const visibleMemories = hasPremiumAccess ? memories : memories.slice(0, 4);
  const totalLocations = Math.max(experience.hiddenGems.length + experience.restaurants.length + experience.hotels.length, 1);
  const displayRating = experience.savedCount > 0 ? Math.min(5, 4.6 + experience.savedCount / 100).toFixed(1) : '4.9';
  const quickInsights = [
    { icon: 'airplane-outline' as const, value: `${Math.max(1, Math.ceil(durationDays(experience.duration) / 5))}`, label: 'Flights' },
    { icon: 'location-outline' as const, value: `${totalLocations}`, label: 'Places Visited' },
    { icon: 'camera-outline' as const, value: `${memoryCount}`, label: 'Photos' },
    { icon: 'wallet-outline' as const, value: estimateSpend(experience), label: 'Total Spent' },
  ];
  const remainingDaysCount = Math.max(experience.dailyPlan.length - timeline.length, 0);
  const remainingMemoriesCount = Math.max(memories.length - visibleMemories.length, 0);
  const quoteText = experience.creatorNotes?.trim() || experience.description || 'A beautifully paced journey worth revisiting again and again.';

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
            <GradientFallback icon="airplane-outline" title={`${experience.city}, ${experience.country}`} subtitle="Curated journey memory" />
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
                <TouchableOpacity style={styles.heroActionButton} onPress={handleToggleSave} activeOpacity={0.84} disabled={savingToggle}>
                  <Ionicons name={isSaved ? 'heart' : 'heart-outline'} size={19} color={isSaved ? CYAN : '#FFFFFF'} />
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>

          <View style={styles.heroContent}>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusBadgeText}>Completed Trip</Text>
            </View>

            <Text style={styles.destinationTitle}>{experience.title}</Text>
            <Text style={styles.countryText}>{experience.city}, {experience.country}</Text>

            <TouchableOpacity
              style={styles.creatorPill}
              onPress={() => router.push({ pathname: '/(tabs)/creator-profile', params: { id: experience.creatorId } })}
              activeOpacity={0.84}
            >
              <View style={styles.creatorAvatarMini}>
                <Text style={styles.creatorAvatarMiniText}>{deriveInitials(experience.creatorName || 'Creator')}</Text>
              </View>
              <Text style={styles.creatorPillText}>{experience.creatorName || 'Curated by creator'}</Text>
            </TouchableOpacity>

            <View style={styles.heroMetaGrid}>
              <View style={styles.heroMetaChip}>
                <Ionicons name="calendar-outline" size={14} color={CYAN} />
                <Text style={styles.heroMetaValue}>{tripRangeLabel(experience)}</Text>
              </View>
              <View style={styles.heroMetaChip}>
                <Ionicons name="time-outline" size={14} color={CYAN} />
                <Text style={styles.heroMetaValue}>{experience.duration}</Text>
              </View>
              <View style={styles.heroMetaChip}>
                <Ionicons name="star-outline" size={14} color={CYAN} />
                <Text style={styles.heroMetaValue}>{displayRating}</Text>
              </View>
              <View style={styles.heroMetaChip}>
                <Ionicons name="images-outline" size={14} color={CYAN} />
                <Text style={styles.heroMetaValue}>{memoryCount} memories</Text>
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

          {!hasPremiumAccess ? <UnlockCard onPurchase={handlePurchase} purchasing={purchasing} /> : null}

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
            {!hasPremiumAccess && remainingDaysCount > 0 ? (
              <Text style={styles.lockedHint}>Unlock to reveal {remainingDaysCount} more itinerary day{remainingDaysCount === 1 ? '' : 's'}.</Text>
            ) : null}
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionEyebrow}>Trip Highlights</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.highlightsRow}>
              {visibleHighlights.map((item) => (
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
                          <Text style={styles.moreMemoriesText}>{remainingMemoriesCount > 0 ? `+${remainingMemoriesCount}` : '+99'} memories</Text>
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
              {visibleInsights.map((item) => (
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
              <Text style={styles.quoteMark}>"</Text>
              <Text style={styles.notesText}>{quoteText}</Text>
              <Text style={styles.notesAttribution}>{experience.creatorName || 'Traveler note'}</Text>
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

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionEyebrow}>Premium Collections</Text>
            <View style={styles.collectionCards}>
              {hasPremiumAccess && experience.hotels.length > 0 ? (
                experience.hotels.slice(0, 2).map((hotel) => (
                  <TouchableOpacity
                    key={hotel.name}
                    style={styles.collectionCard}
                    activeOpacity={0.84}
                    onPress={() => handleOpenMaps(hotel.mapsLink || experience.googleMapsUrl)}
                  >
                    <Ionicons name="bed-outline" size={18} color={CYAN} />
                    <Text style={styles.collectionTitle}>{hotel.name}</Text>
                    <Text style={styles.collectionBody} numberOfLines={2}>{hotel.address || hotel.notes || 'Premium stay recommendation'}</Text>
                  </TouchableOpacity>
                ))
              ) : null}
              {hasPremiumAccess && experience.restaurants.length > 0 ? (
                experience.restaurants.slice(0, 2).map((restaurant) => (
                  <TouchableOpacity
                    key={restaurant.name}
                    style={styles.collectionCard}
                    activeOpacity={0.84}
                    onPress={() => handleOpenMaps(restaurant.mapsLink || experience.googleMapsUrl)}
                  >
                    <Ionicons name="restaurant-outline" size={18} color={CYAN} />
                    <Text style={styles.collectionTitle}>{restaurant.name}</Text>
                    <Text style={styles.collectionBody} numberOfLines={2}>{restaurant.description || 'A creator-picked dining stop.'}</Text>
                  </TouchableOpacity>
                ))
              ) : null}
              {hasPremiumAccess && experience.hiddenGems.length > 0 ? (
                experience.hiddenGems.slice(0, 2).map((gem) => (
                  <TouchableOpacity
                    key={gem.name}
                    style={styles.collectionCard}
                    activeOpacity={0.84}
                    onPress={() => handleOpenMaps(gem.mapsLink || experience.googleMapsUrl)}
                  >
                    <Ionicons name="sparkles-outline" size={18} color={CYAN} />
                    <Text style={styles.collectionTitle}>{gem.name}</Text>
                    <Text style={styles.collectionBody} numberOfLines={2}>{gem.description || 'A hidden local favorite worth the detour.'}</Text>
                  </TouchableOpacity>
                ))
              ) : null}
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
    gap: 4,
  },
  unlockTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  unlockText: {
    color: 'rgba(230,250,255,0.70)',
    lineHeight: 20,
    fontSize: 13,
  },
  unlockActions: {
    flexDirection: 'row',
    gap: LuxurySpacing.sm,
  },
  unlockButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: CYAN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockButtonText: {
    color: '#04111E',
    fontWeight: '800',
  },
  unlockButtonSecondary: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: 'rgba(138,230,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(138,230,255,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockButtonSecondaryText: {
    color: '#E8FAFF',
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
  lockedHint: {
    color: 'rgba(230,250,255,0.64)',
    marginTop: LuxurySpacing.sm,
    lineHeight: 20,
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
  collectionCards: {
    gap: LuxurySpacing.md,
  },
  collectionCard: {
    borderRadius: 24,
    padding: LuxurySpacing.md,
    backgroundColor: 'rgba(11, 22, 34, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(138,230,255,0.09)',
    gap: 8,
  },
  collectionTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  collectionBody: {
    color: 'rgba(230,250,255,0.70)',
    lineHeight: 20,
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
