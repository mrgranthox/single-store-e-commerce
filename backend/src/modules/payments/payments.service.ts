import type { Job } from "bullmq";
import {
  AlertStatus,
  PaymentState,
  Prisma,
  SecuritySeverity,
  WebhookEventStatus
} from "@prisma/client";

import {
  invalidInputError,
  notFoundError,
  providerFailureError,
  serviceUnavailableError
} from "../../common/errors/app-error";
import {
  buildPagination,
  buildPaginationPayload
} from "../../common/http/pagination";
import { toPrismaJsonValue } from "../../common/database/prisma-json";
import { runInTransaction } from "../../common/database/prisma-transaction";
import { queueNames, queues } from "../../config/queue";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { createAlert } from "../alerts-incidents/alerts-incidents.service";
import { initializeCheckoutPayment } from "../checkout/checkout.service";
import { jobRunService } from "../jobs-workers/job-run.service";
import { webhookRecorderService } from "../jobs-workers/webhook-recorder.service";
import { enqueueNotification } from "../notifications/notifications.service";
import {
  isPaymentStateFinal,
  releaseOrderReservations
} from "../orders/orders.service";
import { getPaymentProvider } from "./payment-provider.registry";

const paymentInclude = {
  order: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      guestTrackingKey: true,
      addressSnapshot: true,
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true
        }
      }
    }
  },
  transactions: {
    orderBy: {
      createdAt: "desc" as const
    }
  }
} satisfies Prisma.PaymentInclude;

type PaymentRecord = {
  id: string;
  orderId: string;
  provider: string;
  providerPaymentRef: string | null;
  paymentState: PaymentState;
  amountCents: number;
  currency: string;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
  order: {
    id: string;
    orderNumber: string;
    status: string;
    addressSnapshot: Prisma.JsonValue;
    user: {
      id: string;
      email: string | null;
      firstName: string | null;
      lastName: string | null;
    } | null;
  };
  transactions: Array<{
    id: string;
    providerEventType: string | null;
    providerRef: string | null;
    amountCents: number | null;
    currency: string | null;
    status: string;
    payload: Prisma.JsonValue | null;
    createdAt: Date;
  }>;
};

