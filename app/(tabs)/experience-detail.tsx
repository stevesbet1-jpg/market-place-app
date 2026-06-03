/**
 * experience-detail.tsx
 *
 * Premium Experience Detail Page.
 *
 * Route params:
 *   id — Firestore document ID of a CreatorExperience
 *
 * Lock logic:
 *   Free users preview: Hero, Overview, Creator Notes, Day 1
 *   Full access (Day 2+, Map, Restaurants, Hidden Gems) requires:
 *     - A free view credit (consumed on first open, persisted locally)
 *     - OR future membership / purchase (paywall CTA shown otherwise)
 *
 * DO NOT TOUCH: Tab Bar, Explore, Trips, AI, Membership, Profile,
 *               Creator Dashboard, Payments.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import {
  LuxuryColors,
  LuxurySpacing,
  LuxuryBorderRadius,
  LuxuryFontSize,
  LuxuryShadow,
} from '../../constants/luxuryTheme';
import type { CreatorExperience, DailyPlanEntry, TravelStyle, Restaurant, HiddenGem, Hotel } from '../../constants/creatorExperienceModel';
import { travelStyleLabel } from '../../constants/creatorExperienceModel';
import { getExperienceById, incrementExperienceViews, incrementExperienceUnlocks } from '../../lib/creatorExperienceService';
import { getFirebaseApp } from '../../lib/firebase';
import { checkMembership } from '../../lib/membershipService';
import { safeOpenUrl } from '../../lib/linkingUtils';
import {
  isExperienceUnlocked,
  getSavedExperienceIds,
  toggleSavedExperience,
  FREE_EXPERIENCE_LIMIT,
} from '../../constants/experienceStore';
import {
  getFreeCreditCount,
  consumeCredit,
} from '../../lib/freeCreditService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = 340;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function budgetLabel(b: string): string {
  switch (b) {
    case '$': return 'Budget';
    case '$$': return 'Mid-range';
    case '$$$': return 'Premium';
    case '$$$$': return 'Ultra-luxury';
    default: return b;
  }
}

function bestSeason(exp: CreatorExperience): string {
  // Derive a plausible season from the description or country name
  const text = (exp.description + ' ' + exp.country + ' ' + exp.city).toLowerCase();
  if (/ski|snow|winter|alps|iceland/.test(text)) return 'Winter (Dec – Feb)';
  if (/spring|cherry|bloom|flower/.test(text)) return 'Spring (Mar – May)';
  if (/monsoon|rainy|wet season/.test(text)) return 'Dry Season (Nov – Apr)';
  if (/beach|summer|ocean|sea|tropical/.test(text)) return 'May – October';
  return 'Year-round';
}

function whoItsFor(style: TravelStyle): string {
  switch (style) {
    case 'luxury':    return 'Discerning travelers seeking premium experiences';
    case 'adventure': return 'Active explorers and adventure seekers';
    case 'budget':    return 'Budget-conscious travelers';
    case 'family':    return 'Families with children';
    case 'food':      return 'Food enthusiasts and culinary explorers';
  }
}

/**
 * Splits an activities array into morning / afternoon / evening thirds.
 * Returns an object with up to 3 keys. Falls back to a flat list if < 3 items.
 */
