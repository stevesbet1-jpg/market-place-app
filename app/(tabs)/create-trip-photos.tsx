import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import ImageViewing from 'react-native-image-viewing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LuxuryBorderRadius,
  LuxuryColors,
  LuxuryShadow,
  LuxurySpacing,
} from '../../constants/luxuryTheme';
import {
  getCreateTripDraft,
  patchCreateTripDraft,
  type PhotoCategory,
} from '../../constants/createTripDraftStore';
import {
  normalizePhotoCategory,
  normalizePhotoSource,
  type NormalizedPhotoCategory,
  type NormalizedPhotoSource,
} from '../../lib/photoCategory';

const CYAN = '#8AE6FF';
const MAX_PHOTOS = 40;
const STEPS = [
  { label: 'Trip Info', route: '/(tabs)/create-trip' },
  { label: 'Itinerary', route: '/(tabs)/create-trip-itinerary' },
  { label: 'Photos', route: '/(tabs)/create-trip-photos' },
  { label: 'Experience', route: '/(tabs)/create-trip-experiences' },
  { label: 'Review', route: '/(tabs)/create-trip-review' },
] as const;
const ACTIVE_STEP = 2;
const CLASSIFY_TIMEOUT_MS = 25_000;
const MIN_CONFIDENCE = 0.4;
const VALID_CATEGORIES: DisplayCategoryKey[] = ['places', 'food', 'activities', 'beach', 'animals'];
const PHOTO_TABS = [
  { key: 'all', label: 'All' },
  { key: 'places', label: 'Places' },
  { key: 'food', label: 'Food' },
  { key: 'activities', label: 'Activities' },
  { key: 'beach', label: 'Beach' },
  { key: 'animals', label: 'Animals' },
] as const;
type PhotoTab = (typeof PHOTO_TABS)[number]['key'];
type ImportCategory = Exclude<PhotoTab, 'all'>;
type DisplayCategoryKey = NormalizedPhotoCategory;

const CATEGORY_LABEL: Record<DisplayCategoryKey, string> = {
  places: 'Places',
  food: 'Food',
  activities: 'Activities',
  beach: 'Beach',
  animals: 'Animals',
};

function getClassifyApiBase(): string {
  const raw = (process.env.EXPO_PUBLIC_RESET_API_URL ?? '').replace(/\/$/, '') || 'https://market-place-app-1.onrender.com';
  // Some envs provide a full reset endpoint instead of a base host.
  return raw
    .replace(/\/$/, '')
    .replace(/\/api\/send-reset$/i, '')
    .replace(/\/api\/health$/i, '');
}

// ── AI classification (backend, no API key in app) ─────────────
const CLASSIFY_API = getClassifyApiBase();

function getProvisionalCategory(activeTab: PhotoTab): DisplayCategoryKey {
  if (activeTab === 'food') return 'food';
  if (activeTab === 'activities') return 'activities';
  if (activeTab === 'places') return 'places';
  if (activeTab === 'beach') return 'beach';
  if (activeTab === 'animals') return 'animals';
  return 'beach';
}

function parseConfidence(raw: unknown): { value: number | null; provided: boolean; source: string } {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (raw > 1 && raw <= 100) return { value: Math.max(0, Math.min(1, raw / 100)), provided: true, source: 'number_percent' };
    return { value: Math.max(0, Math.min(1, raw)), provided: true, source: 'number_unit' };
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return { value: null, provided: false, source: 'empty_string' };

    const percentMatch = trimmed.match(/^([0-9]+(?:\.[0-9]+)?)\s*%$/);
    if (percentMatch) {
      const parsed = Number(percentMatch[1]);
      if (Number.isFinite(parsed)) {
        return { value: Math.max(0, Math.min(1, parsed / 100)), provided: true, source: 'string_percent' };
      }
    }

    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      if (numeric > 1 && numeric <= 100) return { value: Math.max(0, Math.min(1, numeric / 100)), provided: true, source: 'string_percent_number' };
      return { value: Math.max(0, Math.min(1, numeric)), provided: true, source: 'string_number' };
    }

    return { value: null, provided: false, source: 'string_non_numeric' };
  }

  return { value: null, provided: false, source: 'missing' };
}

