import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import {
  LuxuryColors,
  LuxurySpacing,
  LuxuryBorderRadius,
  LuxuryFontSize,
  LuxuryShadow,
} from '../../constants/luxuryTheme';
import { getFirebaseApp } from '../../lib/firebase';
import { getUserProfile } from '../../lib/userProfile';
import { addProduct } from '../../lib/products';

const CATEGORIES = ['Electronics', 'Fashion', 'Home', 'Sports', 'Art', 'Vehicles', 'Other'];

export default function AddProductScreen() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priceText, setPriceText] = useState('');
  const [category, setCategory] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    const trimmedDesc = description.trim();
    const trimmedImage = imageUrl.trim();
    const trimmedCategory = category.trim();

    if (!trimmedTitle) {
      Alert.alert('Required', 'Please enter a product title.');
      return;
    }
    if (!trimmedDesc) {
      Alert.alert('Required', 'Please enter a description.');
      return;
    }
    const price = parseFloat(priceText);
    if (isNaN(price) || price <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price greater than 0.');
      return;
    }
    if (!trimmedCategory) {
      Alert.alert('Required', 'Please select or enter a category.');
      return;
    }

    try {
      setIsLoading(true);
      const auth = getAuth(getFirebaseApp());
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Not Signed In', 'Please sign in to list a product.');
        return;
      }
      const profile = await getUserProfile(user.uid);
      const ownerName = profile?.fullName ?? user.displayName ?? null;

      await addProduct({
        title: trimmedTitle,
        description: trimmedDesc,
        price,
        category: trimmedCategory,
        imageUrl: trimmedImage,
        ownerId: user.uid,
        ownerName,
      });

      Alert.alert('Listed!', 'Your product has been listed successfully.', [
        {
          text: 'OK',
          onPress: () => {
            setTitle('');
            setDescription('');
            setPriceText('');
            setCategory('');
            setImageUrl('');
          },
        },
      ]);
    } catch (e: any) {
      console.warn('[AddProduct] submit failed:', e.message);
      Alert.alert('Error', 'Could not list product. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="storefront-outline" size={28} color={LuxuryColors.gold} />
          </View>
          <Text style={styles.headerTitle}>List a Product</Text>
          <Text style={styles.headerSubtitle}>Sell to our exclusive members</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Title */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Title</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="pricetag-outline" size={18} color={LuxuryColors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="e.g. Vintage Rolex Submariner"
                placeholderTextColor={LuxuryColors.textTertiary}
                value={title}
                onChangeText={setTitle}
                returnKeyType="next"
                maxLength={80}
              />
            </View>
          </View>

          {/* Description */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Description</Text>
            <View style={[styles.inputWrapper, styles.textAreaWrapper]}>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe the item's condition, history, and any unique details…"
                placeholderTextColor={LuxuryColors.textTertiary}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                maxLength={500}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Price */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Price (USD)</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor={LuxuryColors.textTertiary}
                value={priceText}
                onChangeText={setPriceText}
                keyboardType="decimal-pad"
                returnKeyType="next"
                maxLength={12}
              />
            </View>
          </View>

          {/* Category */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Category</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryChip, category === cat && styles.categoryChipSelected]}
                  onPress={() => setCategory(cat)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[styles.categoryChipText, category === cat && styles.categoryChipTextSelected]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Image URL */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Image URL <Text style={styles.labelOptional}>(optional)</Text></Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="image-outline" size={18} color={LuxuryColors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="https://example.com/image.jpg"
                placeholderTextColor={LuxuryColors.textTertiary}
                value={imageUrl}
                onChangeText={setImageUrl}
                autoCapitalize="none"
                keyboardType="url"
                returnKeyType="done"
              />
            </View>
          </View>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          activeOpacity={0.8}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color="#000" style={{ marginRight: LuxurySpacing.sm }} />
              <Text style={styles.submitText}>List Product</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 80 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LuxuryColors.surface,
  },
  scrollContent: {
    paddingHorizontal: LuxurySpacing.xl,
    paddingTop: LuxurySpacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: LuxurySpacing.xxl,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: LuxuryColors.surfaceLight,
    borderWidth: 1.5,
    borderColor: LuxuryColors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: LuxurySpacing.md,
    ...LuxuryShadow.gold,
  },
  headerTitle: {
    fontSize: LuxuryFontSize.xxl,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
    marginBottom: LuxurySpacing.xs,
  },
  headerSubtitle: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textSecondary,
  },
  form: {
    gap: LuxurySpacing.lg,
    marginBottom: LuxurySpacing.xxl,
  },
  fieldGroup: {
    gap: LuxurySpacing.sm,
  },
  label: {
    fontSize: LuxuryFontSize.sm,
    fontWeight: '600',
    color: LuxuryColors.textSecondary,
    letterSpacing: 0.5,
  },
  labelOptional: {
    color: LuxuryColors.textTertiary,
    fontWeight: '400',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LuxuryColors.glass,
    borderWidth: 1,
    borderColor: LuxuryColors.glassBorder,
    borderRadius: LuxuryBorderRadius.lg,
    paddingHorizontal: LuxurySpacing.md,
    minHeight: 52,
  },
  textAreaWrapper: {
    alignItems: 'flex-start',
    paddingVertical: LuxurySpacing.md,
    minHeight: 110,
  },
  inputIcon: {
    marginRight: LuxurySpacing.sm,
  },
  currencySymbol: {
    fontSize: LuxuryFontSize.lg,
    color: LuxuryColors.textSecondary,
    marginRight: LuxurySpacing.sm,
    fontWeight: '600',
  },
  input: {
    flex: 1,
    fontSize: LuxuryFontSize.md,
    color: LuxuryColors.textPrimary,
    paddingVertical: LuxurySpacing.sm,
  },
  textArea: {
    minHeight: 88,
    paddingTop: 0,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: LuxurySpacing.sm,
  },
  categoryChip: {
    paddingHorizontal: LuxurySpacing.md,
    paddingVertical: LuxurySpacing.sm,
    borderRadius: LuxuryBorderRadius.full,
    borderWidth: 1,
    borderColor: LuxuryColors.glassBorder,
    backgroundColor: LuxuryColors.glass,
  },
  categoryChipSelected: {
    borderColor: LuxuryColors.gold,
    backgroundColor: LuxuryColors.goldGlow,
  },
  categoryChipText: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textSecondary,
    fontWeight: '500',
  },
  categoryChipTextSelected: {
    color: LuxuryColors.gold,
    fontWeight: '600',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LuxuryColors.gold,
    borderRadius: LuxuryBorderRadius.xl,
    paddingVertical: LuxurySpacing.lg,
    ...LuxuryShadow.gold,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitText: {
    fontSize: LuxuryFontSize.md,
    fontWeight: '700',
    color: '#000',
  },
});
