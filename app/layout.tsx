import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { View, StyleSheet, LogBox } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { ThemeProvider, DarkTheme } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { StripeProvider } from '@stripe/stripe-react-native';
import { LuxuryColors } from '../constants/luxuryTheme';
import { getFirebaseApp, printFirebaseDiagnostics, runFirebaseAuthDiagnostics, printFirebaseConsoleChecklist } from '../lib/firebase';
import { getAuth } from 'firebase/auth';

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

// Force-dark navigation theme — overrides the system colour-scheme so the
// NavigationContainer, every scene background, and the tab-bar card area
// all use our exact dark navy regardless of device setting.
const APP_THEME = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: LuxuryColors.background,  // '#071120' – navigator/scene bg
    card:       LuxuryColors.background,  // '#071120' – tab-bar & header card bg (was surface #0D1525)
    border:     'transparent',
    primary:    '#D4AF37',
  },
};

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
  // Secondary/non-blocking network failures — Firebase is primary auth
  'Network request failed',
  'Post-signup sync failed',
  'Supabase secondary',
  'Welcome email',
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
    if (!STRIPE_PUBLISHABLE_KEY) {
      console.warn('[Stripe] EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY missing. Set it in the app environment before confirming payments.');
    }

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

    // Run auth diagnostics with a generic placeholder (no hardcoded email)
    // In dev, replace with the email you want to test.
    runFirebaseAuthDiagnostics('test@example.com');

    // Print the manual checklist for Firebase Console verification
    printFirebaseConsoleChecklist();
  }, []);

  return (
    // style on SafeAreaProvider paints the native window background dark,
    // eliminating the white strips iOS shows in the status-bar and home-
    // indicator areas before React Native's own views render.
    <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY} merchantIdentifier="merchant.com.marketplace.travel">
    <SafeAreaProvider initialMetrics={initialWindowMetrics} style={{ flex: 1, backgroundColor: LuxuryColors.background }}>
      {/* StatusBar must live inside SafeAreaProvider so insets are available */}
      <StatusBar style="light" backgroundColor={LuxuryColors.background} translucent={false} />
      {/* ThemeProvider forces every React Navigation container/scene/card
          to use our dark palette regardless of the device's system colour scheme. */}
      <ThemeProvider value={APP_THEME}>
        <View style={styles.container}>
          <DeepLinkHandler>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: LuxuryColors.background },
              }}
            >
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            </Stack>
          </DeepLinkHandler>
        </View>
      </ThemeProvider>
    </SafeAreaProvider>
    </StripeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: LuxuryColors.background,
    overflow: 'hidden',
  },
});
