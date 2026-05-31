/**
 * Creator Subscription screen.
 *
 * Shown when a creator tries to publish a journey without an active
 * creator subscription. Presents two tiers (Monthly / Annual) and a
 * benefits list specific to the creator side of the marketplace.
 *
 * Payments are intentionally NOT wired yet — the CTA buttons show a
 * coming-soon alert so the UI is complete but no real billing occurs.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LuxuryColors,
  LuxurySpacing,
  LuxuryBorderRadius,
  LuxuryFontSize,
} from '../../constants/luxuryTheme';

// ─── Data ─────────────────────────────────────────────────────────────────────

const CREATOR_BENEFITS = [
  {
    icon: 'cloud-upload-outline' as const,
    title: 'Publish Unlimited Journeys',
    desc: 'Upload as many curated journeys as you want. No caps.',
  },
  {
    icon: 'people-outline' as const,
    title: 'Reach Paying Travellers',
    desc: 'Your journeys appear in the marketplace to thousands of premium users.',
  },
  {
    icon: 'bar-chart-outline' as const,
    title: 'Creator Analytics',
    desc: 'See views, saves, and engagement on each journey you publish.',
  },
  {
    icon: 'star-outline' as const,
    title: 'Featured Placement',
    desc: 'Top-rated creators get featured in the Discover tab each week.',
  },
  {
    icon: 'shield-checkmark-outline' as const,
    title: 'Verified Creator Badge',
    desc: 'A badge on your profile signals authenticity and builds trust.',
  },
  {
    icon: 'cash-outline' as const,
    title: 'Revenue Share (Coming Soon)',
    desc: 'Earn a share of subscription revenue proportional to journey views.',
  },
] as const;

interface PricingTier {
  id: 'monthly' | 'annual';
  label: string;
  price: string;
  period: string;
  subtext: string;
  savings?: string;
}

const PRICING: PricingTier[] = [
  {
    id: 'annual',
    label: 'Annual Creator',
    price: '$79',
    period: '/year',
    subtext: 'Billed once per year',
    savings: 'Save 34% vs monthly',
  },
  {
    id: 'monthly',
    label: 'Monthly Creator',
    price: '$9.99',
    period: '/month',
    subtext: 'Cancel any time',
  },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CreatorSubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<'monthly' | 'annual'>('annual');

  const handleSubscribe = () => {
    // TODO: wire real payment flow (Stripe / RevenueCat)
    Alert.alert(
      'Coming Soon',
      'Creator subscriptions will be available when payment processing is configured.',
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={LuxuryColors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Creator Subscription</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 40 },
        ]}
      >
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <View style={styles.heroSection}>
          <View style={styles.heroBadge}>
            <Ionicons name="diamond" size={20} color={LuxuryColors.gold} />
            <Text style={styles.heroBadgeText}>Creator Marketplace</Text>
          </View>
          <Text style={styles.heroTitle}>
            Publish Your{'\n'}Journeys to the World
          </Text>
          <Text style={styles.heroSubtitle}>
            Join our curated network of travel creators. Your itineraries reach
            thousands of premium travellers who pay to discover them.
          </Text>
        </View>

        {/* ── Benefits ──────────────────────────────────────────────────── */}
        <View style={styles.benefitsSection}>
          {CREATOR_BENEFITS.map((b) => (
            <View key={b.title} style={styles.benefitRow}>
              <View style={styles.benefitIconWrap}>
                <Ionicons name={b.icon} size={20} color={LuxuryColors.gold} />
              </View>
              <View style={styles.benefitText}>
                <Text style={styles.benefitTitle}>{b.title}</Text>
                <Text style={styles.benefitDesc}>{b.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Pricing cards ─────────────────────────────────────────────── */}
        <Text style={styles.pricingHeading}>Choose your plan</Text>

        {PRICING.map((tier) => {
          const isActive = selected === tier.id;
          return (
            <TouchableOpacity
              key={tier.id}
              style={[styles.pricingCard, isActive && styles.pricingCardActive]}
              onPress={() => setSelected(tier.id)}
              activeOpacity={0.8}
            >
              {/* Popular badge */}
              {tier.id === 'annual' && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularBadgeText}>BEST VALUE</Text>
                </View>
              )}

              <View style={styles.pricingCardLeft}>
                <View
                  style={[
                    styles.radioOuter,
                    isActive && styles.radioOuterActive,
                  ]}
                >
                  {isActive && <View style={styles.radioInner} />}
                </View>
                <View>
                  <Text style={[styles.tierLabel, isActive && styles.tierLabelActive]}>
                    {tier.label}
                  </Text>
                  <Text style={styles.tierSubtext}>{tier.subtext}</Text>
                  {tier.savings && (
                    <Text style={styles.tierSavings}>{tier.savings}</Text>
                  )}
                </View>
              </View>

              <View style={styles.pricingCardRight}>
                <Text style={[styles.tierPrice, isActive && styles.tierPriceActive]}>
                  {tier.price}
                </Text>
                <Text style={styles.tierPeriod}>{tier.period}</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* ── Subscribe CTA ─────────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.subscribeBtn}
          onPress={handleSubscribe}
          activeOpacity={0.85}
        >
          <Text style={styles.subscribeBtnText}>Start Creating</Text>
        </TouchableOpacity>

        <Text style={styles.legalNote}>
          Subscription renews automatically. Cancel any time from your account
          settings. Creator subscription is separate from the user membership.
        </Text>

        {/* ── Separator ─────────────────────────────────────────────────── */}
        <View style={styles.divider} />

        {/* ── Already a creator? ─────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.uploadDirectBtn}
          onPress={() => router.push('/(tabs)/upload-journey')}
          activeOpacity={0.8}
        >
          <Ionicons name="cloud-upload-outline" size={18} color={LuxuryColors.textSecondary} />
          <Text style={styles.uploadDirectText}>
            Already subscribed? Upload a journey →
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LuxuryColors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: LuxurySpacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212,175,55,0.1)',
  },
  backBtn: { padding: 4 },
  headerTitle: {
    flex: 1,
    color: LuxuryColors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSpacer: { width: 30 },

  scrollContent: {
    paddingHorizontal: LuxurySpacing.md,
  },

  // Hero
  heroSection: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 28,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderRadius: LuxuryBorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 20,
  },
  heroBadgeText: {
    color: LuxuryColors.gold,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: LuxuryColors.textPrimary,
    fontSize: LuxuryFontSize.xxxl,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 42,
    marginBottom: 16,
  },
  heroSubtitle: {
    color: LuxuryColors.textSecondary,
    fontSize: LuxuryFontSize.sm,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },

  // Benefits
  benefitsSection: {
    gap: 16,
    marginBottom: 32,
  },
  benefitRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  benefitIconWrap: {
    width: 40,
    height: 40,
    borderRadius: LuxuryBorderRadius.sm,
    backgroundColor: 'rgba(212,175,55,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  benefitText: { flex: 1 },
  benefitTitle: {
    color: LuxuryColors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 3,
  },
  benefitDesc: {
    color: LuxuryColors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },

  // Pricing
  pricingHeading: {
    color: LuxuryColors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  pricingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: LuxuryColors.surface,
    borderRadius: LuxuryBorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 16,
    paddingVertical: 18,
    marginBottom: 12,
    overflow: 'hidden',
  },
  pricingCardActive: {
    borderColor: LuxuryColors.gold,
    backgroundColor: 'rgba(212,175,55,0.06)',
  },
  popularBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: LuxuryColors.gold,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomLeftRadius: LuxuryBorderRadius.sm,
  },
  popularBadgeText: {
    color: LuxuryColors.background,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  pricingCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: { borderColor: LuxuryColors.gold },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: LuxuryColors.gold,
  },
  tierLabel: {
    color: LuxuryColors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  tierLabelActive: { color: LuxuryColors.textPrimary },
  tierSubtext: {
    color: LuxuryColors.textTertiary,
    fontSize: 12,
    marginTop: 2,
  },
  tierSavings: {
    color: LuxuryColors.gold,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  pricingCardRight: { alignItems: 'flex-end' },
  tierPrice: {
    color: LuxuryColors.textSecondary,
    fontSize: 22,
    fontWeight: '800',
  },
  tierPriceActive: { color: LuxuryColors.gold },
  tierPeriod: {
    color: LuxuryColors.textTertiary,
    fontSize: 12,
    marginTop: 1,
  },

  // Subscribe button
  subscribeBtn: {
    backgroundColor: LuxuryColors.gold,
    borderRadius: LuxuryBorderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  subscribeBtnText: {
    color: LuxuryColors.background,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  legalNote: {
    color: LuxuryColors.textTertiary,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 28,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginBottom: 20,
  },
  uploadDirectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  uploadDirectText: {
    color: LuxuryColors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
});
