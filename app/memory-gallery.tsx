import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getCreateTripDraft,
  type PhotoEntryDraft,
} from '../constants/createTripDraftStore';
import {
  LuxuryBorderRadius,
  LuxuryColors,
  LuxurySpacing,
} from '../constants/luxuryTheme';
import { MEMORY_GALLERY_SELECTION_KEY, sortPhotosByDate } from '../lib/sortPhotosByDate';

const CYAN = '#8AE6FF';

type Category = 'Place' | 'Food' | 'Activity' | 'Hotel' | 'Transport' | 'Other';

type GalleryTile = {
  id: string;
  uri: string;
  category: Category;
  index: number;
};

function mapCategory(value: string | undefined): Category {
  const normalized = (value ?? '').trim().toLowerCase();
  if (normalized === 'places' || normalized === 'place') return 'Place';
  if (normalized === 'food') return 'Food';
  if (normalized === 'activities' || normalized === 'activity') return 'Activity';
  if (normalized === 'hotel' || normalized === 'stay') return 'Hotel';
  if (normalized === 'transport' || normalized === 'travel') return 'Transport';
  return 'Other';
}

export default function MemoryGalleryScreen() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const [photos, setPhotos] = useState<PhotoEntryDraft[]>([]);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerPagingEnabled, setViewerPagingEnabled] = useState(true);
  const viewerListRef = useRef<FlatList<GalleryTile> | null>(null);
  const viewerZoomRefs = useRef<Record<number, ScrollView | null>>({});
  const viewerZoomScaleRef = useRef<Record<number, number>>({});
  const viewerLastTapRef = useRef<Record<number, number>>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const transferred = await AsyncStorage.getItem(MEMORY_GALLERY_SELECTION_KEY);
        if (transferred) {
          const parsed = JSON.parse(transferred) as PhotoEntryDraft[];
          if (alive && Array.isArray(parsed)) {
            setPhotos(sortPhotosByDate(parsed));
            return;
          }
        }

        const draft = await getCreateTripDraft();
        if (!alive) return;
        setPhotos(sortPhotosByDate(draft.photos));
      } catch {
        if (!alive) return;
        setPhotos([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const tiles = useMemo<GalleryTile[]>(() => {
    return photos.map((photo, index) => ({
      id: photo.id?.trim() || `${photo.uri}-${index}`,
      uri: photo.uri,
      category: mapCategory(photo.category),
      index,
    }));
  }, [photos]);

  useEffect(() => {
    // Prefetch visible assets to reduce black flashes when paging fullscreen images.
    const uris = tiles.map((tile) => tile.uri).filter((uri) => uri.trim().length > 0);
    uris.forEach((uri) => {
      Image.prefetch(uri).catch(() => {
        // Ignore prefetch failures; viewer still loads images normally.
      });
    });
  }, [tiles]);

  const renderItem = ({ item }: { item: GalleryTile; index: number }) => {
    return (
      <View style={styles.cell}>
        <TouchableOpacity
          style={styles.tile}
          activeOpacity={0.86}
          onPress={() => {
            setViewerPagingEnabled(true);
            setViewerIndex(item.index);
            setViewerVisible(true);
          }}
        >
          <Image source={{ uri: item.uri }} style={styles.tileImage} resizeMode="cover" />
          <View style={styles.tileBadge}>
            <Text style={styles.tileBadgeText}>{item.category}</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: 0 }]}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.84}>
        <Ionicons name="arrow-back" size={18} color={LuxuryColors.textPrimary} />
      </TouchableOpacity>
      <View style={styles.headerCenter}>
        <Text style={styles.title}>Memory Gallery</Text>
        <Text style={styles.count}>{tiles.length} photos</Text>
      </View>
      <View style={styles.rightSlot} />
    </View>
  );

  const clampedViewerIndex = Math.max(0, Math.min(viewerIndex, Math.max(tiles.length - 1, 0)));

  const handleViewerZoomScroll = (index: number, zoomScale: number) => {
    viewerZoomScaleRef.current[index] = zoomScale;
    if (index === viewerIndex) {
      setViewerPagingEnabled(zoomScale <= 1.01);
    }
  };

  const handleViewerDoubleTap = (index: number, x: number, y: number) => {
    const now = Date.now();
    const last = viewerLastTapRef.current[index] ?? 0;
    viewerLastTapRef.current[index] = now;
    if (now - last > 260) return;

    const zoomRef = viewerZoomRefs.current[index] as (ScrollView & {
      scrollResponderZoomTo?: (args: { x: number; y: number; width: number; height: number; animated: boolean }) => void;
    }) | null;
    if (!zoomRef?.scrollResponderZoomTo) return;

    const currentScale = viewerZoomScaleRef.current[index] ?? 1;
    if (currentScale > 1.01) {
      zoomRef.scrollResponderZoomTo({
        x: 0,
        y: 0,
        width: screenWidth,
        height: screenHeight,
        animated: true,
      });
      viewerZoomScaleRef.current[index] = 1;
      if (index === viewerIndex) setViewerPagingEnabled(true);
      return;
    }

    const targetWidth = screenWidth / 2;
    const targetHeight = screenHeight / 2;
    zoomRef.scrollResponderZoomTo({
      x: Math.max(0, x - targetWidth / 2),
      y: Math.max(0, y - targetHeight / 2),
      width: targetWidth,
      height: targetHeight,
      animated: true,
    });
    viewerZoomScaleRef.current[index] = 2;
    if (index === viewerIndex) setViewerPagingEnabled(false);
  };

  const handleViewerMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (screenWidth <= 0) return;
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
    const clampedIndex = Math.max(0, Math.min(nextIndex, tiles.length - 1));
    setViewerIndex(clampedIndex);
    const zoomScale = viewerZoomScaleRef.current[clampedIndex] ?? 1;
    setViewerPagingEnabled(zoomScale <= 1.01);
  };

  const renderViewerSlide = ({ item, index }: { item: GalleryTile; index: number }) => (
    <View style={[styles.viewerSlide, { width: screenWidth, height: screenHeight }]}>
      <ScrollView
        ref={(ref) => {
          viewerZoomRefs.current[index] = ref;
        }}
        style={[styles.viewerZoomScroll, { width: screenWidth, height: screenHeight }]}
        contentContainerStyle={[styles.viewerZoomContent, { width: screenWidth, height: screenHeight }]}
        maximumZoomScale={4}
        minimumZoomScale={1}
        pinchGestureEnabled
        bouncesZoom={false}
        centerContent
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(event) => {
          const scale = event.nativeEvent.zoomScale ?? 1;
          handleViewerZoomScroll(index, scale);
        }}
      >
        <TouchableWithoutFeedback
          onPress={(event) => {
            handleViewerDoubleTap(index, event.nativeEvent.locationX, event.nativeEvent.locationY);
          }}
        >
          <Image
            source={{ uri: item.uri }}
            style={[styles.viewerImage, { width: screenWidth, height: screenHeight }]}
            resizeMode="cover"
          />
        </TouchableWithoutFeedback>
      </ScrollView>
    </View>
  );

  const onScrollToIndexFailed = () => {
    requestAnimationFrame(() => {
      viewerListRef.current?.scrollToOffset({
        offset: clampedViewerIndex * screenWidth,
        animated: false,
      });
    });
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#071120', '#091A2A', '#06101D']} style={StyleSheet.absoluteFill} />

      <FlatList<GalleryTile>
        data={tiles}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={3}
        style={styles.list}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        automaticallyAdjustKeyboardInsets={false}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 40 }]}
        ListHeaderComponent={renderHeader}
        columnWrapperStyle={styles.columnWrap}
        showsVerticalScrollIndicator={false}
        initialNumToRender={21}
        maxToRenderPerBatch={12}
        windowSize={8}
        ListEmptyComponent={<Text style={styles.emptyText}>No photos available.</Text>}
      />

      <Modal
        visible={viewerVisible}
        animationType="none"
        presentationStyle="fullScreen"
        transparent={false}
        onRequestClose={() => {
          setViewerVisible(false);
          setViewerPagingEnabled(true);
          viewerZoomScaleRef.current = {};
          viewerZoomRefs.current = {};
          viewerLastTapRef.current = {};
        }}
      >
        <View style={styles.viewerRoot}>
          {tiles.length > 0 ? (
            <FlatList<GalleryTile>
              ref={viewerListRef}
              data={tiles}
              horizontal
              pagingEnabled
              scrollEnabled={viewerPagingEnabled}
              initialScrollIndex={clampedViewerIndex}
              getItemLayout={(_, index) => ({
                length: screenWidth,
                offset: screenWidth * index,
                index,
              })}
              keyExtractor={(item, index) => `${item.id}-${index}`}
              showsHorizontalScrollIndicator={false}
              removeClippedSubviews={false}
              windowSize={3}
              initialNumToRender={3}
              maxToRenderPerBatch={3}
              renderItem={renderViewerSlide}
              onScrollToIndexFailed={onScrollToIndexFailed}
              onMomentumScrollEnd={handleViewerMomentumEnd}
            />
          ) : null}
          <TouchableOpacity
            style={[styles.viewerCloseButton, { top: insets.top + 12, right: 20 }]}
            onPress={() => {
              setViewerVisible(false);
              setViewerPagingEnabled(true);
              viewerZoomScaleRef.current = {};
              viewerZoomRefs.current = {};
              viewerLastTapRef.current = {};
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: LuxuryColors.background },
  list: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: LuxurySpacing.lg,
    paddingBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(138,230,255,0.16)',
  },
  headerCenter: { alignItems: 'center' },
  rightSlot: { width: 40, height: 40 },
  title: { color: LuxuryColors.textPrimary, fontSize: 18, fontWeight: '700' },
  count: { color: LuxuryColors.textSecondary, fontSize: 12, marginTop: 2 },
  listContent: { paddingHorizontal: 2 },
  columnWrap: { marginBottom: 0 },
  cell: {
    width: '33.3333%',
    padding: 1.5,
  },
  tile: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    position: 'relative',
  },
  tileImage: { width: '100%', height: '100%' },
  tileBadge: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    borderRadius: LuxuryBorderRadius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(7,17,32,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(138,230,255,0.26)',
  },
  tileBadgeText: { color: CYAN, fontSize: 9, fontWeight: '700' },
  emptyText: { color: LuxuryColors.textSecondary, textAlign: 'center', marginTop: 40 },
  viewerRoot: {
    flex: 1,
    backgroundColor: '#000000',
  },
  viewerSlide: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  viewerZoomScroll: {
    width: '100%',
    height: '100%',
  },
  viewerZoomContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerImage: {
    width: '100%',
    height: '100%',
  },
  viewerCloseButton: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    elevation: 999,
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
});
