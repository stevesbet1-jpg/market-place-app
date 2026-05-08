import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { View, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { LuxuryColors } from '../constants/luxuryTheme';

function DeepLinkHandler({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const handleIncomingUrl = (url: string) => {
      console.log('DEEP_LINK: Received URL:', url);

      const parsed = Linking.parse(url);
      const queryParams = parsed.queryParams as Record<string, string> | null;

      const oobCode = queryParams?.oobCode || parsed.queryParams?.['oobCode'];
      const mode = queryParams?.mode || parsed.queryParams?.['mode'];

      if (oobCode) {
        console.log('DEEP_LINK: Found oobCode, navigating to reset-password');
        router.push({
          pathname: '/(auth)/reset-password',
          params: { oobCode, mode: mode || 'resetPassword' },
        });
        return;
      }

      if (parsed.path?.includes('reset-password')) {
        console.log('DEEP_LINK: Reset password path detected');
        router.push('/(auth)/reset-password');
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleIncomingUrl(url);
    });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleIncomingUrl(url);
    });

    return () => subscription.remove();
  }, [router]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={LuxuryColors.background} />
        <DeepLinkHandler>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
        </DeepLinkHandler>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LuxuryColors.background,
  },
});
