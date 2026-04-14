import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { env } from "./env";

declare global {
  var __ecommercePrisma: PrismaClient | undefined;
}

const buildAdapterConnectionString = (rawConnectionString: string) => {
  const trimmed = rawConnectionString.trim();

  try {
    const url = new URL(trimmed);
    const hostname = url.hostname.toLowerCase();
    const isLocalHost =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname.endsWith(".local");
    const hasExplicitSsl =
      url.searchParams.has("sslmode") ||
      url.searchParams.has("ssl") ||
      url.searchParams.has("sslcert") ||
      url.searchParams.has("sslrootcert");

    if (!isLocalHost && !hasExplicitSsl) {
      // Hosted Postgres providers such as Render require TLS, while local development often does not.
      url.searchParams.set("sslmode", "verify-full");
      return url.toString();
    }

    return trimmed;
  } catch {
    return trimmed;
  }
};

const buildPrismaClient = () => {
  const adapter = new PrismaPg({
    connectionString: buildAdapterConnectionString(env.DATABASE_URL)
  });

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
