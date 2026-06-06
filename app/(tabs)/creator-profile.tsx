import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LuxuryColors,
  LuxurySpacing,
  LuxuryBorderRadius,
  LuxuryFontSize,
  LuxuryShadow,
} from '../../constants/luxuryTheme';
import { formatFollowers, formatSaves } from '../../constants/creators';
import {
  getCreatorById,
  subscribeCreatorById,
  isFollowingCreator,
  followCreator,
  unfollowCreator,
} from '../../lib/creatorService';
import { getPublishedExperiencesByCreator } from '../../lib/creatorExperienceService';
import { safeOpenUrl } from '../../lib/linkingUtils';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirebaseApp } from '../../lib/firebase';
import { isValidRemoteImageUrl } from '../../lib/imageFallback';
import type { CreatorExperience } from '../../constants/creatorExperienceModel';

function experienceImageSource(experience: CreatorExperience) {
  if (isValidRemoteImageUrl(experience.coverImage)) return { uri: experience.coverImage!.trim() };
  return null;
}

function experienceLocation(experience: CreatorExperience) {
  const locationParts = [experience.city?.trim(), experience.country?.trim()].filter(Boolean);
  return locationParts.length > 0 ? locationParts.join(', ') : 'Location TBA';
}

function experienceTitle(experience: CreatorExperience) {
  return experience.title?.trim() || 'Untitled Experience';
}

function experienceDuration(experience: CreatorExperience) {
  return experience.duration?.trim() || 'Duration TBA';
}

