import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { env } from "./env";

declare global {
  var __ecommercePrisma: PrismaClient | undefined;
}

const isPrivateOrLocalHostname = (hostname: string) => {
  const host = hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local")
  ) {
    return true;
  }

  // RFC1918 / link-local — typical Cloud SQL private IP + VPC paths (TLS often not verify-full).
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) {
    return true;
  }
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) {
    return true;
  }
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)) {
    return true;
  }

  return false;
};

const buildAdapterConnectionString = (rawConnectionString: string) => {
  const trimmed = rawConnectionString.trim();

  try {
    const url = new URL(trimmed);
    const hostname = url.hostname.toLowerCase();
    const cloudSqlSocket = (url.searchParams.get("host") ?? "").startsWith("/cloudsql/");
    const hasExplicitSsl =
      url.searchParams.has("sslmode") ||
      url.searchParams.has("ssl") ||
      url.searchParams.has("sslcert") ||
      url.searchParams.has("sslrootcert");

    if (!isPrivateOrLocalHostname(hostname) && !cloudSqlSocket && !hasExplicitSsl) {
      // Public hosted Postgres (e.g. Render) requires TLS; private VPC / Cloud SQL sockets do not.
      url.searchParams.set("sslmode", "verify-full");
      return url.toString();
    }

    return trimmed;
  } catch {
    return trimmed;
  }
};

const buildPrismaClient = () => {
  const adapterOptions = {
    connectionString: buildAdapterConnectionString(env.DATABASE_URL),
    max: env.DATABASE_POOL_MAX,
    idleTimeoutMillis: env.DATABASE_IDLE_TIMEOUT_MS
  };
  const adapter = new PrismaPg(adapterOptions);

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
