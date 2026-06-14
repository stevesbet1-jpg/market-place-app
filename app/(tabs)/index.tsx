import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LuxuryColors,
  LuxurySpacing,
  LuxuryBorderRadius,
  LuxuryFontSize,
  LuxuryShadow,
} from '../../constants/luxuryTheme';
import {
  getApprovedCreators,
  hasRealCreators,
  subscribeApprovedCreators,
} from '../../lib/creatorService';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirebaseApp } from '../../lib/firebase';
import { getPublishedExperiences } from '../../lib/creatorExperienceService';
import type { Creator } from '../../constants/creators';
import type { CreatorExperience } from '../../constants/creatorExperienceModel';
import { isValidRemoteImageUrl } from '../../lib/imageFallback';

const CYAN = '#8AE6FF';
const SKY = '#4EA8FF';

type ExploreFilterKey = 'all' | 'featured' | 'luxury' | 'adventure' | 'food';

function dedupeExperiences(items: CreatorExperience[]): CreatorExperience[] {
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();
  const unique: CreatorExperience[] = [];

  for (const item of items) {
    const normalizedId = (item.id ?? '').trim();
    const normalizedTitle = (item.title ?? '').trim().toLowerCase();

    const idAlreadySeen = normalizedId.length > 0 && seenIds.has(normalizedId);
    const titleAlreadySeen = normalizedTitle.length > 0 && seenTitles.has(normalizedTitle);
    if (idAlreadySeen || titleAlreadySeen) continue;

    if (normalizedId.length > 0) seenIds.add(normalizedId);
    if (normalizedTitle.length > 0) seenTitles.add(normalizedTitle);
    unique.push(item);
  }

  return unique;
}

function deriveExperienceStat(exp: CreatorExperience): string {
  if (exp.savedCount > 0) return `${exp.savedCount} saves`;
  if (exp.unlocks > 0) return `${exp.unlocks} unlocks`;
  if (exp.views > 0) return `${exp.views} views`;
  return `${Math.max(exp.dailyPlan.length + exp.hiddenGems.length + exp.restaurants.length, 6)} moments`;
}

function deriveExperienceRating(exp: CreatorExperience): string {
  if (exp.savedCount > 0) {
    return Math.min(5, 4.6 + exp.savedCount / 100).toFixed(1);
  }
  if (exp.unlocks > 0) {
    return Math.min(5, 4.5 + exp.unlocks / 150).toFixed(1);
  }
  return '4.9';
}

function deriveMemoryCount(exp: CreatorExperience): number {
  return Math.max(
    exp.dailyPlan.length + exp.hiddenGems.length + exp.restaurants.length + exp.hotels.length,
    8,
  );
}

