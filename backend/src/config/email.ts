import nodemailer from "nodemailer";

import { invalidInputError, serviceUnavailableError } from "../common/errors/app-error";
import { env } from "./env";

let transport: nodemailer.Transporter | null = null;
let discoveredSender:
  | {
      email: string;
      name?: string;
    }
  | null = null;

type MailAddress = string | { address: string; name: string };

const looksLikeBrevoSmtpKey = (value?: string) => Boolean(value?.trim().toLowerCase().startsWith("xsmtpsib"));

const getBrevoSmtpPassword = () =>
  env.BREVO_SMTP_PASSWORD ?? (looksLikeBrevoSmtpKey(env.BREVO_API_KEY) ? env.BREVO_API_KEY : undefined);

export const isBrevoSmtpConfigured = Boolean(env.BREVO_SMTP_LOGIN && getBrevoSmtpPassword());
export const isBrevoApiConfigured = Boolean(env.BREVO_API_KEY && !looksLikeBrevoSmtpKey(env.BREVO_API_KEY));
export const isBrevoConfigured = isBrevoSmtpConfigured || isBrevoApiConfigured;

const hasConfiguredFromAddress = () => {
  const normalized = env.EMAIL_FROM.trim().toLowerCase();
  return normalized.length > 0 && !normalized.endsWith("@example.com");
};

const normalizeEmailAddress = (value: string) => value.trim().toLowerCase();

const resolveReplyToMailAddress = () =>
  env.EMAIL_REPLY_TO ? normalizeEmailAddress(env.EMAIL_REPLY_TO) : undefined;

const resolveReplyToBrevoAddress = () =>
  env.EMAIL_REPLY_TO
    ? {
        email: normalizeEmailAddress(env.EMAIL_REPLY_TO)
      }
    : undefined;

const resolveConfiguredSenderAddress = () => {
  if (!env.EMAIL_FROM.trim()) {
    throw serviceUnavailableError(
      "EMAIL_FROM is required for transactional email delivery unless Brevo sender discovery is enabled."
    );
  }

  return env.EMAIL_FROM_NAME
    ? {
        name: env.EMAIL_FROM_NAME,
        address: normalizeEmailAddress(env.EMAIL_FROM)
      }
    : normalizeEmailAddress(env.EMAIL_FROM);
};

const parseBrevoApiError = async (response: Response) => {
  try {
    const payload = (await response.json()) as {
      message?: string;
      code?: string;
    };

    return {
      message: payload.message ?? `Brevo API request failed with status ${response.status}.`,
      code: payload.code
    };
  } catch {
    return {
      message: `Brevo API request failed with status ${response.status}.`
    };
  }
};

const isAbortError = (error: unknown) => error instanceof Error && error.name === "AbortError";

const requireBrevoApiBaseUrl = () => {
  const base = env.BREVO_API_BASE_URL?.trim().replace(/\/$/, "");
  if (!base) {
    throw serviceUnavailableError("BREVO_API_BASE_URL is not configured.");
  }
  return base;
};

export const resetEmailRuntimeState = () => {
  transport = null;
  discoveredSender = null;
};

