/**
 * creator-dashboard.tsx
 *
 * Creator workspace — only accessible to approved creators.
 *
 * Sections (tab switcher):
 *   Overview     — stat cards (total, published, pending, drafts)
 *   My Journeys  — list with cover, title, country, status badge
 *   Subscription — display-only plan cards (no payments)
 *   Analytics    — placeholder with 0 values
 *
 * "Create Journey" is a prominent CTA that navigates to create-journey.tsx.
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
import {
  getCurrentUid,
  getMyApprovedCreatorProfile,
  getMyApplicationStatus,
  deriveInitials,
} from '../../lib/creatorService';
import { getCreatorJourneys } from '../../lib/creatorJourneyService';
import type { Creator } from '../../constants/creators';
import type { CreatorJourney } from '../../constants/creatorJourneyModel';

// ─── Section types ────────────────────────────────────────────────────────────

type Section = 'overview' | 'journeys' | 'subscription' | 'analytics';

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'journeys', label: 'My Journeys' },
  { key: 'subscription', label: 'Subscription' },
  { key: 'analytics', label: 'Analytics' },
];

// ─── Status badge ─────────────────────────────────────────────────────────────

type JourneyStatus = CreatorJourney['status'];

function statusLabel(s: JourneyStatus): string {
  switch (s) {
    case 'draft': return 'Draft';
    case 'pending_review': return 'Pending Review';
    case 'published': return 'Published';
    case 'rejected': return 'Rejected';
    default: return s;
  }
}

function statusColor(s: JourneyStatus): string {
  switch (s) {
    case 'draft': return LuxuryColors.textTertiary;
    case 'pending_review': return LuxuryColors.gold;
    case 'published': return LuxuryColors.success;
    case 'rejected': return LuxuryColors.error;
    default: return LuxuryColors.textTertiary;
  }
}

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

// ─── Journey row ──────────────────────────────────────────────────────────────

function JourneyRow({ journey }: { journey: CreatorJourney }) {
  const imgSrc = journey.imageUri ? { uri: journey.imageUri } : null;
  const country = journey.region || journey.destination || '—';
  const color = statusColor(journey.status);
  const label = statusLabel(journey.status);

  return (
    <View style={rowStyles.container}>
      {imgSrc ? (
        <Image source={imgSrc} style={rowStyles.thumb} />
      ) : (
        <View style={[rowStyles.thumb, rowStyles.thumbPlaceholder]}>
          <Ionicons name="image-outline" size={22} color={LuxuryColors.textTertiary} />
        </View>
      )}
      <View style={rowStyles.info}>
        <Text style={rowStyles.title} numberOfLines={2}>{journey.title}</Text>
        <Text style={rowStyles.country} numberOfLines={1}>{country}</Text>
      </View>
      <View style={[rowStyles.badge, { borderColor: `${color}40`, backgroundColor: `${color}12` }]}>
        <Text style={[rowStyles.badgeText, { color }]}>{label}</Text>
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
});

// ─── Access gate ──────────────────────────────────────────────────────────────

type AccessStatus = 'no-auth' | 'none' | 'pending' | 'rejected' | 'approved';

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
    none: {
      icon: 'briefcase-outline',
      color: LuxuryColors.gold,
      title: 'Apply as Creator',
      body: 'Submit a creator application to unlock your dashboard.',
      cta: 'Apply Now',
      ctaAction: () => router.push('/(tabs)/apply-creator'),
    },
    pending: {
      icon: 'time-outline',
      color: LuxuryColors.gold,
      title: 'Application Under Review',
      body: 'Your application is being reviewed by our team. You will be notified by email.',
      cta: 'Back',
      ctaAction: onBack,
    },
    rejected: {
      icon: 'close-circle-outline',
      color: LuxuryColors.error,
      title: 'Application Not Accepted',
      body: 'Your creator application was not accepted at this time. You may reapply in 60 days.',
      cta: 'Back',
      ctaAction: onBack,
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

  // ── Journeys data ────────────────────────────────────────────────────
  const [journeys, setJourneys] = useState<CreatorJourney[]>([]);
  const [loadingJourneys, setLoadingJourneys] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ── Active section ───────────────────────────────────────────────────
  const [activeSection, setActiveSection] = useState<Section>('overview');

  // ── Load creator profile ─────────────────────────────────────────────
  const loadCreatorProfile = useCallback(async () => {
    const uid = getCurrentUid();
    if (!uid) {
      setAccessStatus('no-auth');
      setChecking(false);
      return;
    }
    const profile = await getMyApprovedCreatorProfile(uid);
    if (profile) {
      setCreator(profile);
      setAccessStatus('approved');
    } else {
      const status = await getMyApplicationStatus(uid);
      setAccessStatus(status === 'none' ? 'none' : (status as AccessStatus));
    }
    setChecking(false);
  }, []);

  // ── Load journeys ─────────────────────────────────────────────────────
  const loadJourneys = useCallback(async (creatorId: string, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoadingJourneys(true);
    try {
      const data = await getCreatorJourneys(creatorId);
      setJourneys(data);
    } catch {
      setJourneys([]);
    } finally {
      setLoadingJourneys(false);
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
      loadJourneys(creator.id);
    }
  }, [creator?.id, loadJourneys]);

  // ── Stats ────────────────────────────────────────────────────────────
  const totalJourneys = journeys.length;
  const publishedCount = journeys.filter((j) => j.status === 'published').length;
  const pendingCount = journeys.filter((j) => j.status === 'pending_review').length;
  const draftCount = journeys.filter((j) => j.status === 'draft').length;

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
            onRefresh={() => creator?.id && loadJourneys(creator.id, true)}
            tintColor={LuxuryColors.gold}
          />
        }
      >
        {/* Stat grid */}
        <View style={sectionStyles.statGrid}>
          <View style={sectionStyles.statRow}>
            <StatCard label="Total Journeys" value={totalJourneys} icon="map-outline" />
            <View style={{ width: LuxurySpacing.sm }} />
            <StatCard label="Published" value={publishedCount} icon="checkmark-circle-outline" />
          </View>
          <View style={[sectionStyles.statRow, { marginTop: LuxurySpacing.sm }]}>
            <StatCard label="Pending Review" value={pendingCount} icon="time-outline" />
            <View style={{ width: LuxurySpacing.sm }} />
            <StatCard label="Drafts" value={draftCount} icon="document-text-outline" />
          </View>
        </View>

        {/* Create journey CTA */}
        <TouchableOpacity
          style={sectionStyles.createBtn}
          onPress={() => router.push('/(tabs)/create-journey')}
          activeOpacity={0.85}
        >
          <Ionicons name="add-circle-outline" size={22} color={LuxuryColors.background} />
          <Text style={sectionStyles.createBtnText}>Create New Journey</Text>
        </TouchableOpacity>

        {/* Recent journeys preview */}
        {journeys.length > 0 && (
          <View style={sectionStyles.recentSection}>
            <Text style={sectionStyles.recentTitle}>Recent Journeys</Text>
            {journeys.slice(0, 3).map((j) => (
              <JourneyRow key={j.id} journey={j} />
            ))}
            {journeys.length > 3 && (
              <TouchableOpacity onPress={() => setActiveSection('journeys')} activeOpacity={0.7}>
                <Text style={sectionStyles.viewAllText}>View all {journeys.length} journeys →</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {journeys.length === 0 && !loadingJourneys && (
          <View style={sectionStyles.emptyState}>
            <Ionicons name="map-outline" size={40} color={LuxuryColors.textTertiary} />
            <Text style={sectionStyles.emptyTitle}>No journeys yet</Text>
            <Text style={sectionStyles.emptyBody}>Create your first journey to get started.</Text>
          </View>
        )}
      </ScrollView>
    );
  }

  // ─── Section: My Journeys ─────────────────────────────────────────────
  function renderJourneys() {
    if (loadingJourneys) {
      return (
        <View style={sectionStyles.centeredLoader}>
          <ActivityIndicator color={LuxuryColors.gold} size="large" />
        </View>
      );
    }

    return (
      <FlatList
        data={journeys}
        keyExtractor={(j) => j.id}
        contentContainerStyle={sectionStyles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => creator?.id && loadJourneys(creator.id, true)}
            tintColor={LuxuryColors.gold}
          />
        }
        ListHeaderComponent={
          <TouchableOpacity
            style={sectionStyles.createBtn}
            onPress={() => router.push('/(tabs)/create-journey')}
            activeOpacity={0.85}
          >
            <Ionicons name="add-circle-outline" size={22} color={LuxuryColors.background} />
            <Text style={sectionStyles.createBtnText}>Create Your First Journey</Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={
          <View style={sectionStyles.emptyState}>
            <Ionicons name="map-outline" size={40} color={LuxuryColors.textTertiary} />
            <Text style={sectionStyles.emptyTitle}>No journeys yet</Text>
            <Text style={sectionStyles.emptyBody}>
              Tap "Create Your First Journey" above to get started.
            </Text>
          </View>
        }
        renderItem={({ item }) => <JourneyRow journey={item} />}
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
            'Unlimited journey publications',
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

        {/* Local Creator card */}
        <View style={planStyles.card}>
          <Text style={planStyles.planName}>Local Creator</Text>
          <Text style={planStyles.planPrice}>$—/month</Text>
          <Text style={planStyles.planPriceNote}>Pricing coming soon</Text>
          <View style={planStyles.divider} />
          {[
            'Up to 5 journey publications',
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
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={sectionStyles.content}>
        <Text style={sectionStyles.sectionIntro}>
          Analytics will track engagement once your journeys are published.
        </Text>

        <View style={sectionStyles.statGrid}>
          <View style={sectionStyles.statRow}>
            <StatCard label="Total Views" value={0} icon="eye-outline" />
            <View style={{ width: LuxurySpacing.sm }} />
            <StatCard label="Saved Journeys" value={0} icon="bookmark-outline" />
          </View>
          <View style={[sectionStyles.statRow, { marginTop: LuxurySpacing.sm }]}>
            <StatCard label="Subscribers" value={0} icon="people-outline" />
            <View style={{ width: LuxurySpacing.sm }} />
            <View style={{ flex: 1 }} />
          </View>
        </View>

        <View style={planStyles.comingSoonBanner}>
          <Ionicons name="bar-chart-outline" size={20} color={LuxuryColors.gold} />
          <Text style={planStyles.comingSoonText}>Full analytics dashboard coming soon</Text>
        </View>
      </ScrollView>
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
        {activeSection === 'journeys' && renderJourneys()}
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
