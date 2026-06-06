/**
 * creator-dashboard.tsx
 *
 * Creator workspace — only accessible to approved creators.
 * Part of the Creator Experiences Marketplace.
 *
 * Sections (tab switcher):
 *   Overview        — stat cards (total, published, pending, drafts)
 *   My Experiences  — list with cover, title, country, status + actions
 *   Subscription    — display-only plan cards (no payments yet)
 *   Analytics       — placeholder with 0 values
 *
 * "Create Experience" navigates to create-experience.tsx.
 *
 * Navigation entry points:
 *   apply-creator.tsx (approved state) → this screen
 *   profile.tsx creator menu item      → this screen
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  FlatList,
  RefreshControl,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirebaseApp } from '../../lib/firebase';
import {
  LuxuryColors,
  LuxurySpacing,
  LuxuryBorderRadius,
  LuxuryFontSize,
} from '../../constants/luxuryTheme';
import {
  getCurrentUid,
  getMyApprovedCreatorProfile,
  deriveInitials,
  subscribeCreatorById,
} from '../../lib/creatorService';
import {
  getCreatorExperiences,
  updateExperience,
  publishExperience,
  deleteExperience,
} from '../../lib/creatorExperienceService';
import {
  statusLabel,
  statusColor,
} from '../../constants/creatorExperienceModel';
import type { Creator } from '../../constants/creators';
import type { CreatorExperience } from '../../constants/creatorExperienceModel';
import { BarChart } from 'react-native-chart-kit';
import { isValidRemoteImageUrl } from '../../lib/imageFallback';

// ─── Section types ────────────────────────────────────────────────────────────

type Section = 'overview' | 'experiences' | 'subscription' | 'analytics';
type ExpFilter = 'all' | 'drafts' | 'published';

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'experiences', label: 'My Experiences' },
  { key: 'subscription', label: 'Subscription' },
  { key: 'analytics', label: 'Analytics' },
];

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon }: { label: string; value: number; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={statStyles.card}>
      <Ionicons name={icon} size={20} color={LuxuryColors.gold} style={statStyles.icon} />
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: LuxuryColors.surface,
    borderRadius: LuxuryBorderRadius.lg,
    borderWidth: 1,
    borderColor: LuxuryColors.divider,
    padding: LuxurySpacing.md,
    alignItems: 'center',
    gap: LuxurySpacing.xs,
  },
  icon: {
    marginBottom: LuxurySpacing.xs,
  },
  value: {
    fontSize: LuxuryFontSize.xxl,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
  },
  label: {
    fontSize: LuxuryFontSize.xs,
    color: LuxuryColors.textTertiary,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
});

// ─── Experience row ──────────────────────────────────────────────────────────

function formatRelativeDate(ts: number | null): string | null {
  if (!ts) return null;
  const diff = Date.now() - ts;
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Updated today';
  if (days === 1) return 'Updated yesterday';
  if (days < 30) return `Updated ${days}d ago`;
  return `Updated ${new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function ExperienceRow({
  experience,
  onDelete,
  onSubmitForReview,
  onPublish,
  onUnpublish,
}: {
  experience: CreatorExperience;
  onDelete: () => void;
  onSubmitForReview: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
}) {
  const imgSrc = isValidRemoteImageUrl(experience.coverImage)
    ? { uri: experience.coverImage!.trim() }
    : null;
  const color = statusColor(experience.status);
  const label = statusLabel(experience.status);

  return (
    <View style={rowStyles.container}>
      {/* Cover thumbnail */}
      {imgSrc ? (
        <Image source={imgSrc} style={rowStyles.thumb} />
      ) : (
        <View style={[rowStyles.thumb, rowStyles.thumbPlaceholder]}>
          <Ionicons name="image-outline" size={22} color={LuxuryColors.textTertiary} />
        </View>
      )}

      {/* Info */}
      <View style={rowStyles.info}>
        <Text style={rowStyles.title} numberOfLines={2}>{experience.title}</Text>
        <Text style={rowStyles.country} numberOfLines={1}>
          {experience.city ? `${experience.city}, ` : ''}{experience.country || '—'}
        </Text>
        <View style={[rowStyles.badge, { borderColor: `${color}40`, backgroundColor: `${color}12` }]}>
          <Text style={[rowStyles.badgeText, { color }]}>{label}</Text>
        </View>
        {experience.updatedAt ? (
          <Text style={rowStyles.updatedAt}>{formatRelativeDate(experience.updatedAt)}</Text>
        ) : null}
      </View>

      {/* Actions */}
      <View style={rowStyles.actions}>
        {experience.status === 'published' && (
          <TouchableOpacity
            style={rowStyles.actionBtn}
            onPress={() =>
              router.push({ pathname: '/(tabs)/experience-detail', params: { id: experience.id } })
            }
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="eye-outline" size={18} color={LuxuryColors.textSecondary} />
          </TouchableOpacity>
        )}

        {experience.status === 'published' && (
          <TouchableOpacity
            style={rowStyles.actionBtn}
            onPress={onUnpublish}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-undo-outline" size={18} color={LuxuryColors.gold} />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={rowStyles.actionBtn}
          onPress={() =>
            router.push({ pathname: '/(tabs)/create-experience', params: { id: experience.id } })
          }
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="create-outline" size={18} color={LuxuryColors.textSecondary} />
        </TouchableOpacity>

        {experience.status === 'draft' && (
          <TouchableOpacity
            style={rowStyles.actionBtn}
            onPress={onSubmitForReview}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="paper-plane-outline" size={18} color={LuxuryColors.gold} />
          </TouchableOpacity>
        )}

        {experience.status !== 'published' && (
          <TouchableOpacity
            style={rowStyles.actionBtn}
            onPress={onPublish}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color={LuxuryColors.success} />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={rowStyles.actionBtn}
          onPress={onDelete}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="trash-outline" size={18} color={LuxuryColors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LuxuryColors.surface,
    borderRadius: LuxuryBorderRadius.md,
    borderWidth: 1,
    borderColor: LuxuryColors.divider,
    padding: LuxurySpacing.sm,
    marginBottom: LuxurySpacing.sm,
    gap: LuxurySpacing.sm,
  },
  thumb: {
    width: 60,
    height: 60,
    borderRadius: LuxuryBorderRadius.sm,
  },
  thumbPlaceholder: {
    backgroundColor: LuxuryColors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: LuxuryFontSize.sm,
    fontWeight: '600',
    color: LuxuryColors.textPrimary,
    lineHeight: 20,
  },
  country: {
    fontSize: LuxuryFontSize.xs,
    color: LuxuryColors.textTertiary,
  },
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: LuxuryBorderRadius.full,
    paddingHorizontal: LuxurySpacing.sm,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  updatedAt: {
    fontSize: 11,
    color: LuxuryColors.textTertiary,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'column',
    gap: LuxurySpacing.xs,
    alignItems: 'center',
  },
  actionBtn: {
    padding: LuxurySpacing.xs,
  },
});

// ─── Access gate ──────────────────────────────────────────────────────────────

type AccessStatus = 'no-auth' | 'not-creator' | 'approved';

function AccessGateView({ status, onBack }: { status: AccessStatus; onBack: () => void }) {
  const insets = useSafeAreaInsets();

  const cfg: Record<AccessStatus, { icon: keyof typeof Ionicons.glyphMap; color: string; title: string; body: string; cta: string; ctaAction: () => void }> = {
    'no-auth': {
      icon: 'person-circle-outline',
      color: LuxuryColors.textTertiary,
      title: 'Sign In Required',
      body: 'Sign in to access your creator dashboard.',
      cta: 'Sign In',
      ctaAction: () => router.replace('/(auth)/login'),
    },
    'not-creator': {
      icon: 'create-outline',
      color: LuxuryColors.gold,
      title: 'Become a Creator',
      body: 'Go to your Profile to activate your free creator account instantly — no approval needed.',
      cta: 'Go to Profile',
      ctaAction: () => router.push('/(tabs)/profile'),
    },
    approved: {
      icon: 'checkmark-circle',
      color: LuxuryColors.success,
      title: 'Approved',
      body: '',
      cta: '',
      ctaAction: onBack,
    },
  };

  const c = cfg[status];

  return (
    <View style={[gateStyles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
      <TouchableOpacity onPress={onBack} style={gateStyles.backBtn}>
        <Ionicons name="arrow-back" size={22} color={LuxuryColors.textPrimary} />
      </TouchableOpacity>
      <View style={gateStyles.body}>
        <View style={[gateStyles.iconWrap, { borderColor: `${c.color}22` }]}>
          <Ionicons name={c.icon} size={48} color={c.color} />
        </View>
        <Text style={gateStyles.title}>{c.title}</Text>
        <Text style={gateStyles.bodyText}>{c.body}</Text>
        {c.cta !== '' && (
          <TouchableOpacity style={gateStyles.cta} onPress={c.ctaAction} activeOpacity={0.85}>
            <Text style={gateStyles.ctaText}>{c.cta}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const gateStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LuxuryColors.background,
    paddingHorizontal: LuxurySpacing.lg,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: LuxurySpacing.xxxl,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: LuxurySpacing.lg,
  },
  title: {
    fontSize: LuxuryFontSize.xl,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
    textAlign: 'center',
    marginBottom: LuxurySpacing.sm,
  },
  bodyText: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: LuxurySpacing.lg,
    marginBottom: LuxurySpacing.xl,
  },
  cta: {
    backgroundColor: LuxuryColors.gold,
    borderRadius: LuxuryBorderRadius.lg,
    paddingVertical: LuxurySpacing.md,
    paddingHorizontal: LuxurySpacing.xl,
  },
  ctaText: {
    fontSize: LuxuryFontSize.md,
    fontWeight: '700',
    color: LuxuryColors.background,
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CreatorDashboardScreen() {
  const insets = useSafeAreaInsets();

  // ── Auth + access gate ───────────────────────────────────────────────
  const [checking, setChecking] = useState(true);
  const [creator, setCreator] = useState<Creator | null>(null);
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null);

  // ── Experiences data ───────────────────────────────────────
  const [experiences, setExperiences] = useState<CreatorExperience[]>([]);
  const [loadingExperiences, setLoadingExperiences] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ── Active section ───────────────────────────────────────────────────
  const [activeSection, setActiveSection] = useState<Section>('overview');
  const [activeExpFilter, setActiveExpFilter] = useState<ExpFilter>('all');

  // ── Load creator profile ─────────────────────────────────────────────
  const loadCreatorProfile = useCallback(async () => {
    const uid = getCurrentUid();
    console.log('[Dashboard] current uid:', uid);
    if (!uid) {
      setAccessStatus('no-auth');
      setChecking(false);
      return;
    }
    const profile = await getMyApprovedCreatorProfile(uid);
    console.log('[Dashboard] creator profile:', profile ? `id=${profile.id} name=${profile.name}` : 'null');
    if (profile) {
      setCreator(profile);
      setAccessStatus('approved');
      console.log('[Dashboard] access: granted');
    } else {
      console.log('[Dashboard] no creator profile → not-creator');
      setAccessStatus('not-creator');
    }
    setChecking(false);
  }, []);

  // ── Load experiences ─────────────────────────────────────────
  const loadExperiences = useCallback(async (creatorId: string, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoadingExperiences(true);
    try {
      console.log('[Dashboard] loading experiences for creatorId:', creatorId);
      const data = await getCreatorExperiences(creatorId);
      console.log('[Dashboard] experiences loaded:', data.length);
      setExperiences(data);
    } catch {
      setExperiences([]);
    } finally {
      setLoadingExperiences(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setChecking(true);
      loadCreatorProfile();
    }, [loadCreatorProfile])
  );

  useEffect(() => {
    if (creator?.id) {
      loadExperiences(creator.id);
    }
  }, [creator?.id, loadExperiences]);

  useEffect(() => {
    if (!creator?.id) return;
    return subscribeCreatorById(creator.id, (liveCreator) => {
      if (liveCreator) setCreator(liveCreator);
    });
  }, [creator?.id]);

  // ── Clear state and reload on auth UID change so stale previous-account
  //    data never remains visible after signing in as a different user.
  useEffect(() => {
    const auth = getAuth(getFirebaseApp());
    return onAuthStateChanged(auth, () => {
      setCreator(null);
      setExperiences([]);
      setAccessStatus(null);
      setChecking(true);
      loadCreatorProfile();
    });
  }, [loadCreatorProfile]);

  // ── Stats ──────────────────────────────────────────────
  const totalExperiences = experiences.length;
  const publishedCount = experiences.filter((e) => e.status === 'published').length;
  const pendingCount = experiences.filter((e) => e.status === 'pending_review').length;
  const draftCount = experiences.filter((e) => e.status === 'draft').length;
  const followersCount = creator?.followers ?? 0;
  const totalViews = experiences.reduce((sum, e) => sum + (e.views ?? 0), 0);
  const totalUnlocks = experiences.reduce((sum, e) => sum + (e.unlocks ?? 0), 0);
  const totalSaves = experiences.reduce((sum, e) => sum + (e.savedCount ?? 0), 0);

  // ── Render states ─────────────────────────────────────────────────────
  if (checking) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={LuxuryColors.gold} size="large" />
      </View>
    );
  }

  if (accessStatus && accessStatus !== 'approved') {
    return (
      <AccessGateView
        status={accessStatus}
        onBack={() => router.back()}
      />
    );
  }

  const creatorName = creator?.name ?? 'Creator';
  const creatorInitials = creator ? deriveInitials(creator.name) : '??';

  // ─── Section: Overview ────────────────────────────────────────────────
  function renderOverview() {
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={sectionStyles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => creator?.id && loadExperiences(creator.id, true)}
            tintColor={LuxuryColors.gold}
          />
        }
      >
        {/* Stat grid */}
        <View style={sectionStyles.statGrid}>
          <View style={sectionStyles.statRow}>
            <StatCard label="Total Experiences" value={totalExperiences} icon="globe-outline" />
            <View style={{ width: LuxurySpacing.sm }} />
            <StatCard label="Published" value={publishedCount} icon="checkmark-circle-outline" />
          </View>
          <View style={[sectionStyles.statRow, { marginTop: LuxurySpacing.sm }]}>
            <StatCard label="Drafts" value={draftCount} icon="document-text-outline" />
            <View style={{ width: LuxurySpacing.sm }} />
            <StatCard label="Pending Review" value={pendingCount} icon="time-outline" />
          </View>
          <View style={[sectionStyles.statRow, { marginTop: LuxurySpacing.sm }]}>
            <StatCard label="Total Views" value={totalViews} icon="eye-outline" />
            <View style={{ width: LuxurySpacing.sm }} />
            <StatCard label="Followers" value={followersCount} icon="people-outline" />
          </View>
        </View>

        {/* Create experience CTA */}
        <TouchableOpacity
          style={sectionStyles.createBtn}
          onPress={() => router.push('/(tabs)/create-experience')}
          activeOpacity={0.85}
        >
          <Ionicons name="add-circle-outline" size={22} color={LuxuryColors.background} />
          <Text style={sectionStyles.createBtnText}>Create New Experience</Text>
        </TouchableOpacity>

        {/* Recent experiences preview */}
        {experiences.length > 0 && (
          <View style={sectionStyles.recentSection}>
            <Text style={sectionStyles.recentTitle}>Recent Experiences</Text>
            {experiences.slice(0, 3).map((exp) => (
              <ExperienceRow
                key={exp.id}
                experience={exp}
                onDelete={() => handleDelete(exp.id, exp.title)}
                onSubmitForReview={() => handleSubmitForReview(exp.id, exp.title)}
                onPublish={() => handlePublish(exp.id, exp.title)}
                onUnpublish={() => handleUnpublish(exp.id, exp.title)}
              />
            ))}
            {experiences.length > 3 && (
              <TouchableOpacity onPress={() => setActiveSection('experiences')} activeOpacity={0.7}>
                <Text style={sectionStyles.viewAllText}>
                  View all {experiences.length} experiences →
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {experiences.length === 0 && !loadingExperiences && (
          <View style={sectionStyles.emptyState}>
            <Ionicons name="globe-outline" size={40} color={LuxuryColors.textTertiary} />
            <Text style={sectionStyles.emptyTitle}>No experiences yet</Text>
            <Text style={sectionStyles.emptyBody}>
              Create your first travel experience to get started.
            </Text>
          </View>
        )}
      </ScrollView>
    );
  }

  // ─── Section: My Experiences ──────────────────────────────────────────
  function renderExperiences() {
    if (loadingExperiences) {
      return (
        <View style={sectionStyles.centeredLoader}>
          <ActivityIndicator color={LuxuryColors.gold} size="large" />
        </View>
      );
    }

    const expFilter = activeExpFilter;
    const filtered =
      expFilter === 'drafts'
        ? experiences.filter((e) => e.status === 'draft')
        : expFilter === 'published'
        ? experiences.filter((e) => e.status === 'published')
        : experiences;

    const EXP_FILTERS: { key: ExpFilter; label: string }[] = [
      { key: 'all', label: `All (${experiences.length})` },
      { key: 'drafts', label: `Drafts (${draftCount})` },
      { key: 'published', label: `Published (${publishedCount})` },
    ];

    return (
      <FlatList
        data={filtered}
        keyExtractor={(e) => e.id}
        contentContainerStyle={sectionStyles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => creator?.id && loadExperiences(creator.id, true)}
            tintColor={LuxuryColors.gold}
          />
        }
        ListHeaderComponent={
          <View>
            <TouchableOpacity
              style={sectionStyles.createBtn}
              onPress={() => router.push('/(tabs)/create-experience')}
              activeOpacity={0.85}
            >
              <Ionicons name="add-circle-outline" size={22} color={LuxuryColors.background} />
              <Text style={sectionStyles.createBtnText}>+ Create Experience</Text>
            </TouchableOpacity>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={sectionStyles.expFilterBar}
              contentContainerStyle={sectionStyles.expFilterContent}
            >
              {EXP_FILTERS.map((f) => (
                <TouchableOpacity
                  key={f.key}
                  style={[sectionStyles.expFilterChip, activeExpFilter === f.key && sectionStyles.expFilterChipActive]}
                  onPress={() => setActiveExpFilter(f.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[sectionStyles.expFilterText, activeExpFilter === f.key && sectionStyles.expFilterTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          <View style={sectionStyles.emptyState}>
            <Ionicons name="globe-outline" size={40} color={LuxuryColors.textTertiary} />
            <Text style={sectionStyles.emptyTitle}>No experiences</Text>
            <Text style={sectionStyles.emptyBody}>
              {expFilter === 'all'
                ? 'Tap "+ Create Experience" above to get started.'
                : `No ${expFilter} experiences yet.`}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <ExperienceRow
            experience={item}
            onDelete={() => handleDelete(item.id, item.title)}
            onSubmitForReview={() => handleSubmitForReview(item.id, item.title)}
            onPublish={() => handlePublish(item.id, item.title)}
            onUnpublish={() => handleUnpublish(item.id, item.title)}
          />
        )}
      />
    );
  }

  // ─── Section: Subscription ────────────────────────────────────────────
  function renderSubscription() {
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={sectionStyles.content}>
        <Text style={sectionStyles.sectionIntro}>
          Choose the plan that fits your content style.
        </Text>

        {/* Creator Pro card */}
        <View style={[planStyles.card, planStyles.cardPro]}>
          <View style={planStyles.badge}>
            <Text style={planStyles.badgeText}>MOST POPULAR</Text>
          </View>
          <Text style={planStyles.planName}>Creator Pro</Text>
          <Text style={planStyles.planPrice}>$—/month</Text>
          <Text style={planStyles.planPriceNote}>Pricing coming soon</Text>
          <View style={planStyles.divider} />
          {[
            'Unlimited experience publications',
            'Priority editorial review',
            'Advanced analytics dashboard',
            'Featured placement on Explore',
            'Direct subscriber messaging',
          ].map((feature) => (
            <View key={feature} style={planStyles.featureRow}>
              <Ionicons name="checkmark-circle" size={16} color={LuxuryColors.success} />
              <Text style={planStyles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        {/* Creator Free card */}
        <View style={planStyles.card}>
          <Text style={planStyles.planName}>Creator Free</Text>
          <Text style={planStyles.planPrice}>Free</Text>
          <Text style={planStyles.planPriceNote}>Get started at no cost</Text>
          <View style={planStyles.divider} />
          {[
            'Up to 3 experience publications',
            'Standard editorial review',
            'Basic analytics',
            'Creator profile page',
          ].map((feature) => (
            <View key={feature} style={planStyles.featureRow}>
              <Ionicons name="checkmark-circle" size={16} color={LuxuryColors.success} />
              <Text style={planStyles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        <View style={planStyles.comingSoonBanner}>
          <Ionicons name="card-outline" size={20} color={LuxuryColors.gold} />
          <Text style={planStyles.comingSoonText}>Payment integration coming soon</Text>
        </View>
      </ScrollView>
    );
  }

  // ─── Section: Analytics ───────────────────────────────────────────────
  function renderAnalytics() {
    const published = experiences.filter((e) => e.status === 'published');
    const top5 = [...published]
      .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
      .slice(0, 5);
    const hasData = top5.length > 0;

    const chartWidth = Dimensions.get('window').width - LuxurySpacing.lg * 2;

    const chartConfig = {
      backgroundColor: LuxuryColors.surface,
      backgroundGradientFrom: LuxuryColors.surface,
      backgroundGradientTo: LuxuryColors.surface,
      decimalPlaces: 0,
      color: (opacity = 1) => `rgba(212, 175, 55, ${opacity})`,
      labelColor: (opacity = 1) => `rgba(122, 118, 104, ${opacity})`,
      barPercentage: 0.6,
      propsForBackgroundLines: { stroke: '#141E33' },
    };

    const truncate = (s: string) => (s.length > 7 ? s.slice(0, 7) + '\u2026' : s);

    const viewsData = {
      labels: top5.map((e) => truncate(e.title)),
      datasets: [{ data: top5.map((e) => e.views ?? 0) }],
    };

    const unlocksData = {
      labels: top5.map((e) => truncate(e.title)),
      datasets: [{ data: top5.map((e) => e.unlocks ?? 0) }],
    };

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={sectionStyles.content}>
        <Text style={sectionStyles.sectionIntro}>
          Engagement stats across all your published experiences.
        </Text>

        {/* Aggregate stat cards */}
        <View style={sectionStyles.statGrid}>
          <View style={sectionStyles.statRow}>
            <StatCard label="Total Views" value={totalViews} icon="eye-outline" />
            <View style={{ width: LuxurySpacing.sm }} />
            <StatCard label="Total Unlocks" value={totalUnlocks} icon="lock-open-outline" />
          </View>
          <View style={[sectionStyles.statRow, { marginTop: LuxurySpacing.sm }]}>
            <StatCard label="Total Saves" value={totalSaves} icon="bookmark-outline" />
            <View style={{ width: LuxurySpacing.sm }} />
            <StatCard label="Published" value={publishedCount} icon="checkmark-circle-outline" />
          </View>
        </View>

        {/* Per-experience charts or empty state */}
        {hasData ? (
          <>
            <Text style={analyticsStyles.chartTitle}>Views — Top Experiences</Text>
            <View style={analyticsStyles.chartWrap}>
              <BarChart
                data={viewsData}
                width={chartWidth}
                height={200}
                chartConfig={chartConfig}
                fromZero
                showValuesOnTopOfBars
                style={analyticsStyles.chart}
                yAxisLabel=""
                yAxisSuffix=""
              />
            </View>

            <Text style={analyticsStyles.chartTitle}>Unlocks — Top Experiences</Text>
            <View style={analyticsStyles.chartWrap}>
              <BarChart
                data={unlocksData}
                width={chartWidth}
                height={200}
                chartConfig={chartConfig}
                fromZero
                showValuesOnTopOfBars
                style={analyticsStyles.chart}
                yAxisLabel=""
                yAxisSuffix=""
              />
            </View>
          </>
        ) : (
          <View style={analyticsStyles.emptyState}>
            <Ionicons name="bar-chart-outline" size={40} color={LuxuryColors.textTertiary} />
            <Text style={analyticsStyles.emptyTitle}>No data yet</Text>
            <Text style={analyticsStyles.emptyBody}>
              Publish an experience to start seeing engagement charts.
            </Text>
          </View>
        )}
      </ScrollView>
    );
  }

  // ── Action handlers ──────────────────────────────────────────
  function handleDelete(experienceId: string, title: string) {
    Alert.alert(
      'Delete Experience',
      `Delete "${title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteExperience(experienceId);
              if (creator?.id) loadExperiences(creator.id);
            } catch (e: unknown) {
              Alert.alert('Delete Failed', e instanceof Error ? e.message : 'Unknown error');
            }
          },
        },
      ]
    );
  }

  function handlePublish(experienceId: string, title: string) {
    Alert.alert(
      'Publish Experience',
      `Publish "${title}"? It will immediately be visible to all travelers.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Publish',
          onPress: async () => {
            try {
              await publishExperience(experienceId);
              if (creator?.id) loadExperiences(creator.id);
            } catch (e: unknown) {
              Alert.alert('Publish Failed', e instanceof Error ? e.message : 'Unknown error');
            }
          },
        },
      ]
    );
  }

  function handleUnpublish(experienceId: string, title: string) {
    Alert.alert(
      'Unpublish Experience',
      `Unpublish "${title}"? It will be moved to Drafts and removed from public listings.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unpublish',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateExperience(experienceId, {
                status: 'draft',
                published: false,
                publishedAt: null,
              });

              setExperiences((prev) =>
                prev.map((experience) =>
                  experience.id === experienceId
                    ? {
                        ...experience,
                        status: 'draft',
                        published: false,
                        publishedAt: null,
                        updatedAt: Date.now(),
                      }
                    : experience
                )
              );
            } catch (e: unknown) {
              Alert.alert('Unpublish Failed', e instanceof Error ? e.message : 'Unknown error');
            }
          },
        },
      ]
    );
  }

  function handleSubmitForReview(experienceId: string, title: string) {
    Alert.alert(
      'Submit for Review',
      `Submit "${title}" for editorial review? It will not be visible until approved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            try {
              await updateExperience(experienceId, { status: 'pending_review' });
              if (creator?.id) loadExperiences(creator.id);
            } catch (e: unknown) {
              Alert.alert('Submit Failed', e instanceof Error ? e.message : 'Unknown error');
            }
          },
        },
      ]
    );
  }

  // ─── Main render ──────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Fixed Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={LuxuryColors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={styles.creatorAvatar}>
            {creator?.avatar ? (
              <Image source={{ uri: creator.avatar }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarInitials}>{creatorInitials}</Text>
            )}
          </View>
          <View>
            <Text style={styles.headerName} numberOfLines={1}>{creatorName}</Text>
            <Text style={styles.headerRole}>Creator Dashboard</Text>
          </View>
        </View>

        <View style={{ width: 40 }} />
      </View>

      {/* ── Section Switcher ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {SECTIONS.map((s) => (
          <TouchableOpacity
            key={s.key}
            style={[styles.tab, activeSection === s.key && styles.tabActive]}
            onPress={() => setActiveSection(s.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeSection === s.key && styles.tabTextActive]}>
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.tabDivider} />

      {/* ── Section Body ── */}
      <View style={[styles.body, { paddingBottom: insets.bottom }]}>
        {activeSection === 'overview' && renderOverview()}
        {activeSection === 'experiences' && renderExperiences()}
        {activeSection === 'subscription' && renderSubscription()}
        {activeSection === 'analytics' && renderAnalytics()}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: LuxuryColors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: LuxuryColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: LuxurySpacing.lg,
    paddingVertical: LuxurySpacing.md,
    borderBottomWidth: 1,
    borderBottomColor: LuxuryColors.divider,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.sm,
  },
  creatorAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: `${LuxuryColors.gold}22`,
    borderWidth: 1,
    borderColor: `${LuxuryColors.gold}50`,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  avatarInitials: {
    fontSize: LuxuryFontSize.sm,
    fontWeight: '700',
    color: LuxuryColors.gold,
  },
  headerName: {
    fontSize: LuxuryFontSize.md,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
  },
  headerRole: {
    fontSize: LuxuryFontSize.xs,
    color: LuxuryColors.gold,
    letterSpacing: 0.5,
  },
  tabBar: {
    flexGrow: 0,
    backgroundColor: LuxuryColors.background,
  },
  tabBarContent: {
    paddingHorizontal: LuxurySpacing.lg,
    paddingTop: LuxurySpacing.sm,
    gap: LuxurySpacing.xs,
  },
  tab: {
    paddingHorizontal: LuxurySpacing.md,
    paddingVertical: LuxurySpacing.sm,
    borderRadius: LuxuryBorderRadius.full,
    borderWidth: 1,
    borderColor: LuxuryColors.divider,
    marginRight: LuxurySpacing.xs,
    marginBottom: LuxurySpacing.sm,
  },
  tabActive: {
    borderColor: LuxuryColors.gold,
    backgroundColor: `${LuxuryColors.gold}14`,
  },
  tabText: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textTertiary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: LuxuryColors.gold,
    fontWeight: '600',
  },
  tabDivider: {
    height: 1,
    backgroundColor: LuxuryColors.divider,
  },
  body: {
    flex: 1,
  },
});

const sectionStyles = StyleSheet.create({
  content: {
    padding: LuxurySpacing.lg,
  },
  listContent: {
    padding: LuxurySpacing.lg,
  },
  centeredLoader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statGrid: {
    marginBottom: LuxurySpacing.lg,
  },
  statRow: {
    flexDirection: 'row',
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: LuxurySpacing.sm,
    backgroundColor: LuxuryColors.gold,
    borderRadius: LuxuryBorderRadius.lg,
    paddingVertical: LuxurySpacing.md,
    marginBottom: LuxurySpacing.lg,
  },
  createBtnText: {
    fontSize: LuxuryFontSize.md,
    fontWeight: '700',
    color: LuxuryColors.background,
  },
  recentSection: {
    marginTop: LuxurySpacing.xs,
  },
  recentTitle: {
    fontSize: LuxuryFontSize.sm,
    fontWeight: '700',
    color: LuxuryColors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: LuxurySpacing.sm,
    textTransform: 'uppercase',
  },
  viewAllText: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.gold,
    textAlign: 'center',
    marginTop: LuxurySpacing.xs,
    fontWeight: '500',
  },
  expFilterBar: {
    marginBottom: LuxurySpacing.sm,
  },
  expFilterContent: {
    gap: LuxurySpacing.sm,
    paddingBottom: 2,
  },
  expFilterChip: {
    paddingHorizontal: LuxurySpacing.md,
    paddingVertical: LuxurySpacing.xs,
    borderRadius: LuxuryBorderRadius.full,
    borderWidth: 1,
    borderColor: LuxuryColors.divider,
    backgroundColor: LuxuryColors.surface,
  },
  expFilterChipActive: {
    borderColor: `${LuxuryColors.gold}60`,
    backgroundColor: `${LuxuryColors.gold}14`,
  },
  expFilterText: {
    fontSize: LuxuryFontSize.xs,
    color: LuxuryColors.textTertiary,
    fontWeight: '500',
  },
  expFilterTextActive: {
    color: LuxuryColors.gold,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: LuxurySpacing.xxxl,
    gap: LuxurySpacing.sm,
  },
  emptyTitle: {
    fontSize: LuxuryFontSize.lg,
    fontWeight: '600',
    color: LuxuryColors.textPrimary,
  },
  emptyBody: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: LuxurySpacing.xl,
  },
  sectionIntro: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textSecondary,
    lineHeight: 22,
    marginBottom: LuxurySpacing.lg,
  },
});

const planStyles = StyleSheet.create({
  card: {
    backgroundColor: LuxuryColors.surface,
    borderRadius: LuxuryBorderRadius.xl,
    borderWidth: 1,
    borderColor: LuxuryColors.divider,
    padding: LuxurySpacing.lg,
    marginBottom: LuxurySpacing.md,
  },
  cardPro: {
    borderColor: `${LuxuryColors.gold}50`,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: `${LuxuryColors.gold}18`,
    borderRadius: LuxuryBorderRadius.full,
    paddingHorizontal: LuxurySpacing.sm,
    paddingVertical: 3,
    marginBottom: LuxurySpacing.sm,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 1,
  },
  planName: {
    fontSize: LuxuryFontSize.xl,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
    marginBottom: LuxurySpacing.xs,
  },
  planPrice: {
    fontSize: LuxuryFontSize.xxl,
    fontWeight: '700',
    color: LuxuryColors.gold,
  },
  planPriceNote: {
    fontSize: LuxuryFontSize.xs,
    color: LuxuryColors.textTertiary,
    marginBottom: LuxurySpacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: LuxuryColors.divider,
    marginBottom: LuxurySpacing.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.sm,
    marginBottom: LuxurySpacing.sm,
  },
  featureText: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textSecondary,
    flex: 1,
  },
  comingSoonBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.sm,
    backgroundColor: `${LuxuryColors.gold}10`,
    borderWidth: 1,
    borderColor: `${LuxuryColors.gold}30`,
    borderRadius: LuxuryBorderRadius.md,
    padding: LuxurySpacing.md,
    marginTop: LuxurySpacing.sm,
  },
  comingSoonText: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.gold,
    fontWeight: '500',
  },
});

const analyticsStyles = StyleSheet.create({
  chartTitle: {
    fontSize: LuxuryFontSize.sm,
    fontWeight: '600',
    color: LuxuryColors.textPrimary,
    marginTop: LuxurySpacing.lg,
    marginBottom: LuxurySpacing.sm,
    letterSpacing: 0.2,
  },
  chartWrap: {
    backgroundColor: LuxuryColors.surface,
    borderRadius: LuxuryBorderRadius.lg,
    borderWidth: 1,
    borderColor: LuxuryColors.divider,
    overflow: 'hidden',
  },
  chart: {
    borderRadius: LuxuryBorderRadius.lg,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: LuxurySpacing.xxxl,
    gap: LuxurySpacing.sm,
  },
  emptyTitle: {
    fontSize: LuxuryFontSize.md,
    fontWeight: '600',
    color: LuxuryColors.textSecondary,
  },
  emptyBody: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
