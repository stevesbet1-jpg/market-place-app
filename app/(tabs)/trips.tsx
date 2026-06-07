import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, Image, ActivityIndicator, StyleSheet, ScrollView, Pressable, FlatList, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { LuxuryColors, LuxurySpacing, LuxuryBorderRadius, LuxuryFontSize, LuxuryShadow } from '../../constants/luxuryTheme';
import type { BudgetLevel } from '../../constants/journeys';
import type { CreatorJourney } from '../../constants/creatorJourneyModel';
import { getJourneysByIds } from '../../lib/creatorJourneyService';
import {
  getPublishedExperiencesPage,
  getMorePublishedExperiences,
  getExperiencesByIds,
  getPublishedExperiencesByCreator,
  type ExperiencesPage,
} from '../../lib/creatorExperienceService';
import { formatSaves } from '../../constants/creators';
import {
  getFreeRemaining,
  getSavedIds,
  setBudgetPref,
  getBudgetPref,
  FREE_JOURNEY_LIMIT,
  setJourneyStoreUid,
} from '../../constants/journeyStore';
import { getSavedExperienceIds, setExperienceStoreUid } from '../../constants/experienceStore';
import type { CreatorExperience } from '../../constants/creatorExperienceModel';
import { isValidRemoteImageUrl } from '../../lib/imageFallback';
import { getFirebaseApp } from '../../lib/firebase';
import { getMyApprovedCreatorProfile } from '../../lib/creatorService';

type ImageKey = 'islands' | 'villas' | 'yacht' | 'desert' | 'mountain' | 'city' | 'temple' | 'bali' | 'seychelles' | 'zanzibar' | 'lakecomo' | 'alps';

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
  if (isValidRemoteImageUrl(journey.imageUri)) return { uri: journey.imageUri!.trim() };
  const key = journey.imageKey as ImageKey | undefined;
  if (key && key in JOURNEY_IMAGES) return JOURNEY_IMAGES[key];
  return null;
}

function experienceImageSource(experience: CreatorExperience) {
  if (isValidRemoteImageUrl(experience.coverImage)) return { uri: experience.coverImage!.trim() };
  return null;
}

function experienceLocation(experience: CreatorExperience) {
  const locationParts = [experience.city?.trim(), experience.country?.trim()].filter(Boolean);
  return locationParts.length > 0 ? locationParts.join(', ') : 'Location TBA';
}

function experienceDailyBudget(experience: CreatorExperience) {
  return `${experience.budget}/day`;
}

function deriveInitials(name: string): string {
  return name.split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase();
}

const BUDGET_FILTERS: Array<BudgetLevel | null> = [null, '$', '$$', '$$$', '$$$$'];