type PaymentProcessingTarget = {
  id: string;
  orderId: string;
  provider: string;
  providerPaymentRef: string | null;
  paymentState: PaymentState;
  amountCents: number;
  currency: string;
  order: {
    id: string;
    orderNumber: string;
    status: string;
    addressSnapshot: Prisma.JsonValue;
    user: {
      id: string;
      email: string | null;
    } | null;
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readAddressEmail = (value: Prisma.JsonValue) => {
  const record = isRecord(value) ? value : {};

  if (typeof record.contactEmail === "string" && record.contactEmail.trim()) {
    return record.contactEmail;
  }

  if (typeof record.email === "string" && record.email.trim()) {
    return record.email;
  }

  return null;
};

const equalsIgnoreCase = (left: string | null, right: string | null) =>
  !left || !right || left.trim().toLowerCase() === right.trim().toLowerCase();

const mapProviderVerificationStatusToPaymentState = (status: string) => {
  switch (status) {
    case "success":
      return PaymentState.PAID;
    case "failed":
      return PaymentState.FAILED;
    case "abandoned":
      return PaymentState.CANCELLED;
    case "reversed":
      return PaymentState.REFUNDED;
    case "pending":
    case "ongoing":
    case "processing":
      return PaymentState.AWAITING_CUSTOMER_ACTION;
    default:
      return null;
  }
};

const deriveTransactionStatus = (
  paymentState: PaymentState | null,
  fallbackStatus: string
) => {
  if (!paymentState) {
    return fallbackStatus;
  }

  switch (paymentState) {
    case PaymentState.PAID:
      return "SUCCESS";
    case PaymentState.FAILED:
      return "FAILED";
    case PaymentState.CANCELLED:
      return "CANCELLED";
    case PaymentState.REFUNDED:
      return "REFUNDED";
    default:
      return fallbackStatus;
  }
};

const buildCustomerSummary = (payment: PaymentRecord) => {
  const nameParts = [payment.order.user?.firstName, payment.order.user?.lastName].filter(Boolean);

  return {
    id: payment.order.user?.id ?? null,
    email: payment.order.user?.email ?? readAddressEmail(payment.order.addressSnapshot),
    guest: !payment.order.user,
    name: nameParts.length > 0 ? nameParts.join(" ") : null
  };
};

const serializePaymentListItem = (payment: PaymentRecord) => ({
  id: payment.id,
  orderId: payment.orderId,
  orderNumber: payment.order.orderNumber,
  orderStatus: payment.order.status,
  provider: payment.provider,
  providerPaymentRef: payment.providerPaymentRef,
  paymentState: payment.paymentState,
  amountCents: payment.amountCents,
  currency: payment.currency,
  createdAt: payment.createdAt,
  updatedAt: payment.updatedAt,
  customer: buildCustomerSummary(payment),
  latestTransactionStatus: payment.transactions[0]?.status ?? null
});

const serializePaymentDetail = (payment: PaymentRecord) => ({
  id: payment.id,
  orderId: payment.orderId,
  orderNumber: payment.order.orderNumber,
  orderStatus: payment.order.status,
  provider: payment.provider,
  providerPaymentRef: payment.providerPaymentRef,
  paymentState: payment.paymentState,
  amountCents: payment.amountCents,
  currency: payment.currency,
  idempotencyKey: payment.idempotencyKey,
  createdAt: payment.createdAt,
  updatedAt: payment.updatedAt,
  customer: buildCustomerSummary(payment),
  transactions: payment.transactions.map((transaction) => ({
    id: transaction.id,
    providerEventType: transaction.providerEventType,
    providerRef: transaction.providerRef,
    amountCents: transaction.amountCents,
    currency: transaction.currency,
    status: transaction.status,
    payload: transaction.payload,
    createdAt: transaction.createdAt
  }))
});

const loadPaymentForAdminOrThrow = async (paymentId: string) => {
  const payment = await prisma.payment.findUnique({
    where: {
      id: paymentId
    },
    include: paymentInclude
  });

  if (!payment) {
    throw notFoundError("The requested payment was not found.");
  }

  return payment;
};

const applyPaymentOutcome = async (input: {
  paymentId: string;
  nextPaymentState: PaymentState;
  providerPaymentRef: string | null;
  providerEventType: string;
}) =>
  runInTransaction(async (transaction) => {
    const payment = await transaction.payment.findUnique({
      where: {
        id: input.paymentId
      },
      include: {
        order: true
      }
    });

    if (!payment) {
      throw notFoundError("The referenced payment was not found.");
    }

    if (payment.paymentState === input.nextPaymentState) {
      return {
        paymentStateChanged: false,
        orderStateChanged: false
      };
    }

    if (isPaymentStateFinal(payment.paymentState) && payment.paymentState !== input.nextPaymentState) {
      await transaction.financialException.create({
        data: {
          exceptionType: "PAYMENT_STATE_MISMATCH",
          orderId: payment.orderId,
          paymentId: payment.id,
          mismatchSummary: toPrismaJsonValue({
            currentPaymentState: payment.paymentState,
            incomingPaymentState: input.nextPaymentState,
            providerEventType: input.providerEventType,
            providerPaymentRef: input.providerPaymentRef
          })!
        }
      });

      return {
        paymentStateChanged: false,
        orderStateChanged: false
      };
    }

    await transaction.payment.update({
      where: {
        id: payment.id
      },
      data: {
        paymentState: input.nextPaymentState,
        ...(input.providerPaymentRef ? { providerPaymentRef: input.providerPaymentRef } : {})
      }
    });

    let orderStateChanged = false;

    if (input.nextPaymentState === PaymentState.PAID && payment.order.status === "PENDING_PAYMENT") {
      orderStateChanged = true;

      await transaction.order.update({
        where: {
          id: payment.orderId
        },
        data: {
          status: "CONFIRMED"
        }
      });

      await transaction.orderStatusHistory.create({
        data: {
          orderId: payment.orderId,
          fromStatus: payment.order.status,
          toStatus: "CONFIRMED",
          reason: "verified_payment_webhook",
          metadata: toPrismaJsonValue({
            paymentId: payment.id,
            providerEventType: input.providerEventType
          })
        }
      });
    }

    if (
      input.nextPaymentState === PaymentState.FAILED ||
      input.nextPaymentState === PaymentState.CANCELLED
    ) {
      await releaseOrderReservations(transaction, {
        orderId: payment.orderId,
        releaseReason: "payment_failed_or_cancelled"
      });
    }

    await transaction.timelineEvent.create({
      data: {
        entityType: "ORDER",
        entityId: payment.orderId,
        eventType:
          input.nextPaymentState === PaymentState.PAID
            ? "PAYMENT_CONFIRMED"
            : input.nextPaymentState === PaymentState.FAILED
              ? "PAYMENT_FAILED"
              : "PAYMENT_UPDATED",
        actorType: "SYSTEM",
        payload: toPrismaJsonValue({
          paymentId: payment.id,
          paymentState: input.nextPaymentState,
          providerEventType: input.providerEventType,
          providerPaymentRef: input.providerPaymentRef
        })
      }
    });

    return {
      paymentStateChanged: true,
      orderStateChanged
    };
  });

const assertVerifiedReferenceMatchesPayment = (
  payment: PaymentProcessingTarget,
  verifiedReference: {
    amountCents: number | null;
    currency: string | null;
    customerEmail: string | null;
  },
  providerPaymentRef: string
) => {
  const customerEmail = payment.order.user?.email ?? readAddressEmail(payment.order.addressSnapshot);

  if (
    verifiedReference.amountCents !== null &&
    verifiedReference.amountCents !== payment.amountCents
  ) {
    throw providerFailureError("The verified provider amount did not match the stored payment amount.", {
      paymentId: payment.id,
      providerPaymentRef,
      expectedAmountCents: payment.amountCents,
      verifiedAmountCents: verifiedReference.amountCents
    });
  }

  if (
    verifiedReference.currency &&
    verifiedReference.currency.toUpperCase() !== payment.currency.toUpperCase()
  ) {
    throw providerFailureError("The verified provider currency did not match the stored payment currency.", {
      paymentId: payment.id,
      providerPaymentRef,
      expectedCurrency: payment.currency,
      verifiedCurrency: verifiedReference.currency
    });
  }

  if (!equalsIgnoreCase(customerEmail, verifiedReference.customerEmail)) {
    throw providerFailureError("The verified provider customer email did not match the order contact.", {
      paymentId: payment.id,
      providerPaymentRef
    });
  }
};

const applyResolvedPaymentState = async (input: {
  payment: PaymentProcessingTarget;
  providerEventType: string;
  providerPaymentRef: string;
  resolvedPaymentState: PaymentState | null;
  resolvedTransactionStatus: string;
  resolvedPayload: Record<string, unknown>;
}) => {
  await prisma.paymentTransaction.createMany({
    data: [
      {
        paymentId: input.payment.id,
        providerEventType: input.providerEventType,
        providerRef: input.providerPaymentRef,
        amountCents: input.payment.amountCents,
        currency: input.payment.currency,
        status: input.resolvedTransactionStatus,
        payload: toPrismaJsonValue(input.resolvedPayload)
      }
    ],
    skipDuplicates: true
  });

  let outcomeApplication = {
    paymentStateChanged: false,
    orderStateChanged: false
  };

  if (input.resolvedPaymentState) {
    outcomeApplication = await applyPaymentOutcome({
      paymentId: input.payment.id,
      nextPaymentState: input.resolvedPaymentState,
      providerPaymentRef: input.providerPaymentRef,
      providerEventType: input.providerEventType
    });

    if (input.resolvedPaymentState === PaymentState.FAILED) {
      await createAlert({
        type: "PAYMENT_FAILED",
        severity: SecuritySeverity.MEDIUM,
        relatedOrderId: input.payment.orderId,
        relatedPaymentId: input.payment.id,
        metadata: {
          provider: input.payment.provider,
          providerPaymentRef: input.providerPaymentRef,
          providerEventType: input.providerEventType
        }
      });
    }
  }

  const recipientEmail = input.payment.order.user?.email ?? readAddressEmail(input.payment.order.addressSnapshot);

  if (recipientEmail && outcomeApplication.paymentStateChanged) {
    if (input.resolvedPaymentState === PaymentState.PAID) {
      await enqueueNotification({
        type: "ORDER_CONFIRMED",
        recipientEmail,
        recipientType: input.payment.order.user ? "USER" : "GUEST",
        recipientUserId: input.payment.order.user?.id,
        payload: {
          orderId: input.payment.orderId,
          orderNumber: input.payment.order.orderNumber,
          paymentId: input.payment.id,
          provider: input.payment.provider,
          providerPaymentRef: input.providerPaymentRef,
          amountCents: input.payment.amountCents,
          currency: input.payment.currency
        }
      });
    }

    if (
      input.resolvedPaymentState === PaymentState.FAILED ||
      input.resolvedPaymentState === PaymentState.CANCELLED
    ) {
      await enqueueNotification({
        type: "PAYMENT_FAILED",
        recipientEmail,
        recipientType: input.payment.order.user ? "USER" : "GUEST",
        recipientUserId: input.payment.order.user?.id,
        payload: {
          orderId: input.payment.orderId,
          orderNumber: input.payment.order.orderNumber,
          paymentId: input.payment.id,
          provider: input.payment.provider,
          providerPaymentRef: input.providerPaymentRef,
          amountCents: input.payment.amountCents,
          currency: input.payment.currency,
          providerEventType: input.providerEventType
        }
      });
    }
  }

  return outcomeApplication;
};

const ensurePaymentReconciliationAlert = async (
  payment: PaymentProcessingTarget,
  message: string
) => {
  const existingAlert = await prisma.alert.findFirst({
    where: {
      type: "PAYMENT_RECONCILIATION_FAILURE",
      relatedPaymentId: payment.id,
      status: {
        in: [AlertStatus.OPEN, AlertStatus.ACKNOWLEDGED, AlertStatus.ASSIGNED]
      }
    }
  });

  if (existingAlert) {
    return existingAlert;
  }

  return createAlert({
    type: "PAYMENT_RECONCILIATION_FAILURE",
    severity: SecuritySeverity.MEDIUM,
    relatedOrderId: payment.orderId,
    relatedPaymentId: payment.id,
    metadata: {
      provider: payment.provider,
      providerPaymentRef: payment.providerPaymentRef,
      message
    }
  });
};

const loadPaymentByProviderReference = async (provider: string, providerPaymentRef: string) =>
  prisma.payment.findUnique({
    where: {
      provider_providerPaymentRef: {
        provider,
        providerPaymentRef
      }
    },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          addressSnapshot: true,
          user: {
            select: {
              id: true,
              email: true
            }
          }
        }
      }
    }
  });