const fetchBrevoSenders = async () => {
  if (!env.BREVO_API_KEY) {
    throw serviceUnavailableError("Brevo API credentials are not configured for sender discovery.");
  }

  const brevoApiBase = requireBrevoApiBaseUrl();
  let response: Response;

  try {
    response = await fetch(`${brevoApiBase}/senders`, {
      method: "GET",
      headers: {
        accept: "application/json",
        "api-key": env.BREVO_API_KEY
      },
      signal: AbortSignal.timeout(env.BREVO_API_TIMEOUT_MS)
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw serviceUnavailableError("Brevo sender discovery timed out.");
    }

    throw serviceUnavailableError("Brevo sender discovery is temporarily unavailable.", {
      cause: error instanceof Error ? error.message : error
    });
  }

  if (!response.ok) {
    const error = await parseBrevoApiError(response);
    throw serviceUnavailableError(error.message, error.code ? { providerCode: error.code } : undefined);
  }

  const payload = (await response.json()) as {
    senders?: Array<{
      active?: boolean;
      email?: string;
      name?: string;
    }>;
  };

  return payload.senders ?? [];
};

const discoverBrevoSender = async () => {
  if (discoveredSender) {
    return discoveredSender;
  }

  const senders = await fetchBrevoSenders();
  const sender = senders.find((entry) => entry.active && entry.email) ?? senders.find((entry) => entry.email);

  if (!sender?.email) {
    throw serviceUnavailableError(
      "Brevo sender discovery returned no active sender. Configure EMAIL_FROM or add an active Brevo sender."
    );
  }

  discoveredSender = {
    email: normalizeEmailAddress(sender.email),
    name: sender.name?.trim() || undefined
  };

  return discoveredSender;
};

const resolveFromAddress = async (): Promise<MailAddress> => {
  if (hasConfiguredFromAddress()) {
    return resolveConfiguredSenderAddress();
  }

  if (isBrevoApiConfigured) {
    const sender = await discoverBrevoSender();

    return sender.name
      ? {
          name: sender.name,
          address: sender.email
        }
      : sender.email;
  }

  throw serviceUnavailableError(
    "EMAIL_FROM is not configured. Set EMAIL_FROM to a verified Brevo sender address, or configure a Brevo API key for sender discovery."
  );
};

export const getEmailTransport = () => {
  const smtpPassword = getBrevoSmtpPassword();

  if (!env.BREVO_SMTP_LOGIN && looksLikeBrevoSmtpKey(env.BREVO_API_KEY)) {
    throw serviceUnavailableError(
      "Brevo SMTP key detected, but BREVO_SMTP_LOGIN is missing. Set BREVO_SMTP_LOGIN to your Brevo SMTP login email address."
    );
  }

  if (!env.BREVO_SMTP_LOGIN || !smtpPassword) {
    throw serviceUnavailableError("Brevo SMTP is not configured for this environment.");
  }

  if (!transport) {
    transport = nodemailer.createTransport({
      host: env.BREVO_SMTP_HOST,
      port: env.BREVO_SMTP_PORT,
      secure: env.BREVO_SMTP_PORT === 465,
      requireTLS: true,
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      connectionTimeout: env.BREVO_SMTP_CONNECTION_TIMEOUT_MS,
      greetingTimeout: env.BREVO_SMTP_GREETING_TIMEOUT_MS,
      socketTimeout: env.BREVO_SMTP_SOCKET_TIMEOUT_MS,
      auth: {
        user: env.BREVO_SMTP_LOGIN,
        pass: smtpPassword
      },
      tls: {
        minVersion: "TLSv1.2"
      }
    });
  }

  return transport;
};

export const getEmailFromAddress = async () => resolveFromAddress();

export const sendTransactionalEmail = async (input: {
  notificationId: string;
  notificationType: string;
  recipientEmail: string;
  subject: string;
  html: string;
  text: string;
}) => {
  const recipientEmail = normalizeEmailAddress(input.recipientEmail);

  if (isBrevoSmtpConfigured) {
    const transport = getEmailTransport();
    const info = (await transport.sendMail({
      from: await getEmailFromAddress(),
      to: recipientEmail,
      replyTo: resolveReplyToMailAddress(),
      subject: input.subject,
      html: input.html,
      text: input.text,
      disableFileAccess: true,
      disableUrlAccess: true,
      headers: {
        "X-Notification-Id": input.notificationId,
        "X-Notification-Type": input.notificationType
      }
    })) as {
      accepted?: string[];
      rejected?: string[];
      messageId?: string;
    };

    if ((info.accepted?.length ?? 0) === 0) {
      throw invalidInputError("The email provider did not accept the notification recipient.", {
        rejected: info.rejected
      });
    }

    return {
      provider: "brevo_smtp",
      providerMessageId: info.messageId
    };
  }

  if (!isBrevoApiConfigured) {
    if (looksLikeBrevoSmtpKey(env.BREVO_API_KEY) && !env.BREVO_SMTP_LOGIN) {
      throw serviceUnavailableError(
        "Brevo SMTP key detected, but BREVO_SMTP_LOGIN is missing. Configure BREVO_SMTP_LOGIN and optionally rename the key to BREVO_SMTP_PASSWORD."
      );
    }

    throw serviceUnavailableError(
      "Brevo is not configured for this environment. Provide SMTP credentials or BREVO_API_KEY."
    );
  }

  const from = await getEmailFromAddress();
  const brevoApiBase = requireBrevoApiBaseUrl();
  let response: Response;

  try {
    response = await fetch(`${brevoApiBase}/smtp/email`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": env.BREVO_API_KEY!,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        sender:
          typeof from === "string"
            ? {
                email: normalizeEmailAddress(from)
              }
            : {
                email: normalizeEmailAddress(from.address),
                ...(from.name ? { name: from.name } : {})
              },
        to: [
          {
            email: recipientEmail
          }
        ],
        replyTo: resolveReplyToBrevoAddress(),
        subject: input.subject,
        htmlContent: input.html,
        textContent: input.text,
        headers: {
          "X-Notification-Id": input.notificationId,
          "X-Notification-Type": input.notificationType
        }
      }),
      signal: AbortSignal.timeout(env.BREVO_API_TIMEOUT_MS)
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw serviceUnavailableError("Brevo email delivery timed out.");
    }

    throw serviceUnavailableError("Brevo email delivery is temporarily unavailable.", {
      cause: error instanceof Error ? error.message : error
    });
  }

  if (!response.ok) {
    const error = await parseBrevoApiError(response);
    throw serviceUnavailableError(error.message, error.code ? { providerCode: error.code } : undefined);
  }

  const payload = (await response.json()) as {
    messageId?: string;
  };

  return {
    provider: "brevo_api",
    providerMessageId: payload.messageId ?? null
  };
};
