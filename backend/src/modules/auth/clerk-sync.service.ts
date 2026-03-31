import { UserStatus } from "@prisma/client";
import type { User } from "@clerk/backend";
import { verifyWebhook } from "@clerk/backend/webhooks";
import type { Request } from "express";

import { prisma } from "../../config/prisma";
import { clerkClient } from "../../config/clerk";
import { env } from "../../config/env";
import { serviceUnavailableError } from "../../common/errors/app-error";
import { toPrismaJsonValue } from "../../common/database/prisma-json";

type UnknownRecord = Record<string, unknown>;

export const mapClerkSdkUserToUnknownRecord = (user: User): UnknownRecord => ({
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  primaryEmailAddressId: user.primaryEmailAddressId,
  primaryPhoneNumberId: user.primaryPhoneNumberId,
  emailAddresses: user.emailAddresses.map((entry) => ({
    id: entry.id,
    emailAddress: entry.emailAddress,
    email_address: entry.emailAddress,
    verification: entry.verification
      ? {
          status: entry.verification.status
        }
      : null
  })),
  phoneNumbers: user.phoneNumbers.map((entry) => ({
    id: entry.id,
    phoneNumber: entry.phoneNumber,
    phone_number: entry.phoneNumber
  }))
});

const asRecord = (value: unknown): UnknownRecord | null =>
  value && typeof value === "object" ? (value as UnknownRecord) : null;

const asArray = (value: unknown) => (Array.isArray(value) ? value : []);

const readString = (value: unknown) => (typeof value === "string" && value.trim().length > 0 ? value.trim() : null);

const readClerkField = (record: UnknownRecord, camelKey: string, snakeKey: string) =>
  record[camelKey] ?? record[snakeKey];

const readPrimaryEmail = (record: UnknownRecord) => {
  const entries = asArray(readClerkField(record, "emailAddresses", "email_addresses")).map(asRecord).filter(Boolean);
  const primaryId = readString(readClerkField(record, "primaryEmailAddressId", "primary_email_address_id"));
  const primary =
    entries.find((entry) => readString(entry?.id) === primaryId) ??
    entries.find((entry) => readString(asRecord(entry?.verification)?.status) === "verified") ??
    entries[0];

  if (!primary) {
    return {
      email: null,
      verified: false
    };
  }

  return {
    email: readString(readClerkField(primary, "emailAddress", "email_address")),
    verified: readString(asRecord(primary.verification)?.status) === "verified"
  };
};

const readPrimaryPhoneNumber = (record: UnknownRecord) => {
  const entries = asArray(readClerkField(record, "phoneNumbers", "phone_numbers")).map(asRecord).filter(Boolean);
  const primaryId = readString(readClerkField(record, "primaryPhoneNumberId", "primary_phone_number_id"));
  const primary = entries.find((entry) => readString(entry?.id) === primaryId) ?? entries[0];

  return primary ? readString(readClerkField(primary, "phoneNumber", "phone_number")) : null;
};

const resolveUserStatus = (verified: boolean, currentStatus?: UserStatus) => {
  if (
    currentStatus === UserStatus.SUSPENDED ||
    currentStatus === UserStatus.LOCKED ||
    currentStatus === UserStatus.DEACTIVATED
  ) {
    return currentStatus;
  }

  return verified ? UserStatus.ACTIVE : UserStatus.PENDING_VERIFICATION;
};

const ensureNotificationPreference = async (userId: string) => {
  await prisma.userNotificationPreference.upsert({
    where: {
      userId
    },
    update: {},
    create: {
      userId
    }
  });
};

const buildStandardRequestHeaders = (request: Request) => {
  const headers = new Headers();

  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const headerValue of value) {
        headers.append(key, headerValue);
      }
      continue;
    }

    if (typeof value === "string") {
      headers.set(key, value);
    }
  }

  return headers;
};

export const upsertCustomerUserFromClerkRecord = async (record: UnknownRecord) => {
  const clerkUserId = readString(readClerkField(record, "id", "id"));
  const { email, verified } = readPrimaryEmail(record);

  if (!clerkUserId || !email) {
    return null;
  }

  const firstName = readString(readClerkField(record, "firstName", "first_name"));
  const lastName = readString(readClerkField(record, "lastName", "last_name"));
  const phoneNumber = readPrimaryPhoneNumber(record);
  const existing = await prisma.user.findUnique({
    where: {
      clerkUserId
    }
  });

  const user = await prisma.user.upsert({
    where: {
      clerkUserId
    },
    update: {
      email,
      firstName,
      lastName,
      phoneNumber,
      status: resolveUserStatus(verified, existing?.status)
    },
    create: {
      clerkUserId,
      email,
      firstName,
      lastName,
      phoneNumber,
      status: resolveUserStatus(verified)
    }
  });

  await ensureNotificationPreference(user.id);

  await prisma.timelineEvent.create({
    data: {
      entityType: "USER",
      entityId: user.id,
      eventType: existing ? "CUSTOMER_SYNCED_FROM_CLERK" : "CUSTOMER_CREATED_FROM_CLERK",
      actorType: "SYSTEM",
      payload: toPrismaJsonValue({
        clerkUserId,
        email,
        verified
      })
    }
  });

  return user;
};

export const syncCustomerUserFromClerkUserId = async (clerkUserId: string) => {
  const user = await clerkClient.users.getUser(clerkUserId);

  return upsertCustomerUserFromClerkRecord(mapClerkSdkUserToUnknownRecord(user));
};

export const deactivateCustomerUserFromClerkUserId = async (clerkUserId: string) => {
  const user = await prisma.user.findUnique({
    where: {
      clerkUserId
    }
  });

  if (!user) {
    return null;
  }

  const updated = await prisma.user.update({
    where: {
      id: user.id
    },
    data: {
      status: UserStatus.DEACTIVATED
    }
  });

  await prisma.timelineEvent.create({
    data: {
      entityType: "USER",
      entityId: updated.id,
      eventType: "CUSTOMER_DEACTIVATED_FROM_CLERK",
      actorType: "SYSTEM",
      payload: toPrismaJsonValue({
        clerkUserId
      })
    }
  });

  return updated;
};

export const verifyClerkWebhook = async (request: Request) => {
  if (!env.CLERK_WEBHOOK_SECRET) {
    throw serviceUnavailableError("Clerk webhook handling is not configured for this environment.");
  }

  const body =
    request.rawBody?.toString("utf8") ??
    (request.body ? JSON.stringify(request.body) : "");

  return verifyWebhook(
    new Request("http://localhost/api/v1/webhooks/clerk", {
      method: request.method,
      headers: buildStandardRequestHeaders(request),
      body
    }),
    {
      signingSecret: env.CLERK_WEBHOOK_SECRET
    }
  );
};

export const processClerkWebhook = async (request: Request) => {
  const event = await verifyClerkWebhook(request);
  const payload = asRecord(event.data);

  if (!payload) {
    return {
      type: event.type,
      action: "ignored" as const,
      entity: null
    };
  }

  if (event.type === "user.created" || event.type === "user.updated") {
    const user = await upsertCustomerUserFromClerkRecord(payload);
    return {
      type: event.type,
      action: "upserted" as const,
      entity: user
    };
  }

  if (event.type === "user.deleted") {
    const clerkUserId = readString(readClerkField(payload, "id", "id"));
    const user = clerkUserId ? await deactivateCustomerUserFromClerkUserId(clerkUserId) : null;
    return {
      type: event.type,
      action: "deactivated" as const,
      entity: user
    };
  }

  return {
    type: event.type,
    action: "ignored" as const,
    entity: null
  };
};
