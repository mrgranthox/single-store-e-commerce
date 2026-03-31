import { createHash, randomBytes } from "node:crypto";

import { UserStatus } from "@prisma/client";

import { notFoundError } from "../../common/errors/app-error";
import {
  conflictError,
  invalidCredentialsError,
  invalidInputError,
  providerFailureError,
  serviceUnavailableError
} from "../../common/errors/app-error";
import { env } from "../../config/env";
import { clerkClient } from "../../config/clerk";
import { prisma } from "../../config/prisma";
import { enqueueNotification } from "../notifications/notifications.service";
import {
  mapClerkSdkUserToUnknownRecord,
  processClerkWebhook,
  syncCustomerUserFromClerkUserId,
  upsertCustomerUserFromClerkRecord
} from "./clerk-sync.service";
import {
  issueCustomerApiSession,
  revokeCustomerApiSessionBySessionId,
  revokeCustomerApiSessionsForUser,
  rotateCustomerApiSession
} from "./api-session.service";
import { revokeAdminApiSessionBySessionId } from "./admin-api-session.service";

const EMAIL_VERIFICATION_TTL_MINUTES = 24 * 60;
const PASSWORD_RESET_TTL_MINUTES = 60;

const hashChallengeToken = (token: string) => createHash("sha256").update(token).digest("hex");
const buildChallengeToken = () => `ect_${randomBytes(24).toString("base64url")}`;
const addMinutes = (value: Date, minutes: number) => new Date(value.getTime() + minutes * 60_000);

const buildAuthUser = (user: {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: UserStatus;
}) => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  status: user.status.toLowerCase()
});

const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** Single client-facing message for failed login to reduce account state enumeration. */
const CUSTOMER_LOGIN_REJECTED_MESSAGE = "Invalid email or password.";

const clerkErrorContains = (error: unknown, pattern: string) =>
  JSON.stringify(error).toLowerCase().includes(pattern.toLowerCase());

const findClerkUserByEmail = async (email: string) => {
  const result = await clerkClient.users.getUserList({
    emailAddress: [email],
    limit: 1
  });

  return result.data[0] ?? null;
};

const createAuthChallenge = async (input: {
  userId: string;
  email: string;
  purpose: "EMAIL_VERIFICATION" | "PASSWORD_RESET";
  ttlMinutes: number;
}) => {
  await prisma.customerAuthChallenge.updateMany({
    where: {
      userId: input.userId,
      purpose: input.purpose,
      consumedAt: null
    },
    data: {
      consumedAt: new Date()
    }
  });

  const token = buildChallengeToken();

  await prisma.customerAuthChallenge.create({
    data: {
      userId: input.userId,
      purpose: input.purpose,
      tokenHash: hashChallengeToken(token),
      email: input.email,
      expiresAt: addMinutes(new Date(), input.ttlMinutes)
    }
  });

  return {
    token,
    expiresInMinutes: input.ttlMinutes
  };
};

const consumeAuthChallenge = async (input: {
  token: string;
  purpose: "EMAIL_VERIFICATION" | "PASSWORD_RESET";
}) => {
  const challenge = await prisma.customerAuthChallenge.findUnique({
    where: {
      tokenHash: hashChallengeToken(input.token)
    },
    include: {
      user: true
    }
  });

  if (
    !challenge ||
    challenge.purpose !== input.purpose ||
    challenge.consumedAt ||
    challenge.expiresAt <= new Date()
  ) {
    throw invalidInputError("The supplied token is invalid or expired.");
  }

  await prisma.customerAuthChallenge.update({
    where: {
      id: challenge.id
    },
    data: {
      consumedAt: new Date()
    }
  });

  return challenge;
};

const markPrimaryClerkEmailVerified = async (input: {
  clerkUserId: string;
  email: string;
}) => {
  const clerkUser = await clerkClient.users.getUser(input.clerkUserId);
  const targetEmail =
    clerkUser.emailAddresses.find(
      (entry) => entry.emailAddress.trim().toLowerCase() === input.email.trim().toLowerCase()
    ) ??
    clerkUser.emailAddresses.find((entry) => entry.id === clerkUser.primaryEmailAddressId) ??
    null;

  if (!targetEmail) {
    throw providerFailureError("The Clerk email address could not be found for verification.");
  }

  await clerkClient.emailAddresses.updateEmailAddress(targetEmail.id, {
    verified: true,
    primary: true
  });
};

