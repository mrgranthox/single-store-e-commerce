import type { RequestContext } from "./request-context";

declare global {
  namespace Express {
    interface Request {
      context: RequestContext;
      rawBody?: Buffer;
      /** Populated by `validateRequest` after successful parse. */
      validated?: {
        body?: unknown;
        query?: Record<string, unknown>;
        params?: Record<string, unknown>;
      };
    }
  }
}

export {};
