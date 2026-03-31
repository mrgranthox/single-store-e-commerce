import { PaymentState } from "@prisma/client";

export type PaymentInitializationInput = {
  orderId: string;
  paymentId: string;
  reference: string;
  amountCents: number;
  currency: string;
  customerEmail: string | null;
  callbackUrl: string | null;
  channel: "card" | "mobile_money";
  mobileMoney?: {
    phone: string;
    provider: string;
  } | null;
  metadata?: Record<string, unknown>;
};

export type PaymentInitializationResult = {
  providerPaymentRef: string;
  paymentState: PaymentState;
  requiresRedirect: boolean;
  redirectUrl: string | null;
  providerPayload?: unknown;
};

export type PaymentWebhookVerificationResult = {
  valid: boolean;
  eventType: string;
  payload: Record<string, unknown>;
  reason?: string;
};

export type PaymentReferenceVerificationResult = {
  reference: string;
  status: string;
  amountCents: number | null;
  currency: string | null;
  channel: string | null;
  customerEmail: string | null;
  payload: Record<string, unknown>;
};

export type PaymentWebhookOutcome = {
  providerPaymentRef: string | null;
  providerEventType: string;
  transactionStatus: string;
  amountCents: number | null;
  currency: string | null;
  nextPaymentState: PaymentState | null;
  payload: Record<string, unknown>;
};

export interface PaymentProvider {
  readonly name: string;
  initializePayment(input: PaymentInitializationInput): Promise<PaymentInitializationResult>;
  verifyWebhookSignature(input: {
    rawBody: Buffer | undefined;
    headers: Record<string, string | string[] | undefined>;
    ipAddress?: string | null;
    parsedBody: unknown;
  }): PaymentWebhookVerificationResult;
  verifyPaymentReference(reference: string): Promise<PaymentReferenceVerificationResult>;
  extractWebhookOutcome(input: {
    eventType: string;
    payload: Record<string, unknown>;
  }): PaymentWebhookOutcome;
}
