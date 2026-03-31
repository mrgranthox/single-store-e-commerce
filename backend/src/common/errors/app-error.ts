export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly expose: boolean;

  public constructor(options: {
    statusCode: number;
    code: string;
    message: string;
    details?: unknown;
    expose?: boolean;
    cause?: unknown;
  }) {
    super(options.message, options.cause ? { cause: options.cause } : undefined);
    this.name = "AppError";
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.details = options.details;
    this.expose = options.expose ?? true;
  }
}

export const isAppError = (error: unknown): error is AppError => error instanceof AppError;

export const badRequestError = (message: string, details?: unknown) =>
  new AppError({ statusCode: 400, code: "BAD_REQUEST", message, details });

export const invalidInputError = (message: string, details?: unknown) =>
  new AppError({ statusCode: 400, code: "INVALID_INPUT", message, details });

export const cartEmptyError = (message = "The cart is empty.", details?: unknown) =>
  new AppError({ statusCode: 400, code: "CART_EMPTY", message, details });

export const couponInvalidError = (message = "The coupon is invalid.", details?: unknown) =>
  new AppError({ statusCode: 400, code: "COUPON_INVALID", message, details });

export const invalidCredentialsError = (message = "The supplied credentials are invalid.") =>
  new AppError({ statusCode: 401, code: "INVALID_CREDENTIALS", message });

export const emailNotVerifiedError = (message = "The email address must be verified before login.") =>
  new AppError({ statusCode: 403, code: "EMAIL_NOT_VERIFIED", message });

export const unauthorizedError = (message = "Authentication is required.") =>
  new AppError({ statusCode: 401, code: "UNAUTHORIZED", message });

export const authRequiredError = (message = "Authentication is required.") =>
  new AppError({ statusCode: 401, code: "AUTH_REQUIRED", message });

export const forbiddenError = (message = "You do not have permission to perform this action.") =>
  new AppError({ statusCode: 403, code: "FORBIDDEN", message });

export const notFoundError = (message = "The requested resource was not found.") =>
  new AppError({ statusCode: 404, code: "NOT_FOUND", message });

export const orderNotFoundError = (message = "The requested order was not found.") =>
  new AppError({ statusCode: 404, code: "ORDER_NOT_FOUND", message });

export const conflictError = (message: string, details?: unknown) =>
  new AppError({ statusCode: 409, code: "CONFLICT", message, details });

export const duplicateProcessingError = (message: string, details?: unknown) =>
  new AppError({ statusCode: 409, code: "DUPLICATE_PROCESSING", message, details });

export const invalidStateTransitionError = (message: string, details?: unknown) =>
  new AppError({ statusCode: 409, code: "INVALID_STATE_TRANSITION", message, details });

export const itemOutOfStockError = (message = "One or more items are out of stock.", details?: unknown) =>
  new AppError({ statusCode: 409, code: "ITEM_OUT_OF_STOCK", message, details });

export const priceChangedError = (message = "One or more item prices changed.", details?: unknown) =>
  new AppError({ statusCode: 409, code: "PRICE_CHANGED", message, details });

export const orderNotEligibleError = (message = "The order is not eligible for this operation.", details?: unknown) =>
  new AppError({ statusCode: 409, code: "ORDER_NOT_ELIGIBLE", message, details });

export const serviceUnavailableError = (message: string, details?: unknown) =>
  new AppError({ statusCode: 503, code: "SERVICE_UNAVAILABLE", message, details, expose: false });

export const providerFailureError = (message: string, details?: unknown) =>
  new AppError({ statusCode: 502, code: "PROVIDER_FAILURE", message, details, expose: false });

export const accountLockedError = (message = "The account is locked.") =>
  new AppError({ statusCode: 423, code: "ACCOUNT_LOCKED", message });

export const accountSuspendedError = (message = "The account is suspended or deactivated.") =>
  new AppError({ statusCode: 403, code: "ACCOUNT_SUSPENDED", message });

export const rateLimitError = (message = "Too many requests. Please try again later.", details?: unknown) =>
  new AppError({ statusCode: 429, code: "RATE_LIMITED", message, details });

export const captchaValidationError = (
  message = "Human verification failed. Please try again.",
  details?: unknown
) => new AppError({ statusCode: 403, code: "CAPTCHA_VALIDATION_FAILED", message, details });
