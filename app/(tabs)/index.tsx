import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, TouchableOpacity, Pressable, useWindowDimensions, Alert, ActivityIndicator, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getAuth } from 'firebase/auth';
import { LuxuryColors, LuxurySpacing, LuxuryBorderRadius, LuxuryFontSize, LuxuryShadow } from '../../constants/luxuryTheme';
import { AnimationTiming } from '../../constants/animations';
import { getFirebaseApp } from '../../lib/firebase';
import { getLatestProducts, type Product } from '../../lib/products';

const HERO_CARDS = [
  { badge: 'Private Access',     title: 'Private Island Escape',    subtitle: 'Exclusive members-only retreat in the Maldives',     tier: 'Founder Circle',  image: require('../../assets/collections/private-islands.jpg') },
  { badge: 'Overwater Suite',    title: 'Bora Bora Sanctuary',      subtitle: 'Crystal lagoon villa with private butler service',    tier: 'Diamond Member',  image: require('../../assets/collections/private-islands.jpg') },
  { badge: 'Charter Experience', title: 'Superyacht Mediterranean', subtitle: 'Seven-day exclusive charter along the Amalfi Coast',  tier: 'Founding Member', image: require('../../assets/collections/yacht-escapes.jpg')   },
  { badge: 'Alpine Retreat',     title: 'Swiss Chalet Collection',  subtitle: 'Private mountain chalet with panoramic alpine views', tier: 'Platinum Access', image: require('../../assets/collections/super-villas.jpg')    },
  { badge: 'Desert Expedition',  title: 'Sahara Luxury Camp',       subtitle: 'Glamping under a billion stars in the golden dunes',  tier: 'Explorer Circle', image: require('../../assets/collections/desert-retreats.jpg') },
];

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

const COLLECTION_GRADIENTS = {
  'Private Islands': ['#0B3D52', '#1A7A9A'],
  'Super Villas':    ['#3B1F08', '#7A4A15'],
  'Yacht Escapes':   ['#0A1F4A', '#154FA0'],
  'Desert Retreats': ['#3D2508', '#8A5A1A'],
} as const;

// Static image assets — replace files in assets/collections/ with real photos.
// Gradient above is always rendered first as a fallback if the image fails to load.
const COLLECTION_IMAGES = {
  'Private Islands': require('../../assets/collections/private-islands.jpg'),
  'Super Villas':    require('../../assets/collections/super-villas.jpg'),
  'Yacht Escapes':   require('../../assets/collections/yacht-escapes.jpg'),
  'Desert Retreats': require('../../assets/collections/desert-retreats.jpg'),
};

const PRIVILEGES = [
  { label: 'Private Aviation', icon: 'airplane'         as const, subtitle: 'Access, Anywhere',         badge: 'Included' },
  { label: 'VIP Dining',       icon: 'restaurant'       as const, subtitle: 'Michelin-Starred Dining',  badge: 'Active'   },
  { label: 'Villa Upgrades',   icon: 'diamond'          as const, subtitle: 'Preferred Villa Upgrades', badge: 'Included' },
  { label: 'Travel Insurance', icon: 'shield-checkmark' as const, subtitle: 'Worldwide Protection',     badge: 'Active'   },
] as const;

const FEATURED_LISTINGS = [
  {
    category:    'Luxury Property',
    title:       'Santorini Clifftop Estate',
    description: 'Six-bedroom private estate with 270° caldera views and infinity pool.',
    price:       '€18,500,000',
    image:       require('../../assets/collections/super-villas.jpg'),
    seller:      { name: 'James R.', verified: true },
  },
  {
    category:    'Superyacht',
    title:       'M/Y Azure Dream',
    description: '58m Benetti — 6 cabins, beach club, helipad. Mediterranean delivery.',
    price:       '$42,000,000',
    image:       require('../../assets/collections/yacht-escapes.jpg'),
    seller:      { name: 'Sofia M.', verified: true },
  },
  {
    category:    'Private Aviation',
    title:       'Gulfstream G700 Charter',
    description: 'Ultra-long range · 14 passengers · VVIP cabin · Global routing.',
    price:       '$185,000 / trip',
    image:       require('../../assets/collections/private-islands.jpg'),
    seller:      { name: 'Amir K.', verified: true },
  },
] as const;

const SELLER_SPOTLIGHT = {
  name:       'Alexander V.',
  title:      'Verified Private Broker',
  credential: 'Knight Frank · 12 Years · $2.4B Closed',
  initials:   'AV',
} as const;



