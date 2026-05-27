import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getAuth } from 'firebase/auth';
import { LuxuryColors, LuxurySpacing, LuxuryBorderRadius, LuxuryFontSize, LuxuryShadow } from '../../constants/luxuryTheme';
import { getFirebaseApp } from '../../lib/firebase';
import { logoutFromFirebase } from '../../lib/firebaseAuth';
import { getUserProfile, type UserProfile } from '../../lib/userProfile';

export default function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const auth = getAuth(getFirebaseApp());
        const user = auth.currentUser;
        if (!user) {
          if (!cancelled) setLoading(false);
          return;
        }
        const data = await getUserProfile(user.uid);
        if (!cancelled) {
          // Merge Auth data as fallback for fields not yet in Firestore
          setProfile(data ?? {
            uid: user.uid,
            email: user.email,
            fullName: user.displayName,
            photoURL: user.photoURL,
            provider: 'email',
          });
        }
      } catch (e: any) {
        console.warn('[Profile] load error:', e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const handleMenuItemPress = (title: string) => {
    Alert.alert(title, `${title} settings coming soon.`);
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await logoutFromFirebase();
          } catch (e: any) {
            console.warn('[Profile] logout error:', e.message);
          }
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const initials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const providerLabel = (p: string | undefined) => {
    if (p === 'google') return 'Google';
    if (p === 'apple') return 'Apple';
    return 'Email';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={LuxuryColors.gold} size="large" />
      </View>
    );
  }

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
        <View style={styles.avatarContainer}>
          {profile?.photoURL ? (
            <Image source={{ uri: profile.photoURL }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarInitials}>{initials(profile?.fullName ?? null)}</Text>
            </View>
          )}
          <View style={styles.providerBadge}>
            <Ionicons
              name={profile?.provider === 'google' ? 'logo-google' : profile?.provider === 'apple' ? 'logo-apple' : 'mail'}
              size={14}
              color={LuxuryColors.textPrimary}
            />
          </View>
        </View>
        <Text style={styles.name}>{profile?.fullName || 'Member'}</Text>
        <Text style={styles.email}>{profile?.email || ''}</Text>
        <Text style={styles.providerText}>Signed in with {providerLabel(profile?.provider)}</Text>
      </View>

      {/* Account menu */}
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

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: LuxuryColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    paddingBottom: LuxurySpacing.xl,
    alignItems: 'center',
  },
  avatarContainer: {
    marginBottom: LuxurySpacing.lg,
    position: 'relative',
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
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: LuxuryColors.gold,
  },
  avatarInitials: {
    fontSize: LuxuryFontSize.xxl,
    fontWeight: '700',
    color: LuxuryColors.gold,
  },
  providerBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: LuxuryColors.violet,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
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
    marginBottom: LuxurySpacing.xs,
  },
  providerText: {
    fontSize: LuxuryFontSize.xs,
    color: LuxuryColors.textTertiary,
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

