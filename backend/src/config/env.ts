import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import { z } from "zod";

const loadFileEnv = () => {
  const nodeEnv = process.env.NODE_ENV?.trim() || "development";
  const dotenvFiles = [
    ".env",
    `.env.${nodeEnv}`,
    nodeEnv === "test" ? null : ".env.local",
    `.env.${nodeEnv}.local`
  ].filter((value): value is string => Boolean(value));

  const loadedEntries: Record<string, string> = {};

  for (const relativePath of dotenvFiles) {
    const absolutePath = path.resolve(process.cwd(), relativePath);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }

    Object.assign(loadedEntries, dotenv.parse(fs.readFileSync(absolutePath)));
  }

  return loadedEntries;
};

const fileEnv = loadFileEnv();

const rawProcessEnv = {
  ...process.env,
  ...fileEnv,
  NODE_ENV: process.env.NODE_ENV ?? fileEnv.NODE_ENV,
  BREVO_SMTP_HOST:
    fileEnv.BREVO_SMTP_HOST ??
    process.env.BREVO_SMTP_HOST ??
    fileEnv.BREVO_SMTP_SERVER ??
    process.env.BREVO_SMTP_SERVER ??
    undefined,
  CLOUDINARY_UPLOAD_FOLDER:
    fileEnv.CLOUDINARY_UPLOAD_FOLDER ??
    process.env.CLOUDINARY_UPLOAD_FOLDER ??
    fileEnv.CLOUDINARY_FOLDER_NAME ??
    process.env.CLOUDINARY_FOLDER_NAME ??
    undefined
};

/** Empty strings from deployment templates (e.g. unset GitHub secrets) → treat as unset so Zod defaults apply. */
const DEPLOY_EMPTY_MEANS_UNSET = new Set([
  "CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "CLERK_WEBHOOK_SECRET",
  "SENTRY_DSN",
  "SENTRY_ENVIRONMENT",
  "PAYSTACK_SECRET_KEY",
  "PAYSTACK_PUBLIC_KEY",
  "PAYSTACK_WEBHOOK_SECRET",
  "PAYSTACK_CALLBACK_URL",
  "BREVO_SMTP_LOGIN",
  "BREVO_SMTP_PASSWORD",
  "BREVO_API_KEY",
  "EMAIL_FROM",
  "EMAIL_FROM_NAME",
  "EMAIL_REPLY_TO",
  "EMAIL_PROVIDER",
  "STORAGE_PROVIDER",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "TURNSTILE_SITE_KEY",
  "TURNSTILE_SECRET_KEY",
  "TURNSTILE_VERIFY_URL",
  "TURNSTILE_EXPECTED_HOSTNAMES",
  "BREVO_API_BASE_URL",
  "SEED_DEFAULT_ADMIN_EMAIL",
  "SEED_DEFAULT_ADMIN_CLERK_USER_ID",
  "SEED_DEFAULT_ADMIN_PASSWORD",
  "SEED_DEFAULT_ADMIN_PHONE",
  "QUEUE_PREFIX",
  "PAYMENT_PROVIDER",
  "PAYSTACK_VERIFY_TRANSACTIONS",
  "LOG_LEVEL",
  "SENTRY_ENVIRONMENT",
  "SENTRY_TRACES_SAMPLE_RATE",
  "SENTRY_PROFILE_SAMPLE_RATE",
  "SENTRY_ATTACH_STACKTRACE",
  "SENTRY_SEND_DEFAULT_PII",
  "SENTRY_DEBUG"
]);

const normalizedProcessEnv = Object.fromEntries(
  Object.entries(rawProcessEnv).filter(([key, value]) => {
    if (value !== "") {
      return true;
    }
    return !DEPLOY_EMPTY_MEANS_UNSET.has(key);
  })
) as typeof rawProcessEnv;

const booleanFromString = z.preprocess((value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }

  return value;
}, z.boolean());

const csvToArray = (value: string | undefined, fallback: string[] = []) =>
  (value ?? fallback.join(","))
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

/** PaaS dashboards often set NODE_ENV=staging, prod, or odd casing — map to the three modes we support. */
const normalizeNodeEnv = (value: unknown): unknown => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    return value;
  }
  const t = value.trim().toLowerCase();
  if (t === "" || t === "none") {
    return undefined;
  }
  if (t === "prod" || t === "staging" || t === "stage" || t === "live") {
    return "production";
  }
  if (t === "dev") {
    return "development";
  }
  if (t === "development" || t === "test" || t === "production") {
    return t;
  }
  return t;
};

