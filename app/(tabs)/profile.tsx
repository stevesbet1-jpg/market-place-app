import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getAuth } from 'firebase/auth';
import { LuxuryColors, LuxurySpacing, LuxuryBorderRadius, LuxuryFontSize, LuxuryShadow } from '../../constants/luxuryTheme';
import { getFirebaseApp } from '../../lib/firebase';
import { logoutFromFirebase } from '../../lib/firebaseAuth';
import { getUserProfile, type UserProfile } from '../../lib/userProfile';
import { getSavedIds } from '../../constants/journeyStore';
import { JOURNEYS, type ImageKey } from '../../constants/journeys';
import { getCurrentUid, getMyApprovedCreatorProfile, activateCreator } from '../../lib/creatorService';

export default function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [savedJourneys, setSavedJourneys] = useState<(typeof JOURNEYS)[number][]>([]);
  const [isCreator, setIsCreator] = useState<boolean | null>(null);
  const [creatorName, setCreatorName] = useState<string | null>(null);
  const [creatorStatusLoading, setCreatorStatusLoading] = useState(true);
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    getSavedIds().then((ids) => {
      setSavedJourneys(JOURNEYS.filter((j) => ids.includes(j.id)));
    });
  }, []);

  // Load creator status
  useEffect(() => {
    let cancelled = false;
    const loadCreatorStatus = async () => {
      const uid = getCurrentUid();
      if (!uid) {
        if (!cancelled) { setIsCreator(false); setCreatorStatusLoading(false); }
        return;
      }
      try {
        const creatorProfile = await getMyApprovedCreatorProfile(uid);
        if (!cancelled) {
          setIsCreator(creatorProfile !== null);
          setCreatorName(creatorProfile?.name ?? null);
        }
      } catch {
        if (!cancelled) setIsCreator(false);
      } finally {
        if (!cancelled) setCreatorStatusLoading(false);
      }
    };
    loadCreatorStatus();
    return () => { cancelled = true; };
  }, []);

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

      {/* Saved Journeys */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Saved Journeys</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/trips')} activeOpacity={0.7}>
            <Text style={styles.sectionLink}>Browse All</Text>
          </TouchableOpacity>
        </View>
        {savedJourneys.length === 0 ? (
          <TouchableOpacity
            style={styles.emptyCard}
            onPress={() => router.push('/(tabs)/trips')}
            activeOpacity={0.8}
          >
            <Ionicons name="bookmark-outline" size={24} color={LuxuryColors.textTertiary} />
            <Text style={styles.emptyCardText}>No saved journeys yet</Text>
            <Text style={styles.emptyCardLink}>Explore journeys →</Text>
          </TouchableOpacity>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.savedScroll}>
            {savedJourneys.map((j) => (
              <TouchableOpacity
                key={j.id}
                style={styles.savedCard}
                onPress={() => router.push({ pathname: '/(tabs)/journey-detail', params: { id: j.id } })}
                activeOpacity={0.85}
              >
                <View style={styles.savedCardThumb}>
                  <Ionicons name="map-outline" size={22} color={LuxuryColors.gold} />
                </View>
                <Text style={styles.savedCardName} numberOfLines={2}>{j.name}</Text>
                <Text style={styles.savedCardDest} numberOfLines={1}>{j.destination}</Text>
                <View style={styles.savedCardRating}>
                  <Ionicons name="star" size={10} color={LuxuryColors.gold} />
                  <Text style={styles.savedCardRatingText}>{j.rating.toFixed(1)}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Membership CTA */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.membershipCta}
          onPress={() => router.push('/(tabs)/membership')}
          activeOpacity={0.85}
        >
          <View style={styles.membershipCtaLeft}>
            <Ionicons name="diamond" size={20} color={LuxuryColors.gold} />
            <View>
              <Text style={styles.membershipCtaTitle}>Creator Membership</Text>
              <Text style={styles.membershipCtaDesc}>Unlock every creator journey</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={LuxuryColors.gold} />
        </TouchableOpacity>
      </View>

      {/* Creator — dynamic status section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Creator</Text>
        {creatorStatusLoading ? (
          <View style={styles.creatorStatusLoading}>
            <ActivityIndicator size="small" color={LuxuryColors.gold} />
          </View>
        ) : isCreator ? (
          // Active creator — show dashboard links
          <>
            <View style={styles.creatorStatusCard}>
              <View style={[styles.creatorStatusIcon, { backgroundColor: 'rgba(46,213,115,0.12)', borderColor: 'rgba(46,213,115,0.3)' }]}>
                <Ionicons name="checkmark-circle" size={24} color={LuxuryColors.success} />
              </View>
              <View style={styles.creatorStatusBody}>
                <Text style={styles.creatorStatusTitle}>Creator Account Active</Text>
                <Text style={styles.creatorStatusSub}>
                  {creatorName ? `Welcome, ${creatorName}` : 'Your creator account is active'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/(tabs)/creator-dashboard')}
              activeOpacity={0.8}
            >
              <View style={styles.menuIcon}>
                <Ionicons name="briefcase-outline" size={24} color={LuxuryColors.gold} />
              </View>
              <View style={styles.menuInfo}>
                <Text style={styles.menuTitle}>Creator Dashboard</Text>
                <Text style={styles.menuDesc}>Manage experiences and analytics</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={LuxuryColors.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/(tabs)/create-experience')}
              activeOpacity={0.8}
            >
              <View style={styles.menuIcon}>
                <Ionicons name="add-circle-outline" size={24} color={LuxuryColors.gold} />
              </View>
              <View style={styles.menuInfo}>
                <Text style={styles.menuTitle}>Create Experience</Text>
                <Text style={styles.menuDesc}>Publish a new travel experience</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={LuxuryColors.textTertiary} />
            </TouchableOpacity>
          </>
        ) : (
          // Not yet a creator — show "Become a Creator" activation button
          <TouchableOpacity
            style={[styles.menuItem, activating && { opacity: 0.6 }]}
            disabled={activating}
            onPress={async () => {
              const uid = getCurrentUid();
              if (!uid) { router.replace('/(auth)/login'); return; }
              setActivating(true);
              try {
                const creatorProfile = await activateCreator(uid, profile?.fullName ?? '');
                setIsCreator(true);
                setCreatorName(creatorProfile.name);
              } catch (e: any) {
                Alert.alert('Error', e?.message ?? 'Could not activate creator account. Please try again.');
              } finally {
                setActivating(false);
              }
            }}
            activeOpacity={0.8}
          >
            <View style={styles.menuIcon}>
              {activating
                ? <ActivityIndicator size="small" color={LuxuryColors.gold} />
                : <Ionicons name="create-outline" size={24} color={LuxuryColors.gold} />}
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>Become a Creator</Text>
              <Text style={styles.menuDesc}>Share your travel experiences — free to start</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={LuxuryColors.textTertiary} />
          </TouchableOpacity>
        )}
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
    borderColor: 'rgba(212,175,55,0.35)',
    alignItems: 'center',
    marginBottom: LuxurySpacing.xl,
  },
  signOutText: {
    fontSize: LuxuryFontSize.md,
    fontWeight: '600',
    color: LuxuryColors.gold,
  },

  // ── Saved Journeys ───────────────────────────────────────
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: LuxurySpacing.md,
  },
  sectionLink: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.gold,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: LuxurySpacing.sm,
    paddingVertical: LuxurySpacing.xl,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: LuxuryBorderRadius.xl,
  },
  emptyCardText: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textTertiary,
    letterSpacing: 0.1,
  },
  emptyCardLink: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.gold,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  savedScroll: {
    marginHorizontal: -LuxurySpacing.xl,
    paddingHorizontal: LuxurySpacing.xl,
  },
  savedCard: {
    width: 120,
    marginRight: LuxurySpacing.sm,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: LuxuryBorderRadius.lg,
    padding: LuxurySpacing.sm,
    gap: 4,
  },
  savedCardThumb: {
    width: '100%',
    height: 56,
    borderRadius: LuxuryBorderRadius.md,
    backgroundColor: 'rgba(212,175,55,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  savedCardName: {
    fontSize: 11,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
    letterSpacing: 0.1,
  },
  savedCardDest: {
    fontSize: 10,
    color: LuxuryColors.textSecondary,
    letterSpacing: 0.1,
  },
  savedCardRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  savedCardRatingText: {
    fontSize: 10,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 0.2,
  },

  // ── Membership CTA ───────────────────────────────────────
  membershipCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(212,175,55,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.30)',
    borderRadius: LuxuryBorderRadius.xl,
    padding: LuxurySpacing.md,
  },
  membershipCtaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.md,
  },
  membershipCtaTitle: {
    fontSize: LuxuryFontSize.sm,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
    letterSpacing: 0.1,
  },
  membershipCtaDesc: {
    fontSize: 11,
    color: LuxuryColors.textSecondary,
    letterSpacing: 0.1,
  },

  // ── Creator status card ───────────────────────────────────
  creatorStatusLoading: {
    paddingVertical: LuxurySpacing.lg,
    alignItems: 'center',
  },
  creatorStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.md,
    backgroundColor: LuxuryColors.glass,
    borderWidth: 1,
    borderColor: LuxuryColors.glassBorder,
    borderRadius: LuxuryBorderRadius.xl,
    padding: LuxurySpacing.lg,
    marginBottom: LuxurySpacing.md,
  },
  creatorStatusIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorStatusBody: {
    flex: 1,
    gap: 3,
  },
  creatorStatusTitle: {
    fontSize: LuxuryFontSize.sm,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
  },
  creatorStatusSub: {
    fontSize: LuxuryFontSize.xs,
    color: LuxuryColors.textSecondary,
    lineHeight: 16,
  },

  // ── Legacy chip styles (kept for reference) ───────────────
  creatorsRow: {
    flexDirection: 'row',
    gap: LuxurySpacing.md,
  },
  creatorChip: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  creatorChipAvatar: {
    width: 48,
    height: 48,
    borderRadius: LuxuryBorderRadius.full,
    backgroundColor: 'rgba(212,175,55,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorChipInitials: {
    fontSize: 13,
    fontWeight: '800',
    color: LuxuryColors.gold,
    letterSpacing: 0.3,
  },
  creatorChipName: {
    fontSize: 10,
    fontWeight: '600',
    color: LuxuryColors.textSecondary,
    letterSpacing: 0.1,
    textAlign: 'center',
  },
});