function EmptyState({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name={icon} size={30} color={CYAN} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.filterChip, active && styles.filterChipActive]}
      activeOpacity={0.82}
      onPress={onPress}
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function JourneyCard({ exp }: { exp: CreatorExperience }) {
  const imageSource = isValidRemoteImageUrl(exp.coverImage) ? { uri: exp.coverImage!.trim() } : null;
  const memoryCount = deriveMemoryCount(exp);
  const rating = deriveExperienceRating(exp);
  const statusLabel = exp.published ? 'PUBLISHED' : 'FEATURED';

  return (
    <TouchableOpacity
      style={styles.journeyCard}
      activeOpacity={0.9}
      onPress={() =>
        router.push({ pathname: '/(tabs)/experience-detail', params: { id: exp.id } })
      }
    >
      <View style={styles.journeyMediaWrap}>
        {imageSource ? (
          <Image source={imageSource} style={styles.journeyImage} resizeMode="cover" />
        ) : (
          <View style={styles.journeyFallback}>
            <Ionicons name="globe-outline" size={34} color={CYAN} />
            <Text style={styles.journeyFallbackText}>{exp.city || exp.country || exp.title}</Text>
          </View>
        )}
        <View style={styles.journeyImageShade} />

        <View style={styles.journeyTopRow}>
          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>{statusLabel}</Text>
          </View>
          <TouchableOpacity style={styles.heartButton} activeOpacity={0.82}>
            <Ionicons name="heart-outline" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.journeyBottomMeta}>
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={11} color={CYAN} />
            <Text style={styles.ratingBadgeText}>{rating}</Text>
          </View>
          <View style={styles.memoryBadge}>
            <Ionicons name="images-outline" size={11} color="#DFF8FF" />
            <Text style={styles.memoryBadgeText}>{memoryCount} photos</Text>
          </View>
        </View>
      </View>

      <View style={styles.journeyCardBody}>
        <View style={styles.journeyTextBlock}>
          <Text style={styles.journeyTitle} numberOfLines={2}>{exp.title}</Text>
          <Text style={styles.journeyLocation} numberOfLines={1}>
            {exp.city ? `${exp.city}, ` : ''}{exp.country}
          </Text>
        </View>

        <View style={styles.journeyMetaRow}>
          <View style={styles.metaBadge}>
            <Ionicons name="time-outline" size={13} color={CYAN} />
            <Text style={styles.metaBadgeText}>{exp.duration}</Text>
          </View>
          <View style={styles.metaBadge}>
            <Ionicons name="sparkles-outline" size={13} color={CYAN} />
            <Text style={styles.metaBadgeText}>{deriveExperienceStat(exp)}</Text>
          </View>
        </View>

        <View style={styles.journeyFooterRow}>
          <View style={styles.creatorRow}>
            <Text style={styles.creatorLabel}>by {exp.creatorName}</Text>
            <Text style={styles.travelStyleText}>{exp.travelStyle ? travelStyleText(exp.travelStyle) : 'Curated'}</Text>
          </View>
          <View style={styles.arrowButton}>
            <Ionicons name="arrow-forward" size={16} color={LuxuryColors.background} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function travelStyleText(style: CreatorExperience['travelStyle']): string {
  switch (style) {
    case 'luxury':
      return 'Luxury';
    case 'adventure':
      return 'Adventure';
    case 'budget':
      return 'Budget';
    case 'family':
      return 'Family';
    case 'food':
      return 'Food';
  }
}

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();

  const [creators, setCreators] = useState<Creator[]>([]);
  const [experiences, setExperiences] = useState<CreatorExperience[]>([]);
  const [showingDemo, setShowingDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reallyEmpty, setReallyEmpty] = useState(false);
  const [authUid, setAuthUid] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<ExploreFilterKey>('all');

  useEffect(() => {
    const auth = getAuth(getFirebaseApp());
    return onAuthStateChanged(auth, (user) => {
      setAuthUid(user?.uid ?? null);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      let unsubCreators: (() => void) | null = null;
      setLoading(true);
      Promise.all([
        getApprovedCreators(),
        hasRealCreators(),
        getPublishedExperiences(),
      ]).then(([list, anyReal, exps]) => {
        if (cancelled) return;
        const typedCreators = list as Creator[];
        const typedExperiences = dedupeExperiences(exps as CreatorExperience[]);
        const allDemo = typedCreators.every((c) => c.isDemo);
        setCreators(typedCreators);
        setExperiences(typedExperiences);
        setShowingDemo(allDemo);
        setReallyEmpty(anyReal === false && typedCreators.length === 0 && typedExperiences.length === 0);
        setLoading(false);

        unsubCreators = subscribeApprovedCreators(
          (liveCreators) => {
            if (cancelled) return;
            setCreators(liveCreators);
            setShowingDemo(liveCreators.every((c) => c.isDemo));
          },
          () => {
            if (!cancelled) setLoading(false);
          }
        );
      }).catch(() => {
        if (!cancelled) setLoading(false);
      });

      return () => {
        cancelled = true;
        unsubCreators?.();
      };
    }, [])
  );

  const q = searchQuery.trim().toLowerCase();

  const myCreatorIds = useMemo(
    () => new Set(
      authUid
        ? creators
            .filter((c) => c.userId && c.userId === authUid)
            .map((c) => c.id)
        : []
    ),
    [authUid, creators]
  );

  // Keep Explore strictly public: published journeys from other creators with a valid detail id.
  const publicExperiences = useMemo(
    () => experiences.filter((exp) => {
      const validId = typeof exp.id === 'string' && exp.id.trim().length > 0;
      return exp.published === true && validId && !myCreatorIds.has(exp.creatorId);
    }),
    [experiences, myCreatorIds]
  );

  const searchFilteredExperiences = q
    ? publicExperiences.filter((exp) =>
        exp.title?.toLowerCase().includes(q) ||
        exp.city?.toLowerCase().includes(q) ||
        exp.country?.toLowerCase().includes(q) ||
        exp.creatorName?.toLowerCase().includes(q)
      )
    : publicExperiences;

  const filteredExperiences = useMemo(() => {
    switch (activeFilter) {
      case 'featured':
        return [...searchFilteredExperiences].sort(
          (a, b) => (b.savedCount + b.unlocks + b.views) - (a.savedCount + a.unlocks + a.views)
        );
      case 'luxury':
      case 'adventure':
      case 'food':
        return searchFilteredExperiences.filter((exp) => exp.travelStyle === activeFilter);
      default:
        return searchFilteredExperiences;
    }
  }, [activeFilter, searchFilteredExperiences]);

  const topSummaryText = `${publicExperiences.length} public ${publicExperiences.length === 1 ? 'journey' : 'journeys'} available`;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + LuxurySpacing.lg, paddingBottom: 88 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerEyebrow}>CURATED DISCOVERY</Text>
          <Text style={styles.headerTitle}>Explore Journeys</Text>
          <Text style={styles.headerSub}>
            Premium travel blueprints from independent creators, designed for travelers who want a faster path to unforgettable trips.
          </Text>
        </View>

        <View style={styles.searchShell}>
          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={16} color={LuxuryColors.textTertiary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by title, city, country, creator..."
              placeholderTextColor={LuxuryColors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={16} color={LuxuryColors.textTertiary} />
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={styles.filterHeaderRow}>
            <Text style={styles.summaryText}>{topSummaryText}</Text>
            <View style={styles.filterIconWrap}>
              <Ionicons name="options-outline" size={15} color={CYAN} />
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            <FilterChip label="All" active={activeFilter === 'all'} onPress={() => setActiveFilter('all')} />
            <FilterChip label="Featured" active={activeFilter === 'featured'} onPress={() => setActiveFilter('featured')} />
            <FilterChip label="Luxury" active={activeFilter === 'luxury'} onPress={() => setActiveFilter('luxury')} />
            <FilterChip label="Adventure" active={activeFilter === 'adventure'} onPress={() => setActiveFilter('adventure')} />
            <FilterChip label="Food" active={activeFilter === 'food'} onPress={() => setActiveFilter('food')} />
          </ScrollView>
        </View>

        {loading ? (
          <ActivityIndicator color={LuxuryColors.gold} style={styles.loader} />
        ) : reallyEmpty ? (
          <EmptyState
            icon="compass-outline"
            title="No public journeys yet"
            subtitle="Published journeys from creators will appear here once the first collections go live."
          />
        ) : filteredExperiences.length === 0 ? (
          <EmptyState
            icon={q.length > 0 ? 'search-outline' : 'map-outline'}
            title={q.length > 0 ? 'No journeys match that search' : 'No journeys in this filter'}
            subtitle={q.length > 0
              ? 'Try a different city, country, title, or creator name.'
              : 'Switch filters or check back soon for newly published journeys.'}
          />
        ) : (
          <>
            {showingDemo ? (
              <View style={styles.demoNotice}>
                <Ionicons name="information-circle-outline" size={15} color={CYAN} />
                <Text style={styles.demoNoticeText}>
                  Demo creator profiles are still present, but this Explore feed is focused on public journeys only.
                </Text>
              </View>
            ) : null}

            <View style={styles.cardsColumn}>
              {filteredExperiences.map((exp) => (
                <JourneyCard key={exp.id} exp={exp} />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: LuxuryColors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: LuxurySpacing.xl,
  },
  loader: {
    marginTop: 80,
  },
  header: {
    marginBottom: LuxurySpacing.xl,
    gap: 8,
  },
  headerEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: CYAN,
    letterSpacing: 2.2,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: LuxuryColors.textPrimary,
    letterSpacing: -0.8,
  },
  headerSub: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textSecondary,
    lineHeight: 20,
  },
  searchShell: {
    marginBottom: LuxurySpacing.xl,
    padding: LuxurySpacing.md,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(138,230,255,0.10)',
    ...LuxuryShadow.soft,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(4,13,24,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(138,230,255,0.12)',
    borderRadius: LuxuryBorderRadius.full,
    paddingHorizontal: LuxurySpacing.md,
    paddingVertical: 10,
    gap: 8,
  },
  searchIcon: {
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textPrimary,
    padding: 0,
  },
  filterHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: LuxurySpacing.md,
    marginBottom: LuxurySpacing.sm,
  },
  summaryText: {
    fontSize: 12,
    color: LuxuryColors.textTertiary,
    letterSpacing: 0.2,
  },
  filterIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(138,230,255,0.10)',
  },
  filterRow: {
    gap: 8,
    paddingRight: LuxurySpacing.sm,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: LuxuryBorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  filterChipActive: {
    backgroundColor: 'rgba(138,230,255,0.14)',
    borderColor: 'rgba(138,230,255,0.30)',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: LuxuryColors.textSecondary,
    letterSpacing: 0.2,
  },
  filterChipTextActive: {
    color: CYAN,
  },
  demoNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(138,230,255,0.06)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(138,230,255,0.12)',
    padding: 12,
    marginBottom: LuxurySpacing.lg,
  },
  demoNoticeText: {
    flex: 1,
    color: LuxuryColors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  cardsColumn: {
    gap: LuxurySpacing.lg,
  },
  journeyCard: {
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(138,230,255,0.10)',
    ...LuxuryShadow.medium,
  },
  journeyMediaWrap: {
    height: 272,
    position: 'relative',
    backgroundColor: 'rgba(12,25,42,0.95)',
  },
  journeyImage: {
    width: '100%',
    height: '100%',
  },
  journeyFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: LuxurySpacing.lg,
    gap: 10,
    backgroundColor: 'rgba(13,26,43,0.98)',
  },
  journeyFallbackText: {
    color: LuxuryColors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  journeyImageShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4,11,20,0.32)',
  },
  journeyTopRow: {
    position: 'absolute',
    top: LuxurySpacing.md,
    left: LuxurySpacing.md,
    right: LuxurySpacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: LuxuryBorderRadius.full,
    backgroundColor: 'rgba(8,18,30,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(138,230,255,0.20)',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: CYAN,
    letterSpacing: 1.2,
  },
  heartButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8,18,30,0.60)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  journeyBottomMeta: {
    position: 'absolute',
    left: LuxurySpacing.md,
    right: LuxurySpacing.md,
    bottom: LuxurySpacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: LuxuryBorderRadius.full,
    backgroundColor: 'rgba(8,18,30,0.68)',
  },
  ratingBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  memoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: LuxuryBorderRadius.full,
    backgroundColor: 'rgba(8,18,30,0.68)',
  },
  memoryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#E6FAFF',
  },
  journeyCardBody: {
    padding: LuxurySpacing.lg,
    gap: LuxurySpacing.md,
    backgroundColor: 'rgba(9,18,30,0.92)',
  },
  journeyTextBlock: {
    gap: 5,
  },
  journeyTitle: {
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '800',
    color: LuxuryColors.textPrimary,
    letterSpacing: -0.6,
  },
  journeyLocation: {
    fontSize: 14,
    color: LuxuryColors.textSecondary,
  },
  journeyMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  metaBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E8FAFF',
  },
  journeyFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: LuxurySpacing.md,
  },
  creatorRow: {
    flex: 1,
    gap: 2,
  },
  creatorLabel: {
    fontSize: 13,
    color: LuxuryColors.textPrimary,
    fontWeight: '600',
  },
  travelStyleText: {
    fontSize: 11,
    color: CYAN,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  arrowButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CYAN,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 72,
    paddingBottom: 48,
    paddingHorizontal: LuxurySpacing.lg,
  },
  emptyIconWrap: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: 'rgba(138,230,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: LuxurySpacing.lg,
  },
  emptyTitle: {
    color: LuxuryColors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: LuxurySpacing.sm,
  },
  emptySubtitle: {
    color: LuxuryColors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 320,
  },
});
