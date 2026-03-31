import { Queue } from "bullmq";

import { env } from "./env";
import { queueNames } from "./queue.constants";
import { createRedisConnection } from "./redis";

export { queueNames } from "./queue.constants";

type QueueMap = Record<keyof typeof queueNames, Queue>;

export const queueOperationalContracts = {
  payments: {
    maxAttempts: 5,
    backoffDelayMs: 5_000,
    replayRequiresFailedState: true,
    deadLetterStatus: "FAILED"
  },
  webhooks: {
    maxAttempts: 5,
    backoffDelayMs: 5_000,
    replayRequiresFailedState: true,
    deadLetterStatus: "DEAD_LETTERED"
  },
  notifications: {
    maxAttempts: 5,
    backoffDelayMs: 5_000,
    replayRequiresFailedState: true,
    deadLetterStatus: "FAILED"
  },
  reconciliation: {
    maxAttempts: 5,
    backoffDelayMs: 5_000,
    replayRequiresFailedState: true,
    deadLetterStatus: "FAILED"
  }
} as const;

declare global {
  var __ecommerceQueues: QueueMap | undefined;
}

export const createBullMqConnection = (connectionName: string) =>
  createRedisConnection(`bullmq:${connectionName}`);

const queueDefaults = {
  prefix: env.QUEUE_PREFIX,
  defaultJobOptions: {
    attempts: queueOperationalContracts.payments.maxAttempts,
    removeOnComplete: 100,
    removeOnFail: {
      count: 2000,
      age: 7 * 24 * 3600
    },
    backoff: {
      type: "exponential" as const,
      delay: queueOperationalContracts.payments.backoffDelayMs
    }
  }
};

const buildQueues = (): QueueMap => ({
  payments: new Queue(queueNames.payments, {
    ...queueDefaults,
    connection: createBullMqConnection(queueNames.payments)
  }),
  webhooks: new Queue(queueNames.webhooks, {
    ...queueDefaults,
    connection: createBullMqConnection(queueNames.webhooks)
  }),
  notifications: new Queue(queueNames.notifications, {
    ...queueDefaults,
    connection: createBullMqConnection(queueNames.notifications)
  }),
  reconciliation: new Queue(queueNames.reconciliation, {
    ...queueDefaults,
    connection: createBullMqConnection(queueNames.reconciliation)
  })
});

export const queues =
  env.NODE_ENV === "production"
    ? buildQueues()
    : (globalThis.__ecommerceQueues ??= buildQueues());

export const closeQueues = async () => {
  await Promise.all(Object.values(queues).map((queue) => queue.close()));
};
