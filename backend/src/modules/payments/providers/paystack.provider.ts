import { createHmac, timingSafeEqual } from "node:crypto";

import { PaymentState } from "@prisma/client";

import {
  invalidInputError,
  providerFailureError,
  serviceUnavailableError
} from "../../../common/errors/app-error";
import { env } from "../../../config/env";
import type {
  PaymentInitializationInput,
  PaymentInitializationResult,
  PaymentProvider,
  PaymentReferenceVerificationResult,
  PaymentWebhookOutcome,
  PaymentWebhookVerificationResult
} from "./payment-provider";

type PaystackResponse<T> = {
  status: boolean;
  message: string;
  data: T;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeIpAddress = (value?: string | null) =>
  value?.replace(/^::ffff:/, "").split(",")[0]?.trim() ?? null;

const readEventType = (payload: Record<string, unknown>) => {
  if (typeof payload.event === "string" && payload.event.trim()) {
    return payload.event;
  }

  const data = isRecord(payload.data) ? payload.data : null;

  if (data && typeof data.status === "string" && data.status.trim()) {
    return `payment.${data.status}`;
  }

  return "payment.unknown";
};

const readDataRecord = (payload: Record<string, unknown>) =>
  isRecord(payload.data) ? payload.data : null;

const readProviderReference = (payload: Record<string, unknown>) => {
  const data = readDataRecord(payload);

  if (data && typeof data.reference === "string" && data.reference.trim()) {
    return data.reference;
  }

  return null;
};

const readAmount = (payload: Record<string, unknown>) => {
  const data = readDataRecord(payload);
  return data && typeof data.amount === "number" && Number.isFinite(data.amount)
    ? Math.trunc(data.amount)
    : null;
};

const readCurrency = (payload: Record<string, unknown>) => {
  const data = readDataRecord(payload);
  return data && typeof data.currency === "string" ? data.currency.toUpperCase() : null;
};

const readPaystackStatus = (payload: Record<string, unknown>) => {
  const data = readDataRecord(payload);
  return data && typeof data.status === "string" ? data.status.toLowerCase() : null;
};

const mapPaystackStatusToPaymentState = (status: string | null) => {
  switch (status) {
    case "success":
      return PaymentState.PAID;
    case "failed":
      return PaymentState.FAILED;
    case "abandoned":
      return PaymentState.CANCELLED;
    case "reversed":
      return PaymentState.REFUNDED;
    case "ongoing":
    case "pending":
    case "processing":
      return PaymentState.AWAITING_CUSTOMER_ACTION;
    default:
      return null;
  }
};

const mapWebhookEventToTransactionStatus = (eventType: string, status: string | null) => {
  if (eventType === "charge.success" || status === "success") {
    return "SUCCESS";
  }

  if (eventType === "charge.failed" || status === "failed") {
    return "FAILED";
  }

  if (status === "abandoned") {
    return "ABANDONED";
  }

  if (status === "reversed") {
    return "REVERSED";
  }

  if (status === "pending" || status === "ongoing" || status === "processing") {
    return "PENDING";
  }

  return "IGNORED";
};

const readCustomerEmail = (payload: Record<string, unknown>) => {
  const data = readDataRecord(payload);
  const customer = data && isRecord(data.customer) ? data.customer : null;
  return customer && typeof customer.email === "string" ? customer.email : null;
};

const timingSafeEqualHex = (expectedHex: string, receivedHex: string) => {
  if (typeof expectedHex !== "string" || typeof receivedHex !== "string") {
    return false;
  }

  if (expectedHex.length !== receivedHex.length) {
    return false;
  }

  try {
    const expected = Buffer.from(expectedHex, "hex");
    const received = Buffer.from(receivedHex, "hex");

    if (expected.length !== received.length) {
      return false;
    }

    return timingSafeEqual(expected, received);
  } catch {
    return false;
  }
};

const resolveWebhookSecret = () => env.PAYSTACK_WEBHOOK_SECRET?.trim() || null;

const normalizeMobileMoneyProvider = (value: string) => {
  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue === "atl" || normalizedValue === "airteltigo") {
    return "tgo";
  }

  return normalizedValue;
};

