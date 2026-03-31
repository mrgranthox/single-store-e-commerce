import { PrismaClient } from "@prisma/client";

import { env } from "./env";

declare global {
  var __ecommercePrisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__ecommercePrisma ??
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });

if (env.NODE_ENV !== "production") {
  globalThis.__ecommercePrisma = prisma;
}

export const checkDatabaseConnection = async () => {
  // Static template — no user input (safe from SQL injection).
  await prisma.$queryRaw`SELECT 1`;
};
