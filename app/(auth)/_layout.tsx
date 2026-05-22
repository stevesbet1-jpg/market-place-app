import { Stack } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LuxuryColors } from '../../constants/luxuryTheme';

export default function AuthLayout() {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: LuxuryColors.background },
        }}
      >
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="reset-password" />
      </Stack>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LuxuryColors.background,
  },
});
