import Redis from "ioredis";

import { env } from "./env";

declare global {
  var __ecommerceRedis: Redis | undefined;
}

export const createRedisConnection = (connectionName: string) =>
  new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    connectionName: `${env.QUEUE_PREFIX}:${connectionName}`
  });

export const redis = globalThis.__ecommerceRedis ?? createRedisConnection("app");

if (env.NODE_ENV !== "production") {
  globalThis.__ecommerceRedis = redis;
}

export const checkRedisConnection = async () => {
  await redis.ping();
};

export const closeRedisConnection = async () => {
  if (redis.status !== "end") {
    await redis.quit();
  }
};
