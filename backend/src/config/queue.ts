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

const queueBaseDefaults = {
  prefix: env.QUEUE_PREFIX,
};

const queueDefaultsFor = (queue: keyof typeof queueOperationalContracts) => ({
  ...queueBaseDefaults,
  defaultJobOptions: {
    attempts: queueOperationalContracts[queue].maxAttempts,
    removeOnComplete: 100,
    removeOnFail: {
      count: 2000,
      age: 7 * 24 * 3600
    },
    backoff: {
      type: "exponential" as const,
      delay: queueOperationalContracts[queue].backoffDelayMs
    }
  }
});

const buildQueues = (): QueueMap => ({
  payments: new Queue(queueNames.payments, {
    ...queueDefaultsFor("payments"),
    connection: createBullMqConnection(queueNames.payments)
  }),
  webhooks: new Queue(queueNames.webhooks, {
    ...queueDefaultsFor("webhooks"),
    connection: createBullMqConnection(queueNames.webhooks)
  }),
  notifications: new Queue(queueNames.notifications, {
    ...queueDefaultsFor("notifications"),
    connection: createBullMqConnection(queueNames.notifications)
  }),
  reconciliation: new Queue(queueNames.reconciliation, {
    ...queueDefaultsFor("reconciliation"),
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