export default function TripsScreen() {
  const insets = useSafeAreaInsets();

  const [freeRemaining, setFreeRemaining] = useState<number>(FREE_JOURNEY_LIMIT);
  const [savedJourneyDetails, setSavedJourneyDetails] = useState<CreatorJourney[]>([]);
  // Saved experience objects fetched directly by ID (not filtered from published list)
  const [savedExperienceDetails, setSavedExperienceDetails] = useState<CreatorExperience[]>([]);
  const [budgetPref, setBudgetPrefState] = useState<BudgetLevel | null>(null);
  const [allExperiences, setAllExperiences] = useState<CreatorExperience[]>([]);
  const [myPublishedExperiences, setMyPublishedExperiences] = useState<CreatorExperience[]>([]);
  const [loading, setLoading] = useState(true);
  const [expCursor, setExpCursor] = useState<ExperiencesPage['cursor']>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [authUid, setAuthUid] = useState<string | null>(null);

  useEffect(() => {
    const auth = getAuth(getFirebaseApp());
    return onAuthStateChanged(auth, (user) => {
      const uid = user?.uid ?? null;
      setAuthUid(uid);
      setJourneyStoreUid(uid);
      setExperienceStoreUid(uid);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);

      async function loadAll() {
        try {
          const [remaining, saved, savedExpIds, pref, expPage] = await Promise.all([
            getFreeRemaining(),
            getSavedIds(),
            getSavedExperienceIds(),
            getBudgetPref(),
            getPublishedExperiencesPage(),
          ]);
          if (cancelled) return;

          console.log('[Trips] loaded saved journey ids:', (saved as string[]).length, saved);
          console.log('[Trips] loaded saved experience ids:', (savedExpIds as string[]).length, savedExpIds);

          const savedJourneyDetails = await getJourneysByIds(saved as string[]);
          // Fetch saved experience objects directly by ID — works for drafts and published alike
          const savedExpDetails = await getExperiencesByIds(savedExpIds as string[]);
          if (cancelled) return;

          console.log('[Trips] loaded saved experience details:', savedExpDetails.length, savedExpDetails.map(e => e.id));

          let myPublished: CreatorExperience[] = [];
          if (authUid) {
            try {
              const creatorProfile = await getMyApprovedCreatorProfile(authUid);
              if (creatorProfile?.id) {
                myPublished = await getPublishedExperiencesByCreator(creatorProfile.id);
              }
            } catch {
              myPublished = [];
            }
          }
          if (cancelled) return;

          setFreeRemaining(remaining as number);
          setSavedJourneyDetails(savedJourneyDetails);
          setSavedExperienceDetails(savedExpDetails);
          setBudgetPrefState(pref as BudgetLevel | null);
          setAllExperiences((expPage as ExperiencesPage).items);
          setMyPublishedExperiences(myPublished);
          setExpCursor((expPage as ExperiencesPage).cursor);
          setLoading(false);
        } catch (err) {
          console.error('[Trips] load error:', err);
          if (!cancelled) setLoading(false);
        }
      }

      loadAll();
      return () => { cancelled = true; };
    }, [authUid])
  );

  const featuredExperiences = useMemo<CreatorExperience[]>(() => {
    if (!budgetPref) return allExperiences;
    const matching = allExperiences.filter((experience) => experience.budget === budgetPref);
    const others = allExperiences.filter((experience) => experience.budget !== budgetPref);
    return [...matching, ...others];
  }, [budgetPref, allExperiences]);

  const hasPublishedExperiences = allExperiences.length > 0 || myPublishedExperiences.length > 0;

  const savedJourneys = savedJourneyDetails;

  const handleBudgetFilter = async (b: BudgetLevel | null) => {
    setBudgetPrefState(b);
    await setBudgetPref(b);
  };

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !expCursor) return;
    setLoadingMore(true);
    try {
      const moreExps = await getMorePublishedExperiences(expCursor);
      if (moreExps) {
        setAllExperiences((prev) => [...prev, ...moreExps.items]);
        setExpCursor(moreExps.cursor);
      }
    } catch (err) {
      console.error('[Trips] loadMore error:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, expCursor]);

  const handleCardPress = (journey: CreatorJourney) => {
    if (freeRemaining === 0) {
      router.push('/(tabs)/paywall');
    } else {
      router.push({ pathname: '/(tabs)/journey-detail', params: { id: journey.id } });
    }
  };

  const isLocked = freeRemaining === 0;

  if (loading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={LuxuryColors.gold} />
      </View>
    );
  }

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
        <Text style={styles.overline}>Travel Creator Marketplace</Text>
        <Text style={styles.title}>My Trips</Text>
        <Text style={styles.subtitle}>Curated journeys from world-class travel creators</Text>
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
                Unlimited access to every creator's journey on the platform.
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
                {journeyImageSource(journey) ? (
                  <Image
                    source={journeyImageSource(journey)!}
                    style={styles.savedCardImg}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.savedCardImg, { backgroundColor: LuxuryColors.surface }]} />
                )}
                <LinearGradient
                  colors={['transparent', 'rgba(7,17,32,0.88)'] as const}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.savedCardOverlay}>
                  <Text style={styles.savedCardRegion}>{journey.region}</Text>
                  <Text style={styles.savedCardName} numberOfLines={1}>{journey.title}</Text>
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

      {/* ── Saved Experiences ── */}
      {savedExperienceDetails.length > 0 ? (
        <View style={styles.savedSection}>
          <View style={styles.savedHeader}>
            <Text style={styles.savedLabel}>Saved Experiences</Text>
            <Text style={styles.savedCount}>{savedExperienceDetails.length}</Text>
          </View>
          {savedExperienceDetails.map((exp) => (
            <Pressable
              key={exp.id}
              style={styles.expCard}
              onPress={() =>
                router.push({ pathname: '/(tabs)/experience-detail', params: { id: exp.id } })
              }
            >
              <View style={styles.expCardLeft}>
                <Ionicons name="bookmark" size={18} color={LuxuryColors.gold} />
              </View>
              <View style={styles.expCardBody}>
                <Text style={styles.expCardTitle} numberOfLines={1}>{exp.title}</Text>
                <Text style={styles.expCardMeta} numberOfLines={1}>
                  {exp.city ? `${exp.city}, ` : ''}{exp.country} · {exp.duration}
                </Text>
                <Text style={styles.expCardCreator}>by {exp.creatorName}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={LuxuryColors.textTertiary} />
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* ── Journey cards ── */}
      {!hasPublishedExperiences ? (
        <View style={styles.emptyJourneys}>
          <Ionicons name="map-outline" size={36} color={LuxuryColors.textTertiary} />
          <Text style={styles.emptyJourneysTitle}>No creator journeys published yet.</Text>
          <Text style={styles.emptyJourneysSub}>
            Approved creators will publish their first journeys here soon.
          </Text>
        </View>
      ) : null}

      {/* ── My Published Experiences ── */}
      {myPublishedExperiences.length > 0 && (
        <View style={styles.expSection}>
          <Text style={styles.expSectionTitle}>My Published Experiences</Text>
          <Text style={styles.expSectionSub}>Experiences you published from your creator account</Text>
          {myPublishedExperiences.map((exp) => (
            <Pressable
              key={exp.id}
              style={styles.expCard}
              onPress={() =>
                router.push({ pathname: '/(tabs)/experience-detail', params: { id: exp.id } })
              }
            >
              <View style={styles.expCardLeft}>
                <Ionicons name="person-circle-outline" size={22} color={LuxuryColors.gold} />
              </View>
              <View style={styles.expCardBody}>
                <Text style={styles.expCardTitle} numberOfLines={1}>{exp.title}</Text>
                <Text style={styles.expCardMeta} numberOfLines={1}>
                  {exp.city ? `${exp.city}, ` : ''}{exp.country} · {exp.duration}
                </Text>
                <Text style={styles.expCardCreator}>by {exp.creatorName}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={LuxuryColors.textTertiary} />
            </Pressable>
          ))}
        </View>
      )}

      <View style={[styles.padH, styles.cardList]}>
        {featuredExperiences.map((experience) => (
          <Pressable
            key={experience.id}
            style={({ pressed }) => [
              styles.journeyCard,
              pressed && styles.journeyCardPressed,
            ]}
            onPress={() => router.push({ pathname: '/(tabs)/experience-detail', params: { id: experience.id } })}
          >
            {/* Hero image */}
            <View style={styles.imageWrap}>
              {experienceImageSource(experience) ? (
                <Image
                  source={experienceImageSource(experience)!}
                  style={styles.heroImg}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.heroImg, { backgroundColor: LuxuryColors.surface }]} />
              )}
              <LinearGradient
                colors={['transparent', 'rgba(7,17,32,0.80)'] as const}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.regionBadge}>
                <Text style={styles.regionText}>{experienceLocation(experience)}</Text>
              </View>
              <View style={styles.durationBadge}>
                <Ionicons name="time-outline" size={11} color="rgba(255,255,255,0.80)" />
                <Text style={styles.durationText}>{experience.duration || 'Duration TBA'}</Text>
              </View>
              {isLocked && (
                <View style={styles.premiumBadge}>
                  <Ionicons name="diamond" size={8} color={LuxuryColors.gold} />
                  <Text style={styles.premiumBadgeText}>Premium</Text>
                </View>
              )}
            </View>

            {/* Card body */}
            <View style={styles.cardBody}>
              {/* Creator row */}
              <Pressable
                style={styles.creatorRow}
                onPress={(e) => {
                  e.stopPropagation();
                  router.push({ pathname: '/(tabs)/creator-profile', params: { id: experience.creatorId } });
                }}
              >
                <View style={styles.creatorAvatar}>
                  <Text style={styles.creatorAvatarText}>
                    {deriveInitials(experience.creatorName || 'Creator')}
                  </Text>
                </View>
                <Text style={styles.creatorName} numberOfLines={1}>
                  {experience.creatorName || 'Creator'}
                </Text>
              </Pressable>

              <Text style={styles.journeyName}>{experience.title}</Text>

              {/* Duration + season row */}
              <View style={styles.metaRow}>
                <Ionicons name="time-outline" size={11} color={LuxuryColors.textTertiary} />
                <Text style={styles.metaText}>{experience.duration || 'Duration TBA'}</Text>
                <View style={styles.metaDivider} />
                <Ionicons name="sunny-outline" size={11} color={LuxuryColors.textTertiary} />
                <Text style={styles.metaText}>{experience.bestTimeToVisit || 'Any season'}</Text>
              </View>

              {/* Budget + rating + saves + CTA */}
              <View style={styles.cardFooter}>
                <View style={styles.budgetChip}>
                  <Text style={styles.budgetChipText}>{experienceDailyBudget(experience)}</Text>
                </View>
                <View style={styles.savesChip}>
                  <Ionicons name="heart" size={9} color="rgba(212,175,55,0.60)" />
                  <Text style={styles.savesText}>{formatSaves(experience.savedCount)}</Text>
                </View>
                <View style={styles.exploreLink}>
                  <Text style={styles.exploreLinkText}>View Journey</Text>
                  <Ionicons name="chevron-forward" size={11} color={LuxuryColors.gold} />
                </View>
              </View>
            </View>
          </Pressable>
        ))}
      </View>

      {/* ── Load More ── */}
      {expCursor && (
        <View style={{ alignItems: 'center', paddingVertical: LuxurySpacing.xl }}>
          <TouchableOpacity
            style={styles.loadMoreBtn}
            onPress={handleLoadMore}
            disabled={loadingMore}
            activeOpacity={0.8}
          >
            {loadingMore ? (
              <ActivityIndicator color={LuxuryColors.gold} size="small" />
            ) : (
              <Text style={styles.loadMoreText}>Load More</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 64 + insets.bottom }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LuxuryColors.background,
  },
  emptyJourneys: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: LuxurySpacing.xxl,
    paddingHorizontal: LuxurySpacing.xl,
    gap: LuxurySpacing.sm,
  },
  emptyJourneysTitle: {
    fontSize: LuxuryFontSize.lg,
    fontWeight: '600',
    color: LuxuryColors.textSecondary,
    textAlign: 'center',
    marginTop: LuxurySpacing.sm,
  },
  emptyJourneysSub: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
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
  premiumBadge: {
    position: 'absolute',
    top: LuxurySpacing.md,
    right: LuxurySpacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(7,17,32,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.45)',
    borderRadius: LuxuryBorderRadius.full,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  premiumBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 1.0,
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
    gap: 8,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.sm,
  },
  creatorAvatar: {
    width: 28,
    height: 28,
    borderRadius: LuxuryBorderRadius.full,
    backgroundColor: 'rgba(212,175,55,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorAvatarText: {
    fontSize: 9,
    fontWeight: '800',
    color: LuxuryColors.gold,
    letterSpacing: 0.3,
  },
  creatorName: {
    flex: 1,
    fontSize: LuxuryFontSize.sm,
    fontWeight: '600',
    color: LuxuryColors.textSecondary,
    letterSpacing: 0.1,
  },
  creatorRatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(212,175,55,0.10)',
    borderRadius: LuxuryBorderRadius.full,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  creatorRatingText: {
    fontSize: 10,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 11,
    color: LuxuryColors.textTertiary,
    letterSpacing: 0.2,
  },
  metaDivider: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: LuxuryColors.textTertiary,
    opacity: 0.4,
  },
  journeyName: {
    fontSize: LuxuryFontSize.lg,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
    letterSpacing: -0.2,
  },
  overviewSnippet: {
    // kept for any future use; not currently rendered on cards
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textSecondary,
    lineHeight: 19,
    letterSpacing: 0.1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.sm,
    marginTop: 2,
  },
  budgetChip: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: LuxuryBorderRadius.sm,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  budgetChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: LuxuryColors.textTertiary,
    letterSpacing: 0.2,
  },
  savesChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  savesText: {
    fontSize: 10,
    color: 'rgba(212,175,55,0.55)',
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  ratingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 0.2,
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
  expSection: {
    paddingHorizontal: LuxurySpacing.xl,
    paddingTop: LuxurySpacing.xl,
    paddingBottom: LuxurySpacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  expSectionTitle: {
    fontSize: LuxuryFontSize.lg,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
    marginBottom: LuxurySpacing.xs,
  },
  expSectionSub: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textSecondary,
    marginBottom: LuxurySpacing.md,
  },
  expCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LuxuryColors.surface,
    borderWidth: 1,
    borderColor: LuxuryColors.glassBorder,
    borderRadius: LuxuryBorderRadius.md,
    padding: LuxurySpacing.md,
    marginBottom: LuxurySpacing.sm,
    gap: LuxurySpacing.sm,
  },
  expCardLeft: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: LuxuryColors.goldGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expCardBody: {
    flex: 1,
    gap: 2,
  },
  expCardTitle: {
    fontSize: LuxuryFontSize.sm,
    fontWeight: '600',
    color: LuxuryColors.textPrimary,
  },
  expCardMeta: {
    fontSize: LuxuryFontSize.xs,
    color: LuxuryColors.textTertiary,
  },
  expCardCreator: {
    fontSize: LuxuryFontSize.xs,
    color: LuxuryColors.gold,
    fontStyle: 'italic',
  },
  loadMoreBtn: {
    paddingHorizontal: LuxurySpacing.xl,
    paddingVertical: LuxurySpacing.sm,
    borderRadius: LuxuryBorderRadius.full,
    borderWidth: 1,
    borderColor: LuxuryColors.gold,
    minWidth: 140,
    alignItems: 'center',
  },
  loadMoreText: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.gold,
    fontWeight: '600',
  },
});

