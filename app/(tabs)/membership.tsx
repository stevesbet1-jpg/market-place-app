import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import { LuxuryColors, LuxurySpacing, LuxuryBorderRadius, LuxuryFontSize, LuxuryGradients, LuxuryShadow } from '../../constants/luxuryTheme';
import { getFirebaseApp } from '../../lib/firebase';
import { getUserProfile } from '../../lib/userProfile';

export default function MembershipScreen() {
  const [memberName, setMemberName] = useState<string | null>(null);

  useEffect(() => {
    const auth = getAuth(getFirebaseApp());
    const user = auth.currentUser;
    if (!user) return;
    getUserProfile(user.uid)
      .then((p) => {
        const name = p?.fullName ?? user.displayName ?? null;
        setMemberName(name ? name.split(' ')[0].toUpperCase() : null);
      })
      .catch(() => {
        const name = user.displayName;
        setMemberName(name ? name.split(' ')[0].toUpperCase() : null);
      });
  }, []);

  const handleTierPress = () => {
    Alert.alert('Membership Details', 'Full membership tier details coming soon.');
  };

  const handlePrivilegePress = (privilegeName: string) => {
    Alert.alert('Privilege', `${privilegeName} benefit details coming soon.`);
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
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.vaultIcon}>
          <Ionicons name="lock-closed" size={28} color={LuxuryColors.gold} />
        </View>
        <Text style={styles.title}>Membership Vault</Text>
        <Text style={styles.subtitle}>Your elite credentials</Text>
      </View>

      {/* Premium Black Card */}
      <View style={styles.section}>
        <View style={styles.cardContainer}>
          <LinearGradient colors={LuxuryGradients.surfaceDeep} style={styles.blackCard}>
            <View style={styles.cardGlow} />
            <View style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <Ionicons name="diamond" size={32} color={LuxuryColors.gold} />
                <Text style={styles.cardBrand}>FOUNDER</Text>
              </View>
              <Text style={styles.cardTitle}>BLACK CARD</Text>
              <Text style={styles.cardSubtitle}>Invitation Only</Text>
              <View style={styles.cardFooter}>
                <Text style={styles.cardNumber}>•••• •••• •••• 8888</Text>
                <Text style={styles.cardMember}>{memberName ?? 'MEMBER'}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>
      </View>

      {/* Current Tier */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current Tier</Text>
        <TouchableOpacity 
          style={styles.tierCardActive}
          onPress={handleTierPress}
          activeOpacity={0.8}
        >
          <View style={styles.tierIconActive}>
            <Ionicons name="diamond" size={24} color={LuxuryColors.gold} />
          </View>
          <View style={styles.tierInfo}>
            <Text style={styles.tierTitleActive}>Black Card</Text>
            <Text style={styles.tierSubtitleActive}>Premium benefits active</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={LuxuryColors.gold} />
        </TouchableOpacity>
      </View>

      {/* Key Privileges */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Key Privileges</Text>
        <View style={styles.privilegesList}>
          <TouchableOpacity 
            style={styles.privilegeItem}
            onPress={() => handlePrivilegePress('Private Aviation Access')}
            activeOpacity={0.8}
          >
            <Ionicons name="airplane" size={20} color={LuxuryColors.gold} />
            <Text style={styles.privilegeText}>Private Aviation Access</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.privilegeItem}
            onPress={() => handlePrivilegePress('VIP Dining Reservations')}
            activeOpacity={0.8}
          >
            <Ionicons name="restaurant" size={20} color={LuxuryColors.gold} />
            <Text style={styles.privilegeText}>VIP Dining Reservations</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.privilegeItem}
            onPress={() => handlePrivilegePress('Complimentary Villa Upgrades')}
            activeOpacity={0.8}
          >
            <Ionicons name="diamond" size={20} color={LuxuryColors.gold} />
            <Text style={styles.privilegeText}>Complimentary Villa Upgrades</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.privilegeItem}
            onPress={() => handlePrivilegePress('Premium Travel Insurance')}
            activeOpacity={0.8}
          >
            <Ionicons name="shield-checkmark" size={20} color={LuxuryColors.gold} />
            <Text style={styles.privilegeText}>Premium Travel Insurance</Text>
          </TouchableOpacity>
        </View>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    maxWidth: '100%',
    backgroundColor: LuxuryColors.background,
    overflow: 'hidden',
  },
  header: {
    paddingTop: LuxurySpacing.xl,
    paddingHorizontal: LuxurySpacing.xl,
    paddingBottom: LuxurySpacing.lg,
    alignItems: 'center',
  },
  vaultIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: LuxuryColors.surfaceLight,
    borderWidth: 2,
    borderColor: LuxuryColors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: LuxurySpacing.lg,
    ...LuxuryShadow.gold,
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
  cardContainer: {
    ...LuxuryShadow.metallic,
  },
  blackCard: {
    borderRadius: LuxuryBorderRadius.xxxl,
    padding: LuxurySpacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)',
    position: 'relative',
    overflow: 'hidden',
  },
  cardGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
  },
  cardContent: {
    position: 'relative',
    gap: LuxurySpacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardBrand: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.gold,
    fontWeight: '700',
    letterSpacing: 3,
  },
  cardTitle: {
    fontSize: LuxuryFontSize.xxl,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
    letterSpacing: 2,
  },
  cardSubtitle: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.gold,
    fontWeight: '600',
    letterSpacing: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: LuxurySpacing.sm,
  },
  cardNumber: {
    fontSize: LuxuryFontSize.lg,
    color: LuxuryColors.textPrimary,
    fontWeight: '600',
    letterSpacing: 2,
  },
  cardMember: {
    fontSize: LuxuryFontSize.xs,
    color: LuxuryColors.textSecondary,
    fontWeight: '700',
    letterSpacing: 1,
  },
  tierCardActive: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderWidth: 1.5,
    borderColor: LuxuryColors.gold,
    borderRadius: LuxuryBorderRadius.xl,
    padding: LuxurySpacing.lg,
    gap: LuxurySpacing.md,
  },
  tierIconActive: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: LuxuryColors.gold,
    borderWidth: 1,
    borderColor: LuxuryColors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierInfo: {
    flex: 1,
  },
  tierTitleActive: {
    fontSize: LuxuryFontSize.lg,
    fontWeight: '700',
    color: LuxuryColors.gold,
  },
  tierSubtitleActive: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textSecondary,
  },
  privilegesList: {
    gap: LuxurySpacing.md,
  },
  privilegeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.md,
    backgroundColor: LuxuryColors.surfaceLight,
    borderWidth: 1,
    borderColor: LuxuryColors.divider,
    borderRadius: LuxuryBorderRadius.lg,
    padding: LuxurySpacing.lg,
  },
  privilegeText: {
    fontSize: LuxuryFontSize.md,
    fontWeight: '600',
    color: LuxuryColors.textPrimary,
  },
});
