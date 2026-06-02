/**
 * apply-creator.tsx
 *
 * Legacy route — the creator application system has been replaced with an
 * open creator model. Any verified user can now become a creator instantly.
 *
 * This screen redirects to the Profile tab where the "Become a Creator"
 * activation button lives.
 */

import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { LuxuryColors } from '../../constants/luxuryTheme';

export default function ApplyCreatorScreen() {
  useEffect(() => {
    // Redirect to profile where "Become a Creator" button is available
    router.replace('/(tabs)/profile');
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: LuxuryColors.background, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={LuxuryColors.gold} />
    </View>
  );
}