export const initializePublicPayment = async (
  context: Parameters<typeof initializeCheckoutPayment>[0],
  input: Parameters<typeof initializeCheckoutPayment>[1]
) => initializeCheckoutPayment(context, input);

export const listAdminPayments = async (input: {
  page: number;
  page_size: number;
  q?: string;
  provider?: string;
  paymentState?: PaymentState;
}) => {
  const where: Prisma.PaymentWhereInput = {
    ...(input.provider ? { provider: input.provider } : {}),
    ...(input.paymentState ? { paymentState: input.paymentState } : {}),
    ...(input.q
      ? {
          OR: [
            {
              providerPaymentRef: {
                contains: input.q,
                mode: "insensitive"
              }
            },
            {
              order: {
                orderNumber: {
                  contains: input.q,
                  mode: "insensitive"
                }
              }
            },
            {
              order: {
                user: {
                  is: {
                    email: {
                      contains: input.q,
                      mode: "insensitive"
                    }
                  }
                }
              }
            }
          ]
        }
      : {})
  };

  const [items, totalItems] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: paymentInclude,
      orderBy: {
        createdAt: "desc"
      },
      ...buildPagination(input)
    }),
    prisma.payment.count({ where })
  ]);

  return {
    items: items.map(serializePaymentListItem),
    pagination: buildPaginationPayload(input, totalItems)
  };
};