async function classifyPhotoViaAI(
  photoId: string,
  imageUri: string,
  imageBase64?: string | null,
): Promise<{
  category: DisplayCategoryKey;
  reason: string;
  confidence: number;
  status: 'done' | 'failed';
}>
{
  console.log('[CLASSIFY_START]', {
    photoId,
    API_BASE: CLASSIFY_API,
    hasBase64: Boolean(imageBase64),
    uri: imageUri?.slice(0, 80),
  });

  if (!imageUri || imageUri.trim().length === 0) {
    const failed = {
      category: 'beach' as const,
      reason: 'Invalid image URI',
      confidence: 0,
      status: 'failed' as const,
    };
    console.log('[CLASSIFY_RAW]', { photoId, raw: null, reason: failed.reason });
    console.log('[CLASSIFY_NORMALIZED]', { photoId, rawCategory: null, normalizedCategory: 'beach', isValidCategory: false });
    console.log('[CLASSIFY_CONFIDENCE]', {
      photoId,
      rawConfidence: null,
      parsedConfidence: 0,
      confidenceProvided: false,
      threshold: MIN_CONFIDENCE,
      gateApplied: false,
      gatePassed: false,
    });
    console.log('[CLASSIFY_FALLBACK_OTHER_REASON]', { photoId, reasonCode: 'invalid_image_uri', reason: failed.reason });
    console.log('[CLASSIFY_FAILED]', { photoId, reason: failed.reason });
    console.log('[CLASSIFY_FINALLY]', { photoId, status: failed.status, category: failed.category });
    return failed;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CLASSIFY_TIMEOUT_MS);

  try {
    const res = await fetch(`${CLASSIFY_API}/api/classify-photo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoId, imageUri, imageBase64: imageBase64 ?? null }),
      signal: controller.signal,
    });
    console.log('[CLASSIFY_HTTP]', { photoId, status: res.status, ok: res.ok });

    if (!res.ok) {
      const errText = await res.text();
      const failed = {
        category: 'beach' as const,
        reason: `HTTP ${res.status}: ${errText.slice(0, 160)}`,
        confidence: 0,
        status: 'failed' as const,
      };
      console.log('[CLASSIFY_RAW]', { photoId, raw: errText.slice(0, 300) });
      console.log('[CLASSIFY_NORMALIZED]', { photoId, rawCategory: null, normalizedCategory: 'beach', isValidCategory: false });
      console.log('[CLASSIFY_CONFIDENCE]', {
        photoId,
        rawConfidence: null,
        parsedConfidence: 0,
        confidenceProvided: false,
        threshold: MIN_CONFIDENCE,
        gateApplied: false,
        gatePassed: false,
      });
      console.log('[CLASSIFY_FALLBACK_OTHER_REASON]', { photoId, reasonCode: 'http_error', reason: failed.reason });
      console.log('[CLASSIFY_FAILED]', { photoId, reason: failed.reason });
      return failed;
    }

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      const failed = {
        category: 'beach' as const,
        reason: 'Invalid JSON response',
        confidence: 0,
        status: 'failed' as const,
      };
      console.log('[CLASSIFY_RAW]', { photoId, raw: 'INVALID_JSON' });
      console.log('[CLASSIFY_NORMALIZED]', { photoId, rawCategory: null, normalizedCategory: 'beach', isValidCategory: false });
      console.log('[CLASSIFY_CONFIDENCE]', {
        photoId,
        rawConfidence: null,
        parsedConfidence: 0,
        confidenceProvided: false,
        threshold: MIN_CONFIDENCE,
        gateApplied: false,
        gatePassed: false,
      });
      console.log('[CLASSIFY_FALLBACK_OTHER_REASON]', { photoId, reasonCode: 'invalid_json', reason: failed.reason });
      console.log('[CLASSIFY_FAILED]', { photoId, reason: failed.reason });
      return failed;
    }

    console.log('[CLASSIFY_RESPONSE]', { photoId, data });

    const rawCategory = String(
      data?.category ?? data?.label ?? data?.classification ?? data?.predictedCategory ?? '',
    )
      .trim()
      .toLowerCase();
    const normalizedCategory = normalizePhotoCategory(rawCategory);
    const isValidCategory = VALID_CATEGORIES.includes(normalizedCategory);

    const confidenceInfo = parseConfidence(data?.confidence);
    const confidence = confidenceInfo.value ?? (isValidCategory ? 0.7 : 0);
    const gateApplied = confidenceInfo.provided;
    const gatePassed = !gateApplied || confidence >= MIN_CONFIDENCE;

    console.log('[CLASSIFY_RAW]', { photoId, raw: data });
    console.log('[CLASSIFY_NORMALIZED]', {
      photoId,
      rawCategory,
      normalizedCategory,
      isValidCategory,
      validCategories: VALID_CATEGORIES,
    });
    console.log('[CLASSIFY_CONFIDENCE]', {
      photoId,
      rawConfidence: data?.confidence ?? null,
      parsedConfidence: confidence,
      confidenceProvided: confidenceInfo.provided,
      confidenceSource: confidenceInfo.source,
      threshold: MIN_CONFIDENCE,
      gateApplied,
      gatePassed,
    });

    const reason = typeof data?.reason === 'string' ? data.reason : '';
    let category: DisplayCategoryKey = normalizedCategory;
    let fallbackReasonCode: string | null = null;

    if (!isValidCategory) {
      category = 'beach';
      fallbackReasonCode = 'invalid_or_unknown_category';
    } else if (!gatePassed) {
      category = 'beach';
      fallbackReasonCode = 'low_confidence';
    }

    const status: 'done' | 'failed' = 'done';

    const result = {
      category,
      reason: reason || (category === 'beach' ? 'Low confidence or unclear travel signal' : ''),
      confidence,
      status,
    };

    console.log('[CLASSIFY_API_RESPONSE]', {
      photoId,
      rawCategory,
      normalizedCategory,
      confidence,
      finalCategory: result.category,
    });

    if (category === 'beach') {
      console.log('[CLASSIFY_FALLBACK_OTHER_REASON]', {
        photoId,
        reasonCode: fallbackReasonCode ?? 'category_beach',
        normalizedCategory,
        confidence,
        confidenceProvided: confidenceInfo.provided,
        threshold: MIN_CONFIDENCE,
        reason: result.reason,
      });
    }

    console.log('[CLASSIFY_DONE]', { photoId, ...result });
    return result;
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    const timedOut = err?.name === 'AbortError';
    const failed = {
      category: 'beach' as const,
      reason: timedOut ? 'Classification timeout' : (err?.message || 'Network error'),
      confidence: 0,
      status: 'failed' as const,
    };
    console.log('[CLASSIFY_RAW]', { photoId, raw: null, error: err?.message || String(error) });
    console.log('[CLASSIFY_NORMALIZED]', { photoId, rawCategory: null, normalizedCategory: 'beach', isValidCategory: false });
    console.log('[CLASSIFY_CONFIDENCE]', {
      photoId,
      rawConfidence: null,
      parsedConfidence: 0,
      confidenceProvided: false,
      threshold: MIN_CONFIDENCE,
      gateApplied: false,
      gatePassed: false,
    });
    console.log('[CLASSIFY_FALLBACK_OTHER_REASON]', {
      photoId,
      reasonCode: timedOut ? 'timeout' : 'network_or_runtime_error',
      reason: failed.reason,
    });
    console.log('[CLASSIFY_FAILED]', { photoId, reason: failed.reason, error: err?.message || String(error) });
    return failed;
  } finally {
    clearTimeout(timeoutId);
    console.log('[CLASSIFY_FINALLY]', { photoId });
  }
}

type PhotoEntry = {
  id: string;
  uri: string;
  fileName?: string;
  caption: string;
  category: PhotoCategory;
  selected: boolean;
  createdAt?: number;
  categorySource?: NormalizedPhotoSource;
  source?: NormalizedPhotoSource;
  classificationStatus?: 'pending' | 'done' | 'failed';
  classificationReason?: string;
  confidence?: number;
};

type CategoryCounts = Record<DisplayCategoryKey | 'all', number>;

function buildCategoryCounts(list: PhotoEntry[]): CategoryCounts {
  const base: CategoryCounts = { all: 0, places: 0, food: 0, activities: 0, beach: 0, animals: 0 };
  for (const photo of list) {
    const c = normalizePhotoCategory(photo.category);
    base.all += 1;
    base[c] += 1;
  }
  return base;
}

type ViewerState = {
  viewerVisible: boolean;
  viewerIndex: number;
  viewerPhotos: PhotoEntry[];
};

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function Stepper() {
  return (
    <View style={styles.stepperWrap}>
      {STEPS.map((step, index) => {
        const active = index === ACTIVE_STEP;
        const done = index < ACTIVE_STEP;
        return (
          <React.Fragment key={step.label}>
            <TouchableOpacity style={styles.stepCol} onPress={() => router.replace(step.route)} activeOpacity={0.82}>
              <View style={[styles.stepDot, active && styles.stepDotActive, done && styles.stepDotDone]}>
                {done ? (
                  <Ionicons name="checkmark" size={9} color={LuxuryColors.success} />
                ) : (
                  <Text style={[styles.stepDotText, active && styles.stepDotTextActive]}>{index + 1}</Text>
                )}
              </View>
              <Text numberOfLines={1} ellipsizeMode="clip" style={[styles.stepText, active && styles.stepTextActive]}>{step.label}</Text>
            </TouchableOpacity>
            {index < STEPS.length - 1 ? <View style={styles.stepLine} /> : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}

export default function CreateTripPhotosScreen() {
  const insets = useSafeAreaInsets();
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [activeTab, setActiveTab] = useState<PhotoTab>('all');
  const [isHydrated, setIsHydrated] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isReclassifying, setIsReclassifying] = useState(false);
  const [reclassifySummary, setReclassifySummary] = useState<{
    scanned: number;
    successful: number;
    before: CategoryCounts;
    after: CategoryCounts;
  } | null>(null);
  const [viewerState, setViewerState] = useState<ViewerState>({
    viewerVisible: false,
    viewerIndex: 0,
    viewerPhotos: [],
  });
  const analyzingRunsRef = useRef(0);

  const beginAnalyze = useCallback(() => {
    analyzingRunsRef.current += 1;
    setIsAnalyzing(true);
  }, []);

  const endAnalyze = useCallback(() => {
    analyzingRunsRef.current = Math.max(0, analyzingRunsRef.current - 1);
    if (analyzingRunsRef.current === 0) {
      setIsAnalyzing(false);
      console.log('[CLASSIFY_FINALLY]', { isAnalyzing: false });
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const draft = await getCreateTripDraft();
        if (!alive) return;
        const hydratedPhotos = draft.photos.map((photo) => ({
            ...photo,
            fileName: undefined,
            category: normalizePhotoCategory(photo.category),
            selected: true,
            createdAt: photo.createdAt ?? Date.now(),
            categorySource: normalizePhotoSource(photo.categorySource ?? photo.source, normalizePhotoCategory(photo.category)),
            source: normalizePhotoSource(photo.categorySource ?? photo.source, normalizePhotoCategory(photo.category)),
            classificationStatus:
              photo.classificationStatus === 'pending' || photo.classificationStatus === 'done' || photo.classificationStatus === 'failed'
                ? (photo.classificationStatus === 'pending' ? 'failed' : photo.classificationStatus)
                : (normalizePhotoSource(photo.categorySource ?? photo.source, normalizePhotoCategory(photo.category)) === 'ai'
                  || normalizePhotoSource(photo.categorySource ?? photo.source, normalizePhotoCategory(photo.category)) === 'manual')
                  ? 'done'
                  : 'failed',
            classificationReason:
              typeof photo.classificationReason === 'string' && photo.classificationReason.trim().length > 0
                ? photo.classificationReason
                : 'Classification not completed.',
            confidence:
              typeof photo.confidence === 'number' && Number.isFinite(photo.confidence)
                ? Math.max(0, Math.min(1, photo.confidence))
                : 0,
          }));

        setPhotos(hydratedPhotos);
        hydratedPhotos.forEach((photo) => {
          console.log('[PHOTO_RESTORED]', {
            id: photo.id,
            uri: photo.uri,
            category: normalizePhotoCategory(photo.category),
            categorySource: normalizePhotoSource(photo.categorySource ?? photo.source, normalizePhotoCategory(photo.category)),
            classificationStatus: photo.classificationStatus,
            classificationReason: photo.classificationReason,
            confidence: photo.confidence,
          });
        });
      } finally {
        if (alive) setIsHydrated(true);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      const draftPhotos = photos.map((p) => ({
        id: p.id,
        uri: p.uri,
        caption: p.caption,
        category: normalizePhotoCategory(p.category),
        createdAt: p.createdAt,
        categorySource: normalizePhotoSource(p.categorySource ?? p.source, normalizePhotoCategory(p.category)),
        source: normalizePhotoSource(p.categorySource ?? p.source, normalizePhotoCategory(p.category)),
        classificationStatus:
          p.classificationStatus === 'pending' || p.classificationStatus === 'done' || p.classificationStatus === 'failed'
            ? p.classificationStatus
            : (normalizePhotoSource(p.categorySource ?? p.source, normalizePhotoCategory(p.category)) === 'ai'
              || normalizePhotoSource(p.categorySource ?? p.source, normalizePhotoCategory(p.category)) === 'manual')
              ? 'done'
              : 'failed',
        classificationReason: p.classificationReason ?? '',
        confidence:
          typeof p.confidence === 'number' && Number.isFinite(p.confidence)
            ? Math.max(0, Math.min(1, p.confidence))
            : 0,
      }));
      console.log('[PHOTO_PERSISTED]', {
        count: draftPhotos.length,
        categories: buildCategoryCounts(photos),
      });
      // Persist async and silently; do not block UI.
      patchCreateTripDraft({ photos: draftPhotos }).catch(() => {});
    }, 300);

    return () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    };
  }, [isHydrated, photos]);

  const classifyInBackground = useCallback((items: Array<{ photoId: string; imageUri: string; fileName?: string; imageBase64?: string | null }>) => {
    // Batch classification to avoid flooding API and keep UI responsive.
    const BATCH_SIZE = 4;

    const run = async () => {
      beginAnalyze();
      try {
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE);
        const results = (await Promise.all(
          batch.map(async (item) => {
            console.log('[PHOTO_CLASSIFY_INPUT]', item.imageUri);
            let imageBase64 = item.imageBase64 ?? null;
            if (!imageBase64) {
              // Generate lightweight thumbnail base64 only when picker didn't return base64.
              try {
                const mini = await ImageManipulator.manipulateAsync(
                  item.imageUri,
                  [{ resize: { width: 640 } }],
                  {
                    compress: 0.55,
                    format: ImageManipulator.SaveFormat.JPEG,
                    base64: true,
                  },
                );
                imageBase64 = mini.base64 ?? null;
              } catch {
                imageBase64 = null;
              }
            }

            const ai = await classifyPhotoViaAI(item.photoId, item.imageUri, imageBase64);
            if (ai.status === 'done') {
              console.log('[PHOTO_CLASSIFIED]', {
                id: item.photoId,
                uri: item.imageUri,
                category: ai.category,
                status: ai.status,
                confidence: ai.confidence,
              });
              return { id: item.photoId, category: ai.category, reason: ai.reason, source: 'ai' as const, status: 'done' as const, confidence: ai.confidence };
            }
            console.log('[PHOTO_CLASSIFIED]', {
              id: item.photoId,
              uri: item.imageUri,
              category: 'beach',
              status: 'failed',
              confidence: ai.confidence,
            });
            return { id: item.photoId, category: 'beach' as const, reason: ai.reason || 'Classification failed', source: 'needs_review' as const, status: 'failed' as const, confidence: ai.confidence };
          }),
        ));

        setPhotos((prev) =>
          prev.map((photo) => {
            const hit = results.find((r) => r.id === photo.id);

            if (!hit) return photo;
            const manualCategory = photo.categorySource === 'manual' ? normalizePhotoCategory(photo.category) : null;
            const finalCategory = manualCategory ?? hit.category;
            const finalSource: NormalizedPhotoSource = manualCategory ? 'manual' : hit.source;
            console.log('[PHOTO_CATEGORY_UPDATED]', {
              id: photo.id,
              uri: photo.uri,
              category: finalCategory,
              categorySource: finalSource,
              classificationStatus: hit.status,
              classificationReason: hit.reason,
              confidence: hit.confidence,
            });
            return {
              ...photo,
              category: finalCategory,
              selected: true,
              categorySource: finalSource,
              source: finalSource,
              classificationStatus: hit.status,
              classificationReason: manualCategory ? `Manual category override (${CATEGORY_LABEL[manualCategory]}). ${hit.reason || ''}`.trim() : hit.reason,
              confidence: hit.confidence,
            };
          }),
        );
      }
      } finally {
        endAnalyze();
      }
    };

    void run();
  }, [beginAnalyze, endAnalyze]);

  const reclassifyAllPhotos = useCallback(async () => {
    if (isReclassifying) return;

    const selected = photos.filter((p) => p.selected);
    const candidates = selected;

    if (!candidates.length) {
      Alert.alert('No Reclassification Needed', 'All selected photos already have a valid AI category.');
      return;
    }

    const before = buildCategoryCounts(selected);
    setIsReclassifying(true);
    setReclassifySummary(null);

    const candidateIds = new Set(candidates.map((p) => p.id));
    setPhotos((prev) =>
      prev.map((p) =>
        candidateIds.has(p.id)
          ? {
              ...p,
              classificationStatus: 'pending',
              classificationReason: 'Reclassifying with AI...',
            }
          : p,
      ),
    );
    console.log('[PHOTO_RECLASSIFIED]', { action: 'start', candidateCount: candidates.length });
    beginAnalyze();

    const BATCH_SIZE = 4;
    const resultsById = new Map<
      string,
      {
        category: DisplayCategoryKey;
        source: 'ai' | 'needs_review' | 'manual';
        status: 'done' | 'failed';
        reason: string;
        confidence: number;
      }
    >();

    try {
      for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
        const batch = candidates.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async (photo) => {
            let imageBase64: string | null = null;
            try {
              const mini = await ImageManipulator.manipulateAsync(
                photo.uri,
                [{ resize: { width: 640 } }],
                {
                  compress: 0.55,
                  format: ImageManipulator.SaveFormat.JPEG,
                  base64: true,
                },
              );
              imageBase64 = mini.base64 ?? null;
            } catch {
              imageBase64 = null;
            }

            const ai = await classifyPhotoViaAI(photo.id, photo.uri, imageBase64);
            if (ai.status === 'done') {
              return {
                id: photo.id,
                category: ai.category,
                source: 'ai' as const,
                status: 'done' as const,
                reason: ai.reason,
                confidence: ai.confidence,
              };
            }

            return {
              id: photo.id,
              category: 'beach' as const,
              source: 'needs_review' as const,
              status: 'failed' as const,
              reason: ai.reason || 'Classification failed',
              confidence: ai.confidence,
            };
          }),
        );

        for (const result of batchResults) {
          resultsById.set(result.id, {
            category: result.category,
            source: result.source,
            status: result.status,
            reason: result.reason,
            confidence: result.confidence,
          });
        }
      }

      const successful = [...resultsById.values()].filter((r) => r.source === 'ai').length;
      const summaryCounts = {
        total: candidates.length,
        places: 0,
        food: 0,
        activities: 0,
        beach: 0,
        animals: 0,
        failed: 0,
        averageConfidence: 0,
      };

      let confidenceSum = 0;
      for (const result of resultsById.values()) {
        if (result.category === 'places') summaryCounts.places += 1;
        else if (result.category === 'food') summaryCounts.food += 1;
        else if (result.category === 'activities') summaryCounts.activities += 1;
        else if (result.category === 'beach') summaryCounts.beach += 1;
        else summaryCounts.animals += 1;

        if (result.status === 'failed') summaryCounts.failed += 1;
        confidenceSum += Number.isFinite(result.confidence) ? result.confidence : 0;
      }

      summaryCounts.averageConfidence = resultsById.size > 0
        ? Number((confidenceSum / resultsById.size).toFixed(3))
        : 0;

      console.log('[CLASSIFY_SUMMARY]', summaryCounts);

      let afterSelectedSnapshot: PhotoEntry[] = selected;
      setPhotos((prev) => {
        const next = prev.map((photo) => {
          const hit = resultsById.get(photo.id);
          if (!hit) return photo;
          const manualCategory = photo.categorySource === 'manual' ? normalizePhotoCategory(photo.category) : null;
          const finalCategory = manualCategory ?? hit.category;
          const finalSource: NormalizedPhotoSource = manualCategory ? 'manual' : hit.source;
          return {
            ...photo,
            category: finalCategory,
            categorySource: finalSource,
            source: finalSource,
            classificationStatus: hit.status,
            classificationReason: manualCategory ? `Manual category override (${CATEGORY_LABEL[manualCategory]}). ${hit.reason || ''}`.trim() : hit.reason,
            confidence: hit.confidence,
          };
        });
        afterSelectedSnapshot = next.filter((p) => p.selected);
        return next;
      });

      const after = buildCategoryCounts(afterSelectedSnapshot);
      setReclassifySummary({
        scanned: candidates.length,
        successful,
        before,
        after,
      });
      console.log('[PHOTO_RECLASSIFIED]', {
        action: 'complete',
        scanned: candidates.length,
        successful,
        before,
        after,
      });

      Alert.alert(
        'Reclassification Complete',
        `Scanned ${candidates.length} photos.\nAI classified ${successful}.\nPlaces ${before.places} → ${after.places}\nFood ${before.food} → ${after.food}\nActivities ${before.activities} → ${after.activities}\nBeach ${before.beach} → ${after.beach}\nAnimals ${before.animals} → ${after.animals}`,
      );
    } finally {
      setIsReclassifying(false);
      endAnalyze();
    }
  }, [beginAnalyze, endAnalyze, isReclassifying, photos]);

  const pickImages = useCallback(async (selectedCategory: ImportCategory) => {
    const remainingSlots = Math.max(0, MAX_PHOTOS - photos.length);
    if (remainingSlots <= 0) {
      Alert.alert('Limit Reached', `You can add up to ${MAX_PHOTOS} photos.`);
      return;
    }

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Needed', 'Allow photo access to add images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remainingSlots,
      quality: 0.5,
      base64: false,
    });

    if (result.canceled || !result.assets?.length) return;

    const selected = getProvisionalCategory(selectedCategory);
    setPhotos((prev) => {
      const next = [...prev];
      for (let i = 0; i < result.assets.length; i += 1) {
        const asset = result.assets[i];
        if (!asset?.uri) continue;
        if (next.find((p) => p.uri === asset.uri)) continue;
        if (next.length >= MAX_PHOTOS) break;

        next.push({
          id: uid(),
          uri: asset.uri,
          fileName: asset.fileName ?? undefined,
          caption: '',
          category: selected,
          selected: true,
          createdAt: Date.now(),
          categorySource: 'manual',
          source: 'manual',
          classificationStatus: 'done',
          classificationReason: `Manual category assignment (${CATEGORY_LABEL[selected]}).`,
          confidence: 1,
        });
      }
      return next.slice(0, MAX_PHOTOS);
    });
  }, [photos.length]);

  const handleAddMorePhotos = useCallback(() => {
    if (activeTab === 'all') {
      Alert.alert('Choose Category First', 'Select Places, Food, Activities, Beach, or Animals before picking photos.');
      return;
    }
    void pickImages(activeTab);
  }, [activeTab, pickImages]);

  const handleCategoryChipPress = useCallback((tab: PhotoTab) => {
    setActiveTab(tab);
    if (tab === 'all') return;
    void pickImages(tab);
  }, [pickImages]);

  const removePhoto = useCallback((id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const selectedPhotos = useMemo(() => photos.filter((p) => p.selected), [photos]);
  const reclassifyCandidates = useMemo(
    () => selectedPhotos,
    [selectedPhotos],
  );
  const tabCounts = useMemo(() => {
    return buildCategoryCounts(selectedPhotos);
  }, [selectedPhotos]);

  useEffect(() => {
    console.log('[PHOTO_COUNTED]', tabCounts);
  }, [tabCounts]);

  const filteredPhotos = useMemo(() => {
    if (activeTab === 'all') return selectedPhotos;
    return selectedPhotos.filter((p) => normalizePhotoCategory(p.category) === activeTab);
  }, [activeTab, selectedPhotos]);

  const openViewer = useCallback((photoId: string) => {
    if (viewerState.viewerVisible) return;
      const snapshot =
      activeTab === 'all'
        ? selectedPhotos
        : selectedPhotos.filter((p) => normalizePhotoCategory(p.category) === activeTab);
    const index = snapshot.findIndex((p) => p.id === photoId);
    if (index < 0) return;
    setViewerState({ viewerVisible: true, viewerIndex: index, viewerPhotos: snapshot });
  }, [activeTab, selectedPhotos, viewerState.viewerVisible]);

  const closeViewer = useCallback(() => {
    setViewerState({ viewerVisible: false, viewerIndex: 0, viewerPhotos: [] });
  }, []);

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient colors={['#071120', '#091A2A', '#06101D']} style={StyleSheet.absoluteFill} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 106 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.circleBtn} onPress={() => router.replace('/(tabs)/create-trip-itinerary')} activeOpacity={0.84}>
            <Ionicons name="arrow-back" size={19} color={LuxuryColors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Photos</Text>
            <Text style={styles.headerSub}>Step 3 of 5 - Trip gallery</Text>
          </View>
          <Pressable style={styles.draftBtn} onPress={() => Alert.alert('Draft Saved', 'Photos draft saved.')}> 
            <Text style={styles.draftText}>Save Draft</Text>
          </Pressable>
        </View>

        <Stepper />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
        >
          {PHOTO_TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabBtn, active && styles.tabBtnActive]}
                onPress={() => {
                  void handleCategoryChipPress(tab.key);
                }}
                activeOpacity={0.86}
              >
                <Text numberOfLines={1} style={[styles.tabText, active && styles.tabTextActive]}>{tab.label} ({tabCounts[tab.key]})</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={styles.galleryCountText}>{selectedPhotos.length}/{MAX_PHOTOS} selected</Text>

        {reclassifyCandidates.length > 0 ? (
          <View style={styles.reclassifyCard}>
            <View style={styles.reclassifyHeaderRow}>
              <Text style={styles.reclassifyTitle}>Reclassify selected photos</Text>
              <Text style={styles.reclassifyMeta}>{reclassifyCandidates.length} photos</Text>
            </View>
            <Text style={styles.reclassifySub}>
              Re-run AI on every selected photo and persist Places/Food/Activities/Beach/Animals results.
            </Text>
            <TouchableOpacity
              style={[styles.reclassifyBtn, isReclassifying && styles.reclassifyBtnDisabled]}
              onPress={() => {
                void reclassifyAllPhotos();
              }}
              activeOpacity={0.88}
              disabled={isReclassifying}
            >
              <Text style={styles.reclassifyBtnText}>{isReclassifying ? 'Reclassifying...' : 'Reclassify all photos'}</Text>
            </TouchableOpacity>
            {reclassifySummary ? (
              <Text style={styles.reclassifyResult}>
                Before P/F/A: {reclassifySummary.before.places}/{reclassifySummary.before.food}/{reclassifySummary.before.activities} | After P/F/A: {reclassifySummary.after.places}/{reclassifySummary.after.food}/{reclassifySummary.after.activities} | AI success: {reclassifySummary.successful}/{reclassifySummary.scanned}
              </Text>
            ) : null}
          </View>
        ) : null}

        {isAnalyzing ? <Text style={styles.analyzingInfo}>Analyzing photos...</Text> : null}

        <View style={styles.galleryWrap}>
          <View style={styles.galleryGrid}>
            {filteredPhotos.map((photo) => (
              <TouchableOpacity
                key={photo.id}
                style={styles.photoCell}
                onPress={() => openViewer(photo.id)}
                activeOpacity={0.9}
              >
                <Image source={{ uri: photo.uri }} style={styles.photoThumb} resizeMode="cover" />
                <View style={styles.photoCategoryPill}>
                  <Text style={styles.photoCategoryPillText}>
                    {photo.classificationStatus === 'pending'
                      ? 'Analyzing'
                      : CATEGORY_LABEL[normalizePhotoCategory(photo.category)]}
                  </Text>
                </View>
                {/* badge always calls getDisplayPhotoCategory — never reads photo.category directly */}
                <TouchableOpacity
                  style={styles.photoRemove}
                  onPress={(event) => {
                    event.stopPropagation();
                    removePhoto(photo.id);
                  }}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Ionicons name="close-circle" size={18} color="rgba(255,65,65,0.88)" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={[styles.photoCell, styles.addTile]} onPress={handleAddMorePhotos} activeOpacity={0.88}>
              <View style={styles.addTileCircle}>
                <Ionicons name="add" size={20} color={CYAN} />
              </View>
              <Text style={styles.addTileTitle}>Add More Photos</Text>
              <Text style={styles.addTileSub}>JPG or PNG</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <ImageViewing
        images={viewerState.viewerPhotos.map((photo) => ({ uri: photo.uri }))}
        imageIndex={viewerState.viewerIndex}
        visible={viewerState.viewerVisible}
        onRequestClose={closeViewer}
        presentationStyle="overFullScreen"
        backgroundColor="#071120"
        animationType="fade"
        swipeToCloseEnabled={false}
        doubleTapToZoomEnabled
        HeaderComponent={() => (
          <View style={[styles.viewerHeader, { paddingTop: insets.top + 8 }]}> 
            <TouchableOpacity style={styles.viewerIconBtn} onPress={closeViewer}>
              <Ionicons name="close" size={22} color={LuxuryColors.textPrimary} />
            </TouchableOpacity>
          </View>
        )}
        FooterComponent={({ imageIndex }) => (
          <View style={styles.viewerFooterInfo}>
            <Text style={styles.viewerFooterText}>{imageIndex + 1}/{Math.max(1, viewerState.viewerPhotos.length)}</Text>
          </View>
        )}
      />

      {!viewerState.viewerVisible ? <View style={[styles.dock, { paddingBottom: 4 }]}> 
        <TouchableOpacity style={styles.cta} onPress={() => router.push('/(tabs)/create-trip-experiences')} activeOpacity={0.88}>
          <Text style={styles.ctaText}>Continue to Experiences</Text>
          <Ionicons name="arrow-forward" size={17} color={LuxuryColors.background} />
        </TouchableOpacity>
      </View> : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: LuxuryColors.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: LuxurySpacing.lg, gap: 12 },

  headerRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', position: 'relative' },
  headerCenter: { position: 'absolute', left: 0, right: 0, alignItems: 'center', pointerEvents: 'none' },
  headerTitle: { color: LuxuryColors.textPrimary, fontSize: 18, fontWeight: '700' },
  headerSub: { color: LuxuryColors.textSecondary, fontSize: 11, marginTop: 2 },
  circleBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(138,230,255,0.16)' },
  draftBtn: { minHeight: 36, paddingHorizontal: 12, borderRadius: LuxuryBorderRadius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(138,230,255,0.10)', borderWidth: 1, borderColor: 'rgba(138,230,255,0.26)' },
  draftText: { color: CYAN, fontSize: 12, fontWeight: '700' },

  stepperWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, paddingVertical: 3, marginTop: -4, borderRadius: LuxuryBorderRadius.xl, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(138,230,255,0.15)', ...LuxuryShadow.soft },
  stepCol: { flex: 1, alignItems: 'center', gap: 2 },
  stepDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.04)' },
  stepDotActive: { backgroundColor: 'rgba(138,230,255,0.20)', borderColor: CYAN },
  stepDotDone: { backgroundColor: 'rgba(46,213,115,0.16)', borderColor: 'rgba(46,213,115,0.44)' },
  stepDotText: { color: LuxuryColors.textSecondary, fontSize: 9, fontWeight: '700', textAlign: 'center', lineHeight: 10 },
  stepDotTextActive: { color: CYAN },
  stepText: { color: LuxuryColors.textTertiary, fontSize: 7.5, fontWeight: '600', textAlign: 'center', lineHeight: 9, flexWrap: 'nowrap' },
  stepTextActive: { color: LuxuryColors.textPrimary },
  stepLine: { width: 10, flexShrink: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(138,230,255,0.18)', marginHorizontal: 1 },

  tabsRow: { flexDirection: 'row', gap: 8, paddingRight: 2 },
  tabBtn: {
    minHeight: 34,
    minWidth: 96,
    borderRadius: LuxuryBorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBtnActive: { borderColor: 'rgba(138,230,255,0.42)', backgroundColor: 'rgba(138,230,255,0.14)' },
  tabText: { color: LuxuryColors.textSecondary, fontSize: 11, fontWeight: '700' },
  tabTextActive: { color: CYAN },
  galleryCountText: {
    color: LuxuryColors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'right',
    marginTop: -2,
    marginBottom: 2,
  },
  reclassifyCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(138,230,255,0.26)',
    backgroundColor: 'rgba(138,230,255,0.08)',
    padding: 10,
    gap: 8,
  },
  reclassifyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reclassifyTitle: {
    color: CYAN,
    fontSize: 12,
    fontWeight: '800',
  },
  reclassifyMeta: {
    color: LuxuryColors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  reclassifySub: {
    color: LuxuryColors.textSecondary,
    fontSize: 11,
    lineHeight: 15,
  },
  reclassifyBtn: {
    minHeight: 36,
    borderRadius: LuxuryBorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CYAN,
  },
  reclassifyBtnDisabled: {
    opacity: 0.65,
  },
  reclassifyBtnText: {
    color: LuxuryColors.background,
    fontSize: 12,
    fontWeight: '800',
  },
  reclassifyResult: {
    color: LuxuryColors.textPrimary,
    fontSize: 10,
    lineHeight: 14,
  },
  analyzingInfo: {
    color: CYAN,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
  },

  galleryWrap: {
    borderRadius: LuxuryBorderRadius.xxl,
    borderWidth: 1,
    borderColor: 'rgba(138,230,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 10,
    ...LuxuryShadow.soft,
  },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  photoCell: {
    width: '31.7%',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(7,17,32,0.70)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    marginBottom: 8,
    position: 'relative',
    height: 108,
  },
  photoThumb: { width: '100%', height: '100%' },
  photoCategoryPill: {
    position: 'absolute',
    left: 3,
    bottom: 3,
    minHeight: 18,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(7,17,32,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(138,230,255,0.30)',
  },
  photoCategoryPillText: {
    color: CYAN,
    fontSize: 8,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  photoRemove: { position: 'absolute', top: 3, right: 3 },

  addTile: {
    minHeight: 108,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderStyle: 'dashed',
    borderColor: 'rgba(138,230,255,0.34)',
    backgroundColor: 'rgba(138,230,255,0.07)',
    paddingHorizontal: 6,
  },
  addTileCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(138,230,255,0.48)',
    backgroundColor: 'rgba(138,230,255,0.13)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTileTitle: { color: CYAN, fontSize: 10, fontWeight: '700', textAlign: 'center' },
  addTileSub: { color: LuxuryColors.textSecondary, fontSize: 9, textAlign: 'center' },

  viewerHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
  },
  viewerFooterInfo: {
    position: 'absolute',
    bottom: 18,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  viewerFooterText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  viewerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: LuxurySpacing.lg, paddingTop: 2, backgroundColor: 'rgba(7,17,32,0.95)', borderTopWidth: 1, borderTopColor: 'rgba(138,230,255,0.14)' },
  cta: { minHeight: 52, borderRadius: LuxuryBorderRadius.full, backgroundColor: CYAN, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, ...LuxuryShadow.gold },
  ctaText: { color: LuxuryColors.background, fontSize: 14, fontWeight: '800' },
});
