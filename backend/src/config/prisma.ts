import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { env } from "./env";

declare global {
  var __ecommercePrisma: PrismaClient | undefined;
}

const buildPrismaClient = () => {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });
};

export const prisma =
  globalThis.__ecommercePrisma ??
  buildPrismaClient();

if (env.NODE_ENV !== "production") {
  globalThis.__ecommercePrisma = prisma;
}

export const checkDatabaseConnection = async () => {
  // Static template — no user input (safe from SQL injection).
  await prisma.$queryRaw`SELECT 1`;
};
