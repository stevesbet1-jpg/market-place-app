import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  Share,
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
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PHOTO_TABS = [
  { key: 'all', label: 'All' },
  { key: 'places', label: 'Places' },
  { key: 'food', label: 'Food' },
  { key: 'activities', label: 'Activities' },
] as const;
type PhotoTab = (typeof PHOTO_TABS)[number]['key'];
type CategoryKey = 'places' | 'food' | 'activities';

const CATEGORY_LABEL: Record<CategoryKey, string> = {
  places: 'Places',
  food: 'Food',
  activities: 'Activities',
};

function normalizeCategory(category: PhotoCategory | string | undefined): CategoryKey {
  const value = String(category ?? '').trim().toLowerCase();
  if (value === 'places') return 'places';
  if (value === 'food') return 'food';
  if (value === 'activities') return 'activities';
  return 'places';
}

// Deterministic category for newly uploaded photos based on the active tab.
function getUploadCategory(activeTab: PhotoTab): CategoryKey {
  if (activeTab === 'food') return 'food';
  if (activeTab === 'activities') return 'activities';
  return 'places';
}

// ── AI classification (backend, no API key in app) ─────────────
const CLASSIFY_API = 'http://10.0.0.12:3001';

async function classifyPhotoViaAI(
  photoId: string,
  imageUri: string,
  imageBase64?: string | null,
): Promise<{ category: CategoryKey; reason: string } | null> {
  try {
    console.log('[AI classify] request', {
      photoId,
      API_BASE: CLASSIFY_API,
      hasBase64: Boolean(imageBase64),
      uri: imageUri?.slice(0, 80),
    });
    const res = await fetch(`${CLASSIFY_API}/api/classify-photo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUri, imageBase64: imageBase64 ?? null }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.log('[AI classify] error', { status: res.status, body: errText });
      return null;
    }
    const data = await res.json();
    console.log('[AI classify] response', data);
    const allowed: CategoryKey[] = ['food', 'places', 'activities'];
    if (!allowed.includes(data.category as CategoryKey)) return null;
    return {
      category: data.category as CategoryKey,
      reason: typeof data.reason === 'string' ? data.reason : '',
    };
  } catch (error) {
    console.log('[AI classify] error', error);
    return null;
  }
}

type PhotoEntry = {
  id: string;
  uri: string;
  caption: string;
  category: PhotoCategory;
  categorySource?: 'ai' | 'tab' | 'fallback';
  classificationStatus?: 'pending' | 'done' | 'failed';
  classificationReason?: string;
};

// viewerIndex is the only field that changes on next/prev — viewerVisible and viewerPhotos stay constant.
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
  const viewerListRef = useRef<FlatList<PhotoEntry> | null>(null);
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [activeTab, setActiveTab] = useState<PhotoTab>('all');
  const [isHydrated, setIsHydrated] = useState(false);
  const [viewerState, setViewerState] = useState<ViewerState>({
    viewerVisible: false,
    viewerIndex: 0,
    viewerPhotos: [],
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const draft = await getCreateTripDraft();
        if (!alive) return;
        setPhotos(
          draft.photos.map((photo) => ({
            ...photo,
            category: normalizeCategory(photo.category),
            classificationStatus: 'done',
            categorySource: 'fallback',
            classificationReason: '',
          }))
        );
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
    patchCreateTripDraft({ photos }).catch(() => {});
  }, [isHydrated, photos]);

  const pickImages = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Needed', 'Allow photo access to add images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS,
      quality: 0.5,
      base64: true,
    });

    if (result.canceled || !result.assets?.length) return;

    const uploadCategory = getUploadCategory(activeTab);
    const convertedAssets: Array<{ originalUri: string; uri: string; base64?: string | null }> = [];

    for (const asset of result.assets) {
      try {
        const manipulated = await ImageManipulator.manipulateAsync(asset.uri, [], {
          compress: 0.5,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        });
        console.log('[Image convert] jpeg base64 prefix', manipulated.base64?.slice(0, 40));
        convertedAssets.push({
          originalUri: asset.uri,
          uri: manipulated.uri,
          base64: manipulated.base64 ?? null,
        });
      } catch (error) {
        console.log('[Image convert] failed', error);
        convertedAssets.push({
          originalUri: asset.uri,
          uri: asset.uri,
          base64: null,
        });
      }
    }

    const pendingClassifications: Array<{ photoId: string; imageUri: string; imageBase64?: string | null }> = [];

    setPhotos((prev) => {
      const next = [...prev];
      for (let i = 0; i < convertedAssets.length; i += 1) {
        const asset = convertedAssets[i];
        if (next.find((p) => p.uri === asset.uri || p.uri === asset.originalUri)) continue;
        const photoId = uid();
        next.push({
          id: photoId,
          uri: asset.uri,
          caption: '',
          category: uploadCategory,
          categorySource: 'tab',
          classificationStatus: 'pending',
          classificationReason: '',
        });
        pendingClassifications.push({
          photoId,
          imageUri: asset.uri,
          imageBase64: asset.base64,
        });
      }
      return next.slice(0, MAX_PHOTOS);
    });

    // Fire background AI classification for each new asset.
    // On result, update only that photo's category; viewer state is not touched.
    for (const pending of pendingClassifications) {
      classifyPhotoViaAI(pending.photoId, pending.imageUri, pending.imageBase64 ?? null).then((aiResult) => {
        if (!aiResult) {
          setPhotos((prev) =>
            prev.map((p) =>
              p.id === pending.photoId
                ? { ...p, classificationStatus: 'failed', categorySource: 'fallback' }
                : p,
            ),
          );
          return;
        }

        setPhotos((prev) =>
          prev.map((p) =>
            p.id === pending.photoId
              ? {
                  ...p,
                  category: aiResult.category,
                  categorySource: 'ai',
                  classificationStatus: 'done',
                  classificationReason: aiResult.reason,
                }
              : p,
          ),
        );
      });
    }
  }, [activeTab]);

  const removePhoto = useCallback((id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const filteredPhotos = useMemo(() => {
    if (activeTab === 'all') return photos;
    return photos.filter((p) => normalizeCategory(p.category) === activeTab);
  }, [activeTab, photos]);

  // Snapshot filtered list once on open; goNext/goPrev only update viewerIndex — never reopen.
  const openViewer = useCallback((photoId: string) => {
    if (viewerState.viewerVisible) return;
    const snapshot =
      activeTab === 'all'
        ? photos
        : photos.filter((p) => normalizeCategory(p.category) === activeTab);
    const index = snapshot.findIndex((p) => p.id === photoId);
    if (index < 0) return;
    setViewerState({ viewerVisible: true, viewerIndex: index, viewerPhotos: snapshot });
  }, [activeTab, photos, viewerState.viewerVisible]);

  const closeViewer = useCallback(() => {
    setViewerState({ viewerVisible: false, viewerIndex: 0, viewerPhotos: [] });
  }, []);

  const currentViewerPhoto = viewerState.viewerPhotos[viewerState.viewerIndex] ?? null;

  const shareCurrentPhoto = useCallback(async () => {
    if (!currentViewerPhoto) return;
    try {
      await Share.share({ url: currentViewerPhoto.uri, message: currentViewerPhoto.uri });
    } catch {
      Alert.alert('Share Failed', 'Unable to share this photo right now.');
    }
  }, [currentViewerPhoto]);

  const deleteCurrentPhoto = useCallback(() => {
    if (!currentViewerPhoto) return;
    Alert.alert(
      'Delete Photo',
      'Remove this photo from your trip gallery?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const removedId = currentViewerPhoto.id;
            setPhotos((prev) => {
              return prev.filter((p) => p.id !== removedId);
            });
            setViewerState((prev) => {
              const nextViewerPhotos = prev.viewerPhotos.filter((p) => p.id !== removedId);
              if (nextViewerPhotos.length === 0) {
                return { viewerVisible: false, viewerIndex: 0, viewerPhotos: [] };
              }
              return {
                ...prev,
                viewerIndex: Math.min(prev.viewerIndex, nextViewerPhotos.length - 1),
                viewerPhotos: nextViewerPhotos,
              };
            });
          },
        },
      ]
    );
  }, [currentViewerPhoto]);

  // Only viewerIndex changes — viewerVisible and viewerPhotos are never reassigned.
  const goNext = useCallback(() => {
    if (!viewerState.viewerPhotos.length) return;
    setViewerState((prev) => ({
      ...prev,
      viewerIndex: (prev.viewerIndex + 1) % prev.viewerPhotos.length,
    }));
  }, [viewerState.viewerPhotos.length]);

  const goPrev = useCallback(() => {
    if (!viewerState.viewerPhotos.length) return;
    setViewerState((prev) => ({
      ...prev,
      viewerIndex: (prev.viewerIndex - 1 + prev.viewerPhotos.length) % prev.viewerPhotos.length,
    }));
  }, [viewerState.viewerPhotos.length]);

  useEffect(() => {
    if (!viewerState.viewerVisible) return;
    if (!viewerState.viewerPhotos.length) return;
    viewerListRef.current?.scrollToIndex({
      index: viewerState.viewerIndex,
      animated: true,
      viewPosition: 0,
    });
  }, [viewerState.viewerIndex, viewerState.viewerPhotos.length, viewerState.viewerVisible]);

  const handleViewerMomentumEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const nextIndex = Math.round(offsetX / SCREEN_WIDTH);
    setViewerState((prev) => {
      if (nextIndex < 0 || nextIndex >= prev.viewerPhotos.length) return prev;
      if (prev.viewerIndex === nextIndex) return prev;
      return {
        ...prev,
        viewerIndex: nextIndex,
      };
    });
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

        <View style={styles.tabsRow}>
          {PHOTO_TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabBtn, active && styles.tabBtnActive]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.86}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.galleryCountText}>{photos.length}/{MAX_PHOTOS} selected</Text>

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
                    {CATEGORY_LABEL[normalizeCategory(photo.category)]}
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

            <TouchableOpacity style={[styles.photoCell, styles.addTile]} onPress={pickImages} activeOpacity={0.88}>
              <View style={styles.addTileCircle}>
                <Ionicons name="add" size={20} color={CYAN} />
              </View>
              <Text style={styles.addTileTitle}>Add More Photos</Text>
              <Text style={styles.addTileSub}>JPG or PNG</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Stable fullscreen viewer — Modal stays mounted; only Image source changes on next/prev. */}
      <Modal
        visible={viewerState.viewerVisible}
        transparent={false}
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeViewer}
      >
        <View style={styles.viewerModalBg}>
          <FlatList
            ref={viewerListRef}
            data={viewerState.viewerPhotos}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleViewerMomentumEnd}
            initialScrollIndex={viewerState.viewerIndex}
            getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
            windowSize={3}
            initialNumToRender={2}
            maxToRenderPerBatch={3}
            removeClippedSubviews
            renderItem={({ item }) => (
              <ScrollView
                style={styles.viewerPage}
                contentContainerStyle={styles.viewerImageWrap}
                maximumZoomScale={4}
                minimumZoomScale={1}
                pinchGestureEnabled
                bouncesZoom={false}
                centerContent
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
              >
                <Image
                  source={{ uri: item.uri }}
                  style={styles.viewerModalImage}
                  resizeMode="contain"
                />
              </ScrollView>
            )}
          />
          <View style={[styles.viewerHeader, { paddingTop: insets.top + 6 }]}>
            <TouchableOpacity style={styles.viewerIconBtn} onPress={closeViewer}>
              <Ionicons name="close" size={22} color={LuxuryColors.textPrimary} />
            </TouchableOpacity>
          </View>
          <View style={[styles.viewerFooter, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.viewerCounter}>
              {viewerState.viewerPhotos.length === 0
                ? '0 / 0'
                : `${viewerState.viewerIndex + 1} / ${viewerState.viewerPhotos.length}`}
            </Text>
            <View style={styles.viewerActionsRight}>
              <TouchableOpacity style={styles.viewerIconBtn} onPress={goPrev}>
                <Ionicons name="chevron-back" size={18} color={LuxuryColors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.viewerIconBtn} onPress={goNext}>
                <Ionicons name="chevron-forward" size={18} color={LuxuryColors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.viewerIconBtn} onPress={shareCurrentPhoto}>
                <Ionicons name="share-social-outline" size={18} color={LuxuryColors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.viewerIconBtn} onPress={deleteCurrentPhoto}>
                <Ionicons name="trash-outline" size={18} color="rgba(255,75,75,0.9)" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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

  tabsRow: { flexDirection: 'row', gap: 8 },
  tabBtn: {
    flex: 1,
    minHeight: 34,
    borderRadius: LuxuryBorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBtnActive: { borderColor: 'rgba(138,230,255,0.42)', backgroundColor: 'rgba(138,230,255,0.14)' },
  tabText: { color: LuxuryColors.textSecondary, fontSize: 12, fontWeight: '700' },
  tabTextActive: { color: CYAN },
  galleryCountText: {
    color: LuxuryColors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'right',
    marginTop: -2,
    marginBottom: 2,
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

  viewerModalBg: {
    flex: 1,
    backgroundColor: '#000000',
  },
  viewerImageWrap: {
    width: SCREEN_WIDTH,
    minHeight: SCREEN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerPage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  viewerModalImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
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
  viewerFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    backgroundColor: 'rgba(3,10,20,0.60)',
  },
  viewerActionsRight: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
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
  viewerCounter: {
    color: LuxuryColors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },

  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: LuxurySpacing.lg, paddingTop: 2, backgroundColor: 'rgba(7,17,32,0.95)', borderTopWidth: 1, borderTopColor: 'rgba(138,230,255,0.14)' },
  cta: { minHeight: 52, borderRadius: LuxuryBorderRadius.full, backgroundColor: CYAN, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, ...LuxuryShadow.gold },
  ctaText: { color: LuxuryColors.background, fontSize: 14, fontWeight: '800' },
});
