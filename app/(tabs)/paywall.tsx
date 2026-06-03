import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
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

const BENEFITS = [
  { icon: 'people-outline' as const,    text: 'Unlimited access to all creator journeys' },
  { icon: 'calendar-outline' as const,  text: 'Full day-by-day itineraries from expert creators' },
  { icon: 'cash-outline' as const,      text: 'Budget-matched picks from top travel creators' },
  { icon: 'bookmark-outline' as const,  text: 'Save and revisit unlimited journeys' },
  { icon: 'add-circle-outline' as const, text: 'New creator journeys added every week' },
];

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      bounces={false}
      contentInsetAdjustmentBehavior="never"
    >
      {/* ── Back button ── */}
      <TouchableOpacity
        style={[styles.backBtn, { top: insets.top + LuxurySpacing.sm }]}
        onPress={() => router.back()}
        activeOpacity={0.8}
      >
        <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
      </TouchableOpacity>

      <View style={[styles.heroSection, { paddingTop: insets.top + 80 }]}>
        {/* Diamond icon */}
        <View style={styles.diamondWrap}>
          <Ionicons name="diamond" size={36} color={LuxuryColors.gold} />
        </View>

        <Text style={styles.overline}>Unlock Full Access</Text>
        <Text style={styles.title}>Unlimited Creator Journeys</Text>
        <Text style={styles.subtitle}>
          You've used all 3 complimentary journeys.{"\n"}
          Upgrade for unlimited access to every{"\n"}creator's journey on the platform.
        </Text>
      </View>

      {/* ── Benefits list ── */}
      <View style={styles.benefitsCard}>
        <Text style={styles.benefitsLabel}>What you get</Text>
        {BENEFITS.map((b) => (
          <View key={b.text} style={styles.benefitRow}>
            <View style={styles.benefitIconWrap}>
              <Ionicons name={b.icon} size={16} color={LuxuryColors.gold} />
            </View>
            <Text style={styles.benefitText}>{b.text}</Text>
          </View>
        ))}
      </View>

      {/* ── Social proof ── */}
      <View style={styles.socialProof}>
        <View style={styles.socialAvatars}>
          {['A', 'B', 'C', 'D'].map((l, i) => (
            <View key={l} style={[styles.socialAvatar, { marginLeft: i === 0 ? 0 : -8 }]}>
              <Text style={styles.socialAvatarLetter}>{l}</Text>
            </View>
          ))}
        </View>
        <View style={styles.socialTextWrap}>
          <View style={styles.socialStars}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Ionicons key={i} name="star" size={10} color={LuxuryColors.gold} />
            ))}
          </View>
          <Text style={styles.socialProofText}>
            Join a growing community exploring creator-curated journeys.
          </Text>
        </View>
      </View>

      {/* ── CTAs ── */}
      <View style={styles.ctaSection}>
        <TouchableOpacity
          style={styles.ctaPrimary}
          onPress={() => router.push('/(tabs)/membership')}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaPrimaryText}>Monthly Membership</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.ctaSecondary}
          onPress={() => router.push('/(tabs)/membership')}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaSecondaryText}>Annual Membership</Text>
          <View style={styles.saveBadge}>
            <Text style={styles.saveBadgeText}>Save 40%</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.dismissText}>Maybe later</Text>
        </TouchableOpacity>
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
  backBtn: {
    position: 'absolute',
    left: LuxurySpacing.lg,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: LuxuryBorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSection: {
    alignItems: 'center',
    paddingHorizontal: LuxurySpacing.xl,
    paddingBottom: LuxurySpacing.xxl,
    gap: LuxurySpacing.md,
  },
  diamondWrap: {
    width: 80,
    height: 80,
    borderRadius: LuxuryBorderRadius.full,
    backgroundColor: 'rgba(212,175,55,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: LuxurySpacing.md,
  },
  overline: {
    fontSize: 9,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: LuxuryFontSize.xxl,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    letterSpacing: 0.1,
  },
  benefitsCard: {
    marginHorizontal: LuxurySpacing.xl,
    backgroundColor: LuxuryColors.surface,
    borderRadius: LuxuryBorderRadius.xxl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: LuxurySpacing.lg,
    gap: LuxurySpacing.md,
    marginBottom: LuxurySpacing.xl,
  },
  benefitsLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: LuxurySpacing.xs,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.md,
  },
  benefitIconWrap: {
    width: 32,
    height: 32,
    borderRadius: LuxuryBorderRadius.md,
    backgroundColor: 'rgba(212,175,55,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  benefitText: {
    flex: 1,
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textSecondary,
    letterSpacing: 0.1,
    lineHeight: 20,
  },
  ctaSection: {
    paddingHorizontal: LuxurySpacing.xl,
    gap: LuxurySpacing.md,
    alignItems: 'center',
  },
  ctaPrimary: {
    width: '100%',
    backgroundColor: LuxuryColors.gold,
    borderRadius: LuxuryBorderRadius.full,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaPrimaryText: {
    fontSize: LuxuryFontSize.md,
    fontWeight: '700',
    color: LuxuryColors.background,
    letterSpacing: 0.3,
  },
  ctaSecondary: {
    width: '100%',
    backgroundColor: 'transparent',
    borderRadius: LuxuryBorderRadius.full,
    paddingVertical: 15,
    borderWidth: 1.5,
    borderColor: LuxuryColors.gold,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: LuxurySpacing.sm,
  },
  ctaSecondaryText: {
    fontSize: LuxuryFontSize.md,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 0.3,
  },
  saveBadge: {
    backgroundColor: 'rgba(212,175,55,0.15)',
    borderRadius: LuxuryBorderRadius.full,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  saveBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 0.5,
  },
  dismissText: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textTertiary,
    letterSpacing: 0.2,
  },
  // ── Social proof ──────────────────────────────────────
  socialProof: {
    marginHorizontal: LuxurySpacing.xl,
    marginBottom: LuxurySpacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.md,
    backgroundColor: 'rgba(212,175,55,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.12)',
    borderRadius: LuxuryBorderRadius.xl,
    padding: LuxurySpacing.md,
  },
  socialAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  socialAvatar: {
    width: 28,
    height: 28,
    borderRadius: LuxuryBorderRadius.full,
    backgroundColor: 'rgba(212,175,55,0.18)',
    borderWidth: 1.5,
    borderColor: LuxuryColors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialAvatarLetter: {
    fontSize: 10,
    fontWeight: '700',
    color: LuxuryColors.gold,
  },
  socialTextWrap: {
    flex: 1,
    gap: 3,
  },
  socialStars: {
    flexDirection: 'row',
    gap: 2,
  },
  socialProofText: {
    fontSize: 11,
    color: LuxuryColors.textSecondary,
    lineHeight: 16,
    letterSpacing: 0.1,
  },
});
