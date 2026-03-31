import { randomUUID } from "node:crypto";

import type { RequestHandler } from "express";

import { anonymousActor } from "../types/request-context";

const MAX_REQUEST_ID_LENGTH = 64;

const sanitizeClientRequestId = (value: string) =>
  value
    .trim()
    .slice(0, MAX_REQUEST_ID_LENGTH)
    .replace(/[^\w-]/g, "");

const resolveClientIp = (request: Parameters<RequestHandler>[0]) => {
  const forwardedFor = request.header("x-forwarded-for");
  if (forwardedFor) {
    const candidate = forwardedFor
      .split(",")
      .map((entry) => entry.trim())
      .find(Boolean);
    if (candidate) {
      return candidate;
    }
  }

  const realIp = request.header("x-real-ip");
  if (realIp?.trim()) {
    return realIp.trim();
  }

  return request.ip ?? request.socket.remoteAddress ?? null;
};

export const requestContextMiddleware: RequestHandler = (request, response, next) => {
  const requestIdHeader = request.header("x-request-id");
  const sanitized = requestIdHeader ? sanitizeClientRequestId(requestIdHeader) : "";
  const requestId = sanitized.length > 0 ? sanitized : randomUUID();
  const sessionIdHeader = request.header("x-session-id") ?? request.header("x-dev-session-id");

  request.context = {
    requestId,
    traceId: requestId,
    startedAt: Date.now(),
    sessionId: sessionIdHeader && sessionIdHeader.trim().length > 0 ? sessionIdHeader : null,
    ipAddress: resolveClientIp(request),
    userAgent: request.header("user-agent") ?? null,
    actor: anonymousActor()
  };

  response.setHeader("x-request-id", requestId);
  response.setHeader("x-trace-id", requestId);
  next();
};
