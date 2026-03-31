import { queueNames } from "../../config/queue.constants";

type RetryConfig = {
  queueName: string;
  jobName: string;
  payload: Record<string, unknown>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stripRetrySuffix = (value: string) => value.replace(/-retry-\d+$/, "");

const normalizeCompositeJobName = (value: string) => {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return trimmedValue;
  }

  const lastColonIndex = trimmedValue.lastIndexOf(":");

  if (lastColonIndex > 0) {
    return trimmedValue.slice(lastColonIndex + 1);
  }

  return trimmedValue;
};

const readRetryHintFromMetadata = (
  metadata: Record<string, unknown> | null,
  normalizedJobName: string
): RetryConfig | null => {
  if (!metadata) {
    return null;
  }

  if (typeof metadata.webhookEventId === "string") {
    return {
      queueName: queueNames.webhooks,
      jobName: "payments.process-webhook",
      payload: {
        webhookEventId: metadata.webhookEventId
      }
    };
  }

  if (typeof metadata.notificationId === "string") {
    return {
      queueName: queueNames.notifications,
      jobName: "notifications.deliver",
      payload: {
        notificationId: metadata.notificationId
      }
    };
  }

  if (
    typeof metadata.requestId === "string" &&
    (normalizedJobName === "system.ping" || normalizedJobName === `${queueNames.reconciliation}:system.ping`)
  ) {
    return {
      queueName: queueNames.reconciliation,
      jobName: "system.ping",
      payload: {
        requestId: metadata.requestId,
        requestedAt:
          typeof metadata.requestedAt === "string" ? metadata.requestedAt : new Date().toISOString(),
        actorId: metadata.actorId ?? null
      }
    };
  }

  return null;
};

const readRetrySnapshot = (metadata: Record<string, unknown> | null): RetryConfig | null => {
  const snapshot = metadata && isRecord(metadata.jobSnapshot) ? metadata.jobSnapshot : null;

  if (
    snapshot &&
    typeof snapshot.queueName === "string" &&
    typeof snapshot.jobName === "string" &&
    isRecord(snapshot.payload)
  ) {
    return {
      queueName: snapshot.queueName,
      jobName: snapshot.jobName,
      payload: snapshot.payload
    };
  }

  return null;
};

export const inferRetryConfigFromJobRun = (input: {
  jobName: string;
  jobId: string | number | null;
  metadata?: unknown;
}): RetryConfig | null => {
  const metadata = isRecord(input.metadata) ? input.metadata : null;
  const normalizedJobName = normalizeCompositeJobName(input.jobName);
  const retry = metadata && isRecord(metadata.retry) ? metadata.retry : null;

  if (
    retry &&
    typeof retry.queueName === "string" &&
    typeof retry.jobName === "string" &&
    isRecord(retry.payload)
  ) {
    return {
      queueName: retry.queueName,
      jobName: retry.jobName,
      payload: retry.payload
    };
  }

  const snapshotRetry = readRetrySnapshot(metadata);

  if (snapshotRetry) {
    return snapshotRetry;
  }

  const metadataRetryHint = readRetryHintFromMetadata(metadata, normalizedJobName);

  if (metadataRetryHint) {
    return metadataRetryHint;
  }

  const jobId = typeof input.jobId === "string" ? input.jobId : input.jobId != null ? String(input.jobId) : null;

  if (!jobId) {
    return null;
  }

  const normalizedJobId = stripRetrySuffix(jobId);

  if (
    input.jobName === `${queueNames.webhooks}:payments.process-webhook` ||
    normalizedJobName === "payments.process-webhook" ||
    normalizedJobName === "payment-webhook"
  ) {
    const prefix = "payment-webhook-";

    if (normalizedJobId.startsWith(prefix)) {
      return {
        queueName: queueNames.webhooks,
        jobName: "payments.process-webhook",
        payload: {
          webhookEventId: normalizedJobId.slice(prefix.length)
        }
      } satisfies RetryConfig;
    }
  }

  if (
    input.jobName === `${queueNames.notifications}:notifications.deliver` ||
    normalizedJobName === "notifications.deliver" ||
    normalizedJobName === "notification-delivery"
  ) {
    const prefix = "notification-";

    if (normalizedJobId.startsWith(prefix)) {
      return {
        queueName: queueNames.notifications,
        jobName: "notifications.deliver",
        payload: {
          notificationId: normalizedJobId.slice(prefix.length)
        }
      } satisfies RetryConfig;
    }
  }

  if (
    input.jobName === `${queueNames.reconciliation}:system.ping` ||
    normalizedJobName === "system.ping"
  ) {
    const prefix = "system-ping:";

    if (normalizedJobId.startsWith(prefix)) {
      const requestId = normalizedJobId.slice(prefix.length);

      return {
        queueName: queueNames.reconciliation,
        jobName: "system.ping",
        payload: {
          requestId,
          requestedAt: new Date().toISOString(),
          actorId: null
        }
      } satisfies RetryConfig;
    }
  }

  return null;
};
