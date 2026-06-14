type PaymentSheetError = {
  code: string;
  message: string;
};

type InitPaymentSheetResult = {
  error?: PaymentSheetError;
};

type PresentPaymentSheetResult = {
  error?: PaymentSheetError;
};

export async function initMembershipPaymentSheet(
  _params?: unknown,
): Promise<InitPaymentSheetResult> {
  return {
    error: {
      code: 'UnavailableOnWeb',
      message: 'Membership checkout is available on iOS and Android only.',
    },
  };
}

export async function presentMembershipPaymentSheet(): Promise<PresentPaymentSheetResult> {
  return {
    error: {
      code: 'UnavailableOnWeb',
      message: 'Membership checkout is available on iOS and Android only.',
    },
  };
}
