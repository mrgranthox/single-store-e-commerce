import test from "node:test";
import assert from "node:assert/strict";

import { inferRetryConfigFromJobRun } from "../modules/jobs-workers/retry.helpers";

test("inferRetryConfigFromJobRun prefers explicit retry metadata when present", () => {
  const result = inferRetryConfigFromJobRun({
    jobName: "webhook-processing:payments.process-webhook",
    jobId: "payment-webhook-old",
    metadata: {
      retry: {
        queueName: "webhook-processing",
        jobName: "payments.process-webhook",
        payload: {
          webhookEventId: "from-metadata"
        }
      }
    }
  });

  assert.deepEqual(result, {
    queueName: "webhook-processing",
    jobName: "payments.process-webhook",
    payload: {
      webhookEventId: "from-metadata"
    }
  });
});

test("inferRetryConfigFromJobRun reconstructs legacy payment webhook job payloads from job ids", () => {
  const result = inferRetryConfigFromJobRun({
    jobName: "webhook-processing:payments.process-webhook",
    jobId: "payment-webhook-123e4567-e89b-12d3-a456-426614174000"
  });

  assert.deepEqual(result, {
    queueName: "webhook-processing",
    jobName: "payments.process-webhook",
    payload: {
      webhookEventId: "123e4567-e89b-12d3-a456-426614174000"
    }
  });
});

test("inferRetryConfigFromJobRun reconstructs legacy notification delivery job payloads from job ids", () => {
  const result = inferRetryConfigFromJobRun({
    jobName: "notifications:notifications.deliver",
    jobId: "notification-123e4567-e89b-12d3-a456-426614174999"
  });

  assert.deepEqual(result, {
    queueName: "notifications",
    jobName: "notifications.deliver",
    payload: {
      notificationId: "123e4567-e89b-12d3-a456-426614174999"
    }
  });
});

test("inferRetryConfigFromJobRun reconstructs legacy webhook retries from metadata hints", () => {
  const result = inferRetryConfigFromJobRun({
    jobName: "webhook-processing:legacy-webhook",
    jobId: "legacy-webhook-1",
    metadata: {
      webhookEventId: "123e4567-e89b-12d3-a456-426614174321"
    }
  });

  assert.deepEqual(result, {
    queueName: "webhook-processing",
    jobName: "payments.process-webhook",
    payload: {
      webhookEventId: "123e4567-e89b-12d3-a456-426614174321"
    }
  });
});

test("inferRetryConfigFromJobRun reconstructs legacy notification retries from metadata hints", () => {
  const result = inferRetryConfigFromJobRun({
    jobName: "notifications:legacy-email",
    jobId: "legacy-email-1",
    metadata: {
      notificationId: "123e4567-e89b-12d3-a456-426614174654"
    }
  });

  assert.deepEqual(result, {
    queueName: "notifications",
    jobName: "notifications.deliver",
    payload: {
      notificationId: "123e4567-e89b-12d3-a456-426614174654"
    }
  });
});

test("inferRetryConfigFromJobRun reconstructs system ping retries from metadata hints", () => {
  const result = inferRetryConfigFromJobRun({
    jobName: "reconciliation-cleanup:system.ping",
    jobId: "legacy-ping-1",
    metadata: {
      requestId: "request-123",
      requestedAt: "2026-03-28T00:00:00.000Z",
      actorId: null
    }
  });

  assert.deepEqual(result, {
    queueName: "reconciliation-cleanup",
    jobName: "system.ping",
    payload: {
      requestId: "request-123",
      requestedAt: "2026-03-28T00:00:00.000Z",
      actorId: null
    }
  });
});

test("inferRetryConfigFromJobRun returns null for unrecognized historical job runs", () => {
  const result = inferRetryConfigFromJobRun({
    jobName: "unknown:legacy",
    jobId: "legacy-123"
  });

  assert.equal(result, null);
});
