import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, TouchableOpacity, Pressable, useWindowDimensions, Alert, ActivityIndicator, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getAuth } from 'firebase/auth';
import { LuxuryColors, LuxurySpacing, LuxuryBorderRadius, LuxuryFontSize, LuxuryGradients, LuxuryShadow } from '../../constants/luxuryTheme';
import { AnimationTiming } from '../../constants/animations';
import { getFirebaseApp } from '../../lib/firebase';
import { getLatestProducts, type Product } from '../../lib/products';

const COLLECTIONS = [
  { name: 'Private Islands', tag: 'Exclusive Retreats' },
  { name: 'Super Villas', tag: 'Private Villas' },
  { name: 'Yacht Escapes', tag: 'Coastal Luxury' },
  { name: 'Desert Retreats', tag: 'Expedition' },
] as const;

const COLLECTION_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  'Private Islands': 'umbrella-outline',
  'Super Villas': 'business-outline',
  'Yacht Escapes': 'boat-outline',
  'Desert Retreats': 'compass-outline',
};



export default function ExploreScreen() {
  const { width } = useWindowDimensions();
  // Two equal cards with one gap inside section padding (xl each side)
  const privilegeCardWidth = Math.floor((width - LuxurySpacing.xl * 2 - LuxurySpacing.md) / 2);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState(false);
  const productsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    getLatestProducts(20)
      .then((data) => setProducts(data))
      .catch(() => setProductsError(true))
      .finally(() => setProductsLoading(false));
  }, []);

  useEffect(() => {
    if (!productsLoading) {
      Animated.timing(productsAnim, {
        toValue: 1,
        duration: AnimationTiming.normal,
        useNativeDriver: true,
      }).start();
    }
  }, [productsLoading, productsAnim]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const currentUser = getAuth(getFirebaseApp()).currentUser;
  const greetingName = currentUser?.displayName?.split(' ')[0] ?? 'Member';

  const handleNotificationPress = () => {
    Alert.alert('Notifications', 'No new notifications at this time.');
  };

  const handleViewAllPress = () => {
    Alert.alert('Collections', 'Full luxury collection catalogue coming soon.');
  };

  const handleConciergePress = () => {
    router.push('/(tabs)/ai-concierge');
  };

  const handleDestinationPress = (destName: string) => {
    Alert.alert('Destination', `${destName} details coming soon.`);
  };

  const handlePrivilegePress = (privilegeName: string) => {
    Alert.alert('Privilege', `${privilegeName} benefit details coming soon.`);
  };

  const handleSellPress = () => {
    router.push('/(tabs)/add-product');
  };

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
      {/* Elegant Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>M</Text>
          </View>
          <TouchableOpacity 
            style={styles.notificationButton}
            onPress={handleNotificationPress}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={24} color={LuxuryColors.textPrimary} />
          </TouchableOpacity>
        </View>
        <Text style={styles.greeting}>{greeting}, {greetingName}</Text>
        <Text style={styles.subtitle}>Your next extraordinary journey awaits</Text>
      </View>

      {/* Cinematic Hero - Single Premium Card */}
      <TouchableOpacity 
        style={styles.heroCard}
        onPress={() => handleDestinationPress('Private Island Escape')}
        activeOpacity={0.8}
      >
        <LinearGradient colors={LuxuryGradients.violetGold} style={styles.heroGradient}>
          <View style={styles.heroOverlay} />
          <View style={styles.heroContent}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>Private Access</Text>
            </View>
            <Text style={styles.heroTitle}>Private Island Escape</Text>
            <Text style={styles.heroSubtitle}>Exclusive members-only retreat in the Maldives</Text>
            <View style={styles.heroMeta}>
              <Ionicons name="diamond" size={16} color={LuxuryColors.gold} />
              <Text style={styles.heroMetaText}>Founder Circle</Text>
              <View style={{ flex: 1 }} />
              <Text style={styles.heroExplore}>Explore</Text>
              <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.7)" />
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* Curated Collections */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Curated Collections</Text>
          <TouchableOpacity onPress={handleViewAllPress} activeOpacity={0.7}>
            <Text style={styles.sectionLink}>View All</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: LuxurySpacing.md }}>
          {COLLECTIONS.map((card) => (
            <Pressable
              key={card.name}
              style={({ pressed }) => [
                styles.collectionCard,
                { width: privilegeCardWidth },
                pressed && { transform: [{ scale: 0.96 }], opacity: 0.9 },
              ]}
              onPress={() => handleDestinationPress(card.name)}
            >
              <View style={[styles.collectionImage, { width: '100%' }]}>
                <Ionicons
                  name={COLLECTION_ICONS[card.name] ?? 'image-outline'}
                  size={40}
                  color={LuxuryColors.gold}
                  style={{ opacity: 0.75 }}
                />
              </View>
              <Text style={styles.collectionName}>{card.name}</Text>
              <Text style={styles.collectionTag}>{card.tag}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* AI Concierge Recommendation */}
      <TouchableOpacity 
        style={styles.conciergeCard}
        onPress={handleConciergePress}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={LuxuryGradients.goldDeep}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.conciergeGradient}
        >
          <View style={styles.conciergeContent}>
            <View style={styles.conciergeIconContainer}>
              <Ionicons name="sparkles" size={28} color="#FFFFFF" />
            </View>
            <View style={styles.conciergeText}>
              <Text style={styles.conciergeTitle}>Your AI Concierge</Text>
              <Text style={styles.conciergeSubtitle}>Personalized journey recommendations await</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#FFFFFF" />
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* Member Privileges */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Member Privileges</Text>
        </View>
        <View style={styles.privilegesGrid}>
          {([
            { label: 'Private Aviation', icon: 'airplane' as const },
            { label: 'VIP Dining', icon: 'restaurant' as const },
            { label: 'Villa Upgrades', icon: 'diamond' as const },
            { label: 'Travel Insurance', icon: 'shield-checkmark' as const },
          ] as const).map(({ label, icon }) => (
            <Pressable
              key={label}
              style={({ pressed }) => [
                styles.privilegeCard,
                { width: privilegeCardWidth },
                pressed && { transform: [{ scale: 0.97 }] },
              ]}
              onPress={() => handlePrivilegePress(label)}
            >
              <View style={styles.privilegeIcon}>
                <Ionicons name={icon} size={24} color={LuxuryColors.gold} />
              </View>
              <Text style={styles.privilegeTitle} numberOfLines={2}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Marketplace Product Feed */}
      <View style={[styles.section, { paddingBottom: LuxurySpacing.xxxl }]}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Marketplace</Text>
          <TouchableOpacity onPress={handleSellPress} activeOpacity={0.7}>
            <Text style={styles.sellLink}>+ Sell</Text>
          </TouchableOpacity>
        </View>

        {productsLoading && (
          <View style={styles.feedCenter}>
            <ActivityIndicator color={LuxuryColors.gold} size="small" />
          </View>
        )}

        <Animated.View style={{ opacity: productsAnim }}>
          {!productsLoading && productsError && (
            <View style={styles.feedCenter}>
              <Text style={styles.feedMessage}>Could not load listings. Check your connection.</Text>
            </View>
          )}

          {!productsLoading && !productsError && products.length === 0 && (
            <View style={styles.feedCenter}>
              <Ionicons name="storefront-outline" size={40} color={LuxuryColors.textTertiary} />
              <Text style={styles.feedMessage}>Your private marketplace is opening soon.</Text>
              <Text style={styles.feedSubtitle}>Exclusive member listings will appear here.</Text>
              <TouchableOpacity onPress={handleSellPress} activeOpacity={0.8} style={styles.feedCta}>
                <Text style={styles.feedCtaText}>Be the first to sell</Text>
              </TouchableOpacity>
            </View>
          )}

          {!productsLoading && products.map((product) => (
          <Pressable
            key={product.id}
            style={({ pressed }) => [
              styles.productCard,
              pressed && { transform: [{ scale: 0.98 }], opacity: 0.85 },
            ]}
            onPress={() => Alert.alert(product.title, `$${product.price.toFixed(2)}\n\n${product.description}`)}
          >
            {product.imageUrl ? (
              <Image source={{ uri: product.imageUrl }} style={styles.productImage} />
            ) : (
              <View style={styles.productImagePlaceholder}>
                <Ionicons name="image-outline" size={28} color={LuxuryColors.textTertiary} />
              </View>
            )}
            <View style={styles.productInfo}>
              <Text style={styles.productTitle} numberOfLines={2}>{product.title}</Text>
              <Text style={styles.productCategory}>{product.category}</Text>
              <View style={styles.productFooter}>
                <Text style={styles.productPrice}>${product.price.toFixed(2)}</Text>
                {product.ownerName ? (
                  <Text style={styles.productOwner} numberOfLines={1}>by {product.ownerName}</Text>
                ) : null}
              </View>
            </View>
          </Pressable>
        ))}
        </Animated.View>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    maxWidth: '100%',
    backgroundColor: LuxuryColors.background,
    overflow: 'hidden',
  },
  header: {
    paddingTop: LuxurySpacing.xl,
    paddingHorizontal: LuxurySpacing.xl,
    paddingBottom: LuxurySpacing.lg,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: LuxurySpacing.lg,
  },
  logoContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: LuxuryColors.surfaceLight,
    borderWidth: 1.5,
    borderColor: LuxuryColors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: LuxuryColors.gold,
  },
  notificationButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: LuxuryColors.glass,
    borderWidth: 1,
    borderColor: LuxuryColors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: {
    fontSize: LuxuryFontSize.xxxxxl,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
    marginBottom: LuxurySpacing.xs,
    letterSpacing: -1.5,
  },
  subtitle: {
    fontSize: LuxuryFontSize.lg,
    color: LuxuryColors.textSecondary,
    fontWeight: '400',
  },
  heroCard: {
    marginHorizontal: LuxurySpacing.xl,
    height: 280,
    borderRadius: LuxuryBorderRadius.xxxl,
    overflow: 'hidden',
    marginBottom: LuxurySpacing.xxl,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
    ...LuxuryShadow.ambient,
  },
  heroGradient: {
    flex: 1,
    padding: LuxurySpacing.xl,
    justifyContent: 'flex-end',
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
  },
  heroContent: {
    gap: LuxurySpacing.sm,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: LuxurySpacing.sm,
    paddingVertical: LuxurySpacing.xs,
    borderRadius: LuxuryBorderRadius.lg,
    marginBottom: LuxurySpacing.xs,
  },
  heroBadgeText: {
    fontSize: LuxuryFontSize.xs,
    color: LuxuryColors.gold,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontSize: LuxuryFontSize.xxl,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: LuxuryFontSize.md,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.xs,
  },
  heroMetaText: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.gold,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: LuxurySpacing.xl,
    marginBottom: LuxurySpacing.xxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: LuxurySpacing.lg,
  },
  sectionTitle: {
    fontSize: LuxuryFontSize.xl,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
  },
  sectionLink: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.violetLight,
    fontWeight: '600',
  },
  collectionCard: {
    alignItems: 'center',
    overflow: 'hidden',
  },
  collectionImage: {
    height: 140,
    borderRadius: LuxuryBorderRadius.lg,
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.18)',
    marginBottom: LuxurySpacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collectionName: {
    fontSize: LuxuryFontSize.md,
    fontWeight: '600',
    color: LuxuryColors.textPrimary,
  },
  collectionTag: {
    fontSize: LuxuryFontSize.xs,
    color: LuxuryColors.gold,
    fontWeight: '600',
    marginTop: 2,
  },
  conciergeCard: {
    marginHorizontal: LuxurySpacing.xl,
    borderRadius: LuxuryBorderRadius.xxl,
    overflow: 'hidden',
    marginBottom: LuxurySpacing.xxl,
    ...LuxuryShadow.medium,
  },
  conciergeGradient: {
    padding: LuxurySpacing.lg,
  },
  conciergeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.lg,
  },
  conciergeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  conciergeText: {
    flex: 1,
  },
  conciergeTitle: {
    fontSize: LuxuryFontSize.lg,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: LuxurySpacing.xs,
  },
  conciergeSubtitle: {
    fontSize: LuxuryFontSize.sm,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  privilegesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: LuxurySpacing.md,
  },
  privilegeCard: {
    backgroundColor: LuxuryColors.surfaceLight,
    borderWidth: 1,
    borderColor: LuxuryColors.divider,
    borderRadius: LuxuryBorderRadius.xl,
    padding: LuxurySpacing.lg,
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: LuxurySpacing.sm,
  },
  heroExplore: {
    fontSize: LuxuryFontSize.xs,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  privilegeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: LuxuryColors.surfaceLight,
    borderWidth: 1.5,
    borderColor: LuxuryColors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  privilegeTitle: {
    fontSize: LuxuryFontSize.sm,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
    textAlign: 'center',
  },
  feedCenter: {
    alignItems: 'center',
    paddingVertical: LuxurySpacing.xxl,
    gap: LuxurySpacing.md,
  },
  feedMessage: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textTertiary,
    textAlign: 'center',
  },
  feedCta: {
    paddingHorizontal: LuxurySpacing.xl,
    paddingVertical: LuxurySpacing.md,
    borderRadius: LuxuryBorderRadius.full,
    borderWidth: 1,
    borderColor: LuxuryColors.gold,
  },
  feedCtaText: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.gold,
    fontWeight: '600',
  },
  feedSubtitle: {
    fontSize: LuxuryFontSize.xs,
    color: LuxuryColors.textTertiary,
    textAlign: 'center',
    opacity: 0.7,
  },
  sellLink: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.gold,
    fontWeight: '700',
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: LuxuryColors.glass,
    borderWidth: 1,
    borderColor: LuxuryColors.glassBorder,
    borderRadius: LuxuryBorderRadius.xl,
    marginBottom: LuxurySpacing.md,
    overflow: 'hidden',
  },
  productImage: {
    width: 90,
    height: 90,
  },
  productImagePlaceholder: {
    width: 90,
    height: 90,
    backgroundColor: LuxuryColors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productInfo: {
    flex: 1,
    padding: LuxurySpacing.md,
    justifyContent: 'space-between',
  },
  productTitle: {
    fontSize: LuxuryFontSize.md,
    fontWeight: '600',
    color: LuxuryColors.textPrimary,
    marginBottom: LuxurySpacing.xs,
  },
  productCategory: {
    fontSize: LuxuryFontSize.xs,
    color: LuxuryColors.textTertiary,
    marginBottom: LuxurySpacing.xs,
  },
  productFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  productPrice: {
    fontSize: LuxuryFontSize.lg,
    fontWeight: '700',
    color: LuxuryColors.gold,
  },
  productOwner: {
    fontSize: LuxuryFontSize.xs,
    color: LuxuryColors.textTertiary,
    maxWidth: 100,
  },
});