const recordCustomerLoginEvent = async (input: {
  userId?: string | null;
  email: string;
  success: boolean;
  failureReason?: string | null;
  userAgent?: string | null;
}) => {
  await prisma.loginEvent.create({
    data: {
      userId: input.userId ?? null,
      email: input.email,
      success: input.success,
      failureReason: input.failureReason ?? null,
      userAgent: input.userAgent ?? null
    }
  });
};

const createVerificationNotification = async (input: {
  userId: string;
  email: string;
  token: string;
  expiryMinutes: number;
}) =>
  enqueueNotification({
    type: "EMAIL_VERIFICATION_REQUIRED",
    recipientUserId: input.userId,
    recipientEmail: input.email,
    recipientType: "USER",
    payload: {
      verificationUrl: `${env.CUSTOMER_APP_URL}/verify-email?token=${encodeURIComponent(input.token)}`,
      expiryMinutes: input.expiryMinutes
    }
  });

const createPasswordResetNotification = async (input: {
  userId: string;
  email: string;
  token: string;
  expiryMinutes: number;
}) =>
  enqueueNotification({
    type: "PASSWORD_RESET",
    recipientUserId: input.userId,
    recipientEmail: input.email,
    recipientType: "USER",
    payload: {
      resetUrl: `${env.CUSTOMER_APP_URL}/reset-password?token=${encodeURIComponent(input.token)}`,
      expiryMinutes: input.expiryMinutes
    }
  });

export const getCurrentAuthSession = async (input: {
  actor: {
    isAuthenticated: boolean;
    kind: string;
    actorId: string | null;
    userId?: string;
    adminUserId?: string;
    clerkUserId?: string;
    email?: string;
    roles: string[];
    permissions: string[];
  };
  sessionId: string | null;
}) => {
  if (!input.actor.isAuthenticated) {
    return {
      authenticated: false,
      actor: null,
      session: null
    };
  }

  const session = input.sessionId
    ? await prisma.sessionMetadata.findUnique({
        where: {
          sessionId: input.sessionId
        }
      })
    : null;

  return {
    authenticated: true,
    actor: {
      kind: input.actor.kind,
      actorId: input.actor.actorId,
      userId: input.actor.userId ?? null,
      adminUserId: input.actor.adminUserId ?? null,
      clerkUserId: input.actor.clerkUserId ?? null,
      email: input.actor.email ?? null,
      roles: input.actor.roles,
      permissions: input.actor.permissions
    },
    session: session
      ? {
          id: session.id,
          sessionId: session.sessionId,
          sessionType: session.sessionType,
          lastActiveAt: session.lastActiveAt,
          revokedAt: session.revokedAt
        }
      : null
  };
};

export const logoutActorSession = async (input: {
  actor: {
    kind: string;
    userId?: string;
    adminUserId?: string;
  };
  sessionId: string | null;
}) => {
  if (!input.sessionId) {
    return {
      revoked: false,
      session: null
    };
  }

  const where =
    input.actor.kind === "admin"
      ? {
          sessionId: input.sessionId,
          adminUserId: input.actor.adminUserId
        }
      : {
          sessionId: input.sessionId,
          userId: input.actor.userId
        };

  const session = await prisma.sessionMetadata.findFirst({ where });

  if (!session) {
    throw notFoundError("The active session could not be found.");
  }

  const updated = await prisma.sessionMetadata.update({
    where: {
      id: session.id
    },
    data: {
      revokedAt: session.revokedAt ?? new Date()
    }
  });

  if (input.actor.kind === "customer") {
    await revokeCustomerApiSessionBySessionId(updated.sessionId);
  }

  if (input.actor.kind === "admin") {
    await revokeAdminApiSessionBySessionId(updated.sessionId);
  }

  return {
    revoked: true,
    session: {
      id: updated.id,
      sessionId: updated.sessionId,
      revokedAt: updated.revokedAt
    }
  };
};

