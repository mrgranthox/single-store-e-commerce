import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";

import { WebhookEventStatus, type Prisma } from "@prisma/client";
import type { RequestHandler } from "express";

import { createApp } from "../app/app";
import { resetClerkRuntimeOverrides, setClerkRuntimeOverrides } from "../config/clerk";
import { env } from "../config/env";
import { prisma } from "../config/prisma";
import { closeQueues } from "../config/queue";
import { closeRedisConnection } from "../config/redis";
import { flushSentry } from "../config/sentry";
import { processPaymentWebhookJob } from "../modules/payments/payments.service";
import {
  resetPaymentProviderOverride,
  setPaymentProviderOverride
} from "../modules/payments/payment-provider.registry";
import { requestJson, startHttpsServer, stopServer } from "./support/http";
import { deleteRedisKeysByPattern } from "./support/redis";

const requirePaystackWebhookSecret = () => {
  const secret = env.PAYSTACK_WEBHOOK_SECRET ?? env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    throw new Error("PAYSTACK_WEBHOOK_SECRET or PAYSTACK_SECRET_KEY must be configured for tests.");
  }

  return secret;
};

const waitForWebhookEvent = async (where: Prisma.WebhookEventWhereInput, timeoutMs = 10_000) => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const row = await prisma.webhookEvent.findFirst({
      where,
      orderBy: {
        createdAt: "desc"
      }
    });

    if (row) {
      return row;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error("Timed out waiting for webhook event persistence.");
};

type FakeClerkEmailAddress = {
  id: string;
  emailAddress: string;
  verification: {
    status: "verified" | "unverified";
  };
};

type FakeClerkUser = {
  id: string;
  emailAddresses: FakeClerkEmailAddress[];
  primaryEmailAddressId: string;
  firstName: string | null;
  lastName: string | null;
  phoneNumbers: Array<{
    id: string;
    phoneNumber: string;
  }>;
  primaryPhoneNumberId: string | null;
  password: string;
};

const buildClerkRuntime = () => {
  const users = new Map<string, FakeClerkUser>();

  const findByEmail = (email: string) => {
    const normalizedEmail = email.trim().toLowerCase();

    return (
      [...users.values()].find((user) =>
        user.emailAddresses.some(
          (entry) => entry.emailAddress.trim().toLowerCase() === normalizedEmail
        )
      ) ?? null
    );
  };

  const clerkRequestMiddleware: RequestHandler = (_request, _response, next) => next();

  return {
    clerkRequestMiddleware,
    safeGetClerkAuth: () => null,
    clerkClient: {
      users: {
        getUserList: async (input: { emailAddress?: string[]; limit?: number }) => {
          const matches = (input.emailAddress ?? [])
            .map((email) => findByEmail(email))
            .filter((user): user is FakeClerkUser => Boolean(user));

          return {
            data: matches.slice(0, input.limit ?? matches.length)
          };
        },
        createUser: async (input: {
          emailAddress: string[];
          phoneNumber?: string[];
          password: string;
          firstName?: string;
          lastName?: string;
        }) => {
          const email = input.emailAddress[0]!.trim().toLowerCase();

          if (findByEmail(email)) {
            throw new Error("duplicate_email");
          }

          const emailId = `email_${randomUUID()}`;
          const phoneNumber = input.phoneNumber?.[0] ?? null;
          const phoneId = phoneNumber ? `phone_${randomUUID()}` : null;
          const user: FakeClerkUser = {
            id: `clerk_${randomUUID()}`,
            emailAddresses: [
              {
                id: emailId,
                emailAddress: email,
                verification: {
                  status: "unverified"
                }
              }
            ],
            primaryEmailAddressId: emailId,
            firstName: input.firstName ?? null,
            lastName: input.lastName ?? null,
            phoneNumbers: phoneNumber
              ? [
                  {
                    id: phoneId!,
                    phoneNumber
                  }
                ]
              : [],
            primaryPhoneNumberId: phoneId,
            password: input.password
          };

          users.set(user.id, user);
          return user;
        },
        getUser: async (userId: string) => {
          const user = users.get(userId);

          if (!user) {
            throw new Error("user_not_found");
          }

          return user;
        },
        verifyPassword: async (input: { userId: string; password: string }) => {
          const user = users.get(input.userId);

          if (!user || user.password !== input.password) {
            throw new Error("invalid_password");
          }

          return {
            verified: true
          };
        },
        updateUser: async (
          userId: string,
          input: {
            password?: string;
          }
        ) => {
          const user = users.get(userId);

          if (!user) {
            throw new Error("user_not_found");
          }

          if (input.password) {
            user.password = input.password;
          }

          users.set(userId, user);
          return user;
        }
      },
      emailAddresses: {
        updateEmailAddress: async (
          emailAddressId: string,
          input: {
            verified?: boolean;
            primary?: boolean;
          }
        ) => {
          const user = [...users.values()].find((entry) =>
            entry.emailAddresses.some((email) => email.id === emailAddressId)
          );

          if (!user) {
            throw new Error("email_not_found");
          }

          const targetEmail = user.emailAddresses.find((entry) => entry.id === emailAddressId)!;

          if (input.verified) {
            targetEmail.verification.status = "verified";
          }

          if (input.primary) {
            user.primaryEmailAddressId = emailAddressId;
          }

          users.set(user.id, user);
          return targetEmail;
        }
      }
    }
  };
};

