import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import ImageViewing from 'react-native-image-viewing';
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
  const [photos, setPhotos] = useState<PhotoEntryDraft[]>([]);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

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

  const viewerImages = useMemo(
    () => photos.map((photo) => ({ uri: photo.uri })),
    [photos],
  );

  const renderItem = ({ item }: { item: GalleryTile; index: number }) => {
    return (
      <View style={styles.cell}>
        <TouchableOpacity
          style={styles.tile}
          activeOpacity={0.86}
          onPress={() => {
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

      <ImageViewing
        images={viewerImages}
        imageIndex={viewerIndex}
        visible={viewerVisible}
        onRequestClose={() => setViewerVisible(false)}
        swipeToCloseEnabled
        presentationStyle="fullScreen"
        backgroundColor="rgba(2,8,15,0.98)"
        doubleTapToZoomEnabled
      />
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
});