const assertChannelAllowed = (channel: "card" | "mobile_money") => {
  if (!env.paystackAllowedChannels.includes(channel)) {
    throw invalidInputError("The requested Paystack channel is not enabled for this environment.", {
      channel,
      allowedChannels: env.paystackAllowedChannels
    });
  }
};

const ensurePaystackConfigured = () => {
  if (!env.PAYSTACK_SECRET_KEY) {
    throw serviceUnavailableError("Paystack is not configured for this environment.");
  }
};

const callPaystackApi = async <T>(
  path: string,
  input?: {
    method?: "GET" | "POST";
    body?: Record<string, unknown>;
  }
) => {
  ensurePaystackConfigured();

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, env.PAYSTACK_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${env.PAYSTACK_API_BASE_URL}${path}`, {
      method: input?.method ?? "GET",
      headers: {
        Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: input?.body ? JSON.stringify(input.body) : undefined,
      signal: controller.signal
    });

    const payloadText = await response.text();
    const payload = payloadText
      ? (JSON.parse(payloadText) as PaystackResponse<T>)
      : ({ status: false, message: "Paystack returned an empty response.", data: {} as T });

    if (!response.ok || !payload.status) {
      throw providerFailureError("Paystack returned an unsuccessful API response.", {
        path,
        statusCode: response.status,
        message: payload.message,
        endpoint: `${env.PAYSTACK_API_BASE_URL}${path}`,
        payload
      });
    }

    return payload;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw serviceUnavailableError("Paystack request timed out.", {
        path,
        endpoint: `${env.PAYSTACK_API_BASE_URL}${path}`
      });
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

export class PaystackPaymentProvider implements PaymentProvider {
  public readonly name = "paystack";

  public async initializePayment(
    input: PaymentInitializationInput
  ): Promise<PaymentInitializationResult> {
    ensurePaystackConfigured();
    assertChannelAllowed(input.channel);

    if (!input.customerEmail) {
      throw invalidInputError("Paystack requires a customer email address for payment initialization.");
    }

    const metadata = {
      orderId: input.orderId,
      paymentId: input.paymentId,
      paymentChannel: input.channel,
      ...input.metadata
    };

    if (input.channel === "card") {
      const response = await callPaystackApi<{
        authorization_url: string;
        access_code: string;
        reference: string;
      }>("/transaction/initialize", {
        method: "POST",
        body: {
          email: input.customerEmail,
          amount: input.amountCents,
          currency: input.currency,
          reference: input.reference,
          callback_url: input.callbackUrl ?? env.PAYSTACK_CALLBACK_URL,
          channels: ["card"],
          metadata
        }
      });

      return {
        providerPaymentRef: response.data.reference,
        paymentState: PaymentState.AWAITING_CUSTOMER_ACTION,
        requiresRedirect: true,
        redirectUrl: response.data.authorization_url,
        providerPayload: {
          provider: "paystack",
          channel: "card",
          accessCode: response.data.access_code,
          authorizationUrl: response.data.authorization_url,
          reference: response.data.reference
        }
      };
    }

    if (!input.mobileMoney?.phone || !input.mobileMoney.provider) {
      throw invalidInputError("A mobile money phone and provider are required for Paystack mobile money charges.");
    }

    const mobileMoneyProvider = normalizeMobileMoneyProvider(input.mobileMoney.provider);

    if (!env.paystackAllowedMobileMoneyProviders.includes(mobileMoneyProvider)) {
      throw invalidInputError("The requested mobile money provider is not enabled for this environment.", {
        provider: mobileMoneyProvider,
        allowedProviders: env.paystackAllowedMobileMoneyProviders
      });
    }

    const response = await callPaystackApi<{
      reference: string;
      status: string;
      display_text?: string;
    }>("/charge", {
      method: "POST",
      body: {
        email: input.customerEmail,
        amount: input.amountCents,
        currency: input.currency,
        reference: input.reference,
        metadata,
        mobile_money: {
          phone: input.mobileMoney.phone,
          provider: mobileMoneyProvider
        }
      }
    });

    return {
      providerPaymentRef: response.data.reference,
      paymentState: PaymentState.AWAITING_CUSTOMER_ACTION,
      requiresRedirect: false,
      redirectUrl: null,
      providerPayload: {
        provider: "paystack",
        channel: "mobile_money",
        reference: response.data.reference,
        status: response.data.status,
        displayText:
          typeof response.data.display_text === "string" ? response.data.display_text : null
      }
    };
  }

  public verifyWebhookSignature(input: {
    rawBody: Buffer | undefined;
    headers: Record<string, string | string[] | undefined>;
    ipAddress?: string | null;
    parsedBody: unknown;
  }): PaymentWebhookVerificationResult {
    const parsedPayload = isRecord(input.parsedBody) ? input.parsedBody : {};
    const eventType = readEventType(parsedPayload);
    const signatureHeader = input.headers["x-paystack-signature"];
    const signature =
      typeof signatureHeader === "string"
        ? signatureHeader
        : Array.isArray(signatureHeader)
          ? signatureHeader[0]
          : undefined;
    const webhookSecret = resolveWebhookSecret();

    if (!webhookSecret) {
      return {
        valid: false,
        eventType,
        payload: parsedPayload,
        reason: "PAYSTACK_WEBHOOK_SECRET is not configured."
      };
    }

    const ipAddress = normalizeIpAddress(input.ipAddress);

    if (env.paystackAllowedWebhookIps.length > 0) {
      if (!ipAddress) {
        return {
          valid: false,
          eventType,
          payload: parsedPayload,
          reason: "The webhook request IP address was not available."
        };
      }

      if (!env.paystackAllowedWebhookIps.includes(ipAddress)) {
        return {
          valid: false,
          eventType,
          payload: parsedPayload,
          reason: "The webhook request did not originate from a whitelisted Paystack IP."
        };
      }
    }

    if (!signature || !input.rawBody) {
      return {
        valid: false,
        eventType,
        payload: parsedPayload,
        reason: "The Paystack signature header or raw body is missing."
      };
    }

    const computedSignature = createHmac("sha512", webhookSecret)
      .update(input.rawBody)
      .digest("hex");

    const signaturesMatch = timingSafeEqualHex(computedSignature, signature);

    return {
      valid: signaturesMatch,
      eventType,
      payload: parsedPayload,
      reason: signaturesMatch ? undefined : "The Paystack webhook signature is invalid."
    };
  }

  public async verifyPaymentReference(reference: string): Promise<PaymentReferenceVerificationResult> {
    const response = await callPaystackApi<Record<string, unknown>>(
      `/transaction/verify/${encodeURIComponent(reference)}`
    );
    const payload = {
      data: response.data
    };

    return {
      reference,
      status:
        typeof response.data.status === "string" ? response.data.status.toLowerCase() : "unknown",
      amountCents:
        typeof response.data.amount === "number" ? Math.trunc(response.data.amount) : null,
      currency:
        typeof response.data.currency === "string"
          ? response.data.currency.toUpperCase()
          : null,
      channel:
        typeof response.data.channel === "string" ? response.data.channel.toLowerCase() : null,
      customerEmail:
        isRecord(response.data.customer) && typeof response.data.customer.email === "string"
          ? response.data.customer.email
          : null,
      payload
    };
  }

  public extractWebhookOutcome(input: {
    eventType: string;
    payload: Record<string, unknown>;
  }): PaymentWebhookOutcome {
    const eventType = input.eventType || readEventType(input.payload);
    const providerPaymentRef = readProviderReference(input.payload);
    const amountCents = readAmount(input.payload);
    const currency = readCurrency(input.payload);
    const paystackStatus = readPaystackStatus(input.payload);
    const nextPaymentState =
      eventType === "charge.success"
        ? PaymentState.PAID
        : eventType === "charge.failed"
          ? PaymentState.FAILED
          : mapPaystackStatusToPaymentState(paystackStatus);

    return {
      providerPaymentRef,
      providerEventType: eventType,
      transactionStatus: mapWebhookEventToTransactionStatus(eventType, paystackStatus),
      amountCents,
      currency,
      nextPaymentState,
      payload: {
        ...input.payload,
        verificationHints: {
          customerEmail: readCustomerEmail(input.payload),
          paystackStatus
        }
      }
    };
  }
}
