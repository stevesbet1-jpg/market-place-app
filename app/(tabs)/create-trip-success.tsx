import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LuxuryBorderRadius, LuxuryColors, LuxuryFontSize, LuxuryShadow, LuxurySpacing } from '../../constants/luxuryTheme';

const CYAN = '#8AE6FF';

const SUMMARY_ITEMS = [
  { icon: 'location-outline' as const,    label: 'Destination',  value: 'Amalfi Coast, Italy' },
  { icon: 'calendar-outline' as const,    label: 'Dates',        value: 'May 14 – May 21, 2026' },
  { icon: 'time-outline' as const,        label: 'Duration',     value: '7 Days' },
  { icon: 'people-outline' as const,      label: 'Travelers',    value: '2 people' },
  { icon: 'map-outline' as const,         label: 'Itinerary',    value: '3 days mapped' },
  { icon: 'images-outline' as const,      label: 'Photos',       value: 'Cover + gallery ready' },
  { icon: 'sparkles-outline' as const,    label: 'Experiences',  value: 'Logged and rated' },
];

export default function CreateTripSuccessScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#071120', '#081B2C', '#06101D']} style={StyleSheet.absoluteFill} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
          <View style={styles.heroRing}>
            <View style={styles.heroInnerRing}>
              <Ionicons name="checkmark" size={38} color={CYAN} />
            </View>
          </View>

          <Text style={styles.heroTitle}>Trip Created{'\n'}Successfully</Text>
          <Text style={styles.heroSub}>
            Your trip blueprint is ready. Tap View Trip Details to explore your full itinerary, or head back to My Journeys to see it in your collection.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardIconWrap}>
              <Ionicons name="document-text-outline" size={16} color={CYAN} />
            </View>
            <Text style={styles.cardTitle}>Trip Summary</Text>
          </View>

          {SUMMARY_ITEMS.map((item) => (
            <View key={item.label} style={styles.summaryRow}>
              <View style={styles.summaryIconWrap}>
                <Ionicons name={item.icon} size={14} color={CYAN} />
              </View>
              <Text style={styles.summaryLabel}>{item.label}</Text>
              <Text style={styles.summaryValue} numberOfLines={1}>{item.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.statsRow}>
          {[
            { icon: 'map-outline' as const,        label: 'Days',        value: '7' },
            { icon: 'images-outline' as const,     label: 'Photos',      value: '0' },
            { icon: 'sparkles-outline' as const,   label: 'Experiences', value: '1' },
          ].map((s) => (
            <View key={s.label} style={styles.statPill}>
              <Ionicons name={s.icon} size={16} color={CYAN} />
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push({ pathname: '/(tabs)/trips' })}
          activeOpacity={0.88}
        >
          <Ionicons name="eye-outline" size={17} color={LuxuryColors.background} />
          <Text style={styles.primaryBtnText}>View Trip Details</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.replace('/(tabs)/trips')}
          activeOpacity={0.86}
        >
          <Ionicons name="arrow-back" size={15} color={CYAN} />
          <Text style={styles.secondaryBtnText}>Back to My Journeys</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.ghostBtn}
          onPress={() => router.replace('/(tabs)/create-trip')}
          activeOpacity={0.84}
        >
          <Ionicons name="add-circle-outline" size={15} color={LuxuryColors.textSecondary} />
          <Text style={styles.ghostBtnText}>Create Another Trip</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: LuxuryColors.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: LuxurySpacing.lg, gap: 16, alignItems: 'stretch' },
  heroSection: { alignItems: 'center', gap: 14, paddingVertical: 10 },
  heroRing: { width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(138,230,255,0.10)', borderWidth: 2, borderColor: 'rgba(138,230,255,0.32)', alignItems: 'center', justifyContent: 'center', ...LuxuryShadow.gold },
  heroInnerRing: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(138,230,255,0.18)', borderWidth: 1, borderColor: 'rgba(138,230,255,0.50)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: LuxuryColors.textPrimary, fontSize: LuxuryFontSize.xxxl, fontWeight: '800', textAlign: 'center', lineHeight: 38, letterSpacing: -0.5 },
  heroSub: { color: LuxuryColors.textSecondary, fontSize: 13, lineHeight: 20, textAlign: 'center', maxWidth: 320 },
  card: { borderRadius: LuxuryBorderRadius.xxl, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(138,230,255,0.14)', padding: 16, gap: 10, ...LuxuryShadow.soft },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardIconWrap: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(138,230,255,0.12)', borderWidth: 1, borderColor: 'rgba(138,230,255,0.28)', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: LuxuryColors.textPrimary, fontSize: 14, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryIconWrap: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(138,230,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  summaryLabel: { width: 90, color: LuxuryColors.textSecondary, fontSize: 12, fontWeight: '600' },
  summaryValue: { flex: 1, color: LuxuryColors.textPrimary, fontSize: 12, fontWeight: '600', textAlign: 'right' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statPill: { flex: 1, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(138,230,255,0.16)', backgroundColor: 'rgba(138,230,255,0.07)', padding: 14, alignItems: 'center', gap: 5 },
  statValue: { color: LuxuryColors.textPrimary, fontSize: LuxuryFontSize.xl, fontWeight: '800' },
  statLabel: { color: LuxuryColors.textSecondary, fontSize: 10, fontWeight: '600' },
  primaryBtn: { minHeight: 54, borderRadius: LuxuryBorderRadius.full, backgroundColor: CYAN, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, ...LuxuryShadow.gold },
  primaryBtnText: { color: LuxuryColors.background, fontSize: 14, fontWeight: '800' },
  secondaryBtn: { minHeight: 50, borderRadius: LuxuryBorderRadius.full, borderWidth: 1, borderColor: 'rgba(138,230,255,0.36)', backgroundColor: 'rgba(138,230,255,0.10)', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  secondaryBtnText: { color: CYAN, fontSize: 14, fontWeight: '700' },
  ghostBtn: { minHeight: 46, borderRadius: LuxuryBorderRadius.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  ghostBtnText: { color: LuxuryColors.textSecondary, fontSize: 13, fontWeight: '600' },
});