export const getAdminPaymentDetail = async (paymentId: string) => {
  const payment = await loadPaymentForAdminOrThrow(paymentId);

  return {
    entity: serializePaymentDetail(payment)
  };
};

export const getAdminPaymentTransactions = async (paymentId: string) => {
  const payment = await loadPaymentForAdminOrThrow(paymentId);

  return {
    entity: {
      id: payment.id,
      provider: payment.provider,
      paymentState: payment.paymentState,
      providerPaymentRef: payment.providerPaymentRef
    },
    items: payment.transactions.map((transaction) => ({
      id: transaction.id,
      status: transaction.status,
      providerEventType: transaction.providerEventType,
      providerRef: transaction.providerRef,
      amountCents: transaction.amountCents,
      currency: transaction.currency,
      createdAt: transaction.createdAt,
      payload: transaction.payload
    }))
  };
};

export const listAdminFailedPaymentInvestigations = async (input: {
  page: number;
  page_size: number;
  provider?: string;
}) => {
  const where: Prisma.PaymentWhereInput = {
    paymentState: PaymentState.FAILED,
    ...(input.provider ? { provider: input.provider } : {})
  };

  const [items, totalItems] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: paymentInclude,
      orderBy: {
        updatedAt: "desc"
      },
      ...buildPagination(input)
    }),
    prisma.payment.count({ where })
  ]);

  return {
    items: items.map(serializePaymentListItem),
    pagination: buildPaginationPayload(input, totalItems)
  };
};

