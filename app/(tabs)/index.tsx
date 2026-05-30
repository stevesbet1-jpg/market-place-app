import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LuxuryColors,
  LuxurySpacing,
  LuxuryBorderRadius,
  LuxuryFontSize,
  LuxuryShadow,
} from '../../constants/luxuryTheme';
import { CREATORS, formatFollowers, type Creator } from '../../constants/creators';
import { JOURNEYS } from '../../constants/journeys';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function journeyCountForCreator(creatorId: string): number {
  return JOURNEYS.filter((j) => j.creatorId === creatorId).length;
}

// ─── Creator Card ─────────────────────────────────────────────────────────────

function CreatorCard({ creator }: { creator: Creator }) {
  const journeyCount = journeyCountForCreator(creator.id);

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
        <Text style={styles.cardName}>{creator.name}</Text>
        <Text style={styles.cardBio} numberOfLines={2}>{creator.bio}</Text>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Ionicons name="people" size={11} color={LuxuryColors.textTertiary} />
            <Text style={styles.statText}>{formatFollowers(creator.followers)}</Text>
          </View>
          <View style={styles.statDot} />
          <View style={styles.stat}>
            <Ionicons name="map" size={11} color={LuxuryColors.textTertiary} />
            <Text style={styles.statText}>
              {journeyCount} {journeyCount === 1 ? 'Journey' : 'Journeys'}
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

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();

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
            Follow world-class creators and unlock their handcrafted journeys
          </Text>
        </View>

        {/* Creator count badge */}
        <View style={styles.countRow}>
          <View style={styles.countBadge}>
            <Ionicons name="people" size={13} color={LuxuryColors.gold} />
            <Text style={styles.countText}>{CREATORS.length} Verified Creators</Text>
          </View>
        </View>

        {/* Creator list */}
        <View style={styles.list}>
          {CREATORS.map((creator) => (
            <CreatorCard key={creator.id} creator={creator} />
          ))}
        </View>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: LuxurySpacing.xl,
  },

  // Header
  header: {
    marginBottom: LuxurySpacing.xl,
  },
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
    letterSpacing: 0.1,
  },

  // Count badge
  countRow: {
    marginBottom: LuxurySpacing.lg,
  },
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
  list: {
    gap: LuxurySpacing.md,
  },

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
  avatarWrap: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
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
  cardInfo: {
    flex: 1,
    gap: 4,
  },
  cardName: {
    fontSize: LuxuryFontSize.md,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
    letterSpacing: 0.1,
  },
  cardBio: {
    fontSize: 12,
    color: LuxuryColors.textSecondary,
    lineHeight: 17,
    letterSpacing: 0.1,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 2,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statText: {
    fontSize: 10,
    fontWeight: '600',
    color: LuxuryColors.textTertiary,
    letterSpacing: 0.1,
  },
  statDot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: LuxuryColors.textTertiary,
    opacity: 0.5,
  },
});