export default function ExploreScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Two equal cards with one gap inside section padding (xl each side)
  const privilegeCardWidth = Math.floor((width - LuxurySpacing.xl * 2 - LuxurySpacing.md) / 2);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState(false);
  const productsAnim = useRef(new Animated.Value(0)).current;
  const heroScrollRef = useRef<ScrollView>(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const heroIndexRef = useRef(0);

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
    // Notifications screen is planned for a future release.
    Alert.alert('Notifications', 'No new notifications at this time.');
  };

  // View All — full collection catalogue screen is planned for a future release.
  const handleViewAllPress = () => {
    Alert.alert(
      'Curated Collections',
      'The full catalogue is coming soon.\n\nYour AI Concierge can search any destination for you right now.',
      [
        { text: 'Maybe Later', style: 'cancel' },
        { text: 'Open Concierge', onPress: () => router.push('/(tabs)/ai-concierge') },
      ],
    );
  };

  const handleConciergePress = () => {
    router.push('/(tabs)/ai-concierge');
  };

  // Hero card — routes to AI Concierge to start planning this featured experience.
  const handleHeroPress = () => {
    router.push('/(tabs)/ai-concierge');
  };

  // Collection cards — individual collection pages are planned for a future release.
  const handleCollectionPress = (collectionName: string) => {
    Alert.alert(
      collectionName,
      'Collection pages are coming in a future update.\n\nUse your AI Concierge to plan a custom journey now.',
      [
        { text: 'Maybe Later', style: 'cancel' },
        { text: 'Ask Concierge', onPress: () => router.push('/(tabs)/ai-concierge') },
      ],
    );
  };

  // Privilege cards — routes to the Membership tab where all privileges are detailed.
  const handlePrivilegePress = (_label: string) => {
    router.push('/(tabs)/membership');
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
      {/* Elegant Header — paddingTop adds insets.top so status bar never overlaps */}
      <View style={[styles.header, { paddingTop: insets.top + LuxurySpacing.xl }]}>
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

      {/* Cinematic Hero Carousel */}
      <View style={styles.heroCarouselWrapper}>
        <ScrollView
          ref={heroScrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / width);
            if (idx !== heroIndexRef.current) {
              heroIndexRef.current = idx;
              setHeroIndex(idx);
            }
          }}
        >
          {HERO_CARDS.map((card) => (
            <TouchableOpacity
              key={card.title}
              style={{ width }}
              onPress={handleHeroPress}
              activeOpacity={0.8}
            >
              <View style={styles.heroCard}>
                <Image source={card.image} style={[StyleSheet.absoluteFill, styles.heroImage]} resizeMode="cover" />
                <LinearGradient
                  colors={['rgba(0,0,0,0.08)', 'rgba(0,0,0,0.42)', 'rgba(0,0,0,0.82)'] as const}
                  style={styles.heroGradient}
                >
                  <View style={styles.heroContent}>
                    <View style={styles.heroBadge}>
                      <Text style={styles.heroBadgeText}>{card.badge}</Text>
                    </View>
                    <View style={styles.heroTitleBlock}>
                      <Text style={styles.heroTitle}>{card.title}</Text>
                      <Text style={styles.heroSubtitle}>{card.subtitle}</Text>
                    </View>
                    <View style={styles.heroMeta}>
                      <Ionicons name="diamond" size={14} color={LuxuryColors.gold} />
                      <Text style={styles.heroMetaText}>{card.tier}</Text>
                      <View style={{ flex: 1 }} />
                      <Text style={styles.heroExplore}>Explore</Text>
                      <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.7)" />
                    </View>
                  </View>
                </LinearGradient>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.heroDots}>
          {HERO_CARDS.map((_, i) => (
            <View key={i} style={[styles.heroDot, i === heroIndex && styles.heroDotActive]} />
          ))}
        </View>
      </View>

      {/* Curated Collections */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Curated Collections</Text>
          <TouchableOpacity onPress={handleViewAllPress} activeOpacity={0.7}>
            <Text style={styles.sectionLink}>View All</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.collectionGrid}>
          {COLLECTIONS.map((card) => (
            <Pressable
              key={card.name}
              style={({ pressed }) => [
                styles.collectionCard,
                { width: privilegeCardWidth },
                pressed && { transform: [{ scale: 0.97 }], opacity: 0.88 },
              ]}
              onPress={() => handleCollectionPress(card.name)}
            >
              <View style={styles.collectionImageCard}>
                {/* Gradient always renders first — visible during image load or on error */}
                <LinearGradient
                  colors={COLLECTION_GRADIENTS[card.name] ?? (['#141E33', '#0D1525'] as const)}
                  style={StyleSheet.absoluteFill}
                />
                {/* Real photo on top of gradient — replaces it once loaded */}
                <Image
                  source={COLLECTION_IMAGES[card.name]}
                  style={[StyleSheet.absoluteFill, styles.collectionImageStyle]}
                  resizeMode="cover"
                />
                {/* Subtle full-card tint — keeps image visible, lifts contrast */}
                <View style={styles.collectionCardTint} />
                {/* Smooth bottom scrim — protects gold tag and white title only */}
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.88)'] as const}
                  style={styles.collectionTextProtect}
                />
                {/* Icon sits at top-center, clear of the label zone */}
                <View style={styles.collectionCardIconWrap}>
                  <Ionicons
                    name={COLLECTION_ICONS[card.name] ?? 'image-outline'}
                    size={25}
                    color="rgba(255,255,255,0.78)"
                    style={styles.collectionCardIcon}
                  />
                </View>
                <View style={styles.collectionCardLabel}>
                  <Text style={styles.collectionCardTag}>{card.tag}</Text>
                  <Text style={styles.collectionCardName} numberOfLines={1}>{card.name}</Text>
                </View>
              </View>
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
          colors={['#1A0F00', '#4A3200', '#C8A020'] as const}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={styles.conciergeGradient}
        >
          <View style={styles.conciergeContent}>
            <View style={styles.conciergeIconContainer}>
              <Ionicons name="sparkles" size={18} color="rgba(255,255,255,0.88)" />
            </View>
            <View style={styles.conciergeText}>
              <Text style={styles.conciergeOverline}>Personal Concierge</Text>
              <Text style={styles.conciergeTitle}>Your AI Concierge</Text>
              <Text style={styles.conciergeSubtitle}>Craft your perfect luxury itinerary</Text>
            </View>
          </View>
          <View style={styles.conciergePrompts}>
            {(['Private Jet', 'Romantic Escape', 'Yacht Weekend', 'Desert Adventure'] as const).map((prompt) => (
              <TouchableOpacity
                key={prompt}
                style={styles.conciergeChip}
                onPress={handleConciergePress}
                activeOpacity={0.75}
              >
                <Text style={styles.conciergeChipText}>{prompt}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.conciergeCTARow}>
            <Text style={styles.conciergeCTAText}>Start Planning</Text>
            <Ionicons name="arrow-forward" size={13} color="rgba(255,255,255,0.78)" />
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* Member Privileges */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Member Privileges</Text>
        </View>
        <View style={styles.privilegesGrid}>
          {PRIVILEGES.map(({ label, icon, subtitle, badge }) => (
            <Pressable
              key={label}
              style={({ pressed }) => [
                styles.privilegeCard,
                { width: privilegeCardWidth },
                pressed && { transform: [{ scale: 0.97 }] },
              ]}
              onPress={() => handlePrivilegePress(label)}
            >
              <LinearGradient
                colors={['#121E35', '#0D1525'] as const}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.privilegeIcon}>
                <Ionicons name={icon} size={20} color={LuxuryColors.gold} />
              </View>
              <Text style={styles.privilegeTitle}>{label}</Text>
              <Text style={styles.privilegeSubtitle}>{subtitle}</Text>
              <View style={styles.privilegeBadge}>
                <Text style={styles.privilegeBadgeText}>{badge}</Text>
              </View>
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
            <View>
              {/* Invite-only badge */}
              <View style={styles.feedBadge}>
                <Ionicons name="lock-closed" size={11} color={LuxuryColors.gold} />
                <Text style={styles.feedBadgeText}>Invite Only · Members Can List</Text>
              </View>

              {/* Featured Listings overline */}
              <Text style={styles.mktOverline}>Featured Listings</Text>

              {/* 3 featured listing cards */}
              {FEATURED_LISTINGS.map((listing) => (
                <Pressable
                  key={listing.title}
                  style={({ pressed }) => [
                    styles.featuredCard,
                    pressed && { transform: [{ scale: 0.985 }], opacity: 0.90 },
                  ]}
                  onPress={handleConciergePress}
                >
                  {/* Image zone */}
                  <View style={styles.featuredImageWrap}>
                    <Image source={listing.image} style={styles.featuredImage} resizeMode="cover" />
                    <LinearGradient
                      colors={['transparent', 'rgba(7,17,32,0.88)'] as const}
                      style={styles.featuredImageScrim}
                    />
                    <View style={styles.featuredCategoryBadge}>
                      <Text style={styles.featuredCategoryText}>{listing.category}</Text>
                    </View>
                  </View>
                  {/* Content zone */}
                  <View style={styles.featuredBody}>
                    <Text style={styles.featuredTitle}>{listing.title}</Text>
                    <Text style={styles.featuredDesc}>{listing.description}</Text>
                    <View style={styles.featuredPriceRow}>
                      <Text style={styles.featuredPrice}>{listing.price}</Text>
                      <View style={styles.featuredEnquireBtn}>
                        <Text style={styles.featuredEnquireText}>Enquire</Text>
                        <Ionicons name="arrow-forward" size={10} color={LuxuryColors.background} />
                      </View>
                    </View>
                    <View style={styles.featuredDivider} />
                    <View style={styles.featuredSellerRow}>
                      <View style={styles.featuredAvatar}>
                        <Text style={styles.featuredAvatarText}>{listing.seller.name.charAt(0)}</Text>
                      </View>
                      <Text style={styles.featuredSellerName}>{listing.seller.name}</Text>
                      <Ionicons name="checkmark-circle" size={12} color={LuxuryColors.gold} />
                      <Text style={styles.featuredVerified}>Verified Seller</Text>
                    </View>
                  </View>
                </Pressable>
              ))}

              {/* Seller Spotlight */}
              <View style={styles.sellerSpotlight}>
                <LinearGradient
                  colors={['#0D1830', '#0A1420'] as const}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={styles.spotlightOverline}>Seller Spotlight</Text>
                <View style={styles.spotlightRow}>
                  <View style={styles.spotlightAvatar}>
                    <Text style={styles.spotlightAvatarText}>{SELLER_SPOTLIGHT.initials}</Text>
                  </View>
                  <View style={styles.spotlightInfo}>
                    <View style={styles.spotlightNameRow}>
                      <Text style={styles.spotlightName}>{SELLER_SPOTLIGHT.name}</Text>
                      <Ionicons name="checkmark-circle" size={14} color={LuxuryColors.gold} />
                    </View>
                    <Text style={styles.spotlightTitle}>{SELLER_SPOTLIGHT.title}</Text>
                    <Text style={styles.spotlightCredential}>{SELLER_SPOTLIGHT.credential}</Text>
                  </View>
                </View>
              </View>

              {/* List Your Asset CTA */}
              <View style={styles.feedCenter}>
                <TouchableOpacity onPress={handleSellPress} activeOpacity={0.8} style={styles.feedCta}>
                  <Text style={styles.feedCtaText}>List Your Asset</Text>
                  <Ionicons name="arrow-forward" size={11} color={LuxuryColors.gold} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {!productsLoading && products.map((product) => (
          <Pressable
            key={product.id}
            style={({ pressed }) => [
              styles.productCard,
              pressed && { transform: [{ scale: 0.98 }], opacity: 0.85 },
            ]}
            onPress={() => Alert.alert(
              product.title,
              `${product.category}  ·  $${product.price.toFixed(2)}${product.ownerName ? `\nby ${product.ownerName}` : ''}\n\n${product.description}`,
              [{ text: 'Close', style: 'cancel' }],
            )}
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
  heroCarouselWrapper: {
    marginBottom: LuxurySpacing.xxl,
  },
  heroCard: {
    marginHorizontal: LuxurySpacing.xl,
    height: 280,
    borderRadius: LuxuryBorderRadius.xxxl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
    ...LuxuryShadow.ambient,
  },
  heroDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: LuxurySpacing.xs,
    marginTop: LuxurySpacing.md,
  },
  heroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  heroDotActive: {
    width: 20,
    backgroundColor: LuxuryColors.gold,
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
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroContent: {
    gap: LuxurySpacing.md,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: LuxurySpacing.md,
    paddingVertical: LuxurySpacing.xs,
    borderRadius: LuxuryBorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.45)',
  },
  heroBadgeText: {
    fontSize: LuxuryFontSize.xs,
    color: LuxuryColors.gold,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroTitleBlock: {
    gap: LuxurySpacing.xs,
  },
  heroTitle: {
    fontSize: LuxuryFontSize.xxl,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.8,
    lineHeight: 30,
  },
  heroSubtitle: {
    fontSize: LuxuryFontSize.sm,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
    paddingTop: LuxurySpacing.sm,
  },
  heroMetaText: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.gold,
    fontWeight: '600',
    letterSpacing: 0.2,
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
    fontSize: 11,
    color: LuxuryColors.gold,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  collectionCard: {
    overflow: 'hidden',
    borderRadius: LuxuryBorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.18)',
    ...LuxuryShadow.soft,
  },
  collectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: LuxurySpacing.md,
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
  collectionImageCard: {
    height: 140,
    width: '100%',
    borderRadius: LuxuryBorderRadius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  collectionCardTint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  collectionTextProtect: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 110,
  },
  collectionImageStyle: {
    width: '100%',
    height: '100%',
    opacity: 1,
  },
  collectionCardIcon: {
    opacity: 0.80,
  },
  collectionCardIconWrap: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  collectionCardLabel: {
    position: 'absolute',
    bottom: LuxurySpacing.md,
    left: LuxurySpacing.md,
    right: LuxurySpacing.md,
  },
  collectionCardTag: {
    fontSize: 10,
    color: LuxuryColors.gold,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.0,
    marginBottom: 3,
  },
  collectionCardName: {
    fontSize: LuxuryFontSize.sm,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },
  conciergeCard: {
    marginHorizontal: LuxurySpacing.xl,
    borderRadius: LuxuryBorderRadius.xxl,
    overflow: 'hidden',
    marginBottom: LuxurySpacing.xxl,
    ...LuxuryShadow.medium,
  },
  conciergeGradient: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 12,
  },
  conciergeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  conciergeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  conciergeText: {
    flex: 1,
  },
  conciergeOverline: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.50)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 2.5,
    marginBottom: 3,
  },
  conciergeTitle: {
    fontSize: LuxuryFontSize.lg,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  conciergeSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.62)',
    lineHeight: 18,
    letterSpacing: 0.15,
  },
  conciergePrompts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.20)',
  },
  conciergeChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: LuxuryBorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.30)',
  },
  conciergeChipText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  conciergeCTARow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: LuxurySpacing.xs,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.22)',
  },
  conciergeCTAText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: 2.0,
    textTransform: 'uppercase',
  },
  privilegesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: LuxurySpacing.md,
  },
  privilegeCard: {
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.18)',
    borderRadius: LuxuryBorderRadius.xl,
    overflow: 'hidden',
    padding: LuxurySpacing.lg,
    minHeight: 148,
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: LuxurySpacing.sm,
    ...LuxuryShadow.soft,
  },
  heroExplore: {
    fontSize: LuxuryFontSize.xs,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  privilegeIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(212,175,55,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  privilegeTitle: {
    fontSize: LuxuryFontSize.sm,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
  },
  privilegeSubtitle: {
    fontSize: LuxuryFontSize.xs,
    color: LuxuryColors.textSecondary,
    marginTop: 1,
    opacity: 0.80,
  },
  privilegeBadge: {
    marginTop: LuxurySpacing.xs,
    paddingHorizontal: LuxurySpacing.md,
    paddingVertical: 2,
    borderRadius: LuxuryBorderRadius.full,
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(212,175,55,0.40)',
  },
  privilegeBadgeText: {
    fontSize: 10,
    color: LuxuryColors.gold,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  feedCenter: {
    alignItems: 'center',
    paddingVertical: LuxurySpacing.xl,
    gap: LuxurySpacing.sm,
  },
  feedMessage: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textTertiary,
    textAlign: 'center',
  },
  feedCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.xs,
    paddingHorizontal: LuxurySpacing.lg,
    paddingVertical: LuxurySpacing.sm,
    borderRadius: LuxuryBorderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(212,175,55,0.60)',
    marginTop: LuxurySpacing.xs,
  },
  feedCtaText: {
    fontSize: 11,
    color: LuxuryColors.gold,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 2.0,
  },
  feedSubtitle: {
    fontSize: LuxuryFontSize.xs,
    color: LuxuryColors.textSecondary,
    textAlign: 'center',
    opacity: 0.70,
    lineHeight: 18,
  },
  feedOverline: {
    fontSize: 9,
    color: 'rgba(212,175,55,0.70)',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 2.5,
  },
  feedHeading: {
    fontSize: LuxuryFontSize.xl,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
    letterSpacing: -0.3,
  },
  feedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.xs,
    alignSelf: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.20)',
    borderRadius: LuxuryBorderRadius.full,
    paddingHorizontal: LuxurySpacing.md,
    paddingVertical: LuxurySpacing.xs,
    marginBottom: LuxurySpacing.lg,
  },
  feedBadgeText: {
    fontSize: LuxuryFontSize.xs,
    color: LuxuryColors.gold,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  ghostImage: {
    width: 88,
    height: 88,
    margin: 1,
    borderRadius: LuxuryBorderRadius.sm,
    backgroundColor: '#121E35',
  },
  ghostInfo: {
    flex: 1,
    padding: LuxurySpacing.md,
    gap: LuxurySpacing.sm,
    justifyContent: 'center',
  },
  ghostLine: {
    height: 9,
    borderRadius: LuxuryBorderRadius.sm,
    backgroundColor: '#121E35',
    width: '80%',
  },
  sellLink: {
    fontSize: 11,
    color: LuxuryColors.gold,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
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
  // ─── Featured Marketplace Cards ──────────────────────────────────────
  mktOverline: {
    fontSize: 9,
    color: 'rgba(212,175,55,0.70)',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 2.5,
    marginBottom: LuxurySpacing.md,
  },
  featuredCard: {
    backgroundColor: LuxuryColors.surface,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.18)',
    borderRadius: LuxuryBorderRadius.xl,
    overflow: 'hidden',
    marginBottom: LuxurySpacing.lg,
    ...LuxuryShadow.medium,
  },
  featuredImageWrap: {
    height: 155,
    width: '100%',
  },
  featuredImage: {
    width: '100%',
    height: '100%',
  },
  featuredImageScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 60,
  },
  featuredCategoryBadge: {
    position: 'absolute',
    top: LuxurySpacing.md,
    left: LuxurySpacing.md,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: LuxurySpacing.md,
    paddingVertical: LuxurySpacing.xs,
    borderRadius: LuxuryBorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.45)',
  },
  featuredCategoryText: {
    fontSize: LuxuryFontSize.xs,
    color: LuxuryColors.gold,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  featuredBody: {
    padding: LuxurySpacing.md,
    gap: 5,
  },
  featuredTitle: {
    fontSize: LuxuryFontSize.lg,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
    letterSpacing: -0.2,
  },
  featuredDesc: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textSecondary,
    lineHeight: 20,
    opacity: 0.85,
  },
  featuredPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  featuredPrice: {
    fontSize: LuxuryFontSize.xl,
    fontWeight: '700',
    color: LuxuryColors.gold,
    letterSpacing: -0.3,
  },
  featuredEnquireBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: LuxuryColors.gold,
    paddingHorizontal: LuxurySpacing.md,
    paddingVertical: LuxurySpacing.xs,
    borderRadius: LuxuryBorderRadius.full,
  },
  featuredEnquireText: {
    fontSize: 11,
    fontWeight: '700',
    color: LuxuryColors.background,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  featuredDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(212,175,55,0.15)',
    marginVertical: 3,
  },
  featuredSellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.xs,
  },
  featuredAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(212,175,55,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredAvatarText: {
    fontSize: 11,
    fontWeight: '700',
    color: LuxuryColors.gold,
  },
  featuredSellerName: {
    fontSize: LuxuryFontSize.xs,
    color: LuxuryColors.textSecondary,
    fontWeight: '600',
    flex: 1,
  },
  featuredVerified: {
    fontSize: 10,
    color: LuxuryColors.gold,
    fontWeight: '600',
    opacity: 0.8,
  },
  // ─── Seller Spotlight ────────────────────────────────────────────────
  sellerSpotlight: {
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.18)',
    borderRadius: LuxuryBorderRadius.xl,
    overflow: 'hidden',
    padding: LuxurySpacing.lg,
    marginBottom: LuxurySpacing.lg,
    ...LuxuryShadow.soft,
  },
  spotlightOverline: {
    fontSize: 9,
    color: 'rgba(212,175,55,0.70)',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 2.5,
    marginBottom: LuxurySpacing.md,
  },
  spotlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.md,
  },
  spotlightAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(212,175,55,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotlightAvatarText: {
    fontSize: LuxuryFontSize.lg,
    fontWeight: '700',
    color: LuxuryColors.gold,
  },
  spotlightInfo: {
    flex: 1,
    gap: 3,
  },
  spotlightNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LuxurySpacing.xs,
  },
  spotlightName: {
    fontSize: LuxuryFontSize.md,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
  },
  spotlightTitle: {
    fontSize: LuxuryFontSize.xs,
    color: LuxuryColors.gold,
    fontWeight: '600',
    opacity: 0.85,
  },
  spotlightCredential: {
    fontSize: 11,
    color: LuxuryColors.textSecondary,
    lineHeight: 16,
    opacity: 0.75,
  },
});
