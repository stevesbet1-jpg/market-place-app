import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, Image, ActivityIndicator, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { LuxuryColors, LuxurySpacing, LuxuryBorderRadius, LuxuryFontSize, LuxuryShadow } from '../../constants/luxuryTheme';
import type { CreatorJourney } from '../../constants/creatorJourneyModel';
import {
  deleteExperience,
  getCreatorExperiences,
  getExperienceById,
  getExperiencesByIds,
} from '../../lib/creatorExperienceService';
import { listPurchasedExperienceIds } from '../../lib/paymentService';
import { isValidRemoteImageUrl } from '../../lib/imageFallback';
import { getFirebaseApp, getFirestoreDb } from '../../lib/firebase';
import { getMyApprovedCreatorProfile } from '../../lib/creatorService';
import {
  DEFAULT_TRIP_INFO,
  saveCreateTripDraft,
  type CreateTripDraft,
  type ExperienceDraft,
  type ItineraryDayDraft,
  type PhotoEntryDraft,
  type TripInfoDraft,
} from '../../constants/createTripDraftStore';

type ImageKey = 'islands' | 'villas' | 'yacht' | 'desert' | 'mountain' | 'city' | 'temple' | 'bali' | 'seychelles' | 'zanzibar' | 'lakecomo' | 'alps';

const JOURNEY_IMAGES: Record<ImageKey, ReturnType<typeof require>> = {
  islands:    require('../../assets/collections/private-islands.jpg'),
  villas:     require('../../assets/collections/super-villas.jpg'),
  yacht:      require('../../assets/collections/yacht-escapes.jpg'),
  desert:     require('../../assets/collections/desert-retreats.jpg'),
  mountain:   require('../../assets/collections/alpine-mountains.jpg'),
  city:       require('../../assets/collections/japanese-city.jpg'),
  temple:     require('../../assets/collections/japanese-temple.jpg'),
  bali:       require('../../assets/collections/bali-rice.jpg'),
  seychelles: require('../../assets/collections/seychelles-beach.jpg'),
  zanzibar:   require('../../assets/collections/zanzibar-coast.jpg'),
  lakecomo:   require('../../assets/collections/lake-como-view.jpg'),
  alps:       require('../../assets/collections/swiss-alps-day.jpg'),
};

function journeyImageSource(journey: CreatorJourney) {
  if (isValidRemoteImageUrl(journey.imageUri)) return { uri: journey.imageUri!.trim() };
  const key = journey.imageKey as ImageKey | undefined;
  if (key && key in JOURNEY_IMAGES) return JOURNEY_IMAGES[key];
  return null;
}

type ExploreRawDoc = {
  id: string;
  title?: unknown;
  status?: unknown;
  creatorId?: unknown;
  creatorUid?: unknown;
  userId?: unknown;
  uid?: unknown;
  authorId?: unknown;
  createdBy?: unknown;
  ownerId?: unknown;
  city?: unknown;
  country?: unknown;
  duration?: unknown;
  budget?: unknown;
  travelStyle?: unknown;
  coverImage?: unknown;
  createdAt?: unknown;
  published?: unknown;
};

