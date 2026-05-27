import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { LuxuryColors, LuxurySpacing, LuxuryBorderRadius, LuxuryFontSize, LuxuryGradients, LuxuryShadow } from '../../constants/luxuryTheme';

export default function TripsScreen() {
  const handleTripPress = (tripName: string) => {
    Alert.alert('Journey Details', `${tripName} details coming soon.`);
  };

  const handleBookAgain = (tripName: string) => {
    Alert.alert('Book Again', `Booking ${tripName} again coming soon.`);
  };
  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      bounces={false}
      alwaysBounceHorizontal={false}
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}
      automaticallyAdjustKeyboardInsets={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Your Trips</Text>
        <Text style={styles.subtitle}>Upcoming and past extraordinary journeys</Text>
      </View>

      {/* Upcoming Trip */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Upcoming</Text>
        <TouchableOpacity 
          style={styles.tripCard}
          onPress={() => handleTripPress('Kyoto Cultural Immersion')}
          activeOpacity={0.8}
        >
          <LinearGradient colors={LuxuryGradients.violetGold} style={styles.tripGradient}>
            <View style={styles.tripContent}>
              <View style={styles.tripBadge}>
                <Text style={styles.tripBadgeText}>Confirmed</Text>
              </View>
              <Text style={styles.tripTitle}>Kyoto Cultural Immersion</Text>
              <Text style={styles.tripDate}>March 15-20, 2026</Text>
              <View style={styles.tripMeta}>
                <Ionicons name="person" size={16} color="#FFFFFF" />
                <Text style={styles.tripMetaText}>2 Guests</Text>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Past Trips */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Past Journeys</Text>
        {[
          { name: 'Santorini Sunset Retreat', date: 'December 2025', gradient: LuxuryGradients.violetDeep },
          { name: 'Maldives Paradise Escape', date: 'October 2025', gradient: LuxuryGradients.violetGold },
        ].map((trip, index) => (
          <TouchableOpacity 
            key={index} 
            style={styles.pastTripCard}
            onPress={() => handleTripPress(trip.name)}
            activeOpacity={0.8}
          >
            <View style={styles.pastTripImage}>
              <LinearGradient colors={trip.gradient} style={styles.pastTripGradient}>
                <Ionicons name="image-outline" size={32} color="rgba(255,255,255,0.5)" />
              </LinearGradient>
            </View>
            <View style={styles.pastTripInfo}>
              <Text style={styles.pastTripName} numberOfLines={2} ellipsizeMode="tail">{trip.name}</Text>
              <Text style={styles.pastTripDate}>{trip.date}</Text>
            </View>
            <TouchableOpacity 
              style={styles.bookAgainButton}
              onPress={() => handleBookAgain(trip.name)}
              activeOpacity={0.7}
            >
              <Text style={styles.bookAgainText}>Book Again</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    maxWidth: '100%',
    backgroundColor: LuxuryColors.surface,
    overflow: 'hidden',
  },
  header: {
    paddingTop: LuxurySpacing.xl,
    paddingHorizontal: LuxurySpacing.xl,
    paddingBottom: LuxurySpacing.lg,
  },
  title: {
    fontSize: LuxuryFontSize.xxxl,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
    marginBottom: LuxurySpacing.sm,
  },
  subtitle: {
    fontSize: LuxuryFontSize.md,
    color: LuxuryColors.textSecondary,
  },
  section: {
    paddingHorizontal: LuxurySpacing.xl,
    marginBottom: LuxurySpacing.xxl,
  },
  sectionTitle: {
    fontSize: LuxuryFontSize.xl,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
    marginBottom: LuxurySpacing.lg,
  },
  tripCard: {
    borderRadius: LuxuryBorderRadius.xxxl,
    overflow: 'hidden',
    ...LuxuryShadow.ambient,
  },
  tripGradient: {
    padding: LuxurySpacing.xl,
  },
  tripContent: {
    gap: LuxurySpacing.sm,
  },
  tripBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: LuxurySpacing.md,
    paddingVertical: LuxurySpacing.xs,
    borderRadius: LuxuryBorderRadius.lg,
    marginBottom: LuxurySpacing.xs,
  },
  tripBadgeText: {
    fontSize: LuxuryFontSize.xs,
    color: LuxuryColors.gold,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tripTitle: {
    fontSize: LuxuryFontSize.xxl,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tripDate: {
    fontSize: LuxuryFontSize.md,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  tripMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.xs,
  },
  tripMetaText: {
    fontSize: LuxuryFontSize.sm,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  pastTripCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LuxuryColors.glass,
    borderWidth: 1,
    borderColor: LuxuryColors.glassBorder,
    borderRadius: LuxuryBorderRadius.xl,
    padding: LuxurySpacing.lg,
    marginBottom: LuxurySpacing.md,
    gap: LuxurySpacing.md,
  },
  pastTripImage: {
    width: 80,
    height: 80,
    borderRadius: LuxuryBorderRadius.lg,
    overflow: 'hidden',
  },
  pastTripGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pastTripInfo: {
    flex: 1,
  },
  pastTripName: {
    fontSize: LuxuryFontSize.lg,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
    marginBottom: LuxurySpacing.xs,
  },
  pastTripDate: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textSecondary,
  },
  bookAgainButton: {
    backgroundColor: LuxuryColors.surfaceLight,
    paddingHorizontal: LuxurySpacing.md,
    paddingVertical: LuxurySpacing.sm,
    borderRadius: LuxuryBorderRadius.lg,
    borderWidth: 1,
    borderColor: LuxuryColors.divider,
  },
  bookAgainText: {
    fontSize: LuxuryFontSize.xs,
    color: LuxuryColors.gold,
    fontWeight: '700',
  },
});
