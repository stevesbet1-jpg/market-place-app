import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LuxuryColors, LuxurySpacing, LuxuryBorderRadius, LuxuryFontSize, LuxuryShadow } from '../../constants/luxuryTheme';
import { JOURNEYS, Journey, ImageKey } from '../../constants/journeys';

const JOURNEY_IMAGES: Record<ImageKey, ReturnType<typeof require>> = {
  islands: require('../../assets/collections/private-islands.jpg'),
  villas:  require('../../assets/collections/super-villas.jpg'),
  yacht:   require('../../assets/collections/yacht-escapes.jpg'),
  desert:  require('../../assets/collections/desert-retreats.jpg'),
};

export default function TripsScreen() {
  const insets = useSafeAreaInsets();

  // Fixed random selection for this session — re-shuffles only on cold app launch
  const [featuredJourneys] = useState<Journey[]>(() => {
    const shuffled = [...JOURNEYS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 5);
  });

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

      {/* ── Complimentary badge ── */}
      <View style={styles.padH}>
        <View style={styles.trialBadge}>
          <Ionicons name="diamond-outline" size={13} color={LuxuryColors.gold} />
          <Text style={styles.trialBadgeText}>3 Complimentary Journeys Available</Text>
          <View style={styles.trialDots}>
            {[0, 1, 2].map((i) => <View key={i} style={styles.trialDot} />)}
          </View>
        </View>
      </View>

      {/* ── Journey cards ── */}
      <View style={[styles.padH, styles.cardList]}>
        {featuredJourneys.map((journey) => (
          <Pressable
            key={journey.id}
            style={({ pressed }) => [
              styles.journeyCard,
              pressed && styles.journeyCardPressed,
            ]}
            onPress={() =>
              router.push({ pathname: '/(tabs)/journey-detail', params: { id: journey.id } })
            }
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
              {/* Region badge */}
              <View style={styles.regionBadge}>
                <Text style={styles.regionText}>{journey.region}</Text>
              </View>
              {/* Duration badge */}
              <View style={styles.durationBadge}>
                <Ionicons name="time-outline" size={11} color="rgba(255,255,255,0.80)" />
                <Text style={styles.durationText}>{journey.duration}</Text>
              </View>
            </View>

            {/* Card body */}
            <View style={styles.cardBody}>
              <View style={styles.cardMeta}>
                <Text style={styles.destinationName}>{journey.destination}</Text>
                <Text style={styles.bestTime}>Best: {journey.bestTime}</Text>
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
                  <Text style={styles.exploreLinkText}>Explore</Text>
                  <Ionicons name="chevron-forward" size={11} color={LuxuryColors.gold} />
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
  // ── Complimentary badge ────────────────────────────────
  trialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.sm,
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.20)',
    borderRadius: LuxuryBorderRadius.full,
    paddingHorizontal: LuxurySpacing.md,
    paddingVertical: 10,
    marginBottom: LuxurySpacing.lg,
  },
  trialBadgeText: {
    flex: 1,
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.gold,
    fontWeight: '600',
    letterSpacing: 0.2,
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
  // ── Card list ─────────────────────────────────────────
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
  // ── Hero image ────────────────────────────────────────
  imageWrap: {
    height: 155,
    overflow: 'hidden',
  },
  heroImg: {
    width: '100%',
    height: '100%',
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
  // ── Card body ─────────────────────────────────────────
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
  bestTime: {
    fontSize: LuxuryFontSize.xs,
    color: LuxuryColors.textTertiary,
    letterSpacing: 0.2,
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
    marginTop: 2,
  },
  placeChips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    flexWrap: 'nowrap',
  },
  placeChip: {
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.18)',
    borderRadius: LuxuryBorderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: 130,
  },
  placeChipText: {
    fontSize: 10,
    color: LuxuryColors.textSecondary,
    letterSpacing: 0.2,
  },
  placeMore: {
    fontSize: 10,
    color: LuxuryColors.textTertiary,
    letterSpacing: 0.3,
  },
  exploreLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  exploreLinkText: {
    fontSize: LuxuryFontSize.xs,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 0.5,
  },
});