function asOwnerString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function toMillis(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'toMillis' in (value as Record<string, unknown>)) {
    const maybeFn = (value as { toMillis?: unknown }).toMillis;
    if (typeof maybeFn === 'function') {
      try {
        const n = maybeFn.call(value);
        return typeof n === 'number' ? n : null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

function rawDocToJourney(doc: ExploreRawDoc): CreatorJourney {
  const city = typeof doc.city === 'string' ? doc.city.trim() : '';
  const country = typeof doc.country === 'string' ? doc.country.trim() : '';
  const destination = city && country ? `${city}, ${country}` : country || city || 'Unknown destination';
  const budget = doc.budget === '$' || doc.budget === '$$' || doc.budget === '$$$' || doc.budget === '$$$$' ? doc.budget : '$$';
  const status = doc.status === 'draft' || doc.status === 'pending_review' || doc.status === 'published' || doc.status === 'rejected'
    ? doc.status
    : 'published';

  return {
    id: doc.id,
    creatorId:
      asOwnerString(doc.creatorId)
      ?? asOwnerString(doc.creatorUid)
      ?? asOwnerString(doc.userId)
      ?? asOwnerString(doc.uid)
      ?? asOwnerString(doc.authorId)
      ?? asOwnerString(doc.createdBy)
      ?? asOwnerString(doc.ownerId)
      ?? '',
    creatorName: '',
    title: typeof doc.title === 'string' && doc.title.trim().length > 0 ? doc.title : 'Untitled journey',
    destination,
    region: typeof doc.travelStyle === 'string' && doc.travelStyle.trim().length > 0 ? doc.travelStyle.toUpperCase() : 'TRAVEL',
    duration: typeof doc.duration === 'string' && doc.duration.trim().length > 0 ? doc.duration : 'N/A',
    bestTime: '',
    overview: '',
    budget,
    dailyBudget: '',
    places: [],
    restaurants: [],
    experiences: [],
    itinerary: [],
    imageUri: typeof doc.coverImage === 'string' && isValidRemoteImageUrl(doc.coverImage)
      ? doc.coverImage.trim()
      : null,
    rating: 0,
    savedCount: 0,
    status,
    isDemo: false,
    createdAt: toMillis(doc.createdAt),
  };
}

function docMatchesOwner(rawDoc: ExploreRawDoc, ownerIds: Set<string>): boolean {
  const ownerCandidates = [
    rawDoc.creatorId,
    rawDoc.creatorUid,
    rawDoc.userId,
    rawDoc.uid,
    rawDoc.authorId,
    rawDoc.createdBy,
    rawDoc.ownerId,
  ];
  return ownerCandidates
    .map(asOwnerString)
    .some((ownerValue): ownerValue is string => ownerValue !== null && ownerIds.has(ownerValue));
}

export default function TripsScreen() {
  const insets = useSafeAreaInsets();

  const [creatorJourneys, setCreatorJourneys] = useState<CreatorJourney[]>([]);
  const [purchasedJourneys, setPurchasedJourneys] = useState<CreatorJourney[]>([]);
  const [loading, setLoading] = useState(true);
  const [authUid, setAuthUid] = useState<string | null>(null);
  const [isCreator, setIsCreator] = useState(false);
  const [creatorName, setCreatorName] = useState<string>('');
  const [deletingJourneyId, setDeletingJourneyId] = useState<string | null>(null);

  const asObject = (value: unknown): Record<string, unknown> | null => {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  };

  const toStringList = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
  };

  const mapTripInfo = (value: unknown): TripInfoDraft => {
    const raw = asObject(value);
    if (!raw) return { ...DEFAULT_TRIP_INFO };
    return {
      ...DEFAULT_TRIP_INFO,
      destination: typeof raw.destination === 'string' ? raw.destination : DEFAULT_TRIP_INFO.destination,
      startDate: typeof raw.startDate === 'string' ? raw.startDate : DEFAULT_TRIP_INFO.startDate,
      endDate: typeof raw.endDate === 'string' ? raw.endDate : DEFAULT_TRIP_INFO.endDate,
      tripTitle: typeof raw.tripTitle === 'string' ? raw.tripTitle : DEFAULT_TRIP_INFO.tripTitle,
      duration: typeof raw.duration === 'string' ? raw.duration : DEFAULT_TRIP_INFO.duration,
      travelers: typeof raw.travelers === 'string' ? raw.travelers : DEFAULT_TRIP_INFO.travelers,
      tripType: (['Luxury', 'Adventure', 'Food', 'Romantic', 'Family'].includes(String(raw.tripType))
        ? String(raw.tripType)
        : DEFAULT_TRIP_INFO.tripType) as TripInfoDraft['tripType'],
      budget: typeof raw.budget === 'string' ? raw.budget : DEFAULT_TRIP_INFO.budget,
      flightCost: typeof raw.flightCost === 'string' ? raw.flightCost : DEFAULT_TRIP_INFO.flightCost,
      stayCost: typeof raw.stayCost === 'string' ? raw.stayCost : DEFAULT_TRIP_INFO.stayCost,
      foodCost: typeof raw.foodCost === 'string' ? raw.foodCost : DEFAULT_TRIP_INFO.foodCost,
      activitiesCost: typeof raw.activitiesCost === 'string' ? raw.activitiesCost : DEFAULT_TRIP_INFO.activitiesCost,
      notes: typeof raw.notes === 'string' ? raw.notes : DEFAULT_TRIP_INFO.notes,
      highlights: toStringList(raw.highlights),
      coverUri: typeof raw.coverUri === 'string' ? raw.coverUri : DEFAULT_TRIP_INFO.coverUri,
      galleryUris: toStringList(raw.galleryUris),
    };
  };

  const mapItineraryDays = (value: unknown): ItineraryDayDraft[] => {
    if (!Array.isArray(value)) return [];
    return value
      .map((item, index) => {
        const raw = asObject(item);
        if (!raw) return null;
        return {
          id: typeof raw.id === 'string' ? raw.id : `restored-day-${index + 1}`,
          dayLabel: typeof raw.dayLabel === 'string' ? raw.dayLabel : `Day ${index + 1}`,
          dateLabel: typeof raw.dateLabel === 'string' ? raw.dateLabel : '',
          title: typeof raw.title === 'string' ? raw.title : '',
          subtitle: typeof raw.subtitle === 'string' ? raw.subtitle : '',
          imageUri: typeof raw.imageUri === 'string' ? raw.imageUri : '',
          activities: toStringList(raw.activities),
        };
      })
      .filter((item): item is ItineraryDayDraft => item !== null);
  };

  const mapPhotos = (value: unknown): PhotoEntryDraft[] => {
    if (!Array.isArray(value)) return [];
    return value
      .map((item, index) => {
        const raw = asObject(item);
        if (!raw) return null;
        const category = ['Places', 'Food', 'Activities'].includes(String(raw.category))
          ? (String(raw.category) as PhotoEntryDraft['category'])
          : 'Places';
        return {
          id: typeof raw.id === 'string' ? raw.id : `restored-photo-${index + 1}`,
          uri: typeof raw.uri === 'string' ? raw.uri : '',
          caption: typeof raw.caption === 'string' ? raw.caption : '',
          category,
        };
      })
      .filter((item): item is PhotoEntryDraft => item !== null && item.uri.trim().length > 0);
  };

  const mapExperiences = (value: unknown): ExperienceDraft[] => {
    if (!Array.isArray(value)) return [];
    return value
      .map((item, index) => {
        const raw = asObject(item);
        if (!raw) return null;
        const rating = typeof raw.rating === 'number' ? raw.rating : 0;
        return {
          id: typeof raw.id === 'string' ? raw.id : `restored-exp-${index + 1}`,
          title: typeof raw.title === 'string' ? raw.title : '',
          locationDate: typeof raw.locationDate === 'string' ? raw.locationDate : '',
          rating,
          imageUri: typeof raw.imageUri === 'string' ? raw.imageUri : '',
        };
      })
      .filter((item): item is ExperienceDraft => item !== null && item.title.trim().length > 0);
  };

  useEffect(() => {
    const auth = getAuth(getFirebaseApp());
    return onAuthStateChanged(auth, (user) => {
      const uid = user?.uid ?? null;
      setAuthUid(uid);
    });
  }, []);

  // Load purchased journeys independently of creator status
  useEffect(() => {
    if (!authUid) {
      setPurchasedJourneys([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const ids = await listPurchasedExperienceIds();
        if (ids.length === 0) {
          if (!cancelled) setPurchasedJourneys([]);
          return;
        }
        const exps = await getExperiencesByIds(ids);
        const mapped = exps.map((exp) =>
          rawDocToJourney({
            id: exp.id,
            title: exp.title,
            status: exp.status,
            creatorId: exp.creatorId,
            city: exp.city,
            country: exp.country,
            duration: exp.duration,
            budget: exp.budget,
            travelStyle: exp.travelStyle,
            coverImage: exp.coverImage,
            createdAt: exp.createdAt,
            published: exp.published,
          })
        );
        if (!cancelled) setPurchasedJourneys(mapped);
      } catch {
        if (!cancelled) setPurchasedJourneys([]);
      }
    })();
    return () => { cancelled = true; };
  }, [authUid]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);

      async function loadCreatorJourneys() {
        try {
          if (!authUid) {
            if (!cancelled) {
              setCreatorJourneys([]);
              setIsCreator(false);
              setCreatorName('');
              setLoading(false);
            }
            return;
          }

          const creatorProfile = await getMyApprovedCreatorProfile(authUid);
          if (!creatorProfile) {
            const ownExperiences = await getCreatorExperiences(authUid);
            const ownJourneys = ownExperiences
              .map((exp) => rawDocToJourney({
                id: exp.id,
                title: exp.title,
                status: exp.status,
                creatorId: exp.creatorId,
                city: exp.city,
                country: exp.country,
                duration: exp.duration,
                budget: exp.budget,
                travelStyle: exp.travelStyle,
                coverImage: exp.coverImage,
                createdAt: exp.createdAt,
                published: exp.published,
              }))
              .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

            if (!cancelled) {
              setCreatorJourneys(ownJourneys);
              setIsCreator(true);
              setCreatorName('My');
              setLoading(false);
            }
            return;
          }

          const ownerIds = new Set(
            [creatorProfile.id, creatorProfile.userId, authUid]
              .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
              .map((value) => value.trim())
          );

          const db = getFirestoreDb();
          const publishedSnap = await getDocs(
            query(collection(db, 'creatorExperiences'), where('published', '==', true))
          );
          const publishedRawDocs: ExploreRawDoc[] = publishedSnap.docs
            .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Record<string, unknown>) } as ExploreRawDoc))
            .filter((doc) => doc.status === 'published');

          for (const doc of publishedRawDocs) {
            console.log('[MyJourneys:ExploreRawDoc]', {
              id: doc.id,
              title: doc.title,
              status: doc.status,
              creatorId: doc.creatorId,
              creatorUid: doc.creatorUid,
              userId: doc.userId,
              uid: doc.uid,
              authorId: doc.authorId,
              createdBy: doc.createdBy,
              ownerId: doc.ownerId,
            });
          }

          const ownedPublishedDocs = publishedRawDocs.filter((doc) => docMatchesOwner(doc, ownerIds));

          // Drafts are not on Explore; load creator-scoped docs and merge.
          const creatorScopedGroups = await Promise.all(
            [...ownerIds].map((ownerId) => getCreatorExperiences(ownerId))
          );
          // Keep ALL statuses from getCreatorExperiences so the Map id-dedup can
          // collapse any doc that also appears in the published query.
          const creatorScopedAll = creatorScopedGroups
            .flat()
            .map((exp) => {
              const journey = rawDocToJourney({
                id: exp.id,
                title: exp.title,
                status: exp.status,
                creatorId: exp.creatorId,
                city: exp.city,
                country: exp.country,
                duration: exp.duration,
                budget: exp.budget,
                travelStyle: exp.travelStyle,
                coverImage: exp.coverImage,
                createdAt: exp.createdAt,
                published: exp.published,
              });
              console.log('[MyJourneys:creatorScopedQuery]', {
                source: 'getCreatorExperiences',
                collection: 'creatorExperiences',
                id: journey.id,
                title: journey.title,
                status: exp.status,
                creatorId: exp.creatorId,
              });
              return journey;
            });

          const publishedJourneys = ownedPublishedDocs.map((doc) => {
            const journey = rawDocToJourney(doc);
            console.log('[MyJourneys:publishedQuery]', {
              source: 'publishedExploreQuery',
              collection: 'creatorExperiences',
              id: journey.id,
              title: journey.title,
              status: doc.status,
              creatorId: doc.creatorId,
              creatorUid: doc.creatorUid,
              userId: doc.userId,
            });
            return journey;
          });

          // Primary dedup: by document id (collapses same doc from multiple query paths).
          const uniqueById = new Map<string, CreatorJourney>();
          for (const journey of [...creatorScopedAll, ...publishedJourneys]) {
            if (!uniqueById.has(journey.id)) {
              uniqueById.set(journey.id, journey);
            }
          }

          // Fallback dedup: by normalised title (catches genuinely separate docs
          // that are logical duplicates with identical titles).
          const uniqueJourneys = new Map<string, CreatorJourney>();
          for (const journey of uniqueById.values()) {
            const normTitle = journey.title.trim().toLowerCase();
            if (!uniqueJourneys.has(normTitle)) {
              uniqueJourneys.set(normTitle, journey);
            } else {
              console.warn('[MyJourneys:titleDedupe] dropping duplicate title', {
                keptId: uniqueJourneys.get(normTitle)!.id,
                droppedId: journey.id,
                title: journey.title,
              });
            }
          }

          const journeys = [...uniqueJourneys.values()].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
          if (cancelled) return;

          setCreatorJourneys(journeys);
          setIsCreator(true);
          setCreatorName(creatorProfile.name ?? 'Creator');
          setLoading(false);
        } catch (err) {
          console.error('[Trips] load error:', err);
          if (!cancelled) setLoading(false);
        }
      }

      loadCreatorJourneys();
      return () => { cancelled = true; };
    }, [authUid])
  );

  const draftJourneys = creatorJourneys.filter((journey) => journey.status === 'draft');
  const publishedJourneys = creatorJourneys.filter((journey) => journey.status === 'published');

  const handleEditJourney = useCallback(async (journey: CreatorJourney) => {
    try {
      const experience = await getExperienceById(journey.id);
      if (!experience) {
        Alert.alert('Trip Not Found', 'Could not load this trip for editing.');
        return;
      }

      const tripData = asObject(experience.tripData);
      const draftTripInfo = mapTripInfo(tripData?.tripInfo);
      const draft: CreateTripDraft = {
        tripInfo: {
          ...draftTripInfo,
          tripTitle: draftTripInfo.tripTitle || experience.title,
          destination: draftTripInfo.destination || [experience.city, experience.country].filter(Boolean).join(', '),
          duration: draftTripInfo.duration || experience.duration,
          notes: draftTripInfo.notes || experience.description,
          coverUri: draftTripInfo.coverUri || experience.coverImage,
        },
        itineraryDays: mapItineraryDays(tripData?.itineraryDays),
        photos: mapPhotos(tripData?.photos ?? tripData?.galleryPhotos),
        experiences: mapExperiences(tripData?.experiences),
        updatedAt: Date.now(),
      };

      await saveCreateTripDraft(draft);
      router.push('/(tabs)/create-trip');
    } catch {
      Alert.alert('Edit Failed', 'Unable to open this trip for editing right now.');
    }
  }, []);

  const handleDeleteJourney = useCallback((journey: CreatorJourney) => {
    Alert.alert(
      'Delete Trip',
      `Delete "${journey.title}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingJourneyId(journey.id);
              await deleteExperience(journey.id);
              setCreatorJourneys((prev) => prev.filter((item) => item.id !== journey.id));
            } catch {
              Alert.alert('Delete Failed', 'Unable to delete this trip right now.');
            } finally {
              setDeletingJourneyId(null);
            }
          },
        },
      ]
    );
  }, []);

  function renderJourneyCard(journey: CreatorJourney, showManageActions = false) {
    return (
      <View
        key={journey.id}
        style={styles.journeyCard}
      >
        <View style={styles.journeyMediaWrap}>
          {journeyImageSource(journey) ? (
            <Image
              source={journeyImageSource(journey)!}
              style={styles.journeyMedia}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.journeyMedia, { backgroundColor: LuxuryColors.surface }]} />
          )}
          <LinearGradient
            colors={['transparent', 'rgba(7,17,32,0.88)'] as const}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.journeyOverlay}>
            <Text style={styles.journeyRegion}>{journey.region}</Text>
            <Text style={styles.journeyTitle} numberOfLines={1}>{journey.title}</Text>
            <Text style={styles.journeyMeta} numberOfLines={1}>{journey.destination} · {journey.duration}</Text>
          </View>
        </View>
        <Pressable
          style={({ pressed }) => [styles.viewJourneyBtn, pressed && { opacity: 0.75 }]}
          onPress={() => router.push({ pathname: '/(tabs)/experience-detail', params: { id: journey.id } })}
        >
          <Text style={styles.viewJourneyBtnText}>View Journey</Text>
          <Ionicons name="arrow-forward" size={13} color={LuxuryColors.background} />
        </Pressable>
        {showManageActions ? (
          <View style={styles.manageActionsRow}>
            <Pressable style={styles.manageActionBtn} onPress={() => handleEditJourney(journey)}>
              <Ionicons name="create-outline" size={14} color={LuxuryColors.textSecondary} />
              <Text style={styles.manageActionText}>Edit</Text>
            </Pressable>
            <Pressable
              style={[styles.manageActionBtn, deletingJourneyId === journey.id && { opacity: 0.6 }]}
              onPress={() => handleDeleteJourney(journey)}
              disabled={deletingJourneyId === journey.id}
            >
              <Ionicons name="trash-outline" size={14} color="rgba(255,90,90,0.9)" />
              <Text style={styles.manageDeleteText}>{deletingJourneyId === journey.id ? 'Deleting...' : 'Delete'}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={LuxuryColors.gold} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      bounces={false}
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}
    >
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + LuxurySpacing.xl }]}>
        <Text style={styles.overline}>Travel Creator Studio</Text>
        <Text style={styles.title}>My Created Journeys</Text>
        <Text style={styles.subtitle}>Draft and published journeys owned by your creator account</Text>
      </View>

      {!authUid ? (
        <View style={styles.savedEmptyState}>
          <Ionicons name="person-outline" size={18} color="rgba(212,175,55,0.40)" />
          <Text style={styles.savedEmptyText}>Sign in to view your journeys</Text>
          <Text style={styles.savedEmptySubtext}>Your creator drafts and published journeys will appear here</Text>
        </View>
      ) : (
        <>
          {/* ── Creator sections (visible only if user has an approved creator account) ── */}
          {isCreator && (
            <>
              <View style={styles.savedSection}>
                <View style={styles.savedHeader}>
                  <Text style={styles.sectionLabel}>Draft Journeys</Text>
                  <Text style={styles.savedCount}>{draftJourneys.length}</Text>
                </View>
                {draftJourneys.length > 0 ? (
                  draftJourneys.map((journey) => renderJourneyCard(journey, true))
                ) : (
                  <View style={styles.savedEmptyState}>
                    <Ionicons name="document-text-outline" size={18} color="rgba(212,175,55,0.40)" />
                    <Text style={styles.savedEmptyText}>No drafts yet</Text>
                    <Text style={styles.savedEmptySubtext}>Draft journeys you create will appear here</Text>
                  </View>
                )}
              </View>

              <View style={styles.savedSection}>
                <View style={styles.savedHeader}>
                  <Text style={styles.sectionLabel}>Published Journeys</Text>
                  <Text style={styles.savedCount}>{publishedJourneys.length}</Text>
                </View>
                {publishedJourneys.length > 0 ? (
                  publishedJourneys.map((journey) => renderJourneyCard(journey, true))
                ) : (
                  <View style={styles.savedEmptyState}>
                    <Ionicons name="globe-outline" size={18} color="rgba(212,175,55,0.40)" />
                    <Text style={styles.savedEmptyText}>No published journeys yet</Text>
                    <Text style={styles.savedEmptySubtext}>{creatorName ? `${creatorName}, publish a journey to see it here` : 'Publish a journey to see it here'}</Text>
                  </View>
                )}
              </View>
            </>
          )}

          {/* ── Purchased journeys (visible to all logged-in users) ── */}
          <View style={styles.savedSection}>
            <View style={styles.savedHeader}>
              <Text style={styles.sectionLabel}>Purchased Journeys</Text>
              <Text style={styles.savedCount}>{purchasedJourneys.length}</Text>
            </View>
            {purchasedJourneys.length > 0 ? (
              purchasedJourneys.map((journey) => renderJourneyCard(journey))
            ) : (
              <View style={styles.savedEmptyState}>
                <Ionicons name="bag-outline" size={18} color="rgba(212,175,55,0.40)" />
                <Text style={styles.savedEmptyText}>No purchased journeys yet</Text>
                <Text style={styles.savedEmptySubtext}>Journeys you unlock will appear here</Text>
              </View>
            )}
          </View>
        </>
      )}

      <View style={{ height: 64 + insets.bottom }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LuxuryColors.background,
  },
  header: {
    paddingHorizontal: LuxurySpacing.xl,
    paddingBottom: LuxurySpacing.md,
  },
  overline: {
    fontSize: 9,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: LuxurySpacing.sm,
  },
  title: {
    fontSize: LuxuryFontSize.xxxl,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: LuxurySpacing.xs,
  },
  subtitle: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textSecondary,
    letterSpacing: 0.2,
    lineHeight: 20,
  },
  savedSection: {
    marginBottom: LuxurySpacing.xl,
  },
  savedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: LuxurySpacing.xl,
    marginBottom: LuxurySpacing.md,
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  savedCount: {
    fontSize: 9,
    fontWeight: '700',
    color: LuxuryColors.textTertiary,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: LuxuryBorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    letterSpacing: 0.3,
  },
  savedList: {
    paddingHorizontal: LuxurySpacing.xl,
    gap: LuxurySpacing.md,
    paddingRight: LuxurySpacing.xxl,
  },
  journeyCard: {
    marginHorizontal: LuxurySpacing.xl,
    marginBottom: LuxurySpacing.sm,
    borderRadius: LuxuryBorderRadius.xl,
    overflow: 'hidden',
    ...LuxuryShadow.soft,
  },
  journeyCardPressed: {
    opacity: 0.9,
  },
  viewJourneyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: LuxuryColors.gold,
    marginHorizontal: LuxurySpacing.md,
    marginBottom: LuxurySpacing.md,
    marginTop: 2,
    paddingVertical: 9,
    borderRadius: LuxuryBorderRadius.md,
  },
  viewJourneyBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: LuxuryColors.background,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  manageActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: LuxurySpacing.md,
    marginBottom: LuxurySpacing.md,
    gap: 10,
  },
  manageActionBtn: {
    flex: 1,
    minHeight: 34,
    borderRadius: LuxuryBorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  manageActionText: {
    color: LuxuryColors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  manageDeleteText: {
    color: 'rgba(255,90,90,0.95)',
    fontSize: 11,
    fontWeight: '700',
  },
  journeyMediaWrap: {
    height: 132,
    width: '100%',
    position: 'relative',
  },
  journeyMedia: {
    width: '100%',
    height: '100%',
  },
  journeyOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: LuxurySpacing.md,
    gap: 3,
  },
  journeyRegion: {
    fontSize: 9,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  journeyTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.1,
    lineHeight: 16,
  },
  journeyMeta: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.82)',
    letterSpacing: 0.2,
  },
  savedEmptyState: {
    marginHorizontal: LuxurySpacing.xl,
    marginBottom: LuxurySpacing.xl,
    alignItems: 'center',
    gap: 6,
    paddingVertical: LuxurySpacing.xl,
    paddingHorizontal: LuxurySpacing.lg,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: LuxuryBorderRadius.xl,
    borderStyle: 'dashed',
  },
  savedEmptyText: {
    fontSize: LuxuryFontSize.md,
    fontWeight: '600',
    color: LuxuryColors.textTertiary,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  savedEmptySubtext: {
    fontSize: 12,
    color: 'rgba(122,118,104,0.65)',
    letterSpacing: 0.1,
    textAlign: 'center',
    lineHeight: 18,
  },
});

