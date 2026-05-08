import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LuxuryColors, LuxurySpacing, LuxuryBorderRadius, LuxuryFontSize, LuxuryShadow } from '../../constants/luxuryTheme';

export default function ProfileScreen() {
  const handleMenuItemPress = (title: string) => {
    Alert.alert(title, `${title} settings coming soon.`);
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?');
  };
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={48} color={LuxuryColors.textPrimary} />
          </View>
          <TouchableOpacity 
            style={styles.editButton}
            onPress={() => handleMenuItemPress('Edit Profile Photo')}
            activeOpacity={0.7}
          >
            <Ionicons name="camera" size={20} color={LuxuryColors.textPrimary} />
          </TouchableOpacity>
        </View>
        <Text style={styles.name}>Member</Text>
        <Text style={styles.email}>member@example.com</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>0</Text>
          <Text style={styles.statLabel}>Trips</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>0</Text>
          <Text style={styles.statLabel}>Saved</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>0</Text>
          <Text style={styles.statLabel}>Reviews</Text>
        </View>
      </View>

      {/* Menu Items */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        {[
          { icon: 'person-outline', title: 'Personal Information', desc: 'Update your details' },
          { icon: 'card-outline', title: 'Payment Methods', desc: 'Manage cards and wallets' },
          { icon: 'shield-checkmark-outline', title: 'Security', desc: 'Password and 2FA' },
        ].map((item, index) => (
          <TouchableOpacity 
            key={index} 
            style={styles.menuItem}
            onPress={() => handleMenuItemPress(item.title)}
            activeOpacity={0.8}
          >
            <View style={styles.menuIcon}>
              <Ionicons name={item.icon as any} size={24} color={LuxuryColors.textSecondary} />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>{item.title}</Text>
              <Text style={styles.menuDesc}>{item.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={LuxuryColors.textTertiary} />
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        {[
          { icon: 'notifications-outline', title: 'Notifications', desc: 'Push and email alerts' },
          { icon: 'language-outline', title: 'Language', desc: 'English (US)' },
          { icon: 'moon-outline', title: 'Dark Mode', desc: 'Always on' },
        ].map((item, index) => (
          <TouchableOpacity 
            key={index} 
            style={styles.menuItem}
            onPress={() => handleMenuItemPress(item.title)}
            activeOpacity={0.8}
          >
            <View style={styles.menuIcon}>
              <Ionicons name={item.icon as any} size={24} color={LuxuryColors.textSecondary} />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>{item.title}</Text>
              <Text style={styles.menuDesc}>{item.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={LuxuryColors.textTertiary} />
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Support</Text>
        {[
          { icon: 'help-circle-outline', title: 'Help Center', desc: 'FAQs and guides' },
          { icon: 'chatbubble-outline', title: 'Contact Support', desc: '24/7 assistance' },
        ].map((item, index) => (
          <TouchableOpacity 
            key={index} 
            style={styles.menuItem}
            onPress={() => handleMenuItemPress(item.title)}
            activeOpacity={0.8}
          >
            <View style={styles.menuIcon}>
              <Ionicons name={item.icon as any} size={24} color={LuxuryColors.textSecondary} />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>{item.title}</Text>
              <Text style={styles.menuDesc}>{item.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={LuxuryColors.textTertiary} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Sign Out */}
      <TouchableOpacity 
        style={styles.signOutButton}
        onPress={handleSignOut}
        activeOpacity={0.8}
      >
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LuxuryColors.surface,
  },
  header: {
    paddingTop: LuxurySpacing.xl,
    paddingHorizontal: LuxurySpacing.xl,
    paddingBottom: LuxurySpacing.xl,
    alignItems: 'center',
  },
  avatarContainer: {
    marginBottom: LuxurySpacing.lg,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: LuxuryColors.surfaceLight,
    borderWidth: 2,
    borderColor: LuxuryColors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    ...LuxuryShadow.gold,
  },
  editButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: LuxuryColors.violet,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: LuxuryColors.surface,
  },
  name: {
    fontSize: LuxuryFontSize.xxl,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
    marginBottom: LuxurySpacing.xs,
  },
  email: {
    fontSize: LuxuryFontSize.md,
    color: LuxuryColors.textSecondary,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: LuxuryColors.glass,
    borderWidth: 1,
    borderColor: LuxuryColors.glassBorder,
    borderRadius: LuxuryBorderRadius.xl,
    paddingVertical: LuxurySpacing.lg,
    marginHorizontal: LuxurySpacing.xl,
    marginBottom: LuxurySpacing.xxl,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: LuxuryFontSize.xxl,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
    marginBottom: LuxurySpacing.xs,
  },
  statLabel: {
    fontSize: LuxuryFontSize.xs,
    color: LuxuryColors.textSecondary,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    backgroundColor: LuxuryColors.divider,
  },
  section: {
    paddingHorizontal: LuxurySpacing.xl,
    marginBottom: LuxurySpacing.xxl,
  },
  sectionTitle: {
    fontSize: LuxuryFontSize.lg,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
    marginBottom: LuxurySpacing.lg,
  },
  menuItem: {
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
  menuIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: LuxuryColors.surfaceLight,
    borderWidth: 1,
    borderColor: LuxuryColors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuInfo: {
    flex: 1,
  },
  menuTitle: {
    fontSize: LuxuryFontSize.md,
    fontWeight: '600',
    color: LuxuryColors.textPrimary,
    marginBottom: LuxurySpacing.xs,
  },
  menuDesc: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textSecondary,
  },
  signOutButton: {
    marginHorizontal: LuxurySpacing.xl,
    paddingVertical: LuxurySpacing.lg,
    borderRadius: LuxuryBorderRadius.xl,
    borderWidth: 1.5,
    borderColor: LuxuryColors.goldDark,
    alignItems: 'center',
    marginBottom: LuxurySpacing.xl,
  },
  signOutText: {
    fontSize: LuxuryFontSize.md,
    fontWeight: '600',
    color: LuxuryColors.goldDark,
  },
});
