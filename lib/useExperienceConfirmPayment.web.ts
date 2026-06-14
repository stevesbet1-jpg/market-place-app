export function useExperienceConfirmPayment() {
  return async () => {
    throw new Error('Purchasing is currently available on iOS and Android only.');
  };
}
