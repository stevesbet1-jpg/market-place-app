import React from 'react';
import { Platform } from 'react-native';

type StripeAppProviderProps = {
  children: React.ReactNode;
  publishableKey: string;
  merchantIdentifier?: string;
};

export function StripeAppProvider({
  children,
  publishableKey,
  merchantIdentifier,
}: StripeAppProviderProps) {
  if (Platform.OS === 'web') {
    return <>{children}</>;
  }

  try {
    const dynamicRequire = Function('return require')() as (id: string) => any;
    const stripeModule = dynamicRequire('@stripe/stripe-react-native');
    const StripeProvider = stripeModule.StripeProvider as React.ComponentType<{
      children: React.ReactNode;
      publishableKey: string;
      merchantIdentifier?: string;
    }>;

    return (
      <StripeProvider publishableKey={publishableKey} merchantIdentifier={merchantIdentifier}>
        {children}
      </StripeProvider>
    );
  } catch (error) {
    console.warn('[Stripe] Failed to load StripeProvider at runtime.', error);
    return <>{children}</>;
  }
}