function splitTimeOfDay(activities: string[]): {
  morning: string[];
  afternoon: string[];
  evening: string[];
} {
  const n = activities.length;
  if (n === 0) return { morning: [], afternoon: [], evening: [] };
  if (n < 3) return { morning: activities, afternoon: [], evening: [] };
  const third = Math.ceil(n / 3);
  return {
    morning: activities.slice(0, third),
    afternoon: activities.slice(third, third * 2),
    evening: activities.slice(third * 2),
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StyleTag({ style }: { style: TravelStyle }) {
  const label = travelStyleLabel(style);
  return (
    <View style={tagStyles.tag}>
      <Text style={tagStyles.tagText}>{label}</Text>
    </View>
  );
}

function SectionTitle({ title, icon }: { title: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={detailStyles.sectionHeader}>
      <Ionicons name={icon} size={18} color={LuxuryColors.gold} />
      <Text style={detailStyles.sectionTitle}>{title}</Text>
    </View>
  );
}

function InfoPill({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={detailStyles.infoPill}>
      <Ionicons name={icon} size={14} color={LuxuryColors.gold} />
      <View style={{ marginLeft: LuxurySpacing.xs }}>
        <Text style={detailStyles.infoPillLabel}>{label}</Text>
        <Text style={detailStyles.infoPillValue}>{value}</Text>
      </View>
    </View>
  );
}

function BulletItem({ text }: { text: string }) {
  return (
    <View style={detailStyles.bulletRow}>
      <View style={detailStyles.bulletDot} />
      <Text style={detailStyles.bulletText}>{text}</Text>
    </View>
  );
}

// ─── Paywall Banner ───────────────────────────────────────────────────────────

function PaywallBanner({
  sectionName,
  freeRemaining,
  onUseFreeCredit,
}: {
  sectionName: string;
  freeRemaining: number;
  onUseFreeCredit: () => void;
}) {
  return (
    <View style={paywallStyles.banner}>
      <View style={paywallStyles.iconCircle}>
        <Ionicons name="lock-closed" size={22} color={LuxuryColors.gold} />
      </View>
      <Text style={paywallStyles.title}>Premium Content</Text>
      <Text style={paywallStyles.desc}>
        {sectionName} is exclusive content from this creator.
      </Text>

      {freeRemaining > 0 ? (
        <TouchableOpacity
          style={paywallStyles.freeCta}
          onPress={onUseFreeCredit}
          activeOpacity={0.85}
        >
          <Ionicons name="gift-outline" size={14} color={LuxuryColors.background} />
          <Text style={paywallStyles.freeCtaText}>
            Unlock free ({freeRemaining} of {FREE_EXPERIENCE_LIMIT} remaining)
          </Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={paywallStyles.memberCta}
          onPress={() => router.push('/(tabs)/membership')}
          activeOpacity={0.85}
        >
          <Ionicons name="diamond" size={12} color={LuxuryColors.background} />
          <Text style={paywallStyles.memberCtaText}>Unlock with Club</Text>
        </TouchableOpacity>
      )}

      {freeRemaining === 0 && (
        <Text style={paywallStyles.exhaustedNote}>
          You've used all {FREE_EXPERIENCE_LIMIT} free views. Join the club for unlimited access.
        </Text>
      )}
    </View>
  );
}

// ─── Day Card ─────────────────────────────────────────────────────────────────

function DayCard({ entry }: { entry: DailyPlanEntry }) {
  return (
    <View style={dayStyles.card}>
      <View style={dayStyles.dayHeader}>
        <View style={dayStyles.dayBadge}>
          <Text style={dayStyles.dayBadgeText}>Day {entry.day}</Text>
        </View>
        {entry.title ? <Text style={dayStyles.dayTitle}>{entry.title}</Text> : null}
      </View>
      {entry.description ? (
        <Text style={dayStyles.dayDescription}>{entry.description}</Text>
      ) : null}
    </View>
  );
}

// ─── Restaurant Card ──────────────────────────────────────────────────────────

function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
  return (
    <View style={placeStyles.card}>
      <View style={placeStyles.cardLeft}>
        <View style={placeStyles.iconCircle}>
          <Ionicons name="restaurant-outline" size={18} color={LuxuryColors.gold} />
        </View>
      </View>
      <View style={placeStyles.cardBody}>
        <Text style={placeStyles.placeName}>{restaurant.name}</Text>
        {restaurant.description ? (
          <Text style={placeStyles.placeNote}>{restaurant.description}</Text>
        ) : null}
      </View>
    </View>
  );
}

// ─── Hidden Gem Card ──────────────────────────────────────────────────────────

function HiddenGemCard({ gem }: { gem: HiddenGem }) {
  return (
    <View style={placeStyles.card}>
      <View style={placeStyles.cardLeft}>
        <View style={[placeStyles.iconCircle, { backgroundColor: 'rgba(212,175,55,0.18)' }]}>
          <Ionicons name="star-outline" size={18} color={LuxuryColors.gold} />
        </View>
      </View>
      <View style={placeStyles.cardBody}>
        <Text style={placeStyles.placeName}>{gem.name}</Text>
        {gem.description ? (
          <Text style={placeStyles.placeNote}>{gem.description}</Text>
        ) : null}
        <View style={placeStyles.insiderBadge}>
          <Text style={placeStyles.insiderBadgeText}>Insider Tip</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Map Placeholder ──────────────────────────────────────────────────────────

function MapPlaceholder({
  city,
  country,
}: {
  city: string;
  country: string;
}) {
  const query = encodeURIComponent(`${city}, ${country}`);
  const mapsUrl = `https://maps.google.com/?q=${query}`;

  const handleOpenMaps = () => {
    safeOpenUrl(mapsUrl, 'Could not open Maps.');
  };

  return (
    <View style={mapStyles.placeholder}>
      <View style={mapStyles.inner}>
        <Ionicons name="map-outline" size={36} color={LuxuryColors.textTertiary} />
        <Text style={mapStyles.label}>{city}, {country}</Text>
        <Text style={mapStyles.sublabel}>
          Interactive map integration coming soon.
        </Text>
        <TouchableOpacity
          style={mapStyles.openBtn}
          onPress={handleOpenMaps}
          activeOpacity={0.85}
        >
          <Ionicons name="navigate-outline" size={14} color={LuxuryColors.background} />
          <Text style={mapStyles.openBtnText}>Open in Maps</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ExperienceDetailScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const experienceId = params.id;

  const [experience, setExperience] = useState<CreatorExperience | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [freeRemaining, setFreeRemaining] = useState(FREE_EXPERIENCE_LIMIT);
  const [isSaved, setIsSaved] = useState(false);
  const [savingToggle, setSavingToggle] = useState(false);
  const [isMember, setIsMember] = useState(false);

  // ── Membership check: members always have full access ───────────────
  useEffect(() => {
    const auth = getAuth(getFirebaseApp());
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { setIsMember(false); return; }
      const active = await checkMembership(user.uid);
      setIsMember(active);
      if (active) setIsUnlocked(true); // members bypass free credit gate
    });
    return unsubscribe;
  }, []);

  // ── Load experience + unlock state ─────────────────────────────────
  useEffect(() => {
    if (!experienceId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const [exp, unlocked, remaining, savedIds] = await Promise.all([
          getExperienceById(experienceId as string),
          isExperienceUnlocked(experienceId as string),
          getFreeCreditCount(),
          getSavedExperienceIds(),
        ]);

        if (cancelled) return;

        if (!exp) {
          setNotFound(true);
        } else {
          setExperience(exp);
          setIsUnlocked(unlocked);
          setFreeRemaining(remaining);
          setIsSaved(savedIds.includes(experienceId as string));
          // P2.2: fire-and-forget view increment
          incrementExperienceViews(experienceId as string);
        }
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [experienceId]);

  // ── Consume a free credit ───────────────────────────────────────────
  const handleUseFreeCredit = useCallback(async () => {
    if (!experienceId || isUnlocked) return;
    try {
      const newRemaining = await consumeCredit(experienceId);
      setIsUnlocked(true);
      setFreeRemaining(newRemaining);
      // P2.3: fire-and-forget unlock increment
      incrementExperienceUnlocks(experienceId as string);
    } catch {
      Alert.alert('Error', 'Could not unlock experience. Try again.');
    }
  }, [experienceId, isUnlocked]);

  // ── Save toggle ─────────────────────────────────────────────────────
  const handleToggleSave = useCallback(async () => {
    if (!experienceId || savingToggle) return;
    setSavingToggle(true);
    console.log('[SaveTrip] experience id:', experienceId);
    try {
      const newSaved = await toggleSavedExperience(experienceId as string);
      const nowSaved = newSaved.includes(experienceId as string);
      setIsSaved(nowSaved);
      console.log('[SaveTrip] write success — saved:', nowSaved, '— total saved count:', newSaved.length);
    } catch (err) {
      console.error('[SaveTrip] write failure:', err);
      Alert.alert('Error', 'Could not update saved state.');
    } finally {
      setSavingToggle(false);
    }
  }, [experienceId, savingToggle]);

  // ── Loading ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={LuxuryColors.gold} size="large" />
      </View>
    );
  }

  // ── Not found ───────────────────────────────────────────────────────
  if (notFound || !experience) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <TouchableOpacity
          style={styles.backBtnAbs}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={LuxuryColors.textPrimary} />
        </TouchableOpacity>
        <Ionicons name="compass-outline" size={48} color={LuxuryColors.textTertiary} />
        <Text style={styles.notFoundTitle}>Experience not available</Text>
        <Text style={styles.notFoundBody}>
          This experience may have been removed or is not yet published.
        </Text>
        <TouchableOpacity
          style={styles.notFoundCta}
          onPress={() => router.back()}
          activeOpacity={0.85}
        >
          <Text style={styles.notFoundCtaText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Derived values ──────────────────────────────────────────────────
  const initials = deriveInitials(experience.creatorName);
  const season = bestSeason(experience);
  const days = parseInt(experience.duration, 10);
  const difficulty =
    !isNaN(days) && days >= 14 ? 'Advanced' :
    !isNaN(days) && days >= 7 ? 'Moderate' : 'Easy';
  const difficultyColor =
    difficulty === 'Advanced' ? '#FF6B6B' :
    difficulty === 'Moderate' ? '#FFA040' : '#4CAF80';

  const firstDay = experience.dailyPlan[0] ?? null;
  const remainingDays = experience.dailyPlan.slice(1);

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces
        contentContainerStyle={{ paddingBottom: insets.bottom + LuxurySpacing.xxl }}
      >
        {/* ─────────────────────────────────────────────────────────────
            1. HERO
        ───────────────────────────────────────────────────────────── */}
        <View style={heroStyles.container}>
          {experience.coverImage ? (
            <Image
              source={{ uri: experience.coverImage }}
              style={heroStyles.image}
              resizeMode="cover"
            />
          ) : (
            <View style={heroStyles.imageFallback}>
              <Ionicons name="globe-outline" size={64} color={LuxuryColors.textTertiary} />
            </View>
          )}

          {/* Gradient overlay */}
          <LinearGradient
            colors={['transparent', 'rgba(7,17,32,0.65)', LuxuryColors.background]}
            locations={[0.2, 0.6, 1]}
            style={heroStyles.gradient}
          />

          {/* Back button */}
          <TouchableOpacity
            style={[heroStyles.backBtn, { top: insets.top + LuxurySpacing.sm }]}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={20} color={LuxuryColors.textPrimary} />
          </TouchableOpacity>

          {/* Save button */}
          <TouchableOpacity
            style={[heroStyles.saveBtn, { top: insets.top + LuxurySpacing.sm }]}
            onPress={handleToggleSave}
            activeOpacity={0.8}
            disabled={savingToggle}
          >
            <Ionicons
              name={isSaved ? 'bookmark' : 'bookmark-outline'}
              size={20}
              color={isSaved ? LuxuryColors.gold : LuxuryColors.textPrimary}
            />
          </TouchableOpacity>

          {/* Hero text overlay */}
          <View style={heroStyles.textOverlay}>
            {/* Creator attribution */}
            <View style={heroStyles.creatorRow}>
              <View style={heroStyles.avatar}>
                <Text style={heroStyles.avatarInitials}>{initials}</Text>
              </View>
              <Text style={heroStyles.creatorName}>{experience.creatorName}</Text>
            </View>

            <Text style={heroStyles.title}>{experience.title}</Text>

            {/* Quick meta */}
            <View style={heroStyles.metaRow}>
              <View style={heroStyles.metaChip}>
                <Ionicons name="location-outline" size={12} color={LuxuryColors.gold} />
                <Text style={heroStyles.metaChipText}>
                  {experience.city}, {experience.country}
                </Text>
              </View>
              <View style={heroStyles.metaChip}>
                <Ionicons name="time-outline" size={12} color={LuxuryColors.gold} />
                <Text style={heroStyles.metaChipText}>{experience.duration}</Text>
              </View>
              <View style={heroStyles.metaChip}>
                <Text style={heroStyles.metaChipText}>{experience.budget}</Text>
              </View>
            </View>

            {/* Travel style tag */}
            <StyleTag style={experience.travelStyle} />
          </View>
        </View>

        {/* Body padding */}
        <View style={styles.body}>

          {/* ─────────────────────────────────────────────────────────────
              2. OVERVIEW
          ───────────────────────────────────────────────────────────── */}
          <View style={detailStyles.section}>
            <SectionTitle title="Overview" icon="information-circle-outline" />

            {experience.description ? (
              <Text style={detailStyles.description}>{experience.description}</Text>
            ) : (
              <Text style={detailStyles.emptyState}>No description added yet.</Text>
            )}

            {/* Who it's for */}
            <View style={detailStyles.whoRow}>
              <Ionicons name="people-outline" size={14} color={LuxuryColors.gold} />
              <Text style={detailStyles.whoText}>For: {whoItsFor(experience.travelStyle)}</Text>
            </View>

            {/* Info pills grid */}
            <View style={detailStyles.pillGrid}>
              <InfoPill icon="sunny-outline"        label="Best Season"    value={season} />
              <InfoPill icon="trending-up-outline"  label="Difficulty"     value={difficulty} />
              <InfoPill icon="cash-outline"         label="Budget"         value={budgetLabel(experience.budget)} />
              <InfoPill icon="calendar-outline"     label="Duration"       value={experience.duration} />
            </View>
          </View>

          {/* ─────────────────────────────────────────────────────────────
              3. CREATOR NOTES
          ───────────────────────────────────────────────────────────── */}
          <View style={detailStyles.section}>
            <SectionTitle title="Creator Notes" icon="bulb-outline" />

            <View style={creatorStyles.noteCard}>
              <View style={creatorStyles.creatorRow}>
                <View style={creatorStyles.avatar}>
                  <Text style={creatorStyles.avatarInitials}>{initials}</Text>
                </View>
                <View>
                  <Text style={creatorStyles.byLine}>Notes from {experience.creatorName}</Text>
                  <Text style={creatorStyles.byLineSub}>Creator insights</Text>
                </View>
              </View>

              {experience.creatorNotes ? (
                <Text style={creatorStyles.tipText}>{experience.creatorNotes}</Text>
              ) : (
                <Text style={detailStyles.emptyState}>No creator notes added yet.</Text>
              )}
            </View>

            {experience.tips.length > 0 && (
              <View style={{ marginTop: LuxurySpacing.md }}>
                <Text style={[creatorStyles.byLine, { marginBottom: LuxurySpacing.sm }]}>Travel Tips</Text>
                {experience.tips.map((tip, i) => (
                  <View key={i} style={creatorStyles.tipRow}>
                    <Ionicons
                      name="sparkles-outline"
                      size={14}
                      color={LuxuryColors.gold}
                      style={{ marginTop: 2 }}
                    />
                    <Text style={creatorStyles.tipText}>{tip}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* ─────────────────────────────────────────────────────────────
              4. DAILY PLAN
          ───────────────────────────────────────────────────────────── */}
          <View style={detailStyles.section}>
            <SectionTitle title="Daily Plan" icon="calendar-number-outline" />

            {experience.dailyPlan.length === 0 ? (
              <View style={detailStyles.emptyCard}>
                <Ionicons name="calendar-outline" size={28} color={LuxuryColors.textTertiary} />
                <Text style={detailStyles.emptyCardText}>No itinerary added yet.</Text>
              </View>
            ) : (
              <>
                {/* Day 1 always visible */}
                {firstDay && <DayCard entry={firstDay} />}

                {/* Days 2+ require unlock */}
                {remainingDays.length > 0 && (
                  isUnlocked ? (
                    remainingDays.map((day) => <DayCard key={day.day} entry={day} />)
                  ) : (
                    <PaywallBanner
                      sectionName={`${remainingDays.length} more day${remainingDays.length > 1 ? 's' : ''}`}
                      freeRemaining={freeRemaining}
                      onUseFreeCredit={handleUseFreeCredit}
                    />
                  )
                )}
              </>
            )}
          </View>

          {/* ─────────────────────────────────────────────────────────────
              5. PLACES & MAP PREVIEW
          ───────────────────────────────────────────────────────────── */}
          <View style={detailStyles.section}>
            <SectionTitle title="Places & Map" icon="map-outline" />

            {isUnlocked ? (
              <>
                {/* Key places derived from hotels */}
                {experience.hotels.length > 0 && (
                  <View style={{ marginBottom: LuxurySpacing.md }}>
                    <Text style={detailStyles.subLabel}>Where to Stay</Text>
                    {experience.hotels.map((h: Hotel, i: number) => (
                      <View key={i} style={placeStyles.card}>
                        <View style={placeStyles.cardLeft}>
                          <View style={placeStyles.iconCircle}>
                            <Ionicons name="bed-outline" size={18} color={LuxuryColors.gold} />
                          </View>
                        </View>
                        <View style={placeStyles.cardBody}>
                          <Text style={placeStyles.placeName}>{h.name}</Text>
                          {h.address ? <Text style={placeStyles.placeNote}>{h.address}</Text> : null}
                          {h.notes ? <Text style={placeStyles.placeNote}>{h.notes}</Text> : null}
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                <MapPlaceholder city={experience.city} country={experience.country} />
              </>
            ) : (
              <PaywallBanner
                sectionName="map and accommodation details"
                freeRemaining={freeRemaining}
                onUseFreeCredit={handleUseFreeCredit}
              />
            )}
          </View>

          {/* ─────────────────────────────────────────────────────────────
              6. RESTAURANTS & CAFÉS
          ───────────────────────────────────────────────────────────── */}
          <View style={detailStyles.section}>
            <SectionTitle title="Restaurants & Cafés" icon="restaurant-outline" />

            {isUnlocked ? (
              experience.restaurants.length > 0 ? (
                experience.restaurants.map((r, i) => (
                  <RestaurantCard key={i} restaurant={r} />
                ))
              ) : (
                <View style={detailStyles.emptyCard}>
                  <Ionicons name="restaurant-outline" size={28} color={LuxuryColors.textTertiary} />
                  <Text style={detailStyles.emptyCardText}>No restaurants added yet.</Text>
                </View>
              )
            ) : (
              <PaywallBanner
                sectionName="restaurants and cafés"
                freeRemaining={freeRemaining}
                onUseFreeCredit={handleUseFreeCredit}
              />
            )}
          </View>

          {/* ─────────────────────────────────────────────────────────────
              7. HIDDEN GEMS
          ───────────────────────────────────────────────────────────── */}
          <View style={detailStyles.section}>
            <SectionTitle title="Hidden Gems" icon="sparkles-outline" />

            {isUnlocked ? (
              experience.hiddenGems.length > 0 ? (
                experience.hiddenGems.map((gem, i) => (
                  <HiddenGemCard key={i} gem={gem} />
                ))
              ) : (
                <View style={detailStyles.emptyCard}>
                  <Ionicons name="star-outline" size={28} color={LuxuryColors.textTertiary} />
                  <Text style={detailStyles.emptyCardText}>No hidden gems added yet.</Text>
                </View>
              )
            ) : (
              <PaywallBanner
                sectionName="hidden gems and insider spots"
                freeRemaining={freeRemaining}
                onUseFreeCredit={handleUseFreeCredit}
              />
            )}
          </View>

          {/* ─────────────────────────────────────────────────────────────
              8. SAVE EXPERIENCE
          ───────────────────────────────────────────────────────────── */}
          <View style={saveStyles.section}>
            <TouchableOpacity
              style={[saveStyles.saveBtn, isSaved && saveStyles.saveBtnActive]}
              onPress={handleToggleSave}
              activeOpacity={0.85}
              disabled={savingToggle}
            >
              <Ionicons
                name={isSaved ? 'bookmark' : 'bookmark-outline'}
                size={20}
                color={isSaved ? LuxuryColors.background : LuxuryColors.gold}
              />
              <Text
                style={[saveStyles.saveBtnText, isSaved && saveStyles.saveBtnTextActive]}
              >
                {isSaved ? 'Saved' : 'Save Experience'}
              </Text>
            </TouchableOpacity>

            {isSaved && (
              <Text style={saveStyles.savedNote}>
                Saved to your profile. Access it anytime from your saved list.
              </Text>
            )}
          </View>

        </View>{/* /body */}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LuxuryColors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: LuxuryColors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: LuxurySpacing.xl,
  },
  backBtnAbs: {
    position: 'absolute',
    top: LuxurySpacing.lg,
    left: LuxurySpacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: LuxuryColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundTitle: {
    color: LuxuryColors.textPrimary,
    fontSize: LuxuryFontSize.xl,
    fontWeight: '700',
    marginTop: LuxurySpacing.lg,
    textAlign: 'center',
  },
  notFoundBody: {
    color: LuxuryColors.textSecondary,
    fontSize: LuxuryFontSize.sm,
    textAlign: 'center',
    marginTop: LuxurySpacing.sm,
    lineHeight: 22,
  },
  notFoundCta: {
    marginTop: LuxurySpacing.xl,
    backgroundColor: LuxuryColors.gold,
    paddingHorizontal: LuxurySpacing.xl,
    paddingVertical: LuxurySpacing.md,
    borderRadius: LuxuryBorderRadius.full,
  },
  notFoundCtaText: {
    color: LuxuryColors.background,
    fontSize: LuxuryFontSize.md,
    fontWeight: '700',
  },
  body: {
    paddingHorizontal: LuxurySpacing.md,
    paddingTop: LuxurySpacing.lg,
  },
});

// ── Hero ──────────────────────────────────────────────────────────────────────

const heroStyles = StyleSheet.create({
  container: {
    height: HERO_HEIGHT,
    position: 'relative',
  },
  image: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
    position: 'absolute',
  },
  imageFallback: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
    backgroundColor: LuxuryColors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: HERO_HEIGHT,
  },
  backBtn: {
    position: 'absolute',
    left: LuxurySpacing.md,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(7,17,32,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  saveBtn: {
    position: 'absolute',
    right: LuxurySpacing.md,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(7,17,32,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  textOverlay: {
    position: 'absolute',
    bottom: LuxurySpacing.lg,
    left: LuxurySpacing.md,
    right: LuxurySpacing.md,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: LuxurySpacing.sm,
    gap: LuxurySpacing.sm,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: LuxuryColors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: LuxuryColors.background,
    fontSize: 11,
    fontWeight: '800',
  },
  creatorName: {
    color: LuxuryColors.textPrimary,
    fontSize: LuxuryFontSize.sm,
    fontWeight: '600',
    opacity: 0.9,
  },
  title: {
    color: LuxuryColors.textPrimary,
    fontSize: LuxuryFontSize.xxl,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: LuxurySpacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: LuxurySpacing.xs,
    marginBottom: LuxurySpacing.sm,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(7,17,32,0.65)',
    paddingHorizontal: LuxurySpacing.sm,
    paddingVertical: 4,
    borderRadius: LuxuryBorderRadius.full,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
  },
  metaChipText: {
    color: LuxuryColors.textPrimary,
    fontSize: LuxuryFontSize.xs,
    fontWeight: '600',
  },
});

// ── Tags ──────────────────────────────────────────────────────────────────────

const tagStyles = StyleSheet.create({
  tag: {
    alignSelf: 'flex-start',
    backgroundColor: LuxuryColors.gold,
    paddingHorizontal: LuxurySpacing.sm,
    paddingVertical: 4,
    borderRadius: LuxuryBorderRadius.full,
  },
  tagText: {
    color: LuxuryColors.background,
    fontSize: LuxuryFontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});

// ── Detail sections ───────────────────────────────────────────────────────────

const detailStyles = StyleSheet.create({
  section: {
    marginBottom: LuxurySpacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.sm,
    marginBottom: LuxurySpacing.md,
  },
  sectionTitle: {
    color: LuxuryColors.textPrimary,
    fontSize: LuxuryFontSize.lg,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  description: {
    color: LuxuryColors.textSecondary,
    fontSize: LuxuryFontSize.md,
    lineHeight: 26,
    marginBottom: LuxurySpacing.lg,
  },
  emptyState: {
    color: LuxuryColors.textTertiary,
    fontSize: LuxuryFontSize.sm,
    fontStyle: 'italic',
    marginBottom: LuxurySpacing.md,
  },
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.sm,
    backgroundColor: LuxuryColors.surface,
    borderWidth: 1,
    borderColor: LuxuryColors.surfaceLight,
    borderRadius: LuxuryBorderRadius.md,
    padding: LuxurySpacing.md,
    marginBottom: LuxurySpacing.sm,
  },
  emptyCardText: {
    color: LuxuryColors.textTertiary,
    fontSize: LuxuryFontSize.sm,
    fontStyle: 'italic',
  },
  whoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.xs,
    marginBottom: LuxurySpacing.lg,
  },
  whoText: {
    color: LuxuryColors.textSecondary,
    fontSize: LuxuryFontSize.sm,
    fontStyle: 'italic',
    flex: 1,
  },
  subLabel: {
    color: LuxuryColors.textTertiary,
    fontSize: LuxuryFontSize.xs,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: LuxurySpacing.sm,
  },
  pillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: LuxurySpacing.sm,
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LuxuryColors.surface,
    borderWidth: 1,
    borderColor: LuxuryColors.surfaceLight,
    borderRadius: LuxuryBorderRadius.md,
    paddingHorizontal: LuxurySpacing.md,
    paddingVertical: LuxurySpacing.sm,
    width: (SCREEN_WIDTH - LuxurySpacing.md * 2 - LuxurySpacing.sm) / 2,
  },
  infoPillLabel: {
    color: LuxuryColors.textTertiary,
    fontSize: LuxuryFontSize.xs,
    fontWeight: '600',
  },
  infoPillValue: {
    color: LuxuryColors.textPrimary,
    fontSize: LuxuryFontSize.sm,
    fontWeight: '700',
    marginTop: 2,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: LuxurySpacing.xs + 2,
    gap: LuxurySpacing.sm,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: LuxuryColors.gold,
    marginTop: 8,
    flexShrink: 0,
  },
  bulletText: {
    flex: 1,
    color: LuxuryColors.textSecondary,
    fontSize: LuxuryFontSize.sm,
    lineHeight: 22,
  },
});

// ── Creator notes ─────────────────────────────────────────────────────────────

const creatorStyles = StyleSheet.create({
  noteCard: {
    backgroundColor: LuxuryColors.surface,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.15)',
    borderRadius: LuxuryBorderRadius.lg,
    padding: LuxurySpacing.md,
    ...LuxuryShadow.soft,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.sm,
    marginBottom: LuxurySpacing.md,
    paddingBottom: LuxurySpacing.md,
    borderBottomWidth: 1,
    borderBottomColor: LuxuryColors.divider,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: LuxuryColors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: LuxuryColors.background,
    fontSize: LuxuryFontSize.sm,
    fontWeight: '800',
  },
  byLine: {
    color: LuxuryColors.textPrimary,
    fontSize: LuxuryFontSize.sm,
    fontWeight: '700',
  },
  byLineSub: {
    color: LuxuryColors.textTertiary,
    fontSize: LuxuryFontSize.xs,
    marginTop: 1,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: LuxurySpacing.sm,
    marginBottom: LuxurySpacing.sm,
  },
  tipText: {
    flex: 1,
    color: LuxuryColors.textSecondary,
    fontSize: LuxuryFontSize.sm,
    lineHeight: 22,
  },
});

// ── Day card ──────────────────────────────────────────────────────────────────

const dayStyles = StyleSheet.create({
  card: {
    backgroundColor: LuxuryColors.surface,
    borderWidth: 1,
    borderColor: LuxuryColors.surfaceLight,
    borderRadius: LuxuryBorderRadius.lg,
    padding: LuxurySpacing.md,
    marginBottom: LuxurySpacing.md,
    ...LuxuryShadow.soft,
  },
  dayHeader: {
    marginBottom: LuxurySpacing.md,
  },
  dayBadge: {
    alignSelf: 'flex-start',
    backgroundColor: LuxuryColors.goldGlow,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    paddingHorizontal: LuxurySpacing.sm,
    paddingVertical: 4,
    borderRadius: LuxuryBorderRadius.full,
  },
  dayBadgeText: {
    color: LuxuryColors.gold,
    fontSize: LuxuryFontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  dayTitle: {
    color: LuxuryColors.textPrimary,
    fontSize: LuxuryFontSize.sm,
    fontWeight: '600',
    marginTop: LuxurySpacing.xs,
  },
  dayDescription: {
    color: LuxuryColors.textSecondary,
    fontSize: LuxuryFontSize.sm,
    lineHeight: 22,
    marginTop: LuxurySpacing.xs,
  },
  slotBlock: {
    marginBottom: LuxurySpacing.sm,
  },
  slotLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: LuxurySpacing.xs,
  },
  slotLabelText: {
    color: LuxuryColors.textTertiary,
    fontSize: LuxuryFontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});

// ── Place cards ───────────────────────────────────────────────────────────────

const placeStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: LuxuryColors.surface,
    borderWidth: 1,
    borderColor: LuxuryColors.surfaceLight,
    borderRadius: LuxuryBorderRadius.md,
    padding: LuxurySpacing.md,
    marginBottom: LuxurySpacing.sm,
    ...LuxuryShadow.soft,
  },
  cardLeft: {
    marginRight: LuxurySpacing.md,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: LuxuryColors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
  },
  placeName: {
    color: LuxuryColors.textPrimary,
    fontSize: LuxuryFontSize.sm,
    fontWeight: '700',
    marginBottom: 3,
  },
  placeType: {
    color: LuxuryColors.textTertiary,
    fontSize: LuxuryFontSize.xs,
    fontWeight: '600',
    marginBottom: 3,
  },
  placeNote: {
    color: LuxuryColors.textSecondary,
    fontSize: LuxuryFontSize.xs,
    lineHeight: 18,
    marginBottom: 4,
  },
  priceLevel: {
    color: LuxuryColors.gold,
    fontSize: LuxuryFontSize.xs,
    fontWeight: '800',
  },
  insiderBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: LuxuryBorderRadius.full,
    marginTop: 4,
  },
  insiderBadgeText: {
    color: LuxuryColors.gold,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

// ── Map placeholder ───────────────────────────────────────────────────────────

const mapStyles = StyleSheet.create({
  placeholder: {
    borderRadius: LuxuryBorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: LuxuryColors.surfaceLight,
    ...LuxuryShadow.soft,
  },
  inner: {
    backgroundColor: LuxuryColors.surface,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: LuxurySpacing.sm,
  },
  label: {
    color: LuxuryColors.textPrimary,
    fontSize: LuxuryFontSize.md,
    fontWeight: '700',
  },
  sublabel: {
    color: LuxuryColors.textTertiary,
    fontSize: LuxuryFontSize.xs,
    textAlign: 'center',
    paddingHorizontal: LuxurySpacing.xl,
  },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.xs,
    backgroundColor: LuxuryColors.gold,
    paddingHorizontal: LuxurySpacing.lg,
    paddingVertical: LuxurySpacing.sm,
    borderRadius: LuxuryBorderRadius.full,
    marginTop: LuxurySpacing.xs,
  },
  openBtnText: {
    color: LuxuryColors.background,
    fontSize: LuxuryFontSize.sm,
    fontWeight: '700',
  },
});

// ── Paywall banner ────────────────────────────────────────────────────────────

const paywallStyles = StyleSheet.create({
  banner: {
    backgroundColor: LuxuryColors.surface,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    borderRadius: LuxuryBorderRadius.lg,
    padding: LuxurySpacing.xl,
    alignItems: 'center',
    ...LuxuryShadow.gold,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: LuxuryColors.goldGlow,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: LuxurySpacing.md,
  },
  title: {
    color: LuxuryColors.textPrimary,
    fontSize: LuxuryFontSize.lg,
    fontWeight: '800',
    marginBottom: LuxurySpacing.xs,
    letterSpacing: 0.2,
  },
  desc: {
    color: LuxuryColors.textSecondary,
    fontSize: LuxuryFontSize.sm,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: LuxurySpacing.lg,
    paddingHorizontal: LuxurySpacing.sm,
  },
  freeCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.xs,
    backgroundColor: LuxuryColors.gold,
    paddingHorizontal: LuxurySpacing.xl,
    paddingVertical: LuxurySpacing.md,
    borderRadius: LuxuryBorderRadius.full,
  },
  freeCtaText: {
    color: LuxuryColors.background,
    fontSize: LuxuryFontSize.sm,
    fontWeight: '800',
  },
  memberCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.xs,
    backgroundColor: LuxuryColors.gold,
    paddingHorizontal: LuxurySpacing.xl,
    paddingVertical: LuxurySpacing.md,
    borderRadius: LuxuryBorderRadius.full,
  },
  memberCtaText: {
    color: LuxuryColors.background,
    fontSize: LuxuryFontSize.sm,
    fontWeight: '800',
  },
  exhaustedNote: {
    color: LuxuryColors.textTertiary,
    fontSize: LuxuryFontSize.xs,
    textAlign: 'center',
    marginTop: LuxurySpacing.md,
    lineHeight: 18,
  },
});

// ── Save section ──────────────────────────────────────────────────────────────

const saveStyles = StyleSheet.create({
  section: {
    alignItems: 'center',
    marginBottom: LuxurySpacing.xl,
    marginTop: LuxurySpacing.sm,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.sm,
    borderWidth: 1.5,
    borderColor: LuxuryColors.gold,
    paddingHorizontal: LuxurySpacing.xxl,
    paddingVertical: LuxurySpacing.md,
    borderRadius: LuxuryBorderRadius.full,
    backgroundColor: 'transparent',
  },
  saveBtnActive: {
    backgroundColor: LuxuryColors.gold,
  },
  saveBtnText: {
    color: LuxuryColors.gold,
    fontSize: LuxuryFontSize.md,
    fontWeight: '700',
  },
  saveBtnTextActive: {
    color: LuxuryColors.background,
  },
  savedNote: {
    color: LuxuryColors.textTertiary,
    fontSize: LuxuryFontSize.xs,
    textAlign: 'center',
    marginTop: LuxurySpacing.sm,
    paddingHorizontal: LuxurySpacing.xl,
    lineHeight: 18,
  },
});
