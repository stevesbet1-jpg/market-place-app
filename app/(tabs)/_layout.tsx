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
      height: 46 + insets.bottom,
      paddingTop: 8,
      paddingBottom: 0,
      borderTopWidth: 0,
      borderBottomWidth: 0,
      elevation: 0,
      shadowOpacity: 0,
      shadowRadius: 0,
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      backgroundColor: LuxuryColors.background,
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
      <Tabs.Screen
        name="index"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="compass" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: 'Journeys',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="airplane" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="add-product"
        options={{
          title: 'Sell',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="storefront-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ai-concierge"
        options={{
          title: 'Concierge',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="sparkles" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="membership"
        options={{
          title: 'Membership',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="card" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
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
  tabBarBackgroundFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: -50,
    backgroundColor: LuxuryColors.background,
  },
  tabBarItem: {
    justifyContent: 'flex-end',
    paddingBottom: 4,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
});

