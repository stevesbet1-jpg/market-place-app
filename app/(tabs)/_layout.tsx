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
            // Sit just above the home indicator: insets.bottom (~34pt on iPhone X+)
            // minus 18pt moves the pill lower into the safe zone while still
            // keeping it visually clear of the home bar. Floor at 4pt for
            // devices without a home indicator.
            bottom: Math.max(insets.bottom - 18, 4),
            left: 16,
            right: 16,
            height: 72,
            paddingTop: 10,
            paddingBottom: 8,
            borderTopWidth: 0,
            backgroundColor: 'rgba(7, 17, 32, 0.95)',
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