const buildMockPaymentProvider = () => {
  const readPayloadRecord = (value: unknown) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return {
    name: "paystack",
    async initializePayment(input: {
      reference: string;
      channel: "card" | "mobile_money";
      amountCents: number;
      currency: string;
    }) {
      return {
        providerPaymentRef: input.reference,
        paymentState: "AWAITING_CUSTOMER_ACTION" as const,
        requiresRedirect: input.channel === "card",
        redirectUrl:
          input.channel === "card"
            ? `https://payments.example.test/authorize/${encodeURIComponent(input.reference)}`
            : null,
        providerPayload: {
          provider: "paystack",
          channel: input.channel,
          reference: input.reference,
          amountCents: input.amountCents,
          currency: input.currency
        }
      };
    },
    verifyWebhookSignature(input: {
      rawBody: Buffer | undefined;
      headers: Record<string, string | string[] | undefined>;
      parsedBody: unknown;
    }) {
      const signatureHeader = input.headers["x-paystack-signature"];
      const signature =
        typeof signatureHeader === "string"
          ? signatureHeader
          : Array.isArray(signatureHeader)
            ? signatureHeader[0]
            : null;
      const payload = readPayloadRecord(input.parsedBody);
      const eventType = typeof payload.event === "string" ? payload.event : "payment.unknown";
      const webhookSecret = requirePaystackWebhookSecret();
      const expectedSignature = input.rawBody
        ? createHmac("sha512", webhookSecret).update(input.rawBody).digest("hex")
        : null;

      return {
        valid: Boolean(expectedSignature && signature && signature === expectedSignature),
        eventType,
        payload,
        reason:
          expectedSignature && signature === expectedSignature
            ? undefined
            : "The Paystack webhook signature is invalid."
      };
    },
    async verifyPaymentReference(reference: string) {
      return {
        reference,
        status: "success",
        amountCents: null,
        currency: null,
        channel: "card",
        customerEmail: null,
        payload: {
          reference
        }
      };
    },
    extractWebhookOutcome(input: {
      eventType: string;
      payload: Record<string, unknown>;
    }) {
      const data = readPayloadRecord(input.payload.data);
      const amount = typeof data.amount === "number" ? Math.trunc(data.amount) : null;
      const currency = typeof data.currency === "string" ? data.currency : null;
      const providerPaymentRef =
        typeof data.reference === "string" ? data.reference : null;
      const status = typeof data.status === "string" ? data.status.toLowerCase() : null;

      return {
        providerPaymentRef,
        providerEventType: input.eventType,
        transactionStatus: input.eventType === "charge.success" ? "SUCCESS" : "FAILED",
        amountCents: amount,
        currency,
        nextPaymentState:
          input.eventType === "charge.success"
            ? ("PAID" as const)
            : status === "failed"
              ? ("FAILED" as const)
              : ("AWAITING_CUSTOMER_ACTION" as const),
        payload: input.payload
      };
    }
  };
};

const extractTokenFromNotificationPayload = (
  payload: unknown,
  key: "verificationUrl" | "resetUrl"
) => {
  const record =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : null;
  const value = record && typeof record[key] === "string" ? record[key] : null;

  if (!value) {
    throw new Error(`Notification payload is missing ${key}.`);
  }

  const parsedUrl = new URL(value);
  const token = parsedUrl.searchParams.get("token");

  if (!token) {
    throw new Error(`Notification payload URL is missing a token query parameter for ${key}.`);
  }

  return token;
};

