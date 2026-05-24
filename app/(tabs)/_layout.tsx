import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { LuxuryColors, LuxurySpacing, LuxuryBorderRadius, LuxuryGradients, LuxuryShadow } from '../../constants/luxuryTheme';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: LuxuryColors.gold,
          tabBarInactiveTintColor: LuxuryColors.textTertiary,
          // Fills the pill background so the area within the tab bar is dark.
          tabBarBackground: () => (
            <View style={{ flex: 1, backgroundColor: LuxuryColors.background }} />
          ),
          tabBarStyle: {
            position: 'absolute',
            // bottom: 0 — pill's bottom edge touches the physical screen bottom.
            // height extends into the home-indicator zone (insets.bottom ≈ 34pt on
            // iPhone X+) so the bar fills that area with dark background.
            // paddingBottom lifts the icons/labels above the home indicator.
            bottom: 0,
            left: 16,
            right: 16,
            height: 72 + insets.bottom,
            paddingTop: 10,
            paddingBottom: insets.bottom + 4,
            borderTopWidth: 0,
            backgroundColor: LuxuryColors.background,
            borderRadius: LuxuryBorderRadius.xxxl,
            borderWidth: 1,
            borderColor: LuxuryColors.glassBorder,
            ...LuxuryShadow.strong,
          },
          headerShown: false,
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '600',
          },
        }}
      >
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
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.conciergeIcon, focused && styles.conciergeIconFocused]}>
              <LinearGradient colors={LuxuryGradients.goldDeep} style={styles.conciergeGradient}>
                <Ionicons name="sparkles" size={24} color="#FFFFFF" />
              </LinearGradient>
            </View>
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
  container: {
    flex: 1,
    backgroundColor: LuxuryColors.background,
  },
  conciergeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: LuxuryColors.surfaceLight,
    borderWidth: 1,
    borderColor: LuxuryColors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -28,
    overflow: 'hidden',
  },
  conciergeIconFocused: {
    borderWidth: 2,
    borderColor: LuxuryColors.gold,
  },
  conciergeGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
