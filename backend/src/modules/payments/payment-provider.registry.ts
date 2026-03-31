import { invalidInputError } from "../../common/errors/app-error";
import type { PaymentProvider } from "./providers/payment-provider";
import { PaystackPaymentProvider } from "./providers/paystack.provider";

const paystackProvider = new PaystackPaymentProvider();
let paymentProviderOverride:
  | ((providerName: string) => PaymentProvider)
  | null = null;

export const setPaymentProviderOverride = (
  override: ((providerName: string) => PaymentProvider) | PaymentProvider | null
) => {
  if (!override) {
    paymentProviderOverride = null;
    return;
  }

  paymentProviderOverride =
    typeof override === "function" ? override : () => override;
};

export const resetPaymentProviderOverride = () => {
  paymentProviderOverride = null;
};

export const getPaymentProvider = (providerName: string): PaymentProvider => {
  if (paymentProviderOverride) {
    return paymentProviderOverride(providerName);
  }

  switch (providerName.toLowerCase()) {
    case "paystack":
      return paystackProvider;
    default:
      throw invalidInputError(`The payment provider "${providerName}" is not supported.`);
  }
};
