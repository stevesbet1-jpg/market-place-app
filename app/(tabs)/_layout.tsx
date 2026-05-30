import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet } from 'react-native';
import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LuxuryColors } from '../../constants/luxuryTheme';

// ─── Module-level constants — allocated once at import time, never recreated ──

/** Tells the Tabs navigator to add zero bottom safe-area padding internally.
 *  We handle the home-indicator zone ourselves via tabBarStyle height. */
const TABS_SAFE_AREA_INSETS = { bottom: 0 };

/** Stable background component — passing a function reference (not an arrow
 *  literal) means React Navigation never sees a new prop value here. */
function TabBarBackground() {
  return (
    <View style={styles.tabBarBackgroundOuter}>
      <View style={styles.tabBarTopBorder} />
      <View style={styles.tabBarBackgroundFill} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  // Only recalculated if insets.bottom changes (never in practice after mount).
  const tabBarStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      bottom: 0,
      left: 0,
      right: 0,
      height: 60 + insets.bottom,
      paddingTop: 9,
      // Push tab items above the home indicator
      paddingBottom: insets.bottom > 0 ? insets.bottom - 4 : 4,
      borderTopWidth: 0,
      borderBottomWidth: 0,
      elevation: 0,
      shadowOpacity: 0,
      shadowRadius: 0,
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      backgroundColor: 'transparent',
    }),
    [insets.bottom],
  );

  // Freeze the entire screenOptions object so <Tabs> never receives a new prop
  // reference on re-renders, preventing any internal layout recalculation.
  const screenOptions = useMemo(
    () => ({
      tabBarActiveTintColor: LuxuryColors.gold,
      tabBarInactiveTintColor: LuxuryColors.textTertiary,
      tabBarBackground: TabBarBackground,
      tabBarStyle,
      headerShown: false,
      tabBarItemStyle: styles.tabBarItem,
      tabBarLabelStyle: styles.tabBarLabel,
    }),
    [tabBarStyle],
  );

  return (
    <View style={styles.container}>
      <Tabs safeAreaInsets={TABS_SAFE_AREA_INSETS} screenOptions={screenOptions}>
        {/* ── Visible tabs (5) ─────────────────────────────── */}
        <Tabs.Screen
          name="index"
          options={{
            title: 'Explore',
            tabBarIcon: ({ color }) => (
              <Ionicons name="compass" size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="trips"
          options={{
            title: 'Trips',
            tabBarIcon: ({ color }) => (
              <Ionicons name="map" size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="ai-concierge"
          options={{
            title: 'AI',
            tabBarIcon: ({ color }) => (
              <Ionicons name="sparkles" size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="membership"
          options={{
            title: 'Club',
            tabBarIcon: ({ color }) => (
              <Ionicons name="diamond" size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color }) => (
              <Ionicons name="person" size={22} color={color} />
            ),
          }}
        />

        {/* ── Hidden screens (no tab button) ───────────────── */}
        <Tabs.Screen name="journey-detail" options={{ tabBarButton: () => null }} />
        <Tabs.Screen name="creator-profile" options={{ tabBarButton: () => null }} />
        <Tabs.Screen name="paywall" options={{ tabBarButton: () => null }} />
        <Tabs.Screen name="add-product" options={{ tabBarButton: () => null }} />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  // position:'absolute' + all edges 0 fills the FULL parent view bounds,
  // ignoring any implicit paddingBottom the Stack may apply. This is the
  // key difference from flex:1, which would stop short of any parent padding.
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: LuxuryColors.background,
  },
  tabBarBackgroundOuter: {
    flex: 1,
    overflow: 'visible',
  },
  tabBarTopBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(212,175,55,0.12)',
  },
  tabBarBackgroundFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: -50,
    backgroundColor: LuxuryColors.background,
    opacity: 0.97,
  },
  tabBarItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 2,
    overflow: 'visible',
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '600',
    includeFontPadding: false,
    flexShrink: 0,
    overflow: 'visible',
  },
});

