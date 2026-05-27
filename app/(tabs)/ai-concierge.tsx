import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { LuxuryColors, LuxurySpacing, LuxuryBorderRadius, LuxuryFontSize, LuxuryGradients, LuxuryShadow } from '../../constants/luxuryTheme';

export default function AIConciergeScreen() {
  const handleActionPress = (actionName: string) => {
    Alert.alert(actionName, `${actionName} service coming soon.`);
  };

  const handleRequestPress = (requestName: string) => {
    Alert.alert('Request', `${requestName} request coming soon.`);
  };

  const handleSuggestionPress = (suggestion: string) => {
    Alert.alert('AI Assistant', `Processing: ${suggestion}`);
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
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.conciergeIcon}>
            <Ionicons name="sparkles" size={32} color={LuxuryColors.gold} />
          </View>
        </View>
        <Text style={styles.title}>Concierge</Text>
        <Text style={styles.subtitle}>What can I arrange for you today?</Text>
      </View>

      {/* Concierge Actions */}
      <View style={styles.section}>
        <TouchableOpacity 
          style={styles.actionCard}
          onPress={() => handleActionPress('Private Jet')}
          activeOpacity={0.8}
        >
          <LinearGradient colors={LuxuryGradients.goldDeep} style={styles.actionGradient}>
            <View style={styles.actionContent}>
              <Ionicons name="airplane" size={32} color="#FFFFFF" />
              <Text style={styles.actionTitle}>Private Jet</Text>
              <Text style={styles.actionSubtitle}>Charter luxury aviation</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionCard}
          onPress={() => handleActionPress('VIP Dining')}
          activeOpacity={0.8}
        >
          <LinearGradient colors={LuxuryGradients.violet} style={styles.actionGradient}>
            <View style={styles.actionContent}>
              <Ionicons name="restaurant" size={32} color="#FFFFFF" />
              <Text style={styles.actionTitle}>VIP Dining</Text>
              <Text style={styles.actionSubtitle}>Reserve exclusive tables</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionCard}
          onPress={() => handleActionPress('Curated Itinerary')}
          activeOpacity={0.8}
        >
          <LinearGradient colors={LuxuryGradients.goldDeep} style={styles.actionGradient}>
            <View style={styles.actionContent}>
              <Ionicons name="map" size={32} color="#FFFFFF" />
              <Text style={styles.actionTitle}>Curated Itinerary</Text>
              <Text style={styles.actionSubtitle}>Personalized journey planning</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionCard}
          onPress={() => handleActionPress('Hidden Destinations')}
          activeOpacity={0.8}
        >
          <LinearGradient colors={LuxuryGradients.goldDeep} style={styles.actionGradient}>
            <View style={styles.actionContent}>
              <Ionicons name="location" size={32} color="#FFFFFF" />
              <Text style={styles.actionTitle}>Hidden Destinations</Text>
              <Text style={styles.actionSubtitle}>Secret locations revealed</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Quick Requests */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Requests</Text>
        {[
          { icon: 'car', title: 'Chauffeur Service', desc: 'On-demand luxury transport' },
          { icon: 'calendar', title: 'Event Tickets', desc: 'VIP access to events' },
          { icon: 'gift', title: 'Gift Arrangements', desc: 'Curated luxury gifting' },
          { icon: 'call', title: '24/7 Support', desc: 'Direct concierge line' },
        ].map((request, index) => (
          <TouchableOpacity 
            key={index} 
            style={styles.requestCard}
            onPress={() => handleRequestPress(request.title)}
            activeOpacity={0.8}
          >
            <View style={styles.requestIcon}>
              <Ionicons name={request.icon as any} size={24} color={LuxuryColors.gold} />
            </View>
            <View style={styles.requestInfo}>
              <Text style={styles.requestTitle}>{request.title}</Text>
              <Text style={styles.requestDesc}>{request.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={LuxuryColors.textTertiary} />
          </TouchableOpacity>
        ))}
      </View>

      {/* AI Assistant - Conversational */}
      <View style={styles.section}>
        <View style={styles.aiCard}>
          <View style={styles.aiContent}>
            <View style={[styles.aiAvatar, styles.aiAvatarGlow]}>
              <Ionicons name="sparkles" size={28} color={LuxuryColors.violetLight} />
            </View>
            <View style={styles.aiText}>
              <Text style={styles.aiGreeting}>Hello, Member</Text>
              <Text style={styles.aiMessage}>I'm your private AI assistant. How may I serve you today?</Text>
            </View>
          </View>
          <View style={styles.aiSuggestions}>
            <TouchableOpacity 
              style={styles.suggestionChip}
              onPress={() => handleSuggestionPress('Plan my perfect journey')}
              activeOpacity={0.7}
            >
              <Text style={styles.suggestionText}>Plan my perfect journey</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.suggestionChip}
              onPress={() => handleSuggestionPress('Arrange something extraordinary')}
              activeOpacity={0.7}
            >
              <Text style={styles.suggestionText}>Arrange something extraordinary</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    maxWidth: '100%',
    backgroundColor: LuxuryColors.surface,
    overflow: 'hidden',
  },
  header: {
    paddingTop: LuxurySpacing.xl,
    paddingHorizontal: LuxurySpacing.xl,
    paddingBottom: LuxurySpacing.lg,
  },
  headerTop: {
    marginBottom: LuxurySpacing.lg,
  },
  conciergeIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: LuxuryColors.surfaceLight,
    borderWidth: 1.5,
    borderColor: LuxuryColors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    ...LuxuryShadow.gold,
  },
  title: {
    fontSize: LuxuryFontSize.xxxxxl,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
    marginBottom: LuxurySpacing.sm,
    letterSpacing: -1.5,
  },
  subtitle: {
    fontSize: LuxuryFontSize.lg,
    color: LuxuryColors.textSecondary,
    fontWeight: '400',
  },
  section: {
    paddingHorizontal: LuxurySpacing.xl,
    marginBottom: LuxurySpacing.xxl,
  },
  sectionTitle: {
    fontSize: LuxuryFontSize.xl,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
    marginBottom: LuxurySpacing.lg,
  },
  actionCard: {
    height: 104,
    borderRadius: LuxuryBorderRadius.xxxl,
    overflow: 'hidden',
    marginBottom: LuxurySpacing.lg,
    ...LuxuryShadow.medium,
  },
  actionGradient: {
    flex: 1,
    justifyContent: 'center',
    padding: LuxurySpacing.xl,
  },
  actionContent: {
    gap: LuxurySpacing.xs,
  },
  actionTitle: {
    fontSize: LuxuryFontSize.xl,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionSubtitle: {
    fontSize: LuxuryFontSize.sm,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LuxuryColors.glass,
    borderWidth: 1,
    borderColor: LuxuryColors.glassBorder,
    borderRadius: LuxuryBorderRadius.xl,
    padding: LuxurySpacing.lg,
    marginBottom: LuxurySpacing.md,
    gap: LuxurySpacing.md,
  },
  requestIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: LuxuryColors.surfaceLight,
    borderWidth: 1,
    borderColor: LuxuryColors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestInfo: {
    flex: 1,
  },
  requestTitle: {
    fontSize: LuxuryFontSize.md,
    fontWeight: '600',
    color: LuxuryColors.textPrimary,
    marginBottom: LuxurySpacing.xs,
  },
  requestDesc: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textSecondary,
  },
  aiCard: {
    backgroundColor: LuxuryColors.glassStrong,
    borderWidth: 1,
    borderColor: LuxuryColors.violet,
    borderRadius: LuxuryBorderRadius.xxxl,
    padding: LuxurySpacing.xl,
    ...LuxuryShadow.soft,
  },
  aiContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: LuxurySpacing.lg,
  },
  aiAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: LuxuryColors.surfaceLight,
    borderWidth: 1,
    borderColor: LuxuryColors.violetLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiAvatarGlow: {
    ...LuxuryShadow.gold,
  },
  aiText: {
    flex: 1,
  },
  aiGreeting: {
    fontSize: LuxuryFontSize.lg,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
    marginBottom: LuxurySpacing.xs,
  },
  aiMessage: {
    fontSize: LuxuryFontSize.sm,
    color: LuxuryColors.textSecondary,
    lineHeight: 20,
  },
  aiSuggestions: {
    flexDirection: 'row',
    gap: LuxurySpacing.sm,
    marginTop: LuxurySpacing.lg,
  },
  suggestionChip: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    paddingHorizontal: LuxurySpacing.md,
    paddingVertical: LuxurySpacing.sm,
    borderRadius: LuxuryBorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  suggestionText: {
    fontSize: LuxuryFontSize.xs,
    color: LuxuryColors.violetLight,
    fontWeight: '600',
  },
});