export const receivePaymentWebhook = async (input: {
  requestId: string;
  rawBody: Buffer | undefined;
  headers: Record<string, string | string[] | undefined>;
  ipAddress?: string | null;
  payload: unknown;
}) => {
  const provider = getPaymentProvider(env.PAYMENT_PROVIDER);
  const verification = provider.verifyWebhookSignature({
    rawBody: input.rawBody,
    headers: input.headers,
    ipAddress: input.ipAddress,
    parsedBody: input.payload
  });

  const webhookEvent = await webhookRecorderService.recordReceivedEvent({
    provider: provider.name,
    eventType: verification.eventType,
    payload: verification.payload,
    signatureValid: verification.valid
  });

  if (!verification.valid) {
    await webhookRecorderService.markVerified({
      webhookEventId: webhookEvent.id,
      signatureValid: false,
      status: WebhookEventStatus.INVALID_SIGNATURE
    });

    const securityEvent = await prisma.securityEvent.create({
      data: {
        severity: SecuritySeverity.HIGH,
        type: "INVALID_WEBHOOK_SIGNATURE",
        metadata: toPrismaJsonValue({
          provider: provider.name,
          webhookEventId: webhookEvent.id,
          reason: verification.reason,
          requestId: input.requestId
        })!
      }
    });

    await createAlert({
      type: "WEBHOOK_FAILURE",
      severity: SecuritySeverity.HIGH,
      relatedSecurityEventId: securityEvent.id,
      metadata: {
        provider: provider.name,
        webhookEventId: webhookEvent.id,
        reason: verification.reason ?? "Invalid signature"
      }
    });

    return {
      accepted: false,
      webhookEventId: webhookEvent.id,
      reason: verification.reason ?? "The webhook signature is invalid."
    };
  }

  await webhookRecorderService.markVerified({
    webhookEventId: webhookEvent.id,
    signatureValid: true
  });

  try {
    const job = await queues.webhooks.add(
      "payments.process-webhook",
      {
        webhookEventId: webhookEvent.id
      },
      {
        jobId: `payment-webhook-${webhookEvent.id}`
      }
    );

    await jobRunService.recordQueued(job, {
      trigger: "payment_webhook_enqueue",
      webhookEventId: webhookEvent.id,
      retry: {
        queueName: queueNames.webhooks,
        jobName: job.name,
        payload: {
          webhookEventId: webhookEvent.id
        }
      }
    });

    await webhookRecorderService.markQueued(webhookEvent.id);
  } catch (error) {
    await prisma.webhookEvent.update({
      where: {
        id: webhookEvent.id
      },
      data: {
        status: WebhookEventStatus.FAILED
      }
    });

    await createAlert({
      type: "WEBHOOK_QUEUE_FAILURE",
      severity: SecuritySeverity.HIGH,
      metadata: {
        provider: provider.name,
        webhookEventId: webhookEvent.id
      }
    });

    throw serviceUnavailableError("The payment webhook could not be queued for processing.", {
      webhookEventId: webhookEvent.id,
      cause: error instanceof Error ? error.message : error
    });
  }

  return {
    accepted: true,
    webhookEventId: webhookEvent.id,
    provider: provider.name,
    queue: queueNames.webhooks
  };
};

