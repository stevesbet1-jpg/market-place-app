import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, Pressable, FlatList } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LuxuryColors, LuxurySpacing, LuxuryBorderRadius, LuxuryFontSize, LuxuryShadow } from '../../constants/luxuryTheme';
import { JOURNEYS, Journey, ImageKey, BudgetLevel } from '../../constants/journeys';
import { getFreeRemaining, getSavedIds, setBudgetPref, getBudgetPref, FREE_JOURNEY_LIMIT } from '../../constants/journeyStore';

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

const BUDGET_FILTERS: Array<BudgetLevel | null> = [null, '$', '$$', '$$$', '$$$$'];

export default function TripsScreen() {
  const insets = useSafeAreaInsets();

  const [freeRemaining, setFreeRemaining] = useState<number>(FREE_JOURNEY_LIMIT);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [budgetPref, setBudgetPrefState] = useState<BudgetLevel | null>(null);

  const [sessionOrder] = useState<Journey[]>(() =>
    [...JOURNEYS].sort(() => Math.random() - 0.5)
  );

  useFocusEffect(
    useCallback(() => {
      Promise.all([getFreeRemaining(), getSavedIds(), getBudgetPref()]).then(
        ([remaining, saved, pref]) => {
          setFreeRemaining(remaining);
          setSavedIds(saved);
          setBudgetPrefState(pref);
        }
      );
    }, [])
  );

  const featuredJourneys = useMemo<Journey[]>(() => {
    if (!budgetPref) return sessionOrder.slice(0, 5);
    const matching = sessionOrder.filter((j) => j.budget === budgetPref);
    const others = sessionOrder.filter((j) => j.budget !== budgetPref);
    return [...matching, ...others].slice(0, 5);
  }, [budgetPref, sessionOrder]);

  const savedJourneys = useMemo<Journey[]>(
    () => savedIds.map((id) => JOURNEYS.find((j) => j.id === id)).filter(Boolean) as Journey[],
    [savedIds]
  );

  const handleBudgetFilter = async (b: BudgetLevel | null) => {
    setBudgetPrefState(b);
    await setBudgetPref(b);
  };

  const handleCardPress = (journey: Journey) => {
    if (freeRemaining === 0) {
      router.push('/(tabs)/paywall');
    } else {
      router.push({ pathname: '/(tabs)/journey-detail', params: { id: journey.id } });
    }
  };

  const isLocked = freeRemaining === 0;

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      bounces={false}
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}
    >
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + LuxurySpacing.xl }]}>
        <Text style={styles.overline}>Luxury Discovery</Text>
        <Text style={styles.title}>Discover Journeys</Text>
        <Text style={styles.subtitle}>Curated destinations, refreshed each session</Text>
      </View>

      {/* ── Free counter badge ── */}
      <View style={styles.padH}>
        <View style={[styles.trialBadge, isLocked && styles.trialBadgeLocked]}>
          {/* Top row: icon + title + dots */}
          <View style={styles.trialTopRow}>
            <Ionicons
              name={isLocked ? 'lock-closed-outline' : 'diamond-outline'}
              size={13}
              color={isLocked ? LuxuryColors.textTertiary : LuxuryColors.gold}
            />
            <Text style={[styles.trialBadgeText, isLocked && styles.trialBadgeTextLocked]}>
              {isLocked
                ? 'Unlock 20 Premium Journeys'
                : `${freeRemaining} Complimentary ${freeRemaining === 1 ? 'Journey' : 'Journeys'} Remaining`}
            </Text>
            {!isLocked && (
              <View style={styles.trialDots}>
                {Array.from({ length: FREE_JOURNEY_LIMIT }).map((_, i) => (
                  <View
                    key={i}
                    style={[styles.trialDot, i >= freeRemaining && styles.trialDotUsed]}
                  />
                ))}
              </View>
            )}
          </View>
          {/* Locked sub-content */}
          {isLocked && (
            <>
              <Text style={styles.trialSubtext}>
                Curated destinations, full itineraries &amp; budget-matched picks.
              </Text>
              <Pressable
                style={styles.upgradeCta}
                onPress={() => router.push('/(tabs)/paywall')}
              >
                <Text style={styles.upgradeCtaText}>Upgrade Membership</Text>
                <Ionicons name="chevron-forward" size={11} color={LuxuryColors.background} />
              </Pressable>
            </>
          )}
        </View>
      </View>

      {/* ── Budget filter pills ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.budgetFilterRow}
        style={styles.budgetFilterScroll}
      >
        {BUDGET_FILTERS.map((b) => {
          const key = String(b);
          const active = budgetPref === b;
          return (
            <Pressable
              key={key}
              style={[styles.budgetPill, active && styles.budgetPillActive]}
              onPress={() => handleBudgetFilter(b)}
            >
              <Text style={[styles.budgetPillText, active && styles.budgetPillTextActive]}>
                {b === null ? 'All Budgets' : b}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ── Saved Journeys ── */}
      {savedJourneys.length > 0 ? (
        <View style={styles.savedSection}>
          <View style={styles.savedHeader}>
            <Text style={styles.savedLabel}>Saved Journeys</Text>
            <Text style={styles.savedCount}>{savedJourneys.length}</Text>
          </View>
          <FlatList
            data={savedJourneys}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(j) => j.id}
            contentContainerStyle={styles.savedList}
            renderItem={({ item: journey }) => (
              <Pressable
                style={({ pressed }) => [styles.savedCard, pressed && { opacity: 0.85 }]}
                onPress={() => handleCardPress(journey)}
              >
                <Image
                  source={JOURNEY_IMAGES[journey.imageKey]}
                  style={styles.savedCardImg}
                  resizeMode="cover"
                />
                <LinearGradient
                  colors={['transparent', 'rgba(7,17,32,0.88)'] as const}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.savedCardOverlay}>
                  <Text style={styles.savedCardRegion}>{journey.region}</Text>
                  <Text style={styles.savedCardName} numberOfLines={1}>{journey.name}</Text>
                  <View style={styles.savedCardBudgeBadge}>
                    <Text style={styles.savedCardBudgeText}>{journey.budget}</Text>
                  </View>
                </View>
                {isLocked ? (
                  <View style={styles.savedLockBadge}>
                    <Ionicons name="lock-closed" size={9} color="rgba(255,255,255,0.75)" />
                  </View>
                ) : (
                  <View style={styles.savedBookmarkBadge}>
                    <Ionicons name="bookmark" size={9} color={LuxuryColors.gold} />
                  </View>
                )}
              </Pressable>
            )}
          />
        </View>
      ) : (
        <View style={styles.savedEmptyState}>
          <Ionicons name="bookmark-outline" size={18} color="rgba(212,175,55,0.40)" />
          <Text style={styles.savedEmptyText}>No saved journeys yet</Text>
          <Text style={styles.savedEmptySubtext}>Tap the bookmark on any journey to save it</Text>
        </View>
      )}

      {/* ── Journey cards ── */}
      <View style={[styles.padH, styles.cardList]}>
        {featuredJourneys.map((journey) => (
          <Pressable
            key={journey.id}
            style={({ pressed }) => [
              styles.journeyCard,
              pressed && styles.journeyCardPressed,
            ]}
            onPress={() => handleCardPress(journey)}
          >
            {/* Hero image */}
            <View style={styles.imageWrap}>
              <Image
                source={JOURNEY_IMAGES[journey.imageKey]}
                style={styles.heroImg}
                resizeMode="cover"
              />
              <LinearGradient
                colors={['transparent', 'rgba(7,17,32,0.80)'] as const}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.regionBadge}>
                <Text style={styles.regionText}>{journey.region}</Text>
              </View>
              <View style={styles.durationBadge}>
                <Ionicons name="time-outline" size={11} color="rgba(255,255,255,0.80)" />
                <Text style={styles.durationText}>{journey.duration}</Text>
              </View>
              {isLocked && (
                <View style={styles.lockOverlay}>
                  <View style={styles.lockIconWrap}>
                    <Ionicons name="lock-closed" size={16} color="rgba(255,255,255,0.90)" />
                  </View>
                  <Text style={styles.lockLabel}>Members Only</Text>
                </View>
              )}
            </View>

            {/* Card body */}
            <View style={styles.cardBody}>
              <View style={styles.cardMeta}>
                <Text style={styles.destinationName}>{journey.destination}</Text>
                <View style={styles.budgetBadge}>
                  <Text style={styles.budgetBadgeText}>{journey.budget}</Text>
                </View>
              </View>
              <Text style={styles.journeyName}>{journey.name}</Text>
              <Text style={styles.overviewSnippet} numberOfLines={2}>
                {journey.overview}
              </Text>
              <View style={styles.cardFooter}>
                <View style={styles.placeChips}>
                  {journey.places.slice(0, 2).map((place) => (
                    <View key={place} style={styles.placeChip}>
                      <Text style={styles.placeChipText} numberOfLines={1}>{place}</Text>
                    </View>
                  ))}
                  {journey.places.length > 2 && (
                    <Text style={styles.placeMore}>+{journey.places.length - 2}</Text>
                  )}
                </View>
                <View style={styles.exploreLink}>
                  <Text style={styles.exploreLinkText}>{isLocked ? 'Unlock' : 'Explore'}</Text>
                  <Ionicons
                    name={isLocked ? 'lock-closed' : 'chevron-forward'}
                    size={11}
                    color={LuxuryColors.gold}
                  />
                </View>
              </View>
            </View>
          </Pressable>
        ))}
      </View>

      <View style={{ height: 64 + insets.bottom }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LuxuryColors.background,
  },
  header: {
    paddingHorizontal: LuxurySpacing.xl,
    paddingBottom: LuxurySpacing.lg,
  },
  overline: {
    fontSize: 9,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: LuxurySpacing.sm,
  },
  title: {
    fontSize: LuxuryFontSize.xxxl,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: LuxurySpacing.xs,
  },
  subtitle: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textSecondary,
    letterSpacing: 0.2,
  },
  padH: {
    paddingHorizontal: LuxurySpacing.xl,
  },
  trialBadge: {
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.20)',
    borderRadius: LuxuryBorderRadius.xl,
    paddingHorizontal: LuxurySpacing.md,
    paddingVertical: 12,
    marginBottom: LuxurySpacing.lg,
    gap: LuxurySpacing.sm,
  },
  trialTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.sm,
  },
  trialBadgeLocked: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.10)',
  },
  trialBadgeText: {
    flex: 1,
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.gold,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  trialBadgeTextLocked: {
    color: LuxuryColors.textSecondary,
  },
  trialDots: {
    flexDirection: 'row',
    gap: 5,
  },
  trialDot: {
    width: 7,
    height: 7,
    borderRadius: LuxuryBorderRadius.full,
    backgroundColor: LuxuryColors.gold,
  },
  trialDotUsed: {
    backgroundColor: 'rgba(212,175,55,0.25)',
  },
  upgradeLink: {
    fontSize: LuxuryFontSize.xs,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 0.3,
  },
  trialSubtext: {
    fontSize: 11,
    color: LuxuryColors.textSecondary,
    lineHeight: 16,
    letterSpacing: 0.1,
  },
  upgradeCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: LuxuryColors.gold,
    borderRadius: LuxuryBorderRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  upgradeCtaText: {
    fontSize: 11,
    fontWeight: '700',
    color: LuxuryColors.background,
    letterSpacing: 0.4,
  },
  budgetFilterScroll: {
    marginBottom: LuxurySpacing.lg,
  },
  budgetFilterRow: {
    paddingHorizontal: LuxurySpacing.xl,
    gap: LuxurySpacing.sm,
  },
  budgetPill: {
    paddingHorizontal: LuxurySpacing.md,
    paddingVertical: 7,
    borderRadius: LuxuryBorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  budgetPillActive: {
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderColor: 'rgba(212,175,55,0.35)',
  },
  budgetPillText: {
    fontSize: LuxuryFontSize.sm,
    fontWeight: '600',
    color: LuxuryColors.textSecondary,
    letterSpacing: 0.3,
  },
  budgetPillTextActive: {
    color: LuxuryColors.gold,
  },
  savedSection: {
    marginBottom: LuxurySpacing.lg,
  },
  savedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.sm,
    paddingHorizontal: LuxurySpacing.xl,
    marginBottom: LuxurySpacing.sm,
  },
  savedLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  savedCount: {
    fontSize: 9,
    fontWeight: '700',
    color: LuxuryColors.textTertiary,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: LuxuryBorderRadius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
    letterSpacing: 0.3,
  },
  savedList: {
    paddingHorizontal: LuxurySpacing.xl,
    gap: LuxurySpacing.sm,
  },
  savedCard: {
    width: 150,
    height: 110,
    borderRadius: LuxuryBorderRadius.xl,
    overflow: 'hidden',
    position: 'relative',
    ...LuxuryShadow.soft,
  },
  savedCardImg: {
    width: '100%',
    height: '100%',
  },
  savedCardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: LuxurySpacing.sm,
    gap: 2,
  },
  savedCardRegion: {
    fontSize: 8,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  savedCardName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.1,
    lineHeight: 14,
  },
  savedCardBudgeBadge: {
    backgroundColor: 'rgba(212,175,55,0.20)',
    borderRadius: LuxuryBorderRadius.sm,
    paddingHorizontal: 5,
    paddingVertical: 1,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  savedCardBudgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 0.3,
  },
  savedLockBadge: {
    position: 'absolute',
    top: LuxurySpacing.sm,
    right: LuxurySpacing.sm,
    width: 20,
    height: 20,
    borderRadius: LuxuryBorderRadius.full,
    backgroundColor: 'rgba(7,17,32,0.70)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedBookmarkBadge: {
    position: 'absolute',
    top: LuxurySpacing.sm,
    right: LuxurySpacing.sm,
    width: 20,
    height: 20,
    borderRadius: LuxuryBorderRadius.full,
    backgroundColor: 'rgba(212,175,55,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedEmptyState: {
    marginHorizontal: LuxurySpacing.xl,
    marginBottom: LuxurySpacing.lg,
    alignItems: 'center',
    gap: 5,
    paddingVertical: LuxurySpacing.lg,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: LuxuryBorderRadius.xl,
    borderStyle: 'dashed',
  },
  savedEmptyText: {
    fontSize: LuxuryFontSize.sm,
    fontWeight: '600',
    color: LuxuryColors.textTertiary,
    letterSpacing: 0.2,
  },
  savedEmptySubtext: {
    fontSize: 11,
    color: 'rgba(122,118,104,0.65)',
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  cardList: {
    gap: LuxurySpacing.md,
  },
  journeyCard: {
    backgroundColor: LuxuryColors.surface,
    borderRadius: LuxuryBorderRadius.xxl,
    overflow: 'hidden',
    ...LuxuryShadow.soft,
  },
  journeyCardPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.92,
  },
  imageWrap: {
    height: 155,
    overflow: 'hidden',
  },
  heroImg: {
    width: '100%',
    height: '100%',
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7,17,32,0.52)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  lockIconWrap: {
    width: 32,
    height: 32,
    borderRadius: LuxuryBorderRadius.full,
    backgroundColor: 'rgba(7,17,32,0.60)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.80)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  regionBadge: {
    position: 'absolute',
    top: LuxurySpacing.md,
    left: LuxurySpacing.md,
    backgroundColor: 'rgba(7,17,32,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    borderRadius: LuxuryBorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  regionText: {
    fontSize: 10,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  durationBadge: {
    position: 'absolute',
    top: LuxurySpacing.md,
    right: LuxurySpacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(7,17,32,0.65)',
    borderRadius: LuxuryBorderRadius.full,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  durationText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.80)',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  cardBody: {
    padding: LuxurySpacing.md,
    gap: 6,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  destinationName: {
    fontSize: LuxuryFontSize.xs,
    fontWeight: '700',
    color: LuxuryColors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  budgetBadge: {
    backgroundColor: 'rgba(212,175,55,0.10)',
    borderRadius: LuxuryBorderRadius.sm,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  budgetBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 0.5,
  },
  journeyName: {
    fontSize: LuxuryFontSize.lg,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
    letterSpacing: -0.2,
  },
  overviewSnippet: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textSecondary,
    lineHeight: 19,
    letterSpacing: 0.1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: LuxurySpacing.xs,
  },
  placeChips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
    flexWrap: 'nowrap',
    overflow: 'hidden',
  },
  placeChip: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: LuxuryBorderRadius.sm,
    paddingHorizontal: 7,
    paddingVertical: 3,
    maxWidth: 110,
  },
  placeChipText: {
    fontSize: 10,
    color: LuxuryColors.textTertiary,
    letterSpacing: 0.2,
  },
  placeMore: {
    fontSize: 10,
    color: LuxuryColors.textTertiary,
    fontWeight: '600',
  },
  exploreLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 0,
  },
  exploreLinkText: {
    fontSize: LuxuryFontSize.xs,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 0.3,
  },
});

