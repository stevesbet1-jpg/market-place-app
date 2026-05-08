import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LuxuryColors, LuxurySpacing, LuxuryBorderRadius, LuxuryFontSize, LuxuryGradients, LuxuryShadow } from '../../constants/luxuryTheme';

const { width } = Dimensions.get('window');

export default function ExploreScreen() {
  const handleNotificationPress = () => {
    Alert.alert('Notifications', 'No new notifications at this time.');
  };

  const handleViewAllPress = () => {
    Alert.alert('Collections', 'View all collections coming soon.');
  };

  const handleConciergePress = () => {
    router.push('/(tabs)/ai-concierge');
  };

  const handleDestinationPress = (destName: string) => {
    Alert.alert('Destination', `${destName} details coming soon.`);
  };

  const handlePrivilegePress = (privilegeName: string) => {
    Alert.alert('Privilege', `${privilegeName} benefit details coming soon.`);
  };
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Elegant Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>M</Text>
          </View>
          <TouchableOpacity 
            style={styles.notificationButton}
            onPress={handleNotificationPress}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={24} color={LuxuryColors.textPrimary} />
          </TouchableOpacity>
        </View>
        <Text style={styles.greeting}>Good Evening, Member</Text>
        <Text style={styles.subtitle}>Your next extraordinary journey awaits</Text>
      </View>

      {/* Cinematic Hero - Single Premium Card */}
      <TouchableOpacity 
        style={styles.heroCard}
        onPress={() => handleDestinationPress('Private Island Escape')}
        activeOpacity={0.8}
      >
        <LinearGradient colors={LuxuryGradients.violetGold} style={styles.heroGradient}>
          <View style={styles.heroContent}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>Private Access</Text>
            </View>
            <Text style={styles.heroTitle}>Private Island Escape</Text>
            <Text style={styles.heroSubtitle}>Exclusive members-only retreat in the Maldives</Text>
            <View style={styles.heroMeta}>
              <Ionicons name="diamond" size={16} color={LuxuryColors.gold} />
              <Text style={styles.heroMetaText}>Founder Circle</Text>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* Curated Collections */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Curated Collections</Text>
          <TouchableOpacity onPress={handleViewAllPress} activeOpacity={0.7}>
            <Text style={styles.sectionLink}>View All</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.collectionScroll}>
          {[
            { name: 'Santorini', tag: 'Private Villas' },
            { name: 'Kyoto', tag: 'Cultural' },
            { name: 'Amalfi', tag: 'Coastal' },
            { name: 'Patagonia', tag: 'Expedition' },
          ].map((dest, index) => (
            <TouchableOpacity 
              key={index} 
              style={styles.collectionCard}
              onPress={() => handleDestinationPress(dest.name)}
              activeOpacity={0.8}
            >
              <View style={styles.collectionImage}>
                <Ionicons name="image-outline" size={32} color={LuxuryColors.textTertiary} />
              </View>
              <Text style={styles.collectionName}>{dest.name}</Text>
              <Text style={styles.collectionTag}>{dest.tag}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* AI Concierge Recommendation */}
      <TouchableOpacity 
        style={styles.conciergeCard}
        onPress={handleConciergePress}
        activeOpacity={0.8}
      >
        <LinearGradient colors={LuxuryGradients.goldDeep} style={styles.conciergeGradient}>
          <View style={styles.conciergeContent}>
            <View style={styles.conciergeIconContainer}>
              <Ionicons name="sparkles" size={28} color="#FFFFFF" />
            </View>
            <View style={styles.conciergeText}>
              <Text style={styles.conciergeTitle}>Your AI Concierge</Text>
              <Text style={styles.conciergeSubtitle}>Personalized journey recommendations await</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#FFFFFF" />
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* Member Privileges */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Member Privileges</Text>
        </View>
        <View style={styles.privilegesGrid}>
          <TouchableOpacity 
            style={styles.privilegeCard}
            onPress={() => handlePrivilegePress('Private Aviation')}
            activeOpacity={0.8}
          >
            <View style={styles.privilegeIcon}>
              <Ionicons name="airplane" size={24} color={LuxuryColors.gold} />
            </View>
            <Text style={styles.privilegeTitle}>Private Aviation</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.privilegeCard}
            onPress={() => handlePrivilegePress('VIP Dining')}
            activeOpacity={0.8}
          >
            <View style={styles.privilegeIcon}>
              <Ionicons name="restaurant" size={24} color={LuxuryColors.gold} />
            </View>
            <Text style={styles.privilegeTitle}>VIP Dining</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.privilegeCard}
            onPress={() => handlePrivilegePress('Villa Upgrades')}
            activeOpacity={0.8}
          >
            <View style={styles.privilegeIcon}>
              <Ionicons name="diamond" size={24} color={LuxuryColors.gold} />
            </View>
            <Text style={styles.privilegeTitle}>Villa Upgrades</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.privilegeCard}
            onPress={() => handlePrivilegePress('Travel Insurance')}
            activeOpacity={0.8}
          >
            <View style={styles.privilegeIcon}>
              <Ionicons name="shield-checkmark" size={24} color={LuxuryColors.gold} />
            </View>
            <Text style={styles.privilegeTitle}>Travel Insurance</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ height: 120 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LuxuryColors.background,
  },
  header: {
    paddingTop: LuxurySpacing.xl,
    paddingHorizontal: LuxurySpacing.xl,
    paddingBottom: LuxurySpacing.lg,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: LuxurySpacing.lg,
  },
  logoContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: LuxuryColors.surfaceLight,
    borderWidth: 1.5,
    borderColor: LuxuryColors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: LuxuryColors.gold,
  },
  notificationButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: LuxuryColors.glass,
    borderWidth: 1,
    borderColor: LuxuryColors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: {
    fontSize: LuxuryFontSize.xxxxxl,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
    marginBottom: LuxurySpacing.xs,
    letterSpacing: -1.5,
  },
  subtitle: {
    fontSize: LuxuryFontSize.lg,
    color: LuxuryColors.textSecondary,
    fontWeight: '400',
  },
  heroCard: {
    marginHorizontal: LuxurySpacing.xl,
    height: 280,
    borderRadius: LuxuryBorderRadius.xxxl,
    overflow: 'hidden',
    marginBottom: LuxurySpacing.xxl,
    ...LuxuryShadow.ambient,
  },
  heroGradient: {
    flex: 1,
    padding: LuxurySpacing.xl,
    justifyContent: 'flex-end',
  },
  heroContent: {
    gap: LuxurySpacing.sm,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: LuxurySpacing.md,
    paddingVertical: LuxurySpacing.xs,
    borderRadius: LuxuryBorderRadius.lg,
    marginBottom: LuxurySpacing.xs,
  },
  heroBadgeText: {
    fontSize: LuxuryFontSize.xs,
    color: LuxuryColors.gold,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  heroTitle: {
    fontSize: LuxuryFontSize.xxl,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: LuxuryFontSize.md,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.xs,
  },
  heroMetaText: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.gold,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: LuxurySpacing.xl,
    marginBottom: LuxurySpacing.xxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: LuxurySpacing.lg,
  },
  sectionTitle: {
    fontSize: LuxuryFontSize.xl,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
  },
  sectionLink: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.violetLight,
    fontWeight: '600',
  },
  collectionScroll: {
    flexDirection: 'row',
  },
  collectionCard: {
    marginRight: LuxurySpacing.md,
    alignItems: 'center',
    width: 120,
  },
  collectionImage: {
    width: 120,
    height: 160,
    borderRadius: LuxuryBorderRadius.lg,
    backgroundColor: LuxuryColors.surfaceLight,
    borderWidth: 1,
    borderColor: LuxuryColors.divider,
    marginBottom: LuxurySpacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collectionName: {
    fontSize: LuxuryFontSize.md,
    fontWeight: '600',
    color: LuxuryColors.textPrimary,
  },
  collectionTag: {
    fontSize: LuxuryFontSize.xs,
    color: LuxuryColors.gold,
    fontWeight: '600',
  },
  conciergeCard: {
    marginHorizontal: LuxurySpacing.xl,
    borderRadius: LuxuryBorderRadius.xxl,
    overflow: 'hidden',
    marginBottom: LuxurySpacing.xxl,
    ...LuxuryShadow.medium,
  },
  conciergeGradient: {
    padding: LuxurySpacing.lg,
  },
  conciergeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.lg,
  },
  conciergeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  conciergeText: {
    flex: 1,
  },
  conciergeTitle: {
    fontSize: LuxuryFontSize.lg,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: LuxurySpacing.xs,
  },
  conciergeSubtitle: {
    fontSize: LuxuryFontSize.sm,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  privilegesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: LuxurySpacing.md,
  },
  privilegeCard: {
    width: (width - LuxurySpacing.xxxl - LuxurySpacing.md) / 2,
    backgroundColor: LuxuryColors.surfaceLight,
    borderWidth: 1,
    borderColor: LuxuryColors.divider,
    borderRadius: LuxuryBorderRadius.xl,
    padding: LuxurySpacing.lg,
    alignItems: 'center',
    gap: LuxurySpacing.sm,
  },
  privilegeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: LuxuryColors.glass,
    borderWidth: 1,
    borderColor: LuxuryColors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  privilegeTitle: {
    fontSize: LuxuryFontSize.sm,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
    textAlign: 'center',
  },
});
