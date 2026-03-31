import { redis } from "../../config/redis";
import { env } from "../../config/env";

const workerHeartbeatKey = () => `${env.QUEUE_PREFIX}:worker:heartbeat`;

export const writeWorkerHeartbeat = async (payload: {
  pid: number;
  queues: string[];
  hostname?: string;
}) => {
  const ttlSeconds = Math.max(env.WORKER_HEARTBEAT_TTL_SECONDS, 10);
  await redis.set(
    workerHeartbeatKey(),
    JSON.stringify({
      ...payload,
      observedAt: new Date().toISOString()
    }),
    "EX",
    ttlSeconds
  );
};

export const clearWorkerHeartbeat = async () => {
  await redis.del(workerHeartbeatKey());
};

export const readWorkerHeartbeat = async (): Promise<{
  pid: number;
  queues: string[];
  hostname?: string;
  observedAt: string;
} | null> => {
  const raw = await redis.get(workerHeartbeatKey());
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as {
      pid: number;
      queues: string[];
      hostname?: string;
      observedAt: string;
    };
  } catch {
    return null;
  }
};
