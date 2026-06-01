import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LuxuryColors,
  LuxurySpacing,
  LuxuryBorderRadius,
  LuxuryFontSize,
} from '../../constants/luxuryTheme';
import { getApprovedCreators, hasRealCreators, getCurrentUid, getMyApplicationStatus } from '../../lib/creatorService';
import type { ApplicationStatus } from '../../lib/creatorService';
import { getPublishedExperiences } from '../../lib/creatorExperienceService';
import type { Creator } from '../../constants/creators';
import type { CreatorExperience } from '../../constants/creatorExperienceModel';

// ─── Creator Card ─────────────────────────────────────────────────────────────

function CreatorCard({ creator }: { creator: Creator }) {
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.88}
      onPress={() =>
        router.push({ pathname: '/(tabs)/creator-profile', params: { id: creator.id } })
      }
    >
      {/* Avatar */}
      <View style={styles.avatarWrap}>
        <View style={styles.avatar}>
          <Text style={styles.avatarInitials}>{creator.initials}</Text>
        </View>
        <View style={styles.ratingBadge}>
          <Ionicons name="star" size={9} color={LuxuryColors.gold} />
          <Text style={styles.ratingBadgeText}>{creator.rating.toFixed(1)}</Text>
        </View>
      </View>

      {/* Info */}
      <View style={styles.cardInfo}>
        <View style={styles.nameRow}>
          <Text style={styles.cardName}>{creator.name}</Text>
          {creator.isDemo && (
            <View style={styles.demoPill}>
              <Text style={styles.demoPillText}>DEMO</Text>
            </View>
          )}
        </View>
        <Text style={styles.cardBio} numberOfLines={2}>{creator.bio}</Text>

        {/* Stats row */}
        <View style={styles.statsRow}>
          {creator.followers > 0 && (
            <>
              <View style={styles.stat}>
                <Ionicons name="people" size={11} color={LuxuryColors.textTertiary} />
                <Text style={styles.statText}>
                  {creator.followers >= 1000
                    ? `${(creator.followers / 1000).toFixed(1)}K`
                    : String(creator.followers)}
                </Text>
              </View>
              <View style={styles.statDot} />
            </>
          )}
          <View style={styles.stat}>
            <Ionicons name="map" size={11} color={LuxuryColors.textTertiary} />
            <Text style={styles.statText}>
              {creator.totalJourneys} {creator.totalJourneys === 1 ? 'Journey' : 'Journeys'}
            </Text>
          </View>
          {creator.instagram && (
            <>
              <View style={styles.statDot} />
              <View style={styles.stat}>
                <Ionicons name="logo-instagram" size={11} color={LuxuryColors.textTertiary} />
                <Text style={styles.statText}>{creator.instagram}</Text>
              </View>
            </>
          )}
        </View>
      </View>

      {/* Chevron */}
      <Ionicons name="chevron-forward" size={16} color={LuxuryColors.textTertiary} />
    </TouchableOpacity>
  );
}

// ─── Demo notice banner ───────────────────────────────────────────────────────

function DemoNoticeBanner() {
  return (
    <View style={styles.demoNotice}>
      <Ionicons name="information-circle-outline" size={16} color={LuxuryColors.gold} />
      <Text style={styles.demoNoticeText}>
        These are placeholder profiles for UI testing. Real creators are joining soon.
      </Text>
    </View>
  );
}

// ─── Empty state — no creators yet ───────────────────────────────────────────