export const registerCustomer = async (input: {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  password: string;
  marketingOptIn: boolean;
  acceptTerms: boolean;
}) => {
  if (!input.acceptTerms) {
    throw invalidInputError("You must accept the terms to register.");
  }

  const email = normalizeEmail(input.email);
  const existingUser = await prisma.user.findUnique({
    where: {
      email
    }
  });

  if (existingUser) {
    throw conflictError("Registration could not be completed with the supplied information.");
  }

  const existingClerkUser = await findClerkUserByEmail(email);
  if (existingClerkUser) {
    throw conflictError("Registration could not be completed with the supplied information.");
  }

  let clerkUser;
  try {
    clerkUser = await clerkClient.users.createUser({
      emailAddress: [email],
      ...(input.phoneNumber ? { phoneNumber: [input.phoneNumber] } : {}),
      password: input.password,
      firstName: input.firstName,
      lastName: input.lastName,
      legalAcceptedAt: new Date()
    });
  } catch (error) {
    if (!input.phoneNumber && clerkErrorContains(error, "phone_number")) {
      throw invalidInputError(
        "A phone number is required to register with the current identity configuration."
      );
    }

    if (clerkErrorContains(error, "form_password_pwned")) {
      throw invalidInputError(
        "Choose a stronger password. The supplied password has appeared in a known breach."
      );
    }

    if (clerkErrorContains(error, "unsupported_country_code")) {
      throw invalidInputError(
        "The supplied phone number country is not supported by the current identity configuration."
      );
    }

    throw providerFailureError("The customer account could not be created in Clerk.", {
      cause: error
    });
  }

  const user = await upsertCustomerUserFromClerkRecord(mapClerkSdkUserToUnknownRecord(clerkUser));

  if (!user) {
    throw serviceUnavailableError("The new customer account could not be synchronized.");
  }

  await prisma.user.update({
    where: {
      id: user.id
    },
    data: {
      status: UserStatus.PENDING_VERIFICATION
    }
  });

  await prisma.userNotificationPreference.upsert({
    where: {
      userId: user.id
    },
    update: {
      marketingEmailEnabled: input.marketingOptIn
    },
    create: {
      userId: user.id,
      marketingEmailEnabled: input.marketingOptIn
    }
  });

  const verification = await createAuthChallenge({
    userId: user.id,
    email,
    purpose: "EMAIL_VERIFICATION",
    ttlMinutes: EMAIL_VERIFICATION_TTL_MINUTES
  });

  await createVerificationNotification({
    userId: user.id,
    email,
    token: verification.token,
    expiryMinutes: verification.expiresInMinutes
  });

  return {
    user: buildAuthUser({
      ...user,
      status: UserStatus.PENDING_VERIFICATION
    }),
    requiresEmailVerification: true
  };
};

export const loginCustomer = async (input: {
  email: string;
  password: string;
  userAgent?: string | null;
}) => {
  const email = normalizeEmail(input.email);
  let user = await prisma.user.findUnique({
    where: {
      email
    }
  });

  let clerkUserId = user?.clerkUserId ?? null;

  if (!clerkUserId) {
    const clerkUser = await findClerkUserByEmail(email);
    clerkUserId = clerkUser?.id ?? null;
  }

  if (!clerkUserId) {
    await recordCustomerLoginEvent({
      email,
      success: false,
      failureReason: "UNKNOWN_EMAIL",
      userAgent: input.userAgent
    });
    throw invalidCredentialsError(CUSTOMER_LOGIN_REJECTED_MESSAGE);
  }

  try {
    await clerkClient.users.verifyPassword({
      userId: clerkUserId,
      password: input.password
    });
  } catch {
    await recordCustomerLoginEvent({
      userId: user?.id ?? null,
      email,
      success: false,
      failureReason: "INVALID_PASSWORD",
      userAgent: input.userAgent
    });
    throw invalidCredentialsError(CUSTOMER_LOGIN_REJECTED_MESSAGE);
  }

  if (!user) {
    user = await syncCustomerUserFromClerkUserId(clerkUserId);
  }

  if (!user) {
    throw serviceUnavailableError("The authenticated customer could not be synchronized.");
  }

  if (user.status === UserStatus.PENDING_VERIFICATION) {
    await recordCustomerLoginEvent({
      userId: user.id,
      email,
      success: false,
      failureReason: "EMAIL_NOT_VERIFIED",
      userAgent: input.userAgent
    });
    throw invalidCredentialsError(CUSTOMER_LOGIN_REJECTED_MESSAGE);
  }

  if (user.status === UserStatus.SUSPENDED || user.status === UserStatus.DEACTIVATED) {
    await recordCustomerLoginEvent({
      userId: user.id,
      email,
      success: false,
      failureReason: user.status,
      userAgent: input.userAgent
    });
    throw invalidCredentialsError(CUSTOMER_LOGIN_REJECTED_MESSAGE);
  }

  const session = await issueCustomerApiSession({
    userId: user.id,
    deviceLabel: input.userAgent ?? null
  });

  await recordCustomerLoginEvent({
    userId: user.id,
    email,
    success: true,
    userAgent: input.userAgent
  });

  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresInSeconds: session.accessTokenExpiresInSeconds,
    user: buildAuthUser(user),
    session: {
      sessionId: session.sessionId,
      accessTokenExpiresAt: session.accessTokenExpiresAt,
      refreshTokenExpiresAt: session.refreshTokenExpiresAt
    }
  };
};

