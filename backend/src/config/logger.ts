import pino from "pino";

import { env } from "./env";

const transport =
  env.NODE_ENV === "development"
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard"
        }
      }
    : undefined;

export const logger = pino({
  name: "ecommerce-backend",
  level: env.LOG_LEVEL,
  transport,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.x-paystack-signature",
      "headers.authorization",
      "headers.x-paystack-signature",
      "payload.password",
      "payload.token",
      "payload.email",
      "payload.recipientEmail",
      "payload.guestEmail",
      "payload.phoneNumber",
      "payload.phone_number",
      "payload.firstName",
      "payload.lastName",
      "payload.addressLine1",
      "payload.addressLine2",
      "payload.addressSnapshot",
      "payload.deliveryInstructions",
      "payload.secret",
      "payload.signature",
      "payload.access_code",
      "payload.authorization_code",
      "payload.mobile_money.phone",
      "payload.card.cvv",
      "payload.card.number",
      "payload.api-key",
      "payload.apiKey",
      "payload.smtp_password",
      "payload.brevo_api_key",
      "headers.api-key",
      "auth.pass",
      "auth.password",
      "metadata.email",
      "metadata.phoneNumber",
      "metadata.ipAddress"
    ],
    censor: "[REDACTED]"
  }
});