/** Normalize allow-list entries and browser `Origin` headers (scheme + host + port, no trailing slash). */
export const normalizeCorsOrigin = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return trimmed;
  }

  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed.replace(/\/$/, "");
  }
};

const envSchema = z.object({
  NODE_ENV: z.preprocess(normalizeNodeEnv, z.enum(["development", "test", "production"]).default("development")),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  APP_BASE_URL: z.string().url(),
  ADMIN_APP_URL: z.string().url(),
  CUSTOMER_APP_URL: z.string().url(),
  MOBILE_APP_URL: z.string().url(),
  CORS_ALLOWED_ORIGINS: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.preprocess(
    (value) => (value === "" || value === undefined || value === null ? undefined : value),
    z.string().min(1).default("redis://localhost:6379")
  ),
  WORKER_HEARTBEAT_INTERVAL_SECONDS: z.coerce.number().int().min(5).max(300).default(15),
  WORKER_HEARTBEAT_TTL_SECONDS: z.coerce.number().int().min(10).max(600).default(45),
  QUEUE_PREFIX: z.preprocess(
    (value) => (value === "" || value === undefined || value === null ? undefined : value),
    z.string().min(1).default("ecommerce")
  ),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_WEBHOOK_SECRET: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  SENTRY_ENABLED: booleanFromString.default(false),
  SENTRY_ENVIRONMENT: z.string().trim().min(1).optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0),
  SENTRY_PROFILE_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0),
  SENTRY_ATTACH_STACKTRACE: booleanFromString.default(true),
  SENTRY_SEND_DEFAULT_PII: booleanFromString.default(false),
  SENTRY_DEBUG: booleanFromString.default(false),
  PAYMENT_PROVIDER: z.string().default("paystack"),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_PUBLIC_KEY: z.string().optional(),
  PAYSTACK_WEBHOOK_SECRET: z.string().optional(),
  PAYSTACK_API_BASE_URL: z.string().trim().url(),
  PAYSTACK_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(60_000).default(10_000),
  PAYSTACK_ALLOWED_CHANNELS: z.string().default("card,mobile_money"),
  PAYSTACK_ALLOWED_WEBHOOK_IPS: z.string().default("52.31.139.75,52.49.173.169,52.214.14.220"),
  PAYSTACK_ALLOWED_MOBILE_MONEY_PROVIDERS: z.string().default("mtn,tgo,vod"),
  PAYSTACK_DEFAULT_CURRENCY: z
    .string()
    .trim()
    .length(3)
    .transform((value) => value.toUpperCase())
    .default("GHS"),
  PAYSTACK_CALLBACK_URL: z.string().trim().url().optional(),
  PAYSTACK_VERIFY_TRANSACTIONS: booleanFromString.default(true),
  EMAIL_PROVIDER: z
    .string()
    .default("brevo")
    .transform((value) => {
      const normalized = value.trim().toLowerCase();
      return normalized.length > 0 ? normalized : "brevo";
    }),
  BREVO_SMTP_HOST: z.string().trim().min(1).default("smtp-relay.brevo.com"),
  BREVO_SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  BREVO_SMTP_LOGIN: z.string().optional(),
  BREVO_SMTP_PASSWORD: z.string().optional(),
  BREVO_SMTP_CONNECTION_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(60_000).default(10_000),
  BREVO_SMTP_GREETING_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(60_000).default(10_000),
  BREVO_SMTP_SOCKET_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(15_000),
  BREVO_API_KEY: z.string().optional(),
  BREVO_API_BASE_URL: z.string().trim().url().optional(),
  BREVO_API_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(60_000).default(10_000),
  EMAIL_FROM: z.string().default("no-reply@example.com"),
  EMAIL_FROM_NAME: z.string().trim().min(1).max(120).optional(),
  EMAIL_REPLY_TO: z.string().trim().email().optional(),
  STORAGE_PROVIDER: z
    .string()
    .default("cloudinary")
    .transform((value) => {
      const normalized = value.trim().toLowerCase();
      return normalized.length > 0 ? normalized : "cloudinary";
    }),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_UPLOAD_FOLDER: z.string().trim().min(1).default("ecommerce"),
  CLOUDINARY_PRODUCT_MEDIA_FOLDER: z.string().trim().min(1).default("catalog/products"),
  CLOUDINARY_BANNER_FOLDER: z.string().trim().min(1).default("content/banners"),
  CLOUDINARY_SUPPORT_FOLDER: z.string().trim().min(1).default("support/attachments"),
  CLOUDINARY_SIGNED_UPLOADS_ONLY: booleanFromString.default(true),
  CLOUDINARY_ALLOWED_IMAGE_FORMATS: z.string().default("jpg,jpeg,png,webp,avif"),
  CLOUDINARY_ALLOWED_VIDEO_FORMATS: z.string().default("mp4,mov,webm"),
  CLOUDINARY_ALLOWED_DOCUMENT_FORMATS: z.string().default("pdf,jpg,jpeg,png,webp"),
  CLOUDINARY_MAX_IMAGE_BYTES: z.coerce.number().int().min(1).default(8_388_608),
  CLOUDINARY_MAX_VIDEO_BYTES: z.coerce.number().int().min(1).default(52_428_800),
  CLOUDINARY_MAX_DOCUMENT_BYTES: z.coerce.number().int().min(1).default(12_582_912),
  ABUSE_CHALLENGE_PROVIDER: z.enum(["none", "turnstile"]).default("none"),
  PUBLIC_SUPPORT_CAPTCHA_ENABLED: booleanFromString.default(false),
  TURNSTILE_SITE_KEY: z.string().optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),
  TURNSTILE_VERIFY_URL: z.string().trim().url().optional(),
  TURNSTILE_EXPECTED_HOSTNAMES: z.string().default(""),
  TURNSTILE_ENFORCE_ACTION: booleanFromString.default(true),
  TURNSTILE_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(5000),
  SESSION_SECRET: z.string().min(32),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  ALLOW_DEV_AUTH_BYPASS: booleanFromString.default(false),
  ADMIN_API_ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().min(5).max(60).default(10),
  ADMIN_API_REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(3),
  ADMIN_STEP_UP_TTL_MINUTES: z.coerce.number().int().min(1).max(60).default(10),
  ADMIN_REQUIRE_STEP_UP_FOR_SENSITIVE_ACTIONS: booleanFromString.default(true),
  ADMIN_SESSION_ANOMALY_DETECTION_ENABLED: booleanFromString.default(true),
  DEPLOYMENT_CELL: z.string().trim().min(1).optional(),
  APP_RELEASE_LABEL: z.string().trim().min(1).optional(),
  SEED_DEFAULT_ADMIN_EMAIL: z.string().email().optional().or(z.literal("")),
  SEED_DEFAULT_ADMIN_CLERK_USER_ID: z.string().optional(),
  SEED_DEFAULT_ADMIN_PASSWORD: z.string().optional(),
  SEED_DEFAULT_ADMIN_PHONE: z.string().optional(),
  SEED_DEFAULT_ADMIN_ROLE: z.string().default("super_admin")
});