export const refreshCustomerSession = async (input: { refreshToken: string }) => {
  const refreshed = await rotateCustomerApiSession(input.refreshToken);

  return {
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
    expiresInSeconds: refreshed.accessTokenExpiresInSeconds,
    user: buildAuthUser(refreshed.user)
  };
};

export const forgotCustomerPassword = async (input: { email: string }) => {
  const email = normalizeEmail(input.email);
  const user = await prisma.user.findUnique({
    where: {
      email
    }
  });

  if (!user) {
    return {
      submitted: true
    };
  }

  const challenge = await createAuthChallenge({
    userId: user.id,
    email: user.email,
    purpose: "PASSWORD_RESET",
    ttlMinutes: PASSWORD_RESET_TTL_MINUTES
  });

  await createPasswordResetNotification({
    userId: user.id,
    email: user.email,
    token: challenge.token,
    expiryMinutes: challenge.expiresInMinutes
  });

  return {
    submitted: true
  };
};

export const resetCustomerPassword = async (input: {
  token: string;
  newPassword: string;
}) => {
  const challenge = await consumeAuthChallenge({
    token: input.token,
    purpose: "PASSWORD_RESET"
  });

  try {
    await clerkClient.users.updateUser(challenge.user.clerkUserId, {
      password: input.newPassword,
      signOutOfOtherSessions: true
    });
  } catch (error) {
    throw providerFailureError("The password could not be reset in Clerk.", {
      cause: error
    });
  }

  await prisma.sessionMetadata.updateMany({
    where: {
      userId: challenge.user.id,
      sessionType: "customer"
    },
    data: {
      revokedAt: new Date()
    }
  });

  await revokeCustomerApiSessionsForUser({
    userId: challenge.user.id
  });

  await enqueueNotification({
    type: "PASSWORD_CHANGED",
    recipientUserId: challenge.user.id,
    recipientEmail: challenge.user.email,
    recipientType: "USER",
    payload: {
      changedAt: new Date().toISOString()
    }
  });

  return {
    reset: true
  };
};

export const resendCustomerVerification = async (input: { email: string }) => {
  const email = normalizeEmail(input.email);
  const user = await prisma.user.findUnique({
    where: {
      email
    }
  });

  if (!user || user.status === UserStatus.ACTIVE) {
    return {
      submitted: true
    };
  }

  const challenge = await createAuthChallenge({
    userId: user.id,
    email: user.email,
    purpose: "EMAIL_VERIFICATION",
    ttlMinutes: EMAIL_VERIFICATION_TTL_MINUTES
  });

  await createVerificationNotification({
    userId: user.id,
    email: user.email,
    token: challenge.token,
    expiryMinutes: challenge.expiresInMinutes
  });

  return {
    submitted: true
  };
};

export const verifyCustomerEmail = async (input: { token: string }) => {
  const challenge = await consumeAuthChallenge({
    token: input.token,
    purpose: "EMAIL_VERIFICATION"
  });

  await markPrimaryClerkEmailVerified({
    clerkUserId: challenge.user.clerkUserId,
    email: challenge.email
  });

  const synced = await syncCustomerUserFromClerkUserId(challenge.user.clerkUserId);

  if (!synced) {
    throw serviceUnavailableError("The verified customer account could not be synchronized.");
  }

  await enqueueNotification({
    type: "EMAIL_VERIFIED",
    recipientUserId: synced.id,
    recipientEmail: synced.email,
    recipientType: "USER",
    payload: {
      ctaUrl: `${env.CUSTOMER_APP_URL}/account`
    }
  });

  await enqueueNotification({
    type: "WELCOME",
    recipientUserId: synced.id,
    recipientEmail: synced.email,
    recipientType: "USER",
    payload: {
      firstName: synced.firstName,
      ctaUrl: env.CUSTOMER_APP_URL
    }
  });

  return {
    verified: true,
    user: buildAuthUser(synced)
  };
};

export const handleClerkWebhook = processClerkWebhook;
