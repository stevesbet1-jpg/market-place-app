/**
 * My Trips screen — temporary hardcoded Budapest card for UI design/testing.
 * Data wiring will follow once layout is approved.
 */
import React, { useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LuxuryBorderRadius,
  LuxuryColors,
  LuxuryFontSize,
  LuxurySpacing,
} from '../../constants/luxuryTheme';

type TabKey = 'all' | 'completed' | 'wishlist';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'all', label: 'All Trips' },
  { key: 'completed', label: 'Completed' },
  { key: 'wishlist', label: 'Wishlist' },
];

// ─── Placeholder Budapest trip ────────────────────────────────────────────────
// TODO: replace with real data source
const BUDAPEST_CARD = {
  id: 'budapest-placeholder',
  title: 'Budapest',
  location: 'Budapest, Hungary',
  dateRange: 'Jun 10 - Jun 15, 2026',
  daysText: '5 Days',
  photosText: '0 Photos',
  ratingText: 'N/A Rating',
  tabCategory: 'completed' as Exclude<TabKey, 'all'>,
  coverImage: null as string | null, // set to a real uri once draft/publish is loaded
};

export default function TripsScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabKey>('all');

  const cards = activeTab === 'all' || activeTab === BUDAPEST_CARD.tabCategory
    ? [BUDAPEST_CARD]
    : [];

  const openTrip = (_id: string) => {
    router.push('/(tabs)/create-trip-review');
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#030914', '#081628', '#04101C']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 14 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <View style={styles.headerRow}>
          <Text style={styles.pageTitle}>My Trips</Text>
          <Pressable style={styles.iconButton} hitSlop={8}>
            <Ionicons name="notifications-outline" size={20} color={LuxuryColors.textPrimary} />
          </Pressable>
        </View>

        {/* ── Tabs + filter ───────────────────────────────────────────── */}
        <View style={styles.tabBarRow}>
          <View style={styles.tabsGroup}>
            {TABS.map((tab) => {
              const active = tab.key === activeTab;
              return (
                <Pressable
                  key={tab.key}
                  style={styles.tabItem}
                  onPress={() => setActiveTab(tab.key)}
                  hitSlop={6}
                >
                  <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                    {tab.label}
                  </Text>
                  <View style={[styles.tabUnderline, active && styles.tabUnderlineActive]} />
                </Pressable>
              );
            })}
          </View>
          <Pressable style={styles.filterBtn} hitSlop={8}>
            <Ionicons name="options-outline" size={18} color={LuxuryColors.textPrimary} />
          </Pressable>
        </View>

        {/* ── Cards ──────────────────────────────────────────────────── */}
        {cards.map((card) => (
          <Pressable
            key={card.id}
            style={({ pressed }) => [styles.cardWrap, pressed && styles.cardWrapPressed]}
            onPress={() => openTrip(card.id)}
          >
            <View style={styles.card}>
              {/* Background image or fallback gradient */}
              {card.coverImage ? (
                <Image
                  source={{ uri: card.coverImage }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                />
              ) : (
                <LinearGradient
                  colors={['#0D2137', '#1A3A52', '#0A1F33']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              )}

              {/* Dark bottom-fade overlay */}
              <LinearGradient
                colors={['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.18)', 'rgba(0,0,0,0.78)']}
                locations={[0, 0.35, 1]}
                style={styles.cardGradient}
              >
                {/* Top row — badge + heart */}
                <View style={styles.cardTopRow}>
                  <View style={styles.completedBadge}>
                    <Text style={styles.completedBadgeText}>COMPLETED</Text>
                  </View>
                  <Pressable style={styles.heartBtn} hitSlop={8}>
                    <Ionicons name="heart-outline" size={18} color="#FFFFFF" />
                  </Pressable>
                </View>

                {/* Bottom text block */}
                <View style={styles.cardBottom}>
                  <Text style={styles.cardTitle}>{card.title}</Text>
                  <Text style={styles.cardLocation}>{card.location}</Text>
                  <Text style={styles.cardDate}>{card.dateRange}</Text>

                  {/* Meta chips + arrow */}
                  <View style={styles.metaRow}>
                    <View style={styles.pillsGroup}>
                      <View style={styles.pill}>
                        <Text style={styles.pillText}>{card.daysText}</Text>
                      </View>
                      <View style={styles.pill}>
                        <Text style={styles.pillText}>{card.photosText}</Text>
                      </View>
                      <View style={styles.pill}>
                        <Text style={styles.pillText}>{card.ratingText}</Text>
                      </View>
                    </View>

                    <Pressable
                      style={styles.arrowBtn}
                      onPress={() => openTrip(card.id)}
                      hitSlop={6}
                    >
                      <Ionicons name="arrow-forward" size={18} color="#051728" />
                    </Pressable>
                  </View>
                </View>
              </LinearGradient>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#030914',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: LuxurySpacing.lg,
    paddingBottom: 140,
    gap: 16,
  },

  // ── Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageTitle: {
    color: LuxuryColors.textPrimary,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },

  // ── Tab bar
  tabBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tabsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 22,
  },
  tabItem: {
    alignItems: 'center',
    paddingBottom: 2,
  },
  tabLabel: {
    fontSize: LuxuryFontSize.sm,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.52)',
  },
  tabLabelActive: {
    color: '#88E8FF',
  },
  tabUnderline: {
    marginTop: 6,
    height: 2,
    width: '100%',
    borderRadius: 999,
    backgroundColor: 'transparent',
  },
  tabUnderlineActive: {
    backgroundColor: '#88E8FF',
  },
  filterBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },

  // ── Card shell
  cardWrap: {
    borderRadius: LuxuryBorderRadius.xl,
    overflow: 'hidden',
    // shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.36,
    shadowRadius: 14,
    elevation: 10,
  },
  cardWrapPressed: {
    opacity: 0.92,
  },
  card: {
    height: 330,
    borderRadius: LuxuryBorderRadius.xl,
    overflow: 'hidden',
    backgroundColor: '#0D2137',
  },
  cardGradient: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },

  // ── Card top row
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  completedBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(5,16,28,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(136,232,255,0.44)',
  },
  completedBadgeText: {
    color: '#88E8FF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  heartBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(4,10,18,0.58)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },

  // ── Card bottom text
  cardBottom: {
    gap: 5,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 36,
  },
  cardLocation: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    fontWeight: '600',
  },
  cardDate: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 12,
    fontWeight: '500',
  },

  // ── Meta chips row
  metaRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pillsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
    flexWrap: 'wrap',
    paddingRight: 10,
  },
  pill: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(3,9,20,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  pillText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontWeight: '600',
  },
  arrowBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#88E8FF',
  },
});
