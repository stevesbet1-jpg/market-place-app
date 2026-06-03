import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LuxuryColors,
  LuxurySpacing,
  LuxuryBorderRadius,
  LuxuryFontSize,
  LuxuryShadow,
} from '../../constants/luxuryTheme';
import { getFirebaseApp } from '../../lib/firebase';
import { getUserProfile } from '../../lib/userProfile';
import { purchaseMembership } from '../../lib/stripeService';
import { checkMembership } from '../../lib/membershipService';

const BENEFITS = [
  {
    icon: 'people-outline' as const,
    title: 'Unlimited Creator Itineraries',
    desc: 'Access every journey from all 6 creators, with full day-by-day plans.',
  },
  {
    icon: 'add-circle-outline' as const,
    title: 'Weekly New Journeys',
    desc: 'Fresh creator journeys drop every week — always something to discover.',
  },
  {
    icon: 'bookmark-outline' as const,
    title: 'Save Unlimited Trips',
    desc: 'Build your personal travel library with no limits on saved journeys.',
  },
  {
    icon: 'sparkles-outline' as const,
    title: 'AI Travel Assistant',
    desc: 'Describe your dream trip and get personalised creator journey matches.',
  },
  {
    icon: 'lock-open-outline' as const,
    title: 'Creator Exclusive Content',
    desc: 'Behind-the-scenes notes, packing lists, and insider tips from creators.',
  },
] as const;

