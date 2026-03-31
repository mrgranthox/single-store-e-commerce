import {
  clerkClient as clerkExpressClient,
  clerkMiddleware,
  getAuth
} from "@clerk/express";
import type { Request, RequestHandler } from "express";

import { env } from "./env";

const allowedAuthorizedParties = env.corsAllowedOrigins.filter((origin) => origin !== "*");

export const isClerkConfigured = Boolean(env.CLERK_SECRET_KEY && env.CLERK_PUBLISHABLE_KEY);
export const isClerkWebhookConfigured = Boolean(isClerkConfigured && env.CLERK_WEBHOOK_SECRET);

const defaultClerkRequestMiddleware: RequestHandler = isClerkConfigured
  ? clerkMiddleware({
      publishableKey: env.CLERK_PUBLISHABLE_KEY,
      secretKey: env.CLERK_SECRET_KEY,
      enableHandshake: false,
      authorizedParties: allowedAuthorizedParties.length > 0 ? allowedAuthorizedParties : undefined
    })
  : (_request, _response, next) => next();

type ClerkClient = typeof clerkExpressClient;
type SafeGetClerkAuth = typeof getAuth;

let clerkClientOverride: ClerkClient | null = null;
let clerkRequestMiddlewareOverride: RequestHandler | null = null;
let safeGetClerkAuthOverride: SafeGetClerkAuth | null = null;

const defaultSafeGetClerkAuth = (request: Request) => {
  if (!isClerkConfigured) {
    return null;
  }

  try {
    return getAuth(request);
  } catch {
    return null;
  }
};

export const setClerkRuntimeOverrides = (input: {
  clerkClient?: ClerkClient | null;
  clerkRequestMiddleware?: RequestHandler | null;
  safeGetClerkAuth?: SafeGetClerkAuth | null;
}) => {
  clerkClientOverride = input.clerkClient ?? null;
  clerkRequestMiddlewareOverride = input.clerkRequestMiddleware ?? null;
  safeGetClerkAuthOverride = input.safeGetClerkAuth ?? null;
};

export const resetClerkRuntimeOverrides = () => {
  clerkClientOverride = null;
  clerkRequestMiddlewareOverride = null;
  safeGetClerkAuthOverride = null;
};

export const clerkRequestMiddleware: RequestHandler = (request, response, next) =>
  (clerkRequestMiddlewareOverride ?? defaultClerkRequestMiddleware)(request, response, next);

export const safeGetClerkAuth = (request: Request) =>
  (safeGetClerkAuthOverride ?? defaultSafeGetClerkAuth)(request);

export const clerkClient = new Proxy({} as ClerkClient, {
  get(_target, property, receiver) {
    return Reflect.get(clerkClientOverride ?? clerkExpressClient, property, receiver);
  }
});
