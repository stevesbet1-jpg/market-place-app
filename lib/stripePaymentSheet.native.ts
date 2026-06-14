import {
  initPaymentSheet,
  presentPaymentSheet,
} from '@stripe/stripe-react-native';

type InitPaymentSheetParams = Parameters<typeof initPaymentSheet>[0];
type InitPaymentSheetResult = Awaited<ReturnType<typeof initPaymentSheet>>;
type PresentPaymentSheetResult = Awaited<ReturnType<typeof presentPaymentSheet>>;

export function initMembershipPaymentSheet(
  params: InitPaymentSheetParams,
): Promise<InitPaymentSheetResult> {
  return initPaymentSheet(params);
}

export function presentMembershipPaymentSheet(): Promise<PresentPaymentSheetResult> {
  return presentPaymentSheet();
}