export const processPaymentWebhookJob = async (job: Job<{ webhookEventId: string }>) => {
  const webhookEvent = await prisma.webhookEvent.findUnique({
    where: {
      id: job.data.webhookEventId
    }
  });

  if (!webhookEvent) {
    throw invalidInputError("The webhook event to process was not found.");
  }

  if (webhookEvent.status === WebhookEventStatus.PROCESSED) {
    return {
      duplicate: true,
      webhookEventId: webhookEvent.id
    };
  }

  await webhookRecorderService.markProcessing(webhookEvent.id);

  const attemptNo = (await prisma.webhookProcessingAttempt.count({
    where: {
      webhookEventId: webhookEvent.id
    }
  })) + 1;

  const attempt = await webhookRecorderService.startAttempt({
    webhookEventId: webhookEvent.id,
    attemptNo,
    retryCount: job.attemptsMade
  });

  try {
    const provider = getPaymentProvider(webhookEvent.provider);
    const payload = isRecord(webhookEvent.payload) ? webhookEvent.payload : {};
    const outcome = provider.extractWebhookOutcome({
      eventType: webhookEvent.eventType,
      payload
    });

    if (!outcome.providerPaymentRef) {
      throw invalidInputError("The payment webhook payload did not include a provider reference.");
    }

    const payment = await loadPaymentByProviderReference(webhookEvent.provider, outcome.providerPaymentRef);

    if (!payment) {
      throw providerFailureError("The webhook could not be matched to a known payment.", {
        providerPaymentRef: outcome.providerPaymentRef
      });
    }

    let verifiedReference: Awaited<ReturnType<typeof provider.verifyPaymentReference>> | null = null;

    if (env.PAYSTACK_VERIFY_TRANSACTIONS) {
      verifiedReference = await provider.verifyPaymentReference(outcome.providerPaymentRef);
      assertVerifiedReferenceMatchesPayment(payment, verifiedReference, outcome.providerPaymentRef);
    }

    const verifiedPaymentState =
      verifiedReference?.status
        ? mapProviderVerificationStatusToPaymentState(verifiedReference.status)
        : null;
    const resolvedPaymentState = verifiedPaymentState ?? outcome.nextPaymentState;
    const resolvedTransactionStatus = deriveTransactionStatus(
      resolvedPaymentState,
      outcome.transactionStatus
    );
    const resolvedPayload = verifiedReference
      ? {
          ...outcome.payload,
          verification: verifiedReference.payload
        }
      : outcome.payload;

    const outcomeApplication = await applyResolvedPaymentState({
      payment,
      providerEventType: outcome.providerEventType,
      providerPaymentRef: outcome.providerPaymentRef,
      resolvedPaymentState,
      resolvedTransactionStatus,
      resolvedPayload
    });

    await webhookRecorderService.finalizeAttempt({
      webhookEventId: webhookEvent.id,
      attemptId: attempt.id,
      success: true
    });

    return {
      webhookEventId: webhookEvent.id,
      paymentId: payment.id,
      providerPaymentRef: outcome.providerPaymentRef,
      paymentStateChanged: outcomeApplication.paymentStateChanged,
      orderStateChanged: outcomeApplication.orderStateChanged
    };
  } catch (error) {
    await webhookRecorderService.finalizeAttempt({
      webhookEventId: webhookEvent.id,
      attemptId: attempt.id,
      success: false,
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack
            }
          : error
    });

    const maxAttempts = typeof job.opts.attempts === "number" ? job.opts.attempts : 1;

    if (job.attemptsMade + 1 >= maxAttempts) {
      await webhookRecorderService.markDeadLettered(webhookEvent.id);
      await createAlert({
        type: "WEBHOOK_DEAD_LETTER",
        severity: SecuritySeverity.HIGH,
        metadata: {
          provider: webhookEvent.provider,
          webhookEventId: webhookEvent.id,
          eventType: webhookEvent.eventType
        }
      });
    }

    throw error;
  }
};

