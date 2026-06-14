import { useConfirmPayment } from '@stripe/stripe-react-native';

export function useExperienceConfirmPayment() {
  const { confirmPayment } = useConfirmPayment();
  return confirmPayment;
}