function EmptyCreatorsState() {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="people-outline" size={36} color={LuxuryColors.textTertiary} />
      </View>
      <Text style={styles.emptyTitle}>Creators are joining soon</Text>
      <Text style={styles.emptySubtitle}>
        We are onboarding the first wave of travel creators. Be among the first to publish
        your journeys and reach thousands of premium travellers.
      </Text>
      <TouchableOpacity
        style={styles.applyBtn}
        onPress={() => router.push('/(tabs)/apply-creator')}
        activeOpacity={0.85}
      >
        <Ionicons name="add-circle-outline" size={16} color={LuxuryColors.background} />
        <Text style={styles.applyBtnText}>Apply as Creator</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();

  const [creators, setCreators] = useState<Creator[]>([]);
  const [experiences, setExperiences] = useState<CreatorExperience[]>([]);
  const [showingDemo, setShowingDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  // true only when Firebase is configured but returned 0 approved creators
  const [reallyEmpty, setReallyEmpty] = useState(false);
  // current user's creator application status (for CTA routing)
  const [myCreatorStatus, setMyCreatorStatus] = useState<ApplicationStatus | 'no-auth' | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);

      const uid = getCurrentUid();
      Promise.all([
        getApprovedCreators(),
        hasRealCreators(),
        getPublishedExperiences(),
        uid ? getMyApplicationStatus(uid) : Promise.resolve('none' as const),
      ]).then(
        ([list, anyReal, exps, myStatus]) => {
          if (cancelled) return;
          const allDemo = (list as Creator[]).every((c) => c.isDemo);
          setCreators(list as Creator[]);
          setExperiences(exps as CreatorExperience[]);
          setShowingDemo(allDemo);
          // Empty state: Firebase configured but zero real creators found
          setReallyEmpty(anyReal === false && (list as Creator[]).length === 0);
          setMyCreatorStatus(uid ? (myStatus as ApplicationStatus) : 'no-auth');
          setLoading(false);
        }
      ).catch(() => {
        if (!cancelled) setLoading(false);
      });

      return () => { cancelled = true; };
    }, [])
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + LuxurySpacing.lg, paddingBottom: 80 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerEyebrow}>TRAVEL CREATORS</Text>
          <Text style={styles.headerTitle}>Discover</Text>
          <Text style={styles.headerSub}>
            Browse handcrafted journeys from independent travel creators
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator
            color={LuxuryColors.gold}
            style={styles.loader}
          />
        ) : reallyEmpty ? (
          <EmptyCreatorsState />
        ) : (
          <>
            {/* Demo notice — shown while only seed data exists */}
            {showingDemo && <DemoNoticeBanner />}

            {/* Creator count */}
            {!showingDemo && (
              <View style={styles.countRow}>
                <View style={styles.countBadge}>
                  <Ionicons name="people" size={13} color={LuxuryColors.gold} />
                  <Text style={styles.countText}>
                    {creators.length} Creator{creators.length !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
            )}

            {/* Creator list */}
            <View style={styles.list}>
              {creators.map((creator) => (
                <CreatorCard key={creator.id} creator={creator} />
              ))}
            </View>

            {/* Creator CTA — routes to dashboard for approved creators, apply form otherwise */}
            {myCreatorStatus === 'approved' ? (
              <>
                <TouchableOpacity
                  style={styles.applyCtaRow}
                  onPress={() => router.push('/(tabs)/creator-dashboard')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="briefcase-outline" size={16} color={LuxuryColors.gold} />
                  <Text style={styles.applyCtaText}>Creator Dashboard</Text>
                  <Ionicons name="chevron-forward" size={14} color={LuxuryColors.textTertiary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.applyCtaRow}
                  onPress={() => router.push('/(tabs)/create-experience')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add-circle-outline" size={16} color={LuxuryColors.gold} />
                  <Text style={styles.applyCtaText}>Create Experience</Text>
                  <Ionicons name="chevron-forward" size={14} color={LuxuryColors.textTertiary} />
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={styles.applyCtaRow}
                onPress={() => router.push('/(tabs)/apply-creator')}
                activeOpacity={0.8}
              >
                <Ionicons name="add-circle-outline" size={16} color={LuxuryColors.gold} />
                <Text style={styles.applyCtaText}>Apply as Creator</Text>
                <Ionicons name="chevron-forward" size={14} color={LuxuryColors.textTertiary} />
              </TouchableOpacity>
            )}

            {/* Published Experiences section */}
            {experiences.length > 0 && (
              <View style={styles.expSection}>
                <Text style={styles.expSectionTitle}>Creator Experiences</Text>
                <Text style={styles.expSectionSub}>Curated travel blueprints from creators</Text>
                {experiences.map((exp) => (
                  <TouchableOpacity
                    key={exp.id}
                    style={styles.expCard}
                    activeOpacity={0.85}
                    onPress={() =>
                      router.push({ pathname: '/(tabs)/experience-detail', params: { id: exp.id } })
                    }
                  >
                    <View style={styles.expCardLeft}>
                      <Ionicons name="globe-outline" size={22} color={LuxuryColors.gold} />
                    </View>
                    <View style={styles.expCardBody}>
                      <Text style={styles.expCardTitle} numberOfLines={1}>{exp.title}</Text>
                      <Text style={styles.expCardMeta} numberOfLines={1}>
                        {exp.city ? `${exp.city}, ` : ''}{exp.country} · {exp.duration}
                      </Text>
                      <Text style={styles.expCardCreator} numberOfLines={1}>by {exp.creatorName}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={LuxuryColors.textTertiary} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: LuxuryColors.background,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: LuxurySpacing.xl,
  },
  loader: {
    marginTop: 80,
  },

  // Header
  header: { marginBottom: LuxurySpacing.xl },
  headerEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 2,
    marginBottom: LuxurySpacing.xs,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: LuxuryColors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: LuxurySpacing.sm,
  },
  headerSub: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textSecondary,
    lineHeight: 20,
  },

  // Demo notice
  demoNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(212,175,55,0.06)',
    borderRadius: LuxuryBorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.15)',
    padding: 12,
    marginBottom: LuxurySpacing.lg,
  },
  demoNoticeText: {
    flex: 1,
    color: LuxuryColors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },

  // Count badge
  countRow: { marginBottom: LuxurySpacing.lg },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.xs,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.20)',
    borderRadius: LuxuryBorderRadius.full,
    paddingHorizontal: LuxurySpacing.md,
    paddingVertical: 5,
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 0.3,
  },

  // List
  list: { gap: LuxurySpacing.md, marginBottom: LuxurySpacing.xl },

  // Card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.md,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: LuxuryBorderRadius.xl,
    padding: LuxurySpacing.md,
  },

  // Avatar
  avatarWrap: { position: 'relative', alignSelf: 'flex-start' },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: LuxuryBorderRadius.full,
    backgroundColor: 'rgba(212,175,55,0.10)',
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: LuxuryFontSize.md,
    fontWeight: '800',
    color: LuxuryColors.gold,
    letterSpacing: 0.5,
  },
  ratingBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: LuxuryColors.background,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    borderRadius: LuxuryBorderRadius.full,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  ratingBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: LuxuryColors.gold,
    letterSpacing: 0.2,
  },

  // Card body
  cardInfo: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardName: {
    fontSize: LuxuryFontSize.md,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
    letterSpacing: 0.1,
  },
  demoPill: {
    backgroundColor: 'rgba(122,118,104,0.2)',
    borderRadius: LuxuryBorderRadius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  demoPillText: {
    color: LuxuryColors.textTertiary,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  cardBio: {
    fontSize: 12,
    color: LuxuryColors.textSecondary,
    lineHeight: 17,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 2,
  },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statText: { fontSize: 10, fontWeight: '600', color: LuxuryColors.textTertiary },
  statDot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: LuxuryColors.textTertiary,
    opacity: 0.5,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 32,
    gap: 16,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: LuxuryBorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    color: LuxuryColors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    color: LuxuryColors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: LuxuryColors.gold,
    borderRadius: LuxuryBorderRadius.md,
    paddingHorizontal: 24,
    paddingVertical: 14,
    marginTop: 8,
  },
  applyBtnText: {
    color: LuxuryColors.background,
    fontWeight: '800',
    fontSize: 15,
  },

  // Apply CTA row (bottom of filled list)
  applyCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  applyCtaText: {
    flex: 1,
    color: LuxuryColors.gold,
    fontSize: 14,
    fontWeight: '600',
  },
  expSection: {
    marginTop: LuxurySpacing.xl,
    paddingTop: LuxurySpacing.lg,
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
});