export const processPendingPaymentReconciliationJob = async (
  job: Job<{ maxPayments?: number; staleMinutes?: number }>
) => {
  const maxPayments = Math.min(Math.max(job.data.maxPayments ?? 50, 1), 200);
  const staleMinutes = Math.min(Math.max(job.data.staleMinutes ?? 15, 1), 24 * 60);
  const staleBefore = new Date(Date.now() - staleMinutes * 60_000);

  const payments = await prisma.payment.findMany({
    where: {
      providerPaymentRef: {
        not: null
      },
      paymentState: {
        in: [PaymentState.INITIALIZED, PaymentState.AWAITING_CUSTOMER_ACTION]
      },
      updatedAt: {
        lte: staleBefore
      }
    },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          addressSnapshot: true,
          user: {
            select: {
              id: true,
              email: true
            }
          }
        }
      }
    },
    orderBy: {
      updatedAt: "asc"
    },
    take: maxPayments
  });

  let changed = 0;
  let unchanged = 0;
  let failed = 0;

  for (const payment of payments) {
    try {
      const provider = getPaymentProvider(payment.provider);
      const verifiedReference = await provider.verifyPaymentReference(payment.providerPaymentRef!);

      assertVerifiedReferenceMatchesPayment(payment, verifiedReference, payment.providerPaymentRef!);

      const resolvedPaymentState = mapProviderVerificationStatusToPaymentState(verifiedReference.status);
      const resolvedTransactionStatus = deriveTransactionStatus(
        resolvedPaymentState,
        verifiedReference.status.toUpperCase()
      );

      const outcomeApplication = await applyResolvedPaymentState({
        payment,
        providerEventType: "RECONCILIATION_VERIFY",
        providerPaymentRef: verifiedReference.reference,
        resolvedPaymentState,
        resolvedTransactionStatus,
        resolvedPayload: {
          verification: verifiedReference.payload,
          providerStatus: verifiedReference.status,
          reconciledAt: new Date().toISOString(),
          jobId: String(job.id)
        }
      });

      if (outcomeApplication.paymentStateChanged) {
        changed += 1;
      } else {
        unchanged += 1;
      }
    } catch (error) {
      failed += 1;

      await ensurePaymentReconciliationAlert(
        payment,
        error instanceof Error ? error.message : "Payment reconciliation failed."
      );
    }
  }

  return {
    scanned: payments.length,
    changed,
    unchanged,
    failed
  };
};
