import type { RequestHandler } from "express";

import { notFoundError } from "../errors/app-error";

export const notFoundMiddleware: RequestHandler = (_request, _response, next) => {
  next(notFoundError("The requested route does not exist."));
};