export default function MembershipScreen() {
  const insets = useSafeAreaInsets();
  const [memberName, setMemberName] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [currentUid, setCurrentUid] = useState<string | null>(null);
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);

  useEffect(() => {
    const auth = getAuth(getFirebaseApp());
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setCurrentUid(null);
        setCurrentEmail(null);
        setIsMember(false);
        return;
      }
      setCurrentUid(user.uid);
      setCurrentEmail(user.email);

      const [profile, active] = await Promise.all([
        getUserProfile(user.uid).catch(() => null),
        checkMembership(user.uid),
      ]);

      const name = profile?.fullName ?? user.displayName ?? null;
      setMemberName(name ? name.split(' ')[0] : null);
      setIsMember(active);
    });
    return unsub;
  }, []);

  const handleSubscribe = async (plan: 'monthly' | 'annual') => {
    const auth = getAuth(getFirebaseApp());
    const user = auth.currentUser;

    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to purchase a membership.');
      return;
    }

    if (isMember) {
      Alert.alert('Already a member', 'Your membership is currently active.');
      return;
    }

    setPurchasing(true);
    try {
      const result = await purchaseMembership(plan, user.uid, user.email ?? '');
      if (result.success) {
        // Stripe webhook will write to Firestore — poll once after a short delay
        await new Promise((r) => setTimeout(r, 2000));
        const nowMember = await checkMembership(user.uid);
        setIsMember(nowMember);
        if (nowMember) {
          Alert.alert('Welcome to the Club! 🎉', 'Your membership is now active. Enjoy unlimited access.');
        } else {
          Alert.alert(
            'Payment received',
            'Your payment was processed. Membership activation may take a moment — please reload the app if content is still locked.',
          );
        }
      } else if (!result.cancelled) {
        Alert.alert('Payment failed', result.error ?? 'Please try again.');
      }
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      bounces={false}
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}
    >
      {/* ── Hero ── */}
      <View style={[styles.hero, { paddingTop: insets.top + LuxurySpacing.xl }]}>
        <View style={styles.heroIcon}>
          <Ionicons name="diamond" size={32} color={LuxuryColors.gold} />
        </View>
        <Text style={styles.heroOverline}>Creator Membership</Text>
        <Text style={styles.heroTitle}>Unlock Every{'\n'}Creator Journey</Text>
        <Text style={styles.heroSubtitle}>
          {memberName ? `Welcome, ${memberName}. ` : ''}
          One membership. Every creator. Unlimited journeys.
        </Text>
      </View>

      {/* ── Social proof strip ── */}
      <View style={styles.proofStrip}>
        <View style={styles.proofAvatars}>
          {['SC', 'MV', 'JH', 'EK'].map((initials, i) => (
            <View key={initials} style={[styles.proofAvatar, { marginLeft: i === 0 ? 0 : -8 }]}>
              <Text style={styles.proofAvatarText}>{initials}</Text>
            </View>
          ))}
        </View>
        <View style={styles.proofTextWrap}>
          <View style={styles.proofStars}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Ionicons key={i} name="star" size={10} color={LuxuryColors.gold} />
            ))}
          </View>
          <Text style={styles.proofText}>Join a growing community of luxury travelers</Text>
        </View>
      </View>

      {/* ── Benefits ── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>What's included</Text>
        <View style={styles.benefitsCard}>
          {BENEFITS.map((b, i) => (
            <View key={b.title} style={[styles.benefitRow, i > 0 && styles.benefitRowBorder]}>
              <View style={styles.benefitIconWrap}>
                <Ionicons name={b.icon} size={18} color={LuxuryColors.gold} />
              </View>
              <View style={styles.benefitTextWrap}>
                <Text style={styles.benefitTitle}>{b.title}</Text>
                <Text style={styles.benefitDesc}>{b.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* ── Pricing ── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Choose your plan</Text>

        {/* Active member banner */}
        {isMember && (
          <View style={styles.activeBanner}>
            <Ionicons name="checkmark-circle" size={16} color={LuxuryColors.success} />
            <Text style={styles.activeBannerText}>Your membership is active</Text>
          </View>
        )}

        {/* Annual — highlighted */}
        <TouchableOpacity
          style={[styles.planCardAnnual, (purchasing || isMember) && styles.planCardDisabled]}
          onPress={() => handleSubscribe('annual')}
          activeOpacity={0.88}
          disabled={purchasing || isMember}
        >
          <View style={styles.planBestValueBadge}>
            <Text style={styles.planBestValueText}>BEST VALUE</Text>
          </View>
          <View style={styles.planCardInner}>
            <View style={styles.planLeft}>
              <Text style={styles.planName}>Annual</Text>
              <Text style={styles.planDesc}>Billed once per year</Text>
            </View>
            <View style={styles.planRight}>
              <Text style={styles.planPrice}>$79</Text>
              <Text style={styles.planPer}>/year</Text>
            </View>
          </View>
          <View style={styles.planSavingRow}>
            <Ionicons name="checkmark-circle" size={14} color={LuxuryColors.gold} />
            <Text style={styles.planSavingText}>Save 44% vs monthly · Just $6.58/month</Text>
          </View>
          <View style={styles.planCta}>
            {purchasing ? (
              <ActivityIndicator size="small" color={LuxuryColors.background} />
            ) : (
              <>
                <Text style={styles.planCtaText}>{isMember ? 'Already a Member' : 'Start Annual Membership'}</Text>
                <Ionicons name="chevron-forward" size={14} color={LuxuryColors.background} />
              </>
            )}
          </View>
        </TouchableOpacity>

        {/* Monthly */}
        <TouchableOpacity
          style={[styles.planCardMonthly, (purchasing || isMember) && styles.planCardDisabled]}
          onPress={() => handleSubscribe('monthly')}
          activeOpacity={0.88}
          disabled={purchasing || isMember}
        >
          <View style={styles.planCardInner}>
            <View style={styles.planLeft}>
              <Text style={styles.planNameSecondary}>Monthly</Text>
              <Text style={styles.planDesc}>Cancel anytime</Text>
            </View>
            <View style={styles.planRight}>
              <Text style={styles.planPriceSecondary}>$11.99</Text>
              <Text style={styles.planPer}>/month</Text>
            </View>
          </View>
          <View style={styles.planCtaSecondary}>
            <Text style={styles.planCtaSecondaryText}>{isMember ? 'Already a Member' : 'Start Monthly Membership'}</Text>
            <Ionicons name="chevron-forward" size={14} color={LuxuryColors.gold} />
          </View>
        </TouchableOpacity>

        <Text style={styles.planNote}>
          Payments are securely processed by Stripe. Cancel anytime.
        </Text>
      </View>

      {/* ── Creators preview ── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Featured Creators</Text>
        <View style={styles.creatorsRow}>
          {[
            { initials: 'SC', name: 'Sophia Chen', journeys: 3 },
            { initials: 'MV', name: 'Marco Vitale', journeys: 6 },
            { initials: 'JH', name: 'James Hartley', journeys: 2 },
            { initials: 'EK', name: 'Elena Kovacs', journeys: 3 },
          ].map((c) => (
            <View key={c.initials} style={styles.creatorChip}>
              <View style={styles.creatorChipAvatar}>
                <Text style={styles.creatorChipInitials}>{c.initials}</Text>
              </View>
              <Text style={styles.creatorChipName} numberOfLines={1}>{c.name}</Text>
              <Text style={styles.creatorChipCount}>{c.journeys} journeys</Text>
            </View>
          ))}
        </View>
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

  // ── Hero ──────────────────────────────────────────────────
  hero: {
    alignItems: 'center',
    paddingHorizontal: LuxurySpacing.xl,
    paddingBottom: LuxurySpacing.xl,
    gap: LuxurySpacing.md,
    backgroundColor: LuxuryColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: LuxuryBorderRadius.full,
    backgroundColor: 'rgba(212,175,55,0.10)',
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: LuxurySpacing.xs,
    ...LuxuryShadow.gold,
  },
  heroOverline: {
    fontSize: 9,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: LuxuryFontSize.xxxl,
    fontWeight: '800',
    color: LuxuryColors.textPrimary,
    letterSpacing: -0.8,
    textAlign: 'center',
    lineHeight: 38,
  },
  heroSubtitle: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textSecondary,
    lineHeight: 21,
    letterSpacing: 0.1,
    textAlign: 'center',
    maxWidth: 300,
  },

  // ── Social proof ──────────────────────────────────────────
  proofStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.md,
    paddingHorizontal: LuxurySpacing.xl,
    paddingVertical: LuxurySpacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  proofAvatars: {
    flexDirection: 'row',
  },
  proofAvatar: {
    width: 28,
    height: 28,
    borderRadius: LuxuryBorderRadius.full,
    backgroundColor: 'rgba(212,175,55,0.15)',
    borderWidth: 1.5,
    borderColor: LuxuryColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proofAvatarText: {
    fontSize: 8,
    fontWeight: '800',
    color: LuxuryColors.gold,
  },
  proofTextWrap: {
    flex: 1,
    gap: 3,
  },
  proofStars: {
    flexDirection: 'row',
    gap: 2,
  },
  proofText: {
    fontSize: 10,
    color: LuxuryColors.textTertiary,
    letterSpacing: 0.1,
  },

  // ── Section ───────────────────────────────────────────────
  section: {
    paddingHorizontal: LuxurySpacing.xl,
    paddingTop: LuxurySpacing.xl,
    gap: LuxurySpacing.md,
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },

  // ── Benefits ──────────────────────────────────────────────
  benefitsCard: {
    backgroundColor: LuxuryColors.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: LuxuryBorderRadius.xl,
    overflow: 'hidden',
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: LuxurySpacing.md,
    padding: LuxurySpacing.md,
  },
  benefitRowBorder: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  benefitIconWrap: {
    width: 36,
    height: 36,
    borderRadius: LuxuryBorderRadius.md,
    backgroundColor: 'rgba(212,175,55,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  benefitTextWrap: {
    flex: 1,
    gap: 2,
  },
  benefitTitle: {
    fontSize: LuxuryFontSize.sm,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
    letterSpacing: 0.1,
  },
  benefitDesc: {
    fontSize: 11,
    color: LuxuryColors.textSecondary,
    lineHeight: 16,
    letterSpacing: 0.1,
  },

  // ── Pricing ───────────────────────────────────────────────
  planCardAnnual: {
    backgroundColor: 'rgba(212,175,55,0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.45)',
    borderRadius: LuxuryBorderRadius.xl,
    padding: LuxurySpacing.md,
    gap: LuxurySpacing.sm,
    position: 'relative',
    ...LuxuryShadow.gold,
  },
  planBestValueBadge: {
    position: 'absolute',
    top: -10,
    right: LuxurySpacing.md,
    backgroundColor: LuxuryColors.gold,
    borderRadius: LuxuryBorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  planBestValueText: {
    fontSize: 8,
    fontWeight: '800',
    color: LuxuryColors.background,
    letterSpacing: 1.2,
  },
  planCardMonthly: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: LuxuryBorderRadius.xl,
    padding: LuxurySpacing.md,
    gap: LuxurySpacing.sm,
  },
  planCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planLeft: {
    gap: 2,
  },
  planRight: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  planName: {
    fontSize: LuxuryFontSize.lg,
    fontWeight: '800',
    color: LuxuryColors.textPrimary,
    letterSpacing: -0.2,
  },
  planNameSecondary: {
    fontSize: LuxuryFontSize.lg,
    fontWeight: '700',
    color: LuxuryColors.textSecondary,
    letterSpacing: -0.2,
  },
  planDesc: {
    fontSize: 11,
    color: LuxuryColors.textTertiary,
    letterSpacing: 0.1,
  },
  planPrice: {
    fontSize: LuxuryFontSize.xxl,
    fontWeight: '800',
    color: LuxuryColors.gold,
    letterSpacing: -0.5,
  },
  planPriceSecondary: {
    fontSize: LuxuryFontSize.xxl,
    fontWeight: '700',
    color: LuxuryColors.textSecondary,
    letterSpacing: -0.5,
  },
  planPer: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textTertiary,
    letterSpacing: 0.1,
  },
  planSavingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  planSavingText: {
    fontSize: 11,
    color: LuxuryColors.gold,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  planCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: LuxuryColors.gold,
    borderRadius: LuxuryBorderRadius.full,
    paddingVertical: 12,
    marginTop: LuxurySpacing.xs,
  },
  planCtaText: {
    fontSize: LuxuryFontSize.sm,
    fontWeight: '800',
    color: LuxuryColors.background,
    letterSpacing: 0.3,
  },
  planCtaSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    borderRadius: LuxuryBorderRadius.full,
    paddingVertical: 11,
    marginTop: LuxurySpacing.xs,
  },
  planCtaSecondaryText: {
    fontSize: LuxuryFontSize.sm,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 0.3,
  },
  planNote: {
    fontSize: 10,
    color: LuxuryColors.textTertiary,
    textAlign: 'center',
    letterSpacing: 0.1,
    lineHeight: 15,
    marginTop: -LuxurySpacing.xs,
  },
  planCardDisabled: {
    opacity: 0.55,
  },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.xs,
    backgroundColor: 'rgba(46,213,115,0.12)',
    borderRadius: LuxuryBorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(46,213,115,0.3)',
    paddingVertical: LuxurySpacing.sm,
    paddingHorizontal: LuxurySpacing.md,
    marginBottom: LuxurySpacing.md,
  },
  activeBannerText: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.success,
    fontWeight: '600',
  },

  // ── Creators ──────────────────────────────────────────────
  creatorsRow: {
    flexDirection: 'row',
    gap: LuxurySpacing.sm,
    flexWrap: 'wrap',
  },
  creatorChip: {
    alignItems: 'center',
    gap: 4,
    width: '22%',
  },
  creatorChipAvatar: {
    width: 44,
    height: 44,
    borderRadius: LuxuryBorderRadius.full,
    backgroundColor: 'rgba(212,175,55,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorChipInitials: {
    fontSize: 12,
    fontWeight: '800',
    color: LuxuryColors.gold,
    letterSpacing: 0.3,
  },
  creatorChipName: {
    fontSize: 9,
    fontWeight: '600',
    color: LuxuryColors.textSecondary,
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  creatorChipCount: {
    fontSize: 8,
    color: LuxuryColors.textTertiary,
    letterSpacing: 0.2,
  },
});
