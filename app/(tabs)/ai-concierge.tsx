import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  ActivityIndicator,
  Platform,
  Image,
} from 'react-native';
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
import { JOURNEYS, ImageKey } from '../../constants/journeys';
import { getCreatorById } from '../../constants/creators';
import { toggleSaved, getSavedIds } from '../../constants/journeyStore';

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

const API_BASE =
  (process.env.EXPO_PUBLIC_RESET_API_URL ?? '').replace(/\/$/, '') ||
  'https://market-place-app-1.onrender.com';

const PROMPT_CHIPS = [
  '7 days in Japan under $4,000',
  'Romantic Italy trip in May',
  'Luxury beach escape on a budget',
  'Desert adventure in Morocco',
  'City break in Southeast Asia',
  'Island hopping in the Maldives',
] as const;

/** Score how well a journey matches a free-text query */
function scoreJourney(query: string, journey: (typeof JOURNEYS)[number]): number {
  if (!query.trim()) return 0;
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const haystack = [
    journey.name,
    journey.destination,
    journey.region,
    journey.overview,
    journey.budget,
  ]
    .join(' ')
    .toLowerCase();
  return words.reduce((sum, w) => sum + (haystack.includes(w) ? 1 : 0), 0);
}

export default function AIPlannerScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ query?: string }>();
  const [query, setQuery] = useState(params.query ?? '');
  const [inputFocused, setInputFocused] = useState(false);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [aiReply, setAiReply] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  React.useEffect(() => {
    getSavedIds().then(setSavedIds);
  }, []);

  const handleChipPress = useCallback((chip: string) => {
    setQuery(chip);
  }, []);

  const handleJourneyPress = useCallback((id: string) => {
    router.push({ pathname: '/(tabs)/journey-detail', params: { id } });
  }, []);

  const handleCreatorPress = useCallback((creatorId: string) => {
    router.push({ pathname: '/(tabs)/creator-profile', params: { id: creatorId } });
  }, []);

  const handleSave = useCallback(async (id: string) => {
    const newIds = await toggleSaved(id);
    setSavedIds(newIds);
  }, []);

  const handleAskAI = useCallback(async () => {
    if (!query.trim() || aiLoading) return;
    setAiLoading(true);
    setAiReply(null);
    try {
      const res = await fetch(`${API_BASE}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      });
      const data = await res.json();
      if (!data.fallback && data.reply) {
        setAiReply(data.reply);
      }
    } catch {
      // Server unreachable — silently fall back to local scoring
    } finally {
      setAiLoading(false);
    }
  }, [query, aiLoading]);

  // Top-3 journeys that best match the current query; if empty fall back to top-rated
  const recommended = React.useMemo(() => {
    if (!query.trim()) {
      return [...JOURNEYS].sort((a, b) => b.rating - a.rating).slice(0, 3);
    }
    return [...JOURNEYS]
      .map((j) => ({ j, score: scoreJourney(query, j) }))
      .sort((a, b) => b.score - a.score || b.j.rating - a.j.rating)
      .slice(0, 3)
      .map(({ j }) => j);
  }, [query]);

  return (
    <KeyboardAvoidingView
      style={styles.kbWrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        bounces={false}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
      >
        {/* ── Header ── */}
        <View style={[styles.hero, { paddingTop: insets.top + LuxurySpacing.xl }]}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="sparkles" size={28} color={LuxuryColors.gold} />
          </View>
          <Text style={styles.heroOverline}>AI Travel Planner</Text>
          <Text style={styles.heroTitle}>Describe your{'\n'}dream trip</Text>
          <Text style={styles.heroSubtitle}>
            Tell us what you're imagining and we'll match you with creator journeys that fit.
          </Text>
        </View>

        {/* ── Input box ── */}
        <View style={styles.inputSection}>
          <View style={[styles.inputWrap, inputFocused && styles.inputWrapFocused]}>
            <Ionicons
              name="search-outline"
              size={18}
              color={inputFocused ? LuxuryColors.gold : LuxuryColors.textTertiary}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder={'e.g. 7 days in Japan under $4,000'}
              placeholderTextColor={LuxuryColors.textTertiary}
              value={query}
              onChangeText={(t) => { setQuery(t); setAiReply(null); }}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              returnKeyType="search"
              onSubmitEditing={handleAskAI}
              autoCorrect={false}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => { setQuery(''); setAiReply(null); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={16} color={LuxuryColors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Ask Voya button */}
          <TouchableOpacity
            style={[styles.askBtn, (!query.trim() || aiLoading) && styles.askBtnDisabled]}
            onPress={handleAskAI}
            disabled={!query.trim() || aiLoading}
            activeOpacity={0.8}
          >
            {aiLoading ? (
              <ActivityIndicator size="small" color={LuxuryColors.background} />
            ) : (
              <>
                <Ionicons name="sparkles" size={14} color={LuxuryColors.background} />
                <Text style={styles.askBtnText}>Ask Voya</Text>
              </>
            )}
          </TouchableOpacity>

          {/* AI reply card */}
          {aiReply ? (
            <View style={styles.aiReplyCard}>
              <View style={styles.aiReplyHeader}>
                <Ionicons name="sparkles" size={13} color={LuxuryColors.gold} />
                <Text style={styles.aiReplyLabel}>Voya suggests</Text>
              </View>
              <Text style={styles.aiReplyText}>{aiReply}</Text>
            </View>
          ) : null}
        </View>

        {/* ── Prompt chips ── */}
        <View style={styles.chipsSection}>
          <Text style={styles.chipsLabel}>Try one of these</Text>
          <View style={styles.chipsWrap}>
            {PROMPT_CHIPS.map((chip) => (
              <TouchableOpacity
                key={chip}
                style={[styles.chip, query === chip && styles.chipActive]}
                onPress={() => handleChipPress(chip)}
                activeOpacity={0.75}
              >
                <Text style={[styles.chipText, query === chip && styles.chipTextActive]}>
                  {chip}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Recommended journeys ── */}
        <View style={styles.recommendedSection}>
          <Text style={styles.sectionLabel}>
            {query.trim() ? 'Matched journeys' : 'Top-rated journeys'}
          </Text>

          {recommended.map((journey) => {
            const creator = getCreatorById(journey.creatorId);

            return (
              <TouchableOpacity
                key={journey.id}
                style={styles.journeyCard}
                onPress={() => handleJourneyPress(journey.id)}
                activeOpacity={0.88}
              >
                {/* Thumbnail */}
                <Image
                  source={JOURNEY_IMAGES[journey.imageKey]}
                  style={styles.journeyThumb}
                  resizeMode="cover"
                />

                {/* Info */}
                <View style={styles.journeyInfo}>
                  <Text style={styles.journeyName} numberOfLines={1}>{journey.name}</Text>
                  <Text style={styles.journeyDest} numberOfLines={1}>
                    {journey.destination} · {journey.duration}
                  </Text>

                  {/* Creator row */}
                  {creator && (
                    <TouchableOpacity
                      style={styles.creatorRow}
                      onPress={() => handleCreatorPress(creator.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.creatorAvatar}>
                        <Text style={styles.creatorAvatarText}>{creator.initials}</Text>
                      </View>
                      <Text style={styles.creatorName} numberOfLines={1}>{creator.name}</Text>
                    </TouchableOpacity>
                  )}

                  {/* Rating + budget */}
                  <View style={styles.journeyMeta}>
                    <View style={styles.ratingRow}>
                      <Ionicons name="star" size={10} color={LuxuryColors.gold} />
                      <Text style={styles.ratingText}>{journey.rating.toFixed(1)}</Text>
                    </View>
                    <Text style={styles.budgetText}>{journey.dailyBudget}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => handleSave(journey.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={savedIds.includes(journey.id) ? 'bookmark' : 'bookmark-outline'}
                    size={18}
                    color={savedIds.includes(journey.id) ? LuxuryColors.gold : LuxuryColors.textTertiary}
                  />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: 64 + insets.bottom }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  kbWrapper: {
    flex: 1,
    backgroundColor: LuxuryColors.background,
  },
  container: {
    flex: 1,
    backgroundColor: LuxuryColors.background,
  },

  // ── Hero ─────────────────────────────────────────────────
  hero: {
    paddingHorizontal: LuxurySpacing.xl,
    paddingBottom: LuxurySpacing.xl,
    backgroundColor: LuxuryColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: LuxurySpacing.sm,
  },
  heroIconWrap: {
    width: 56,
    height: 56,
    borderRadius: LuxuryBorderRadius.full,
    backgroundColor: 'rgba(212,175,55,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: LuxurySpacing.xs,
    ...LuxuryShadow.gold,
  },
  heroOverline: {
    fontSize: 9,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: LuxuryFontSize.xxxl,
    fontWeight: '800',
    color: LuxuryColors.textPrimary,
    letterSpacing: -0.8,
    lineHeight: 38,
  },
  heroSubtitle: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textSecondary,
    lineHeight: 21,
    letterSpacing: 0.1,
    maxWidth: 300,
  },

  // ── Input ─────────────────────────────────────────────────
  inputSection: {
    paddingHorizontal: LuxurySpacing.xl,
    paddingTop: LuxurySpacing.xl,
    paddingBottom: LuxurySpacing.sm,
    gap: LuxurySpacing.sm,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LuxuryColors.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: LuxuryBorderRadius.xl,
    paddingHorizontal: LuxurySpacing.md,
    paddingVertical: LuxurySpacing.md,
    gap: LuxurySpacing.sm,
  },
  inputWrapFocused: {
    borderColor: 'rgba(212,175,55,0.55)',
    ...LuxuryShadow.gold,
  },
  inputIcon: {
    flexShrink: 0,
  },
  input: {
    flex: 1,
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textPrimary,
    letterSpacing: 0.1,
    paddingVertical: 0,
  },

  askBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: LuxurySpacing.xs,
    backgroundColor: LuxuryColors.gold,
    borderRadius: LuxuryBorderRadius.full,
    paddingVertical: LuxurySpacing.sm + 2,
    paddingHorizontal: LuxurySpacing.xl,
    alignSelf: 'flex-end',
    minWidth: 120,
  },
  askBtnDisabled: {
    opacity: 0.4,
  },
  askBtnText: {
    fontSize: LuxuryFontSize.sm,
    fontWeight: '700',
    color: LuxuryColors.background,
    letterSpacing: 0.4,
  },
  aiReplyCard: {
    backgroundColor: 'rgba(212,175,55,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    borderRadius: LuxuryBorderRadius.xl,
    padding: LuxurySpacing.md,
    gap: LuxurySpacing.xs,
  },
  aiReplyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.xs,
  },
  aiReplyLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  aiReplyText: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textSecondary,
    lineHeight: 21,
    letterSpacing: 0.1,
  },

  // ── Chips ─────────────────────────────────────────────────
  chipsSection: {
    paddingHorizontal: LuxurySpacing.xl,
    paddingVertical: LuxurySpacing.md,
    gap: LuxurySpacing.sm,
  },
  chipsLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: LuxuryColors.textTertiary,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: LuxurySpacing.sm,
  },
  chip: {
    paddingHorizontal: LuxurySpacing.md,
    paddingVertical: 7,
    borderRadius: LuxuryBorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  chipActive: {
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderColor: 'rgba(212,175,55,0.45)',
  },
  chipText: {
    fontSize: 11,
    color: LuxuryColors.textSecondary,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  chipTextActive: {
    color: LuxuryColors.gold,
  },

  // ── Recommended ───────────────────────────────────────────
  recommendedSection: {
    paddingHorizontal: LuxurySpacing.xl,
    paddingTop: LuxurySpacing.md,
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
  journeyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LuxuryColors.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: LuxuryBorderRadius.xl,
    overflow: 'hidden',
    gap: LuxurySpacing.md,
    paddingRight: LuxurySpacing.md,
  },
  journeyThumb: {
    width: 88,
    height: 88,
    flexShrink: 0,
  },
  journeyInfo: {
    flex: 1,
    gap: 3,
    paddingVertical: LuxurySpacing.sm,
  },
  journeyName: {
    fontSize: LuxuryFontSize.sm,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
    letterSpacing: 0.1,
  },
  journeyDest: {
    fontSize: 10,
    color: LuxuryColors.textSecondary,
    letterSpacing: 0.1,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  creatorAvatar: {
    width: 18,
    height: 18,
    borderRadius: LuxuryBorderRadius.full,
    backgroundColor: 'rgba(212,175,55,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorAvatarText: {
    fontSize: 6,
    fontWeight: '800',
    color: LuxuryColors.gold,
  },
  creatorName: {
    fontSize: 10,
    color: LuxuryColors.textTertiary,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  journeyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.sm,
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    fontSize: 10,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: 0.2,
  },
  budgetText: {
    fontSize: 10,
    color: LuxuryColors.textTertiary,
    letterSpacing: 0.1,
  },
});
