import type { NextFunction, Request, Response } from "express";

type WriteHead = Response["writeHead"];

const roundDurationMs = (durationMs: number) => Number(durationMs.toFixed(2));

export const appendServerTiming = (response: Response, metric: string, durationMs: number) => {
  const safeMetric = metric.replace(/[^A-Za-z0-9_-]/g, "");
  if (!safeMetric || response.headersSent) {
    return;
  }

  const value = `${safeMetric};dur=${roundDurationMs(durationMs)}`;
  const existing = response.getHeader("Server-Timing");
  if (!existing) {
    response.setHeader("Server-Timing", value);
    return;
  }

  response.setHeader("Server-Timing", `${String(existing)}, ${value}`);
};

export const performanceHeadersMiddleware = (
  _request: Request,
  response: Response,
  next: NextFunction
) => {
  const startedAt = performance.now();
  const originalWriteHead = response.writeHead.bind(response) as WriteHead;

  response.writeHead = function patchedWriteHead(...args: Parameters<WriteHead>) {
    const durationMs = roundDurationMs(performance.now() - startedAt);
    if (!response.hasHeader("X-Response-Time-Ms")) {
      response.setHeader("X-Response-Time-Ms", String(durationMs));
    }
    appendServerTiming(response, "app", durationMs);

    return originalWriteHead(...args);
  } as WriteHead;

  next();
};
