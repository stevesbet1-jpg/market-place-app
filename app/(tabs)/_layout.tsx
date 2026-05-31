import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LuxuryColors } from '../../constants/luxuryTheme';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

// ─── Tab definitions ──────────────────────────────────────────────────────────

const VISIBLE_TABS = [
  'index',
  'trips',
  'ai-concierge',
  'membership',
  'profile',
] as const;

type VisibleTab = (typeof VISIBLE_TABS)[number];

const TAB_META: Record<VisibleTab, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  'index':        { label: 'Explore', icon: 'compass'  },
  'trips':        { label: 'Trips',   icon: 'map'      },
  'ai-concierge': { label: 'AI',      icon: 'sparkles' },
  'membership':   { label: 'Club',    icon: 'diamond'  },
  'profile':      { label: 'Profile', icon: 'person'   },
};

// ─── Custom Tab Bar ───────────────────────────────────────────────────────────
// Using a custom tabBar render prop gives us 100% control over sizing and
// text rendering — eliminating all React Navigation internal truncation logic.

function AppTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {/* Top gold hairline */}
      <View style={styles.topBorder} />

      {VISIBLE_TABS.map((tabName) => {
        const routeIndex = state.routes.findIndex((r) => r.name === tabName);
        if (routeIndex === -1) return null;

        const route = state.routes[routeIndex];
        const isFocused = state.index === routeIndex;
        const color = isFocused ? LuxuryColors.gold : LuxuryColors.textTertiary;
        const meta = TAB_META[tabName];

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <TouchableOpacity
            key={tabName}
            style={styles.tabItem}
            onPress={onPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
          >
            <Ionicons name={meta.icon} size={24} color={color} />
            <Text style={[styles.label, { color }]}>
              {meta.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function TabLayout() {
  return (
    <View style={styles.container}>
      <Tabs
        tabBar={(props) => <AppTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        {/* Visible tabs */}
        <Tabs.Screen name="index"        options={{ title: 'Explore' }} />
        <Tabs.Screen name="trips"        options={{ title: 'Trips'   }} />
        <Tabs.Screen name="ai-concierge" options={{ title: 'AI'      }} />
        <Tabs.Screen name="membership"   options={{ title: 'Club'    }} />
        <Tabs.Screen name="profile"      options={{ title: 'Profile' }} />

        {/* Hidden screens */}
        <Tabs.Screen name="journey-detail"  options={{ tabBarButton: () => null }} />
        <Tabs.Screen name="creator-profile" options={{ tabBarButton: () => null }} />
        <Tabs.Screen name="paywall"         options={{ tabBarButton: () => null }} />
        <Tabs.Screen name="add-product"          options={{ tabBarButton: () => null }} />
        <Tabs.Screen name="upload-journey"       options={{ tabBarButton: () => null }} />
        <Tabs.Screen name="creator-subscription" options={{ tabBarButton: () => null }} />
      </Tabs>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: LuxuryColors.background,
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LuxuryColors.background,
    paddingTop: 10,
  },
  topBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(212,175,55,0.12)',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    includeFontPadding: false,
  },
});
