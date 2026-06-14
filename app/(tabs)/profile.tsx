import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { LuxuryColors, LuxurySpacing, LuxuryBorderRadius, LuxuryFontSize, LuxuryShadow } from '../../constants/luxuryTheme';
import { getFirebaseApp } from '../../lib/firebase';
import { logoutFromFirebase } from '../../lib/firebaseAuth';
import { getUserProfile, type UserProfile } from '../../lib/userProfile';
import { setJourneyStoreUid } from '../../constants/journeyStore';
import { setExperienceStoreUid } from '../../constants/experienceStore';

export default function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authUid, setAuthUid] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  // ── Auth state listener ─────────────────────────────────────────────────────
  // onAuthStateChanged fires once Firebase has restored the persisted session
  // from AsyncStorage. Using auth.currentUser synchronously at mount time is
  // unreliable because the session restore is async — this is the correct gate.
  useEffect(() => {
    const auth = getAuth(getFirebaseApp());
    console.log('[Profile:Auth] Subscribing to onAuthStateChanged');
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('[Profile:Auth] onAuthStateChanged fired — uid:', user?.uid ?? 'null (signed out)');
      setAuthUid(user?.uid ?? null);
      setAuthReady(true);
    });
    return unsubscribe;
  }, []);

  // Clear all account-scoped state immediately when the auth UID changes
  // so the previous account's data never briefly appears for a new account.
  useEffect(() => {
    setProfile(null);
    setLoading(true);
    setJourneyStoreUid(authUid);
    setExperienceStoreUid(authUid);
  }, [authUid]);

  // Load profile data — runs only after auth state is known
  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    const load = async () => {
      if (!authUid) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const auth = getAuth(getFirebaseApp());
        const user = auth.currentUser;
        console.log('[Profile:Data] Loading profile for uid:', authUid, '| auth.currentUser uid:', user?.uid ?? 'null');
        const data = await getUserProfile(authUid);
        if (!cancelled) {
          // Merge Auth data as fallback for fields not yet in Firestore
          setProfile(data ?? {
            uid: authUid,
            email: user?.email ?? null,
            fullName: user?.displayName ?? null,
            photoURL: user?.photoURL ?? null,
            provider: 'email',
          });
        }
      } catch (e: any) {
        console.warn('[Profile:Data] load error:', e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [authReady, authUid]);

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
          { icon: 'notifications-outline', title: 'Notifications', desc: 'Push and email alerts', route: '/(tabs)/notification-settings' as const },
          { icon: 'options-outline', title: 'Travel Preferences', desc: 'Style, budget and destination interests', route: null },
          { icon: 'moon-outline', title: 'Appearance', desc: 'Dark mode is always on', route: null },
        ].map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.menuItem}
            onPress={() => item.route ? router.push(item.route) : handleMenuItemPress(item.title)}
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Legal</Text>
        {[
          { icon: 'document-text-outline', title: 'Terms of Service', desc: 'Membership and marketplace terms' },
          { icon: 'lock-closed-outline', title: 'Privacy Policy', desc: 'How your data is handled' },
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
    borderRadius: 16,
    backgroundColor: LuxuryColors.violet,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: LuxuryColors.surface,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: LuxurySpacing.md,
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: LuxuryColors.gold,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: LuxuryColors.surfaceLight,
    borderWidth: 2,
    borderColor: LuxuryColors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: LuxuryFontSize.xl,
    fontWeight: '700',
    color: LuxuryColors.gold,
  },
  providerBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: LuxuryColors.surface,
    borderWidth: 1,
    borderColor: LuxuryColors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
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
    borderColor: 'rgba(212,175,55,0.35)',
    alignItems: 'center',
    marginBottom: LuxurySpacing.xl,
  },
  signOutText: {
    fontSize: LuxuryFontSize.md,
    fontWeight: '600',
    color: LuxuryColors.gold,
  },
});