type ParsedEnv = z.infer<typeof envSchema>;

const looksLikeBrevoSmtpKey = (value?: string) =>
  Boolean(value?.trim().toLowerCase().startsWith("xsmtpsib"));

const isBrevoEmailConfigured = (e: ParsedEnv) => {
  const smtpPassword =
    e.BREVO_SMTP_PASSWORD ?? (looksLikeBrevoSmtpKey(e.BREVO_API_KEY) ? e.BREVO_API_KEY : undefined);
  const hasSmtp = Boolean(e.BREVO_SMTP_LOGIN?.trim() && smtpPassword?.trim());
  const hasApi = Boolean(e.BREVO_API_KEY?.trim()) && !looksLikeBrevoSmtpKey(e.BREVO_API_KEY);
  return hasSmtp || hasApi;
};

const parsedEnv = (() => {
  const result = envSchema.safeParse(normalizedProcessEnv);
  if (result.success) {
    return result.data;
  }

  const missingKeys = [
    ...new Set(
      result.error.issues
        .filter((issue) => issue.path.length > 0)
        .map((issue) => issue.path.map(String).join("."))
    )
  ];

  const detail = missingKeys.length > 0 ? `: ${missingKeys.join(", ")}` : "";
  throw new Error(
    `Environment validation failed${detail}. ` +
      "Add the missing variable(s) in Render → Environment (or your host's env), then redeploy. " +
      "The server does not read backend/.env from your local machine in the cloud.\n" +
      result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n")
  );
})();