export default function CreatorProfileScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [creator, setCreator] = useState<Awaited<ReturnType<typeof getCreatorById>>>(null);
  const [loadingCreator, setLoadingCreator] = useState(true);
  const [followed, setFollowed] = useState(false);
  const [authUid, setAuthUid] = useState<string | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [creatorExperiences, setCreatorExperiences] = useState<CreatorExperience[]>([]);

  // Auth listener
  useEffect(() => {
    const auth = getAuth(getFirebaseApp());
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthUid(user?.uid ?? null);
    });
    return unsub;
  }, []);

  // Load creator data + follow state
  useEffect(() => {
    let cancelled = false;
    const creatorId = id ?? '';
    getCreatorById(creatorId).then((c) => {
      if (!cancelled) { setCreator(c); setLoadingCreator(false); }
    });
    getPublishedExperiencesByCreator(creatorId).then((experiences) => {
      if (!cancelled) setCreatorExperiences(experiences);
    });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    return subscribeCreatorById(id, (liveCreator) => {
      if (liveCreator) {
        setCreator(liveCreator);
      }
    });
  }, [id]);

  // Load follow state when uid or creatorId changes
  useEffect(() => {
    if (!id || !authUid) {
      setFollowed(false);
      return;
    }
    let cancelled = false;
    isFollowingCreator(id, authUid)
      .then((isFollowing) => {
        if (!cancelled) setFollowed(isFollowing);
      })
      .catch(() => {
        if (!cancelled) setFollowed(false);
      });
    return () => { cancelled = true; };
  }, [authUid, id]);

  const handleFollow = useCallback(() => {
    const creatorId = id ?? '';
    if (!creatorId || !creator || followBusy) return;

    if (!authUid) {
      Alert.alert('Sign In Required', 'Please sign in to follow creators.');
      return;
    }
    if (authUid === creatorId) {
      Alert.alert('Unavailable', 'You cannot follow yourself.');
      return;
    }

    const nextFollowed = !followed;
    const prevFollowers = Math.max(0, creator.followers ?? 0);
    const optimisticFollowers = Math.max(0, prevFollowers + (nextFollowed ? 1 : -1));

    setFollowBusy(true);
    setFollowed(nextFollowed);
    setCreator((prev) => (prev ? { ...prev, followers: optimisticFollowers } : prev));

    const request = nextFollowed
      ? followCreator(creatorId, authUid)
      : unfollowCreator(creatorId, authUid);

    request
      .then((confirmedFollowers) => {
        setCreator((prev) => (prev ? { ...prev, followers: Math.max(0, confirmedFollowers) } : prev));
      })
      .catch((e: unknown) => {
        setFollowed(!nextFollowed);
        setCreator((prev) => (prev ? { ...prev, followers: prevFollowers } : prev));
        Alert.alert(
          nextFollowed ? 'Follow Failed' : 'Unfollow Failed',
          e instanceof Error ? e.message : 'Please try again when your connection is stable.'
        );
      })
      .finally(() => {
        setFollowBusy(false);
      });
  }, [authUid, creator, followed, followBusy, id]);

  if (loadingCreator) {
    return (
      <View style={[styles.container, styles.notFound]}>
        <Text style={styles.notFoundText}>Loading…</Text>
      </View>
    );
  }

  if (!creator) {
    return (
      <View style={[styles.container, styles.notFound]}>
        <Text style={styles.notFoundText}>Creator not found</Text>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8}>
          <Text style={styles.backFallback}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleSocialPress = (type: string, handle: string) => {
    let url = '';
    if (type === 'Instagram') url = handle.startsWith('http') ? handle : `https://instagram.com/${handle.replace('@', '')}`;
    else if (type === 'YouTube') url = handle.startsWith('http') ? handle : `https://youtube.com/${handle}`;
    else url = handle.startsWith('http') ? handle : `https://${handle}`;
    safeOpenUrl(url, `Visit ${handle} manually.`);
  };

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      bounces={false}
      contentInsetAdjustmentBehavior="never"
    >
      {/* ── Demo disclaimer ── */}
      {creator.isDemo && (
        <View style={[styles.demoBanner, { marginTop: insets.top + 8 }]}>
          <Ionicons name="information-circle-outline" size={15} color={LuxuryColors.textSecondary} />
          <Text style={styles.demoBannerText}>
            Demo profile — placeholder content for UI testing only. Not a verified creator.
          </Text>
        </View>
      )}

      {/* ── Back button ── */}
      <TouchableOpacity
        style={[styles.backBtn, { top: insets.top + LuxurySpacing.sm }]}
        onPress={() => router.back()}
        activeOpacity={0.8}
      >
        <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
      </TouchableOpacity>

      {/* ── Hero / Avatar section ── */}
      <LinearGradient
        colors={['rgba(13,21,37,0)', 'rgba(13,21,37,0.85)']}
        style={[styles.heroSection, { paddingTop: insets.top + 72 }]}
      >
        <View style={styles.avatarWrap}>
          <Text style={styles.avatarText}>{creator.initials}</Text>
        </View>
        <Text style={styles.creatorName}>{creator.name}</Text>
        <Text style={styles.creatorBio}>{creator.bio}</Text>

        {/* Follow button */}
        <Pressable
          style={[styles.followBtn, followed && styles.followBtnActive, followBusy && { opacity: 0.7 }]}
          onPress={handleFollow}
          disabled={followBusy}
        >
          <Ionicons
            name={followed ? 'checkmark-circle' : 'person-add-outline'}
            size={14}
            color={followed ? LuxuryColors.background : LuxuryColors.gold}
          />
          <Text style={[styles.followBtnText, followed && styles.followBtnTextActive]}>
            {followBusy ? 'Updating...' : followed ? 'Following' : 'Follow'}
          </Text>
        </Pressable>
      </LinearGradient>

      {/* ── Stats row ── */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <View style={styles.statValueRow}>
            <Ionicons name="star" size={13} color={LuxuryColors.gold} />
            <Text style={styles.statValue}>{creator.rating.toFixed(1)}</Text>
          </View>
          <Text style={styles.statLabel}>Rating</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatFollowers(creator.followers)}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{creatorExperiences.length}</Text>
          <Text style={styles.statLabel}>Experiences</Text>
        </View>
      </View>

      {/* ── Social links ── */}
      {(creator.instagram || creator.youtube || creator.website) && (
        <View style={styles.socialRow}>
          {creator.instagram && (
            <Pressable
              style={styles.socialChip}
              onPress={() => handleSocialPress('Instagram', creator.instagram!)}
            >
              <Ionicons name="logo-instagram" size={13} color={LuxuryColors.textSecondary} />
              <Text style={styles.socialText}>{creator.instagram}</Text>
            </Pressable>
          )}
          {creator.youtube && (
            <Pressable
              style={styles.socialChip}
              onPress={() => handleSocialPress('YouTube', creator.youtube!)}
            >
              <Ionicons name="logo-youtube" size={13} color={LuxuryColors.textSecondary} />
              <Text style={styles.socialText}>{creator.youtube}</Text>
            </Pressable>
          )}
          {creator.website && (
            <Pressable
              style={styles.socialChip}
              onPress={() => handleSocialPress('Website', creator.website!)}
            >
              <Ionicons name="globe-outline" size={13} color={LuxuryColors.textSecondary} />
              <Text style={styles.socialText}>{creator.website}</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* ── Creator's journeys ── */}
      <View style={styles.journeySection}>
        <Text style={styles.sectionLabel}>Published Experiences</Text>
        {creatorExperiences.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No experiences published yet</Text>
          </View>
        ) : (
          <View style={styles.journeyGrid}>
            {creatorExperiences.map((experience) => (
              <Pressable
                key={experience.id}
                style={({ pressed }) => [styles.journeyCard, pressed && styles.journeyCardPressed]}
                onPress={() =>
                  router.push({ pathname: '/(tabs)/experience-detail', params: { id: experience.id } })
                }
              >
                {experienceImageSource(experience) ? (
                  <Image
                    source={experienceImageSource(experience)!}
                    style={styles.journeyCardImg}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.journeyCardImg, { backgroundColor: LuxuryColors.surface }]} />
                )}
                <LinearGradient
                  colors={['transparent', 'rgba(7,17,32,0.90)'] as const}
                  style={StyleSheet.absoluteFill}
                />
                {/* Premium badge */}
                <View style={styles.premiumBadge}>
                  <Ionicons name="diamond" size={7} color={LuxuryColors.gold} />
                  <Text style={styles.premiumBadgeText}>Published</Text>
                </View>
                <View style={styles.journeyCardInfo}>
                  <Text style={styles.journeyRegion}>{experienceLocation(experience)}</Text>
                  <Text style={styles.journeyTitle} numberOfLines={1}>{experienceTitle(experience)}</Text>
                  <View style={styles.journeyMeta}>
                    <View style={styles.journeyMetaItem}>
                      <Ionicons name="time-outline" size={9} color="rgba(255,255,255,0.60)" />
                      <Text style={styles.journeyMetaText}>{experienceDuration(experience)}</Text>
                    </View>
                    <View style={styles.journeyMetaItem}>
                      <Ionicons name="heart" size={9} color="rgba(212,175,55,0.60)" />
                      <Text style={styles.journeyMetaText}>{formatSaves(experience.savedCount)}</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <View style={{ height: 64 + insets.bottom }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LuxuryColors.background,
  },

  // Demo disclaimer banner
  demoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(122,118,104,0.1)',
    borderRadius: LuxuryBorderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(122,118,104,0.2)',
    marginHorizontal: LuxurySpacing.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    zIndex: 10,
  },
  demoBannerText: {
    flex: 1,
    color: LuxuryColors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },

  notFound: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundText: {
    fontSize: LuxuryFontSize.lg,
    color: LuxuryColors.textSecondary,
    marginBottom: LuxurySpacing.md,
  },
  backFallback: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.gold,
  },
  backBtn: {
    position: 'absolute',
    left: LuxurySpacing.xl,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: LuxuryBorderRadius.full,
    backgroundColor: 'rgba(7,17,32,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSection: {
    paddingHorizontal: LuxurySpacing.xl,
    paddingBottom: LuxurySpacing.xl,
    alignItems: 'center',
    gap: LuxurySpacing.md,
    backgroundColor: LuxuryColors.surface,
  },
  avatarWrap: {
    width: 88,
    height: 88,
    borderRadius: LuxuryBorderRadius.full,
    backgroundColor: 'rgba(212,175,55,0.14)',
    borderWidth: 2,
    borderColor: 'rgba(212,175,55,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '800',
    color: LuxuryColors.gold,
    letterSpacing: 1,
  },
  creatorName: {
    fontSize: LuxuryFontSize.xxl,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  creatorBio: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textSecondary,
    lineHeight: 20,
    letterSpacing: 0.1,
    textAlign: 'center',
    maxWidth: 320,
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: LuxurySpacing.xl,
    paddingVertical: 10,
    borderRadius: LuxuryBorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.45)',
    backgroundColor: 'transparent',
    marginTop: LuxurySpacing.xs,
  },
  followBtnActive: {
    backgroundColor: LuxuryColors.gold,
    borderColor: LuxuryColors.gold,
  },
  followBtnText: {
    fontSize: LuxuryFontSize.sm,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 0.5,
  },
  followBtnTextActive: {
    color: LuxuryColors.background,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: LuxurySpacing.lg,
    paddingHorizontal: LuxurySpacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: LuxurySpacing.xl,
  },
  statItem: {
    alignItems: 'center',
    gap: 3,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: LuxuryFontSize.xl,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
    letterSpacing: -0.2,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: LuxuryColors.textTertiary,
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  socialRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: LuxurySpacing.sm,
    paddingHorizontal: LuxurySpacing.xl,
    paddingVertical: LuxurySpacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  socialChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: LuxuryBorderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  socialText: {
    fontSize: 11,
    color: LuxuryColors.textSecondary,
    letterSpacing: 0.1,
  },
  journeySection: {
    paddingTop: LuxurySpacing.xl,
    paddingHorizontal: LuxurySpacing.xl,
    gap: LuxurySpacing.md,
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: LuxurySpacing.xs,
  },
  journeyGrid: {
    gap: LuxurySpacing.md,
  },
  journeyCard: {
    height: 180,
    borderRadius: LuxuryBorderRadius.xl,
    overflow: 'hidden',
    position: 'relative',
    ...LuxuryShadow.soft,
  },
  journeyCardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  journeyCardImg: {
    width: '100%',
    height: '100%',
  },
  premiumBadge: {
    position: 'absolute',
    top: LuxurySpacing.md,
    right: LuxurySpacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(7,17,32,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.45)',
    borderRadius: LuxuryBorderRadius.full,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  premiumBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
  journeyCardInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: LuxurySpacing.md,
    gap: 3,
  },
  journeyRegion: {
    fontSize: 8,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  journeyTitle: {
    fontSize: LuxuryFontSize.md,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.1,
  },
  journeyMeta: {
    flexDirection: 'row',
    gap: LuxurySpacing.sm,
    marginTop: 2,
  },
  journeyMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  journeyMetaText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: LuxurySpacing.xl,
  },
  emptyText: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textTertiary,
  },
});
