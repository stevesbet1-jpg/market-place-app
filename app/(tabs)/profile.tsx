import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useFocusEffect } from 'expo-router';
import { LuxuryColors, LuxurySpacing, LuxuryBorderRadius, LuxuryFontSize, LuxuryShadow } from '../../constants/luxuryTheme';
import { getFirebaseApp } from '../../lib/firebase';
import { logoutFromFirebase } from '../../lib/firebaseAuth';
import { getUserProfile, type UserProfile } from '../../lib/userProfile';
import { getSavedIds, setJourneyStoreUid } from '../../constants/journeyStore';
import { getJourneysByIds } from '../../lib/creatorJourneyService';
import { setExperienceStoreUid } from '../../constants/experienceStore';
import type { CreatorJourney } from '../../constants/creatorJourneyModel';
import { getMyApprovedCreatorProfile } from '../../lib/creatorService';

export default function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [savedJourneys, setSavedJourneys] = useState<CreatorJourney[]>([]);
  const [authUid, setAuthUid] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isCreator, setIsCreator] = useState<boolean | null>(null);
  const [creatorName, setCreatorName] = useState<string | null>(null);
  const [creatorProfileId, setCreatorProfileId] = useState<string | null>(null);
  const [creatorProfileUserId, setCreatorProfileUserId] = useState<string | null>(null);
  const [userDocExists, setUserDocExists] = useState<boolean | null>(null);
  const [creatorStatusLoading, setCreatorStatusLoading] = useState(true);

  // ── Saved journeys — reload on every tab focus ─────────────────────────────
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getSavedIds().then(async (ids) => {
        const journeys = await getJourneysByIds(ids);
        if (!cancelled) setSavedJourneys(journeys);
      });
      return () => { cancelled = true; };
    }, [])
  );

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
      setAuthEmail(user?.email ?? null);
      setAuthReady(true);
    });
    return unsubscribe;
  }, []);

  // Clear all account-scoped state immediately when the auth UID changes
  // so the previous account's data never briefly appears for a new account.
  useEffect(() => {
    setProfile(null);
    setIsCreator(null);
    setCreatorName(null);
    setCreatorProfileId(null);
    setCreatorProfileUserId(null);
    setUserDocExists(null);
    setSavedJourneys([]);
    setCreatorStatusLoading(true);
    setLoading(true);
    setJourneyStoreUid(authUid);
    setExperienceStoreUid(authUid);
  }, [authUid]);

  // Load creator status — runs only after auth state is known
  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    const loadCreatorStatus = async () => {
      if (!authUid) {
        console.log('[Profile:Creator] authReady but no uid — user is signed out');
        if (!cancelled) { setIsCreator(false); setCreatorStatusLoading(false); }
        return;
      }
      console.log('[Profile:Creator] Loading creator status for uid:', authUid);
      try {
        const creatorProfile = await getMyApprovedCreatorProfile(authUid);
        console.log('[Profile:Creator] Creator profile result:', creatorProfile ? `found (${creatorProfile.name})` : 'null');
        if (!cancelled) {
          setIsCreator(creatorProfile !== null);
          setCreatorName(creatorProfile?.name ?? null);
          setCreatorProfileId(creatorProfile?.id ?? null);
          setCreatorProfileUserId(creatorProfile?.userId ?? null);
        }
      } catch (err: any) {
        console.warn('[Profile:Creator] Error loading creator status:', err?.message);
        if (!cancelled) {
          setIsCreator(false);
          setCreatorProfileId(null);
          setCreatorProfileUserId(null);
        }
      } finally {
        if (!cancelled) setCreatorStatusLoading(false);
      }
    };
    loadCreatorStatus();
    return () => { cancelled = true; };
  }, [authReady, authUid]);

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
          setUserDocExists(data !== null);
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
        if (!cancelled) setUserDocExists(null);
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

      {__DEV__ ? (
        <View style={styles.debugBox}>
          <Text style={styles.debugTitle}>Runtime Debug (temporary)</Text>
          <Text style={styles.debugText}>auth.uid: {authUid ?? 'null'}</Text>
          <Text style={styles.debugText}>auth.email: {authEmail ?? 'null'}</Text>
          <Text style={styles.debugText}>users/doc exists: {String(userDocExists)}</Text>
          <Text style={styles.debugText}>creatorProfile.id: {creatorProfileId ?? 'null'}</Text>
          <Text style={styles.debugText}>creatorProfile.userId: {creatorProfileUserId ?? 'null'}</Text>
          <Text style={styles.debugText}>saved source: journeyStore (uid-scoped)</Text>
        </View>
      ) : null}

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
          { icon: 'notifications-outline', title: 'Notifications', desc: 'Push and email alerts', route: '/(tabs)/notification-settings' as const },
          { icon: 'language-outline', title: 'Language', desc: 'English (US)', route: null },
          { icon: 'moon-outline', title: 'Dark Mode', desc: 'Always on', route: null },
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
                <Text style={styles.savedCardName} numberOfLines={2}>{j.title}</Text>
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
            style={styles.menuItem}
            onPress={async () => {
              console.log('[Profile:Creator] "Become a Creator" tapped — authUid:', authUid ?? 'null', '| authReady:', authReady);
              // Resolve current user at tap-time to avoid transient null from auth restore race.
              const auth = getAuth(getFirebaseApp());
              const resolvedUid = authUid ?? auth.currentUser?.uid ?? null;
              if (!resolvedUid) {
                console.warn('[Profile:Creator] No authUid — user is not authenticated. Redirecting to login.');
                router.replace('/(auth)/login');
                return;
              }

              // Creator onboarding/subscription flow starts from this screen.
              // Activation occurs when the user continues in creator flows.
              router.push('/(tabs)/creator-subscription');
            }}
            activeOpacity={0.8}
          >
            <View style={styles.menuIcon}>
              <Ionicons name="create-outline" size={24} color={LuxuryColors.gold} />
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
  debugBox: {
    marginHorizontal: LuxurySpacing.xl,
    marginBottom: LuxurySpacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderRadius: LuxuryBorderRadius.lg,
    padding: LuxurySpacing.md,
    gap: 4,
  },
  debugTitle: {
    fontSize: LuxuryFontSize.sm,
    fontWeight: '700',
    color: LuxuryColors.gold,
    marginBottom: 4,
  },
  debugText: {
    fontSize: LuxuryFontSize.xs,
    color: LuxuryColors.textSecondary,
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