if (
  parsedEnv.ALLOW_DEV_AUTH_BYPASS &&
  parsedEnv.NODE_ENV !== "development" &&
  parsedEnv.NODE_ENV !== "test"
) {
  throw new Error("ALLOW_DEV_AUTH_BYPASS may only be enabled in development or test.");
}

if (parsedEnv.NODE_ENV === "production") {
  if (parsedEnv.SEED_DEFAULT_ADMIN_PASSWORD?.trim()) {
    throw new Error("SEED_DEFAULT_ADMIN_PASSWORD must not be set in production.");
  }

  if (parsedEnv.ALLOW_DEV_AUTH_BYPASS) {
    throw new Error("ALLOW_DEV_AUTH_BYPASS must not be enabled in production.");
  }

  const corsEntries = csvToArray(parsedEnv.CORS_ALLOWED_ORIGINS);
  if (corsEntries.length === 0 || corsEntries.includes("*")) {
    throw new Error("CORS_ALLOWED_ORIGINS must list explicit origins in production (wildcard * is not allowed).");
  }

  const requiredInProduction = [
    "PAYSTACK_SECRET_KEY",
    "PAYSTACK_WEBHOOK_SECRET",
    "CLERK_SECRET_KEY",
    "CLERK_WEBHOOK_SECRET"
  ] as const;

  for (const key of requiredInProduction) {
    const value = parsedEnv[key];
    if (typeof value !== "string" || !value.trim()) {
      throw new Error(`Required environment variable ${key} is missing or empty in production.`);
    }
  }

  const allowedEmailProviders = new Set(["brevo", "none"]);
  if (!allowedEmailProviders.has(parsedEnv.EMAIL_PROVIDER)) {
    throw new Error(
      `Unsupported EMAIL_PROVIDER "${parsedEnv.EMAIL_PROVIDER}" in production. Use "brevo" or "none".`
    );
  }

  if (parsedEnv.EMAIL_PROVIDER === "brevo") {
    if (!parsedEnv.BREVO_API_BASE_URL?.trim()) {
      throw new Error(
        "EMAIL_PROVIDER is brevo but BREVO_API_BASE_URL is missing or empty in production. Set it in the environment (see .env.example)."
      );
    }
  }

  if (parsedEnv.EMAIL_PROVIDER === "brevo" && !isBrevoEmailConfigured(parsedEnv)) {
    throw new Error(
      "EMAIL_PROVIDER is brevo but Brevo is not configured. Set BREVO_SMTP_LOGIN + BREVO_SMTP_PASSWORD (or BREVO_API_KEY for SMTP key / transactional API), or set EMAIL_PROVIDER=none to disable email at boot (notifications will fail at send time)."
    );
  }

  const allowedStorageProviders = new Set(["cloudinary", "none"]);
  if (!allowedStorageProviders.has(parsedEnv.STORAGE_PROVIDER)) {
    throw new Error(
      `Unsupported STORAGE_PROVIDER "${parsedEnv.STORAGE_PROVIDER}" in production. Use "cloudinary" or "none".`
    );
  }

  if (parsedEnv.STORAGE_PROVIDER === "cloudinary") {
    const cloudinaryKeys = [
      "CLOUDINARY_CLOUD_NAME",
      "CLOUDINARY_API_KEY",
      "CLOUDINARY_API_SECRET"
    ] as const;
    for (const key of cloudinaryKeys) {
      const value = parsedEnv[key];
      if (typeof value !== "string" || !value.trim()) {
        throw new Error(
          `STORAGE_PROVIDER is cloudinary but ${key} is missing or empty in production. Use STORAGE_PROVIDER=none only if you accept media upload failures.`
        );
      }
    }
  }

  if (parsedEnv.SENTRY_ENABLED) {
    if (typeof parsedEnv.SENTRY_DSN !== "string" || !parsedEnv.SENTRY_DSN.trim()) {
      throw new Error("SENTRY_ENABLED is true but SENTRY_DSN is missing or empty in production.");
    }
  }

  if (parsedEnv.PUBLIC_SUPPORT_CAPTCHA_ENABLED && parsedEnv.ABUSE_CHALLENGE_PROVIDER === "turnstile") {
    if (!parsedEnv.TURNSTILE_SITE_KEY?.trim() || !parsedEnv.TURNSTILE_SECRET_KEY?.trim()) {
      throw new Error(
        "PUBLIC_SUPPORT_CAPTCHA_ENABLED is true with ABUSE_CHALLENGE_PROVIDER=turnstile but TURNSTILE_SITE_KEY or TURNSTILE_SECRET_KEY is missing in production."
      );
    }
    if (!parsedEnv.TURNSTILE_VERIFY_URL?.trim()) {
      throw new Error(
        "PUBLIC_SUPPORT_CAPTCHA_ENABLED is true with ABUSE_CHALLENGE_PROVIDER=turnstile but TURNSTILE_VERIFY_URL is missing or empty in production. Set it in the environment (see .env.example)."
      );
    }
  }

  const assertProductionCorsOrigins = (raw: string) => {
    for (const entry of csvToArray(raw)) {
      let hostname: string;
      try {
        hostname = new URL(entry).hostname.toLowerCase();
      } catch {
        throw new Error(`CORS_ALLOWED_ORIGINS contains an invalid origin: ${entry}`);
      }
      if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
        throw new Error(
          "CORS_ALLOWED_ORIGINS must not use localhost or loopback in production. Set real browser origins in the environment."
        );
      }
    }
  };

  assertProductionCorsOrigins(parsedEnv.CORS_ALLOWED_ORIGINS);

  const assertProductionPublicUrl = (key: string, raw: string) => {
    let hostname: string;
    try {
      hostname = new URL(raw).hostname.toLowerCase();
    } catch {
      throw new Error(`${key} must be a valid absolute URL in production.`);
    }

    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
      throw new Error(`${key} must not use localhost or loopback in production (${raw}).`);
    }
  };

  for (const key of ["APP_BASE_URL", "ADMIN_APP_URL", "CUSTOMER_APP_URL", "MOBILE_APP_URL"] as const) {
    assertProductionPublicUrl(key, parsedEnv[key]);
  }

  if (
    parsedEnv.EMAIL_PROVIDER === "brevo" &&
    parsedEnv.EMAIL_FROM.toLowerCase().includes("example.com")
  ) {
    throw new Error(
      "EMAIL_FROM must use a real verified domain in production (addresses under example.com are rejected)."
    );
  }

  const assertNotLoopbackDatastoreUrl = (key: "DATABASE_URL" | "REDIS_URL", raw: string) => {
    try {
      const url = new URL(raw);
      const host = url.hostname.toLowerCase();
      if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
        throw new Error(
          `${key} must not use localhost or loopback in production (use your managed or Compose service hostname, e.g. postgres / redis).`
        );
      }
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error(`${key} must be a valid URL in production.`);
      }

      throw error;
    }
  };

  assertNotLoopbackDatastoreUrl("DATABASE_URL", parsedEnv.DATABASE_URL);
  assertNotLoopbackDatastoreUrl("REDIS_URL", parsedEnv.REDIS_URL);
}

