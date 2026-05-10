import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { View, StyleSheet, StatusBar, LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { LuxuryColors } from '../constants/luxuryTheme';
import { getFirebaseApp, printFirebaseDiagnostics, runFirebaseAuthDiagnostics } from '../lib/firebase';
import { getAuth } from 'firebase/auth';

// ─── Suppress LogBox red screens for handled auth errors ───────────
// These errors are caught and handled gracefully in the UI.
// Showing a red screen would confuse users and crash the app flow.
LogBox.ignoreLogs([
  'auth/user-not-found',
  'auth/invalid-email',
  'auth/invalid-credential',
  'auth/too-many-requests',
  'auth/expired-action-code',
  'auth/invalid-action-code',
  'auth/weak-password',
  'SEND_RESET_ERROR',
  'CONFIRM_RESET_ERROR',
  'fetchSignInMethodsForEmail',
  '[FirebaseAuth] BLOCKED', // legacy log pattern
]);

function DeepLinkHandler({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const extractOobCode = (queryParams: Record<string, any> | null): string | undefined => {
      if (!queryParams) return undefined;
      // Firebase may encode oobCode as oobCode, code, or within a 'link' param
      const code = queryParams.oobCode || queryParams.code || queryParams['oobCode'];
      if (code) return String(code);

      // Firebase sometimes wraps the action in a 'link' parameter
      const link = queryParams.link;
      if (typeof link === 'string') {
        const linked = Linking.parse(link);
        const linkedParams = linked.queryParams as Record<string, any> | null;
        return linkedParams?.oobCode ? String(linkedParams.oobCode) : undefined;
      }
      return undefined;
    };

    const extractMode = (queryParams: Record<string, any> | null): string => {
      if (!queryParams) return 'resetPassword';
      return String(queryParams.mode || queryParams['mode'] || 'resetPassword');
    };

    const handleIncomingUrl = (url: string) => {
      console.log('=== DEEP LINK RECEIVED ===');
      console.log('URL:', url);

      const parsed = Linking.parse(url);
      console.log('Parsed path:', parsed.path);
      console.log('Parsed queryParams:', JSON.stringify(parsed.queryParams));

      const queryParams = parsed.queryParams as Record<string, any> | null;
      const oobCode = extractOobCode(queryParams);
      const mode = extractMode(queryParams);

      console.log('Extracted oobCode:', oobCode ? oobCode.substring(0, 8) + '...' : 'none');
      console.log('Extracted mode:', mode);

      if (oobCode) {
        console.log('[DeepLink] Navigating to reset-password with oobCode');
        router.push({
          pathname: '/(auth)/reset-password',
          params: { oobCode, mode },
        });
        return;
      }

      if (parsed.path?.includes('reset-password')) {
        console.log('[DeepLink] Reset password path detected (no oobCode)');
        router.push('/(auth)/reset-password');
      }
    };

    // Handle initial URL (app opened from deep link)
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('[DeepLink] Initial URL:', url);
        handleIncomingUrl(url);
      } else {
        console.log('[DeepLink] No initial URL');
      }
    });

    // Handle URL events (app already running)
    const subscription = Linking.addEventListener('url', ({ url }) => {
      console.log('[DeepLink] URL event:', url);
      handleIncomingUrl(url);
    });

    return () => subscription.remove();
  }, [router]);

  return <>{children}</>;
}

export default function RootLayout() {
  // ─── Run Firebase diagnostics + pre-warm auth on startup ───────
  useEffect(() => {
    if (__DEV__) {
      console.log('[App] ⚠️  Running in Expo DEV mode. Firebase requests may be slower due to Metro proxy.');
      console.log('[App]    For real delivery speed testing, build a production binary: npx eas build --platform ios');
    }

    printFirebaseDiagnostics();

    // Pre-warm Firebase Auth instance (eliminates cold-start latency on first request)
    try {
      const app = getFirebaseApp();
      const auth = getAuth(app);
      console.log('[App] Firebase Auth instance pre-warmed. currentUser:', auth.currentUser ? 'yes' : 'null');
    } catch (e: any) {
      console.warn('[App] Could not pre-warm auth:', e.message);
    }

    // Test the specific email the user is having trouble with
    runFirebaseAuthDiagnostics('stevesbet1@gmail.com');
  }, []);

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