export const runIntegrationSuite = async () => {
  const originalFetch = globalThis.fetch;
  const clerkRuntime = buildClerkRuntime();
  const paymentProvider = buildMockPaymentProvider();
  const runId = randomUUID().slice(0, 8);
  const customerEmail = `itest.customer.${runId}@example.com`;
  const guestSupportEmail = `itest.support.${runId}@example.com`;
  const step = (label: string) => {
    console.error(`[itest] ${label}`);
  };

  setClerkRuntimeOverrides({
    clerkClient: clerkRuntime.clerkClient as never,
    clerkRequestMiddleware: clerkRuntime.clerkRequestMiddleware,
    safeGetClerkAuth: clerkRuntime.safeGetClerkAuth as never
  });
  setPaymentProviderOverride(paymentProvider as never);
  await deleteRedisKeysByPattern("rl:*");

  globalThis.fetch = (async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    if (!url.includes("challenges.cloudflare.com/turnstile")) {
      throw new Error(`Unexpected outbound fetch in integration test: ${url}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        action: "public_support_contact",
        hostname: "127.0.0.1"
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      }
    );
  }) as typeof fetch;

  const { server, baseUrl } = await startHttpsServer(createApp());

  try {
    let accessToken: string | null = null;
    let refreshToken: string | null = null;

    step("health and readiness");
    const healthResponse = await requestJson<{ success: true }>({
      baseUrl,
      method: "GET",
      path: "/health",
      headers: {
        "x-request-id": `itest-health-${runId}`
      }
    });
    const readinessResponse = await requestJson<{ success: true }>({
      baseUrl,
      method: "GET",
      path: "/ready"
    });

    assert.equal(healthResponse.statusCode, 200);
    assert.equal(healthResponse.headers["x-request-id"], `itest-health-${runId}`);
    assert.equal(readinessResponse.statusCode, 200);
    assert.ok(readinessResponse.headers["x-request-id"]);

    step("register customer");
    const registerResponse = await requestJson<{
      success: true;
      data: {
        user: {
          id: string;
          status: string;
        };
      };
    }>({
      baseUrl,
      method: "POST",
      path: "/api/auth/register",
      body: {
        firstName: "Integration",
        lastName: "Customer",
        email: customerEmail,
        password: "InitialPass123!",
        marketingOptIn: true,
        acceptTerms: true
      }
    });

    assert.equal(registerResponse.statusCode, 201);
    assert.equal(registerResponse.json?.data.user.status, "pending_verification");

    step("resend verification");
    const resendResponse = await requestJson({
      baseUrl,
      method: "POST",
      path: "/api/auth/resend-verification",
      body: {
        email: customerEmail
      }
    });

    assert.equal(resendResponse.statusCode, 200);

    step("load verification notification");
    const verificationNotification = await prisma.notification.findFirst({
      where: {
        recipientEmail: customerEmail,
        type: "EMAIL_VERIFICATION_REQUIRED"
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    assert.ok(verificationNotification);

    step("verify email");
    const verifyResponse = await requestJson<{
      success: true;
      data: {
        verified: boolean;
        user: {
          status: string;
        };
      };
    }>({
      baseUrl,
      method: "POST",
      path: "/api/auth/verify-email",
      body: {
        token: extractTokenFromNotificationPayload(
          verificationNotification.payload,
          "verificationUrl"
        )
      }
    });

    assert.equal(verifyResponse.statusCode, 200);
    assert.equal(verifyResponse.json?.data.verified, true);
    assert.equal(verifyResponse.json?.data.user.status, "active");

    step("login customer");
    const loginResponse = await requestJson<{
      success: true;
      data: {
        accessToken: string;
        refreshToken: string;
        user: {
          email: string;
          status: string;
        };
      };
    }>({
      baseUrl,
      method: "POST",
      path: "/api/auth/login",
      body: {
        email: customerEmail,
        password: "InitialPass123!"
      }
    });

    assert.equal(loginResponse.statusCode, 200);
    assert.equal(loginResponse.json?.data.user.email, customerEmail);
    accessToken = loginResponse.json?.data.accessToken ?? null;
    refreshToken = loginResponse.json?.data.refreshToken ?? null;
    assert.ok(accessToken);
    assert.ok(refreshToken);

    step("session lookup");
    const sessionResponse = await requestJson<{
      success: true;
      data: {
        authenticated: boolean;
        actor: {
          email: string;
        } | null;
      };
    }>({
      baseUrl,
      method: "GET",
      path: "/api/auth/session",
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    });

    assert.equal(sessionResponse.statusCode, 200);
    assert.equal(sessionResponse.json?.data.authenticated, true);
    assert.equal(sessionResponse.json?.data.actor?.email, customerEmail);

    step("refresh session");
    const refreshResponse = await requestJson<{
      success: true;
      data: {
        accessToken: string;
        refreshToken: string;
      };
    }>({
      baseUrl,
      method: "POST",
      path: "/api/auth/refresh",
      body: {
        refreshToken
      }
    });

    assert.equal(refreshResponse.statusCode, 200);
    accessToken = refreshResponse.json?.data.accessToken ?? null;
    refreshToken = refreshResponse.json?.data.refreshToken ?? null;
    assert.ok(accessToken);
    assert.ok(refreshToken);

    step("forgot password");
    const forgotPasswordResponse = await requestJson({
      baseUrl,
      method: "POST",
      path: "/api/auth/forgot-password",
      body: {
        email: customerEmail
      }
    });

    assert.equal(forgotPasswordResponse.statusCode, 200);

    step("load password reset notification");
    const passwordResetNotification = await prisma.notification.findFirst({
      where: {
        recipientEmail: customerEmail,
        type: "PASSWORD_RESET"
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    assert.ok(passwordResetNotification);

    step("reset password");
    const resetPasswordResponse = await requestJson({
      baseUrl,
      method: "POST",
      path: "/api/auth/reset-password",
      body: {
        token: extractTokenFromNotificationPayload(passwordResetNotification.payload, "resetUrl"),
        newPassword: "UpdatedPass123!"
      }
    });

    assert.equal(resetPasswordResponse.statusCode, 200);

    step("login with updated password");
    const reloginResponse = await requestJson<{
      success: true;
      data: {
        accessToken: string;
        refreshToken: string;
      };
    }>({
      baseUrl,
      method: "POST",
      path: "/api/auth/login",
      body: {
        email: customerEmail,
        password: "UpdatedPass123!"
      }
    });

    assert.equal(reloginResponse.statusCode, 200);
    accessToken = reloginResponse.json?.data.accessToken ?? null;
    refreshToken = reloginResponse.json?.data.refreshToken ?? null;
    assert.ok(accessToken);
    assert.ok(refreshToken);

    step("load public support config");
    const supportConfigResponse = await requestJson<{
      success: true;
      data: {
        support: {
          abuseChallenge: {
            enabled: boolean;
            provider: string;
            siteKey: string | null;
          };
        };
      };
    }>({
      baseUrl,
      method: "GET",
      path: "/api/support/public-config"
    });

    assert.equal(supportConfigResponse.statusCode, 200);
    assert.equal(supportConfigResponse.json?.data.support.abuseChallenge.enabled, true);
    assert.equal(supportConfigResponse.json?.data.support.abuseChallenge.provider, "turnstile");
    assert.equal(supportConfigResponse.json?.data.support.abuseChallenge.siteKey, "test-site-key");

    step("create public support contact request");
    const supportContactResponse = await requestJson<{
      success: true;
      data: {
        entity: {
          id: string;
        };
      };
    }>({
      baseUrl,
      method: "POST",
      path: "/api/support/contact",
      headers: {
        "x-forwarded-for": `198.51.100.${(Number.parseInt(runId.slice(0, 2), 16) % 200) + 1}`
      },
      body: {
        name: "Guest Support",
        email: guestSupportEmail,
        subject: "Need help",
        message: "Please confirm the support intake flow.",
        captchaToken: "turnstile-pass-token"
      }
    });

    assert.equal(supportContactResponse.statusCode, 201);

    step("load support notification");
    const supportTicketNotification = await prisma.notification.findFirst({
      where: {
        recipientEmail: guestSupportEmail,
        type: "SUPPORT_TICKET_CREATED"
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    assert.ok(supportTicketNotification);

    step("assert synced customer exists");
    await prisma.user.findUniqueOrThrow({
      where: {
        email: customerEmail
      }
    });
    const adminUser = await prisma.adminUser.create({
      data: {
        email: `itest.admin.${runId}@example.com`,
        clerkAdminUserId: `clerk-admin-${runId}`,
        status: "ACTIVE"
      }
    });

    const category = await prisma.category.create({
      data: {
        slug: `itest-category-${runId}`,
        name: `Integration Category ${runId}`
      }
    });
    const brand = await prisma.brand.create({
      data: {
        slug: `itest-brand-${runId}`,
        name: `Integration Brand ${runId}`
      }
    });
    const product = await prisma.product.create({
      data: {
        slug: `itest-product-${runId}`,
        title: `Integration Product ${runId}`,
        status: "PUBLISHED",
        brandId: brand.id,
        categories: {
          create: {
            categoryId: category.id
          }
        }
      }
    });
    const variant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        sku: `ITEST-SKU-${runId}`,
        priceAmountCents: 15000,
        priceCurrency: "GHS",
        status: "ACTIVE"
      }
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        code: `ITEST-WH-${runId}`,
        name: `Integration Warehouse ${runId}`
      }
    });
    await prisma.inventoryStock.create({
      data: {
        variantId: variant.id,
        warehouseId: warehouse.id,
        onHand: 25,
        reserved: 0,
        reorderLevel: 2
      }
    });

    step("add cart item");
    const addCartItemResponse = await requestJson({
      baseUrl,
      method: "POST",
      path: "/api/cart/items",
      headers: {
        authorization: `Bearer ${accessToken}`
      },
      body: {
        variantId: variant.id,
        quantity: 2
      }
    });

    assert.equal(addCartItemResponse.statusCode, 201);

    step("validate checkout");
    const validateCheckoutResponse = await requestJson<{
      success: true;
      data: {
        eligibilityFlags: {
          canCheckout: boolean;
        };
      };
    }>({
      baseUrl,
      method: "POST",
      path: "/api/checkout/validate",
      headers: {
        authorization: `Bearer ${accessToken}`
      },
      body: {
        address: {
          fullName: "Integration Customer",
          email: customerEmail,
          phone: "+233500000000",
          country: "Ghana",
          region: "Greater Accra",
          city: "Accra",
          line1: "1 Ring Road",
          postalCode: "GA-001-1001"
        },
        shippingMethodCode: "STANDARD"
      }
    });

    assert.equal(validateCheckoutResponse.statusCode, 200);
    assert.equal(validateCheckoutResponse.json?.data.eligibilityFlags.canCheckout, true);

    step("create order");
    const createOrderResponse = await requestJson<{
      success: true;
      data: {
        entity: {
          id: string;
          orderNumber: string;
        };
      };
    }>({
      baseUrl,
      method: "POST",
      path: "/api/checkout/create-order",
      headers: {
        authorization: `Bearer ${accessToken}`
      },
      body: {
        checkoutIdempotencyKey: `checkout-${runId}`,
        address: {
          fullName: "Integration Customer",
          email: customerEmail,
          phone: "+233500000000",
          country: "Ghana",
          region: "Greater Accra",
          city: "Accra",
          line1: "1 Ring Road",
          postalCode: "GA-001-1001"
        },
        shippingMethodCode: "STANDARD"
      }
    });

    assert.equal(createOrderResponse.statusCode, 201);
    const orderId = createOrderResponse.json?.data.entity.id;
    assert.ok(orderId);

    step("initialize payment");
    const initializePaymentResponse = await requestJson<{
      success: true;
      data: {
        entity: {
          id: string;
          paymentState: string;
          redirectUrl: string | null;
        };
      };
    }>({
      baseUrl,
      method: "POST",
      path: "/api/checkout/initialize-payment",
      headers: {
        authorization: `Bearer ${accessToken}`
      },
      body: {
        orderId,
        paymentIdempotencyKey: `payment-${runId}`,
        channel: "card"
      }
    });

    assert.equal(initializePaymentResponse.statusCode, 200);
    assert.equal(initializePaymentResponse.json?.data.entity.paymentState, "AWAITING_CUSTOMER_ACTION");

    step("load payment");
    const payment = await prisma.payment.findFirstOrThrow({
      where: {
        orderId
      }
    });

    const webhookPayload = {
      event: "charge.success",
      data: {
        reference: payment.providerPaymentRef,
        amount: payment.amountCents,
        currency: payment.currency,
        status: "success",
        customer: {
          email: customerEmail
        }
      }
    };
    const webhookRawBody = Buffer.from(JSON.stringify(webhookPayload));
    const webhookSignature = createHmac(
      "sha512",
      requirePaystackWebhookSecret()
    )
      .update(webhookRawBody)
      .digest("hex");

    step("submit invalid webhook");
    const invalidWebhookResponse = await requestJson<{
      success: false;
      error: {
        code: string;
      };
    }>({
      baseUrl,
      method: "POST",
      path: "/api/payments/webhook",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "127.0.0.1",
        "x-paystack-signature": "invalid-signature"
      },
      body: webhookPayload
    });

    assert.equal(invalidWebhookResponse.statusCode, 400);
    assert.equal(invalidWebhookResponse.json?.success, false);
    assert.equal(invalidWebhookResponse.json?.error.code, "INVALID_INPUT");

    const invalidWebhookEvent = await waitForWebhookEvent({
      status: WebhookEventStatus.INVALID_SIGNATURE,
      eventType: "charge.success"
    });
    assert.equal(invalidWebhookEvent.status, "INVALID_SIGNATURE");

    const invalidSignatureSecurityEvent = await prisma.securityEvent.findFirst({
      where: {
        type: "INVALID_WEBHOOK_SIGNATURE"
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    assert.ok(invalidSignatureSecurityEvent);

    const invalidSignatureAlert = await prisma.alert.findFirst({
      where: {
        relatedSecurityEventId: invalidSignatureSecurityEvent.id,
        type: "WEBHOOK_FAILURE"
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    assert.ok(invalidSignatureAlert);

    step("submit valid webhook");
    const validWebhookResponse = await requestJson<{
      success: true;
      data: {
        received: boolean;
      };
    }>({
      baseUrl,
      method: "POST",
      path: "/api/payments/webhook",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "127.0.0.1",
        "x-paystack-signature": webhookSignature
      },
      body: webhookPayload
    });

    assert.equal(validWebhookResponse.statusCode, 200);
    assert.equal(validWebhookResponse.json?.data.received, true);

    const validWebhookEvent = await waitForWebhookEvent({
      signatureValid: true,
      eventType: "charge.success",
      id: {
        not: invalidWebhookEvent.id
      }
    });

    step("process webhook job");
    await processPaymentWebhookJob({
      data: {
        webhookEventId: validWebhookEvent.id
      },
      attemptsMade: 0,
      opts: {
        attempts: 5
      }
    } as never);

    const paidOrder = await prisma.order.findUniqueOrThrow({
      where: {
        id: orderId
      }
    });
    const paidPayment = await prisma.payment.findUniqueOrThrow({
      where: {
        id: payment.id
      }
    });

    assert.equal(paidOrder.status, "CONFIRMED");
    assert.equal(paidPayment.paymentState, "PAID");

    step("reprocess same webhook event is idempotent");
    const paymentTransactionCountBeforeDuplicate = await prisma.paymentTransaction.count({
      where: {
        paymentId: payment.id
      }
    });
    const duplicateProcessResult = await processPaymentWebhookJob({
      data: {
        webhookEventId: validWebhookEvent.id
      },
      attemptsMade: 0,
      opts: {
        attempts: 5
      }
    } as never);
    const paymentTransactionCountAfterDuplicate = await prisma.paymentTransaction.count({
      where: {
        paymentId: payment.id
      }
    });
    assert.deepEqual(duplicateProcessResult, {
      duplicate: true,
      webhookEventId: validWebhookEvent.id
    });
    assert.equal(paymentTransactionCountAfterDuplicate, paymentTransactionCountBeforeDuplicate);

    step("assert order confirmed notification");
    const orderConfirmedNotification = await prisma.notification.findFirst({
      where: {
        recipientEmail: customerEmail,
        type: "ORDER_CONFIRMED"
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    assert.ok(orderConfirmedNotification);

    step("mark order completed");
    await prisma.order.update({
      where: {
        id: orderId
      },
      data: {
        status: "COMPLETED"
      }
    });

    const orderItems = await prisma.orderItem.findMany({
      where: {
        orderId
      }
    });

    step("create return request");
    const createReturnResponse = await requestJson<{
      success: true;
      data: {
        entity: {
          id: string;
          status: string;
        };
      };
    }>({
      baseUrl,
      method: "POST",
      path: `/api/orders/${orderId}/return-request`,
      headers: {
        authorization: `Bearer ${accessToken}`
      },
      body: {
        customerReason: "Item no longer needed",
        items: [
          {
            orderItemId: orderItems[0]!.id,
            quantity: 1
          }
        ]
      }
    });

    assert.equal(createReturnResponse.statusCode, 201);
    const returnId = createReturnResponse.json?.data.entity.id;
    assert.ok(returnId);

    step("rbac denial on approve return");
    const forbiddenApproveReturnResponse = await requestJson({
      baseUrl,
      method: "POST",
      path: `/api/admin/returns/${returnId}/approve`,
      headers: {
        "x-dev-admin-user-id": adminUser.id,
        "x-dev-email": adminUser.email
      },
      body: {
        note: "missing permission"
      }
    });

    assert.equal(forbiddenApproveReturnResponse.statusCode, 403);

    step("approve return");
    const approveReturnResponse = await requestJson({
      baseUrl,
      method: "POST",
      path: `/api/admin/returns/${returnId}/approve`,
      headers: {
        "x-dev-admin-user-id": adminUser.id,
        "x-dev-email": adminUser.email,
        "x-dev-permissions": "orders.update"
      },
      body: {
        note: "approved"
      }
    });

    assert.equal(approveReturnResponse.statusCode, 200);

    step("load created refund");
    const createdRefund = await prisma.refund.findFirst({
      where: {
        returnId
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    assert.ok(createdRefund);

    step("approve refund");
    const approveRefundResponse = await requestJson({
      baseUrl,
      method: "POST",
      path: `/api/admin/refunds/${createdRefund!.id}/approve`,
      headers: {
        "x-dev-admin-user-id": adminUser.id,
        "x-dev-email": adminUser.email,
        "x-dev-permissions": "refunds.approve"
      },
      body: {
        note: "refund approved"
      }
    });

    assert.equal(approveRefundResponse.statusCode, 200);

    step("complete refund");
    const completeRefundResponse = await requestJson({
      baseUrl,
      method: "POST",
      path: `/api/admin/refunds/${createdRefund!.id}/mark-completed`,
      headers: {
        "x-dev-admin-user-id": adminUser.id,
        "x-dev-email": adminUser.email,
        "x-dev-permissions": "refunds.approve"
      },
      body: {
        note: "refund completed",
        providerRefundRef: `refund-${runId}`
      }
    });

    assert.equal(completeRefundResponse.statusCode, 200);

    const completedRefund = await prisma.refund.findUniqueOrThrow({
      where: {
        id: createdRefund!.id
      }
    });
    assert.equal(completedRefund.state, "COMPLETED");

    step("block over-refund approval above payment amount");
    const overflowRefund = await prisma.refund.create({
      data: {
        paymentId: payment.id,
        amountCents: paidPayment.amountCents,
        approvedAmountCents: paidPayment.amountCents,
        currency: paidPayment.currency,
        internalNote: "integration-over-refund-guard",
        items: {
          create: {
            orderItemId: orderItems[0]!.id,
            amountCents: orderItems[0]!.unitPriceAmountCents
          }
        }
      }
    });
    const overRefundApproveResponse = await requestJson({
      baseUrl,
      method: "POST",
      path: `/api/admin/refunds/${overflowRefund.id}/approve`,
      headers: {
        "x-dev-admin-user-id": adminUser.id,
        "x-dev-email": adminUser.email,
        "x-dev-permissions": "refunds.approve"
      },
      body: {
        note: "should fail over cap"
      }
    });
    assert.equal(overRefundApproveResponse.statusCode, 400);
    const overflowRefundAfter = await prisma.refund.findUniqueOrThrow({
      where: {
        id: overflowRefund.id
      }
    });
    assert.equal(overflowRefundAfter.state, "PENDING_APPROVAL");

    step("create unknown legacy job run");
    const unknownLegacyJobRun = await prisma.jobRun.create({
      data: {
        jobId: `legacy-${runId}`,
        jobName: "unknown-legacy:task.execute",
        status: "FAILED"
      }
    });

    step("retry legacy job with override");
    const overrideRetryResponse = await requestJson<{
      success: true;
      data: {
        status: string;
        queue: string;
      };
    }>({
      baseUrl,
      method: "POST",
      path: `/api/admin/jobs/${unknownLegacyJobRun.id}/retry`,
      headers: {
        "x-dev-admin-user-id": adminUser.id,
        "x-dev-email": adminUser.email,
        "x-dev-permissions": "system.jobs.run"
      },
      body: {
        queueName: "reconciliation-cleanup",
        jobName: "system.ping",
        payload: {
          requestId: `override-${runId}`,
          requestedAt: new Date().toISOString(),
          actorId: null
        }
      }
    });

    assert.equal(overrideRetryResponse.statusCode, 202);
    assert.equal(overrideRetryResponse.json?.data.status, "QUEUED");
    assert.equal(overrideRetryResponse.json?.data.queue, "reconciliation-cleanup");

    const retryAuditLog = await prisma.auditLog.findFirst({
      where: {
        actorAdminUserId: adminUser.id,
        actionCode: "system.jobs.retry",
        entityId: unknownLegacyJobRun.id
      },
      orderBy: {
        createdAt: "desc"
      }
    });
    assert.ok(retryAuditLog);
    const retryAdminActionLog = await prisma.adminActionLog.findFirst({
      where: {
        adminUserId: adminUser.id,
        actionCode: "system.jobs.retry",
        entityId: unknownLegacyJobRun.id
      },
      orderBy: {
        createdAt: "desc"
      }
    });
    assert.ok(retryAdminActionLog);

    const overrideReplayJobRun = await prisma.jobRun.findFirst({
      where: {
        metadata: {
          path: ["retriedFromJobRunId"],
          equals: unknownLegacyJobRun.id
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    assert.ok(overrideReplayJobRun);

    step("block replay of a non-failed job");
    const succeededJobRun = await prisma.jobRun.create({
      data: {
        jobId: `succeeded-${runId}`,
        jobName: "system.ping",
        status: "SUCCEEDED"
      }
    });
    const blockedReplayResponse = await requestJson({
      baseUrl,
      method: "POST",
      path: `/api/admin/jobs/${succeededJobRun.id}/retry`,
      headers: {
        "x-dev-admin-user-id": adminUser.id,
        "x-dev-email": adminUser.email,
        "x-dev-permissions": "system.jobs.retry"
      },
      body: {}
    });
    assert.equal(blockedReplayResponse.statusCode, 400);

    step("logout");
    const logoutResponse = await requestJson({
      baseUrl,
      method: "POST",
      path: "/api/auth/logout",
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    });

    assert.equal(logoutResponse.statusCode, 200);

    step("export customer privacy bundle");
    const existingCustomer = await prisma.user.findUniqueOrThrow({
      where: {
        email: customerEmail
      }
    });
    const privacyExportResponse = await requestJson<{
      success: true;
      data: {
        entity: {
          profile: {
            email: string;
          };
          orders: unknown[];
        };
      };
    }>({
      baseUrl,
      method: "GET",
      path: "/api/account/privacy/export",
      headers: {
        "x-dev-user-id": existingCustomer.id,
        "x-dev-email": existingCustomer.email
      }
    });
    assert.equal(privacyExportResponse.statusCode, 200);
    assert.equal(privacyExportResponse.json?.data.entity.profile.email, existingCustomer.email);

    step("anonymize customer privacy data");
    const privacyAnonymizeResponse = await requestJson<{
      success: true;
      data: {
        entity: {
          anonymized: boolean;
          anonymizedEmail: string;
        };
      };
    }>({
      baseUrl,
      method: "POST",
      path: "/api/account/privacy/anonymize",
      headers: {
        "x-dev-user-id": existingCustomer.id,
        "x-dev-email": existingCustomer.email
      },
      body: {
        confirmation: "ERASE"
      }
    });
    assert.equal(privacyAnonymizeResponse.statusCode, 200);
    assert.equal(privacyAnonymizeResponse.json?.data.entity.anonymized, true);
    const anonymizedUser = await prisma.user.findUniqueOrThrow({
      where: {
        id: existingCustomer.id
      }
    });
    assert.equal(anonymizedUser.status, "DEACTIVATED");
    assert.notEqual(anonymizedUser.email, existingCustomer.email);
    console.error("[itest] completed successfully");
  } finally {
    globalThis.fetch = originalFetch;
    resetClerkRuntimeOverrides();
    resetPaymentProviderOverride();
    await stopServer(server);
    await Promise.allSettled([closeQueues(), closeRedisConnection(), prisma.$disconnect(), flushSentry()]);
  }
};

void runIntegrationSuite()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("[itest] failed");
    console.error(error);
    process.exit(1);
  });
