import type { Request, RequestHandler } from "express";
import type { ZodObject, ZodTypeAny } from "zod";

export const readValidatedBody = <T>(request: Request): T =>
  (request.validated?.body !== undefined ? request.validated.body : request.body) as T;

export const readValidatedQuery = <T extends Record<string, unknown>>(request: Request): T =>
  (request.validated?.query !== undefined
    ? request.validated.query
    : (request.query as Record<string, unknown>)) as T;

export const readValidatedParams = <T extends Record<string, unknown>>(request: Request): T =>
  (request.validated?.params !== undefined
    ? request.validated.params
    : (request.params as Record<string, unknown>)) as T;

type RequestSchemas = {
  body?: ZodTypeAny;
  params?: ZodObject;
  query?: ZodObject;
};

export const validateRequest = (schemas: RequestSchemas): RequestHandler => {
  return (request, _response, next) => {
    const validated: NonNullable<Express.Request["validated"]> = {};

    if (schemas.params) {
      const parsedParams = schemas.params.parse(request.params) as Record<string, unknown>;
      for (const key of Object.keys(request.params)) {
        delete request.params[key];
      }
      Object.assign(request.params, parsedParams);
      validated.params = parsedParams;
    }

    if (schemas.query) {
      const parsedQuery = schemas.query.parse(request.query) as Record<string, unknown>;
      const query = request.query as Record<string, unknown>;
      for (const key of Object.keys(query)) {
        delete query[key];
      }
      Object.assign(query, parsedQuery);
      validated.query = parsedQuery;
    }

    if (schemas.body) {
      request.body = schemas.body.parse(request.body);
      validated.body = request.body;
    }

    if (Object.keys(validated).length > 0) {
      request.validated = validated;
    }

    next();
  };
};
