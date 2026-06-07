import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { CardField, useConfirmSetupIntent, type CardFieldInput } from '@stripe/stripe-react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LuxuryColors,
  LuxurySpacing,
  LuxuryBorderRadius,
  LuxuryFontSize,
} from '../constants/luxuryTheme';
import {
  createSetupIntent,
  listPaymentMethods,
  removePaymentMethod,
  setDefaultPaymentMethod,
  type SavedPaymentMethod,
} from '../lib/paymentService';

function formatBrand(brand: string): string {
  if (!brand) return 'Card';
  return brand.charAt(0).toUpperCase() + brand.slice(1);
}

const CARD_FIELD_STYLE: CardFieldInput.Styles = {
  backgroundColor: LuxuryColors.background,
  borderColor: 'rgba(212, 175, 55, 0.28)',
  borderRadius: LuxuryBorderRadius.md,
  borderWidth: 1,
  textColor: LuxuryColors.textPrimary,
  placeholderColor: LuxuryColors.textTertiary,
};

export default function PaymentMethodsScreen() {
  const insets = useSafeAreaInsets();
  const { confirmSetupIntent } = useConfirmSetupIntent();
  const [methods, setMethods] = useState<SavedPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);

  const loadMethods = useCallback(async () => {
    try {
      setLoading(true);
      setMethods(await listPaymentMethods());
    } catch (error) {
      Alert.alert('Payment methods', error instanceof Error ? error.message : 'Could not load cards.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMethods();
  }, [loadMethods]);

  const handleAddCard = useCallback(async () => {
    if (!cardComplete || saving) return;
    try {
      setSaving(true);
      const { clientSecret } = await createSetupIntent();
      const result = await confirmSetupIntent(clientSecret, { paymentMethodType: 'Card' });
      if (result.error) throw new Error(result.error.message || 'Card setup failed.');
      const paymentMethodId = result.setupIntent?.paymentMethod?.id;
      if (paymentMethodId) await setDefaultPaymentMethod(paymentMethodId);
      setCardComplete(false);
      await loadMethods();
      Alert.alert('Card saved', 'Your card is ready for secure purchases.');
    } catch (error) {
      Alert.alert('Card not saved', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }, [cardComplete, confirmSetupIntent, loadMethods, saving]);

  const handleDefault = useCallback(async (paymentMethodId: string) => {
    try {
      await setDefaultPaymentMethod(paymentMethodId);
      await loadMethods();
    } catch (error) {
      Alert.alert('Payment methods', error instanceof Error ? error.message : 'Could not update default card.');
    }
  }, [loadMethods]);

  const handleRemove = useCallback((paymentMethodId: string) => {
    Alert.alert('Remove card?', 'This card will be detached from your account.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removePaymentMethod(paymentMethodId);
            await loadMethods();
          } catch (error) {
            Alert.alert('Payment methods', error instanceof Error ? error.message : 'Could not remove card.');
          }
        },
      },
    ]);
  }, [loadMethods]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}> 
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()} activeOpacity={0.75}>
          <Ionicons name="arrow-back" size={22} color={LuxuryColors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Payment Methods</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.addPanel}>
          <Text style={styles.sectionTitle}>Add Card</Text>
          <CardField
            postalCodeEnabled
            placeholders={{ number: '4242 4242 4242 4242' }}
            cardStyle={CARD_FIELD_STYLE}
            style={styles.cardField}
            onCardChange={(card) => setCardComplete(card.complete)}
          />
          <TouchableOpacity
            style={[styles.primaryButton, (!cardComplete || saving) && styles.disabledButton]}
            onPress={handleAddCard}
            activeOpacity={0.85}
            disabled={!cardComplete || saving}
          >
            {saving ? (
              <ActivityIndicator color={LuxuryColors.background} />
            ) : (
              <>
                <Ionicons name="card-outline" size={17} color={LuxuryColors.background} />
                <Text style={styles.primaryButtonText}>Save Card</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Saved Cards</Text>
        {loading ? (
          <ActivityIndicator color={LuxuryColors.gold} style={{ marginTop: LuxurySpacing.lg }} />
        ) : methods.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="card-outline" size={28} color={LuxuryColors.textTertiary} />
            <Text style={styles.emptyText}>No saved cards yet.</Text>
          </View>
        ) : (
          methods.map((method) => (
            <View key={method.id} style={styles.methodRow}>
              <View style={styles.cardIcon}>
                <Ionicons name="card" size={18} color={LuxuryColors.gold} />
              </View>
              <View style={styles.methodBody}>
                <Text style={styles.methodTitle}>{formatBrand(method.brand)} ending {method.last4}</Text>
                <Text style={styles.methodMeta}>Expires {method.expMonth}/{method.expYear}</Text>
              </View>
              {method.isDefault ? (
                <View style={styles.defaultPill}>
                  <Text style={styles.defaultPillText}>Default</Text>
                </View>
              ) : (
                <TouchableOpacity style={styles.smallButton} onPress={() => handleDefault(method.id)}>
                  <Text style={styles.smallButtonText}>Default</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.removeButton} onPress={() => handleRemove(method.id)}>
                <Ionicons name="trash-outline" size={18} color={LuxuryColors.textSecondary} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: LuxuryColors.background,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: LuxurySpacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(212, 175, 55, 0.22)',
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: LuxuryColors.textPrimary,
    fontSize: LuxuryFontSize.lg,
    fontWeight: '700',
  },
  content: {
    padding: LuxurySpacing.lg,
    paddingBottom: LuxurySpacing.xxl,
  },
  addPanel: {
    marginBottom: LuxurySpacing.xl,
  },
  sectionTitle: {
    color: LuxuryColors.textPrimary,
    fontSize: LuxuryFontSize.md,
    fontWeight: '700',
    marginBottom: LuxurySpacing.sm,
  },
  cardField: {
    height: 52,
    marginBottom: LuxurySpacing.md,
  },
  primaryButton: {
    height: 48,
    borderRadius: LuxuryBorderRadius.md,
    backgroundColor: LuxuryColors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: LuxurySpacing.xs,
  },
  disabledButton: {
    opacity: 0.45,
  },
  primaryButtonText: {
    color: LuxuryColors.background,
    fontWeight: '700',
    fontSize: LuxuryFontSize.sm,
  },
  emptyBox: {
    minHeight: 112,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.22)',
    borderRadius: LuxuryBorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: LuxurySpacing.xs,
  },
  emptyText: {
    color: LuxuryColors.textSecondary,
    fontSize: LuxuryFontSize.sm,
  },
  methodRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(212, 175, 55, 0.18)',
    gap: LuxurySpacing.sm,
  },
  cardIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodBody: {
    flex: 1,
  },
  methodTitle: {
    color: LuxuryColors.textPrimary,
    fontSize: LuxuryFontSize.sm,
    fontWeight: '700',
  },
  methodMeta: {
    color: LuxuryColors.textSecondary,
    fontSize: LuxuryFontSize.xs,
    marginTop: 2,
  },
  defaultPill: {
    paddingHorizontal: LuxurySpacing.sm,
    paddingVertical: 5,
    borderRadius: LuxuryBorderRadius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  defaultPillText: {
    color: LuxuryColors.gold,
    fontSize: LuxuryFontSize.xs,
    fontWeight: '700',
  },
  smallButton: {
    paddingHorizontal: LuxurySpacing.sm,
    paddingVertical: 7,
    borderRadius: LuxuryBorderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.22)',
  },
  smallButtonText: {
    color: LuxuryColors.textPrimary,
    fontSize: LuxuryFontSize.xs,
    fontWeight: '700',
  },
  removeButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
});