export const env = {
  ...parsedEnv,
  sentryEnvironment: parsedEnv.SENTRY_ENVIRONMENT ?? parsedEnv.NODE_ENV,
  corsAllowedOrigins: [
    ...new Set(csvToArray(parsedEnv.CORS_ALLOWED_ORIGINS).map(normalizeCorsOrigin))
  ],
  paystackAllowedChannels: csvToArray(parsedEnv.PAYSTACK_ALLOWED_CHANNELS).map((value) =>
    value.toLowerCase()
  ),
  paystackAllowedWebhookIps: csvToArray(parsedEnv.PAYSTACK_ALLOWED_WEBHOOK_IPS),
  paystackAllowedMobileMoneyProviders: csvToArray(
    parsedEnv.PAYSTACK_ALLOWED_MOBILE_MONEY_PROVIDERS
  ).map((value) => {
    const normalizedValue = value.toLowerCase();

    if (normalizedValue === "atl" || normalizedValue === "airteltigo") {
      return "tgo";
    }

    return normalizedValue;
  }),
  cloudinaryAllowedImageFormats: csvToArray(parsedEnv.CLOUDINARY_ALLOWED_IMAGE_FORMATS).map(
    (value) => value.toLowerCase()
  ),
  cloudinaryAllowedVideoFormats: csvToArray(parsedEnv.CLOUDINARY_ALLOWED_VIDEO_FORMATS).map(
    (value) => value.toLowerCase()
  ),
  cloudinaryAllowedDocumentFormats: csvToArray(parsedEnv.CLOUDINARY_ALLOWED_DOCUMENT_FORMATS).map(
    (value) => value.toLowerCase()
  ),
  turnstileExpectedHostnames: csvToArray(parsedEnv.TURNSTILE_EXPECTED_HOSTNAMES)
};

export type Env = typeof env;
