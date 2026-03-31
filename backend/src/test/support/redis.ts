import { redis } from "../../config/redis";

export const deleteRedisKeysByPattern = async (pattern: string) => {
  let cursor = "0";

  do {
    const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 200);
    cursor = nextCursor;

    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } while (cursor !== "0");
};
