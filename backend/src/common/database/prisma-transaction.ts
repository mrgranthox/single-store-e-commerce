import { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "../../config/prisma";

export type DbClient = Prisma.TransactionClient | PrismaClient;

export type TransactionOptions = {
  isolationLevel?: Prisma.TransactionIsolationLevel;
  maxWaitMs?: number;
  timeoutMs?: number;
};

export const getDbClient = (dbClient?: DbClient) => dbClient ?? prisma;

export const runInTransaction = async <T>(
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  options?: TransactionOptions
) =>
  prisma.$transaction(operation, {
    isolationLevel: options?.isolationLevel,
    maxWait: options?.maxWaitMs,
    timeout: options?.timeoutMs
  });

export abstract class BaseRepository {
  protected readonly db: DbClient;

  protected constructor(dbClient?: DbClient) {
    this.db = getDbClient(dbClient);
  }
}
