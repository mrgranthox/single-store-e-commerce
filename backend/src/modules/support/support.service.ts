import { Prisma, SecuritySeverity, TicketPriority, TicketStatus } from "@prisma/client";

import {
  invalidInputError,
  invalidStateTransitionError,
  notFoundError
} from "../../common/errors/app-error";
import {
  buildPagination,
  buildPaginationPayload,
  type PaginationInput
} from "../../common/http/pagination";
import { toPrismaJsonValue } from "../../common/database/prisma-json";
import { runInTransaction } from "../../common/database/prisma-transaction";
import {
  buildPrivateCloudinaryDownloadUrl,
  createSignedUploadIntent,
  resolveCloudinaryAsset
} from "../../config/cloudinary";
import { logger } from "../../config/logger";
import { prisma } from "../../config/prisma";
import { createAlert } from "../alerts-incidents/alerts-incidents.service";
import { enqueueNotification } from "../notifications/notifications.service";
import { computeTicketSla, firstResponseDueAt } from "./support-sla";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const supportSlaAlertEventType = "SUPPORT_SLA_BREACH_ALERTED";

const isUuidString = (value: string) => UUID_REGEX.test(value);

const ticketInclude = {
  user: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true
    }
  },
  order: {
    select: {
      id: true,
      orderNumber: true,
      status: true
    }
  },
  assignee: {
    select: {
      id: true,
      email: true
    }
  },
  messages: {
    orderBy: {
      createdAt: "asc" as const
    }
  },
  internalNotes: {
    orderBy: {
      createdAt: "asc" as const
    }
  },
  attachments: {
    orderBy: {
      createdAt: "asc" as const
    }
  }
} satisfies Prisma.SupportTicketInclude;

type TicketRecord = Prisma.SupportTicketGetPayload<{
  include: typeof ticketInclude;
}>;

const customerMutableStatuses = new Set<TicketStatus>([
  TicketStatus.OPEN,
  TicketStatus.IN_PROGRESS,
  TicketStatus.PENDING_CUSTOMER
]);

const serializeSupportAttachment = (attachment: TicketRecord["attachments"][number]) => ({
  id: attachment.id,
  url:
    attachment.storageProvider === "cloudinary" &&
    attachment.deliveryType === "private" &&
    attachment.publicId
      ? buildPrivateCloudinaryDownloadUrl({
          publicId: attachment.publicId,
          originalFilename: attachment.originalFilename,
          resourceType: attachment.resourceType
        }) ?? attachment.url
      : attachment.url,
  storageProvider: attachment.storageProvider,
  publicId: attachment.publicId,
  resourceType: attachment.resourceType,
  deliveryType: attachment.deliveryType,
  originalFilename: attachment.originalFilename,
  mimeType: attachment.mimeType,
  fileSizeBytes: attachment.fileSizeBytes,
  width: attachment.width,
  height: attachment.height,
  durationSeconds: attachment.durationSeconds,
  messageId: attachment.messageId,
  createdAt: attachment.createdAt
});

const serializeTicketSummary = (ticket: TicketRecord) => {
  const firstAdminReplyAt =
    ticket.messages.find((message) => message.authorType === "ADMIN")?.createdAt ?? null;
  const sla = computeTicketSla({
    createdAt: ticket.createdAt,
    priority: ticket.priority,
    status: ticket.status,
    firstAdminReplyAt
  });
  return {
    id: ticket.id,
    subject: ticket.subject,
    supportType: ticket.supportType,
    status: ticket.status,
    priority: ticket.priority,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    order: ticket.order,
    productContext: ticket.productId
      ? {
          productId: ticket.productId,
          productSlug: ticket.productSlugSnapshot,
          productTitle: ticket.productTitleSnapshot
        }
      : null,
    assignee: ticket.assignee,
    customer: ticket.user
      ? {
          id: ticket.user.id,
          email: ticket.user.email,
          name: [ticket.user.firstName, ticket.user.lastName].filter(Boolean).join(" ") || null
        }
      : {
          id: null,
          email: ticket.guestEmail,
          name: ticket.guestName
        },
    summary: ticket.messages[0]?.body.slice(0, 160) ?? null,
    lastMessageAt: ticket.messages[ticket.messages.length - 1]?.createdAt ?? ticket.createdAt,
    messageCount: ticket.messages.length,
    attachmentCount: ticket.attachments.length,
    slaDueAt: sla.slaDueAt,
    firstAdminReplyAt: sla.firstAdminReplyAt,
    slaSecondsRemaining: sla.slaSecondsRemaining,
    slaBreached: sla.slaBreached,
    slaMet: sla.slaMet
  };
};

const serializeTicketDetail = (ticket: TicketRecord, viewer: "customer" | "admin") => ({
  ...serializeTicketSummary(ticket),
  ...(viewer === "admin"
    ? {
        csatScore: ticket.csatScore,
        csatSubmittedAt: ticket.csatSubmittedAt?.toISOString() ?? null
      }
    : {}),
  messages: ticket.messages.map((message) => ({
    id: message.id,
    authorType: message.authorType,
    authorUserId: message.authorUserId,
    body: message.body,
    createdAt: message.createdAt
  })),
  internalNotes:
    viewer === "admin"
      ? ticket.internalNotes.map((note) => ({
          id: note.id,
          note: note.note,
          actorAdminUserId: note.actorAdminUserId,
          createdAt: note.createdAt
        }))
      : [],
  attachments: ticket.attachments.map((attachment) => ({
    ...serializeSupportAttachment(attachment)
  })),
  allowedActions:
    viewer === "customer"
      ? {
          canReply: ticket.status !== TicketStatus.CLOSED,
          canAddAttachment: ticket.status !== TicketStatus.CLOSED
        }
      : {
          canReply: true,
          canAssign: true,
          canUpdateStatus: true,
          canAddInternalNote: true,
          canRecordCsat: ticket.status === TicketStatus.CLOSED
        }
});

const loadCustomerTicketOrThrow = async (customerUserId: string, ticketId: string) => {
  const ticket = await prisma.supportTicket.findFirst({
    where: {
      id: ticketId,
      userId: customerUserId
    },
    include: ticketInclude
  });

  if (!ticket) {
    throw notFoundError("The requested support ticket was not found.");
  }

  return ticket;
};

const loadAdminTicketOrThrow = async (
  ticketId: string,
  db: Prisma.TransactionClient | typeof prisma = prisma
) => {
  const ticket = await db.supportTicket.findUnique({
    where: {
      id: ticketId
    },
    include: ticketInclude
  });

  if (!ticket) {
    throw notFoundError("The requested support ticket was not found.");
  }

  return ticket;
};

const resolveSupportAttachmentPayload = async (input: {
  url: string;
  storageProvider: string;
  publicId?: string;
  resourceType?: "image" | "video" | "raw";
  deliveryType?: "upload" | "private";
  originalFilename?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
}) => {
  const resolvedAsset =
    input.storageProvider === "cloudinary"
      ? await resolveCloudinaryAsset("support_attachment", {
          publicId: input.publicId!,
          resourceType: input.resourceType,
          deliveryType: input.deliveryType,
          secureUrl: input.url
        })
      : null;

  return {
    url: resolvedAsset?.url ?? input.url,
    storageProvider: input.storageProvider,
    publicId: resolvedAsset?.publicId ?? input.publicId,
    resourceType: resolvedAsset?.resourceType ?? input.resourceType,
    deliveryType: resolvedAsset?.deliveryType ?? input.deliveryType ?? "private",
    originalFilename: input.originalFilename ?? resolvedAsset?.originalFilename ?? null,
    mimeType: input.mimeType ?? resolvedAsset?.mimeType ?? null,
    fileSizeBytes: input.fileSizeBytes ?? resolvedAsset?.fileSizeBytes ?? null,
    width: input.width ?? resolvedAsset?.width ?? null,
    height: input.height ?? resolvedAsset?.height ?? null,
    durationSeconds: input.durationSeconds ?? resolvedAsset?.durationSeconds ?? null
  };
};

const recordSupportAdminMutation = async (
  transaction: Prisma.TransactionClient,
  input: {
    actorAdminUserId: string;
    actionCode: string;
    ticketId: string;
    note?: string;
    before?: unknown;
    after?: unknown;
    eventType: string;
    payload: unknown;
  }
) => {
  await Promise.all([
    transaction.auditLog.create({
      data: {
        actorType: "ADMIN",
        actorAdminUserId: input.actorAdminUserId,
        actionCode: input.actionCode,
        entityType: "SUPPORT_TICKET",
        entityId: input.ticketId,
        note: input.note,
        metadata: toPrismaJsonValue(input.payload)
      }
    }),
    transaction.adminActionLog.create({
      data: {
        adminUserId: input.actorAdminUserId,
        screen: "support.tickets",
        actionCode: input.actionCode,
        note: input.note,
        entityType: "SUPPORT_TICKET",
        entityId: input.ticketId,
        before: toPrismaJsonValue(input.before),
        after: toPrismaJsonValue(input.after)
      }
    }),
    transaction.timelineEvent.create({
      data: {
        entityType: "SUPPORT_TICKET",
        entityId: input.ticketId,
        eventType: input.eventType,
        actorAdminUserId: input.actorAdminUserId,
        actorType: "ADMIN",
        payload: toPrismaJsonValue(input.payload)
      }
    })
  ]);
};

export const listCustomerTickets = async (
  customerUserId: string,
  input: PaginationInput
) => {
  const where: Prisma.SupportTicketWhereInput = {
    userId: customerUserId
  };

  const [items, totalItems] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      include: ticketInclude,
      orderBy: {
        updatedAt: "desc"
      },
      ...buildPagination(input)
    }),
    prisma.supportTicket.count({ where })
  ]);

  return {
    items: items.map(serializeTicketSummary),
    pagination: buildPaginationPayload(input, totalItems)
  };
};

export const createCustomerTicket = async (
  customerUserId: string,
  input: {
    orderId?: string;
    priority: TicketPriority;
    message: string;
  }
) =>
  runInTransaction(async (transaction) => {
    if (input.orderId) {
      const order = await transaction.order.findFirst({
        where: {
          id: input.orderId,
          userId: customerUserId
        }
      });

      if (!order) {
        throw notFoundError("The linked order was not found.");
      }
    }

    const ticket = await transaction.supportTicket.create({
      data: {
        userId: customerUserId,
        orderId: input.orderId,
        priority: input.priority,
        messages: {
          create: {
            authorType: "CUSTOMER",
            authorUserId: customerUserId,
            body: input.message
          }
        }
      },
      include: ticketInclude
    });

    return {
      entity: serializeTicketDetail(ticket, "customer")
    };
  });

const buildPublicTicketMessage = (input: {
  message: string;
}) => {
  return input.message.trim();
};

export const createPublicSupportTicket = async (input: {
  userId?: string | null;
  guestEmail?: string | null;
  guestName?: string | null;
  priority?: TicketPriority;
  subject?: string;
  message: string;
  attachments?: Array<{
    url: string;
    storageProvider: string;
    publicId?: string;
    resourceType?: "image" | "video" | "raw";
    deliveryType?: "upload" | "private";
    originalFilename?: string;
    mimeType?: string;
    fileSizeBytes?: number;
    width?: number;
    height?: number;
    durationSeconds?: number;
  }>;
  productContext?: {
    productId: string;
    productSlug: string;
    productTitle: string;
  };
}) => {
  if (!input.userId && !input.guestEmail) {
    throw invalidInputError("An email address is required for public support requests.");
  }

  const result = await runInTransaction(async (transaction) => {
    const resolvedAttachments = await Promise.all(
      (input.attachments ?? []).map((attachment) => resolveSupportAttachmentPayload(attachment))
    );

    const ticket = await transaction.supportTicket.create({
      data: {
        userId: input.userId ?? null,
        guestEmail: input.userId ? null : input.guestEmail ?? null,
        guestName: input.userId ? null : input.guestName ?? null,
        subject: input.subject ?? null,
        supportType: input.productContext ? "PRODUCT_INQUIRY" : "CONTACT_REQUEST",
        productId: input.productContext?.productId ?? null,
        productSlugSnapshot: input.productContext?.productSlug ?? null,
        productTitleSnapshot: input.productContext?.productTitle ?? null,
        priority: input.priority ?? TicketPriority.MEDIUM,
        messages: {
          create: {
            authorType: "CUSTOMER",
            authorUserId: input.userId ?? null,
            body: buildPublicTicketMessage({
              message: input.message
            })
          }
        },
        attachments: resolvedAttachments.length
          ? {
              create: resolvedAttachments
            }
          : undefined
      },
      include: ticketInclude
    });

    return {
      entity: serializeTicketDetail(ticket, "customer")
    };
  });

  const recipientUserId = input.userId ?? null;
  const recipientEmail = recipientUserId ? null : input.guestEmail ?? null;

  if (recipientUserId || recipientEmail) {
    void enqueueNotification({
      type: "SUPPORT_TICKET_CREATED",
      recipientUserId,
      recipientEmail,
      recipientType: recipientUserId ? "USER" : "GUEST",
      payload: {
        ticketId: result.entity.id,
        message: input.subject ?? input.message.slice(0, 160)
      }
    }).catch((error) => {
      logger.warn(
        {
          ticketId: result.entity.id,
          error
        },
        "Failed to enqueue support ticket created notification."
      );
    });
  }

  return result;
};

export const createPublicSupportAttachmentUploadIntent = async (input: {
  actorId?: string | null;
  fileName: string;
  contentType: string;
  fileSizeBytes?: number;
  resourceType?: "image" | "video" | "raw";
}) => ({
  entity: createSignedUploadIntent({
    scope: "support_attachment",
    actorId: input.actorId,
    fileName: input.fileName,
    contentType: input.contentType,
    fileSizeBytes: input.fileSizeBytes,
    requestedResourceType: input.resourceType
  })
});

export const getCustomerTicketDetail = async (customerUserId: string, ticketId: string) => {
  const ticket = await loadCustomerTicketOrThrow(customerUserId, ticketId);
  return {
    entity: serializeTicketDetail(ticket, "customer")
  };
};

export const createCustomerTicketMessage = async (
  customerUserId: string,
  input: {
    ticketId: string;
    body: string;
  }
) => {
  const ticket = await loadCustomerTicketOrThrow(customerUserId, input.ticketId);

  if (!customerMutableStatuses.has(ticket.status)) {
    throw invalidStateTransitionError("This support ticket can no longer be updated.");
  }

  await prisma.supportMessage.create({
    data: {
      ticketId: ticket.id,
      authorType: "CUSTOMER",
      authorUserId: customerUserId,
      body: input.body
    }
  });

  await prisma.supportTicket.update({
    where: {
      id: ticket.id
    },
    data: {
      status: TicketStatus.OPEN
    }
  });

  const updated = await loadCustomerTicketOrThrow(customerUserId, ticket.id);

  return {
    entity: serializeTicketDetail(updated, "customer")
  };
};

export const createCustomerTicketAttachment = async (
  customerUserId: string,
  input: {
    ticketId: string;
    url: string;
    storageProvider: string;
    publicId?: string;
    resourceType?: "image" | "video" | "raw";
    deliveryType?: "upload" | "private";
    originalFilename?: string;
    mimeType?: string;
    fileSizeBytes?: number;
    width?: number;
    height?: number;
    durationSeconds?: number;
    messageId?: string;
  }
) => {
  const ticket = await loadCustomerTicketOrThrow(customerUserId, input.ticketId);

  if (ticket.status === TicketStatus.CLOSED) {
    throw invalidStateTransitionError("Closed tickets cannot receive new attachments.");
  }

  if (input.messageId && !ticket.messages.some((message) => message.id === input.messageId)) {
    throw invalidInputError("The attachment messageId does not belong to this ticket.");
  }

  const attachment = await resolveSupportAttachmentPayload(input);

  await prisma.supportAttachment.create({
    data: {
      ticketId: ticket.id,
      ...attachment,
      messageId: input.messageId
    }
  });

  const updated = await loadCustomerTicketOrThrow(customerUserId, ticket.id);

  return {
    entity: serializeTicketDetail(updated, "customer")
  };
};

export const createCustomerTicketAttachmentUploadIntent = async (
  customerUserId: string,
  input: {
    ticketId: string;
    fileName: string;
    contentType: string;
    fileSizeBytes?: number;
    resourceType?: "image" | "video" | "raw";
  }
) => {
  const ticket = await loadCustomerTicketOrThrow(customerUserId, input.ticketId);

  if (ticket.status === TicketStatus.CLOSED) {
    throw invalidStateTransitionError("Closed tickets cannot receive new attachments.");
  }

  return {
    entity: createSignedUploadIntent({
      scope: "support_attachment",
      entityId: ticket.id,
      actorId: customerUserId,
      fileName: input.fileName,
      contentType: input.contentType,
      fileSizeBytes: input.fileSizeBytes,
      requestedResourceType: input.resourceType
    })
  };
};

export const listAdminTickets = async (input: {
  page: number;
  page_size: number;
  status?: TicketStatus;
  priority?: TicketPriority;
  q?: string;
  supportType?: string;
  assignment?: "any" | "unassigned" | "me";
  viewerAdminUserId?: string;
}) => {
  const where: Prisma.SupportTicketWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.priority ? { priority: input.priority } : {}),
    ...(input.supportType ? { supportType: input.supportType } : {}),
    ...(input.assignment === "unassigned" ? { assignedToAdminUserId: null } : {}),
    ...(input.assignment === "me" && input.viewerAdminUserId
      ? { assignedToAdminUserId: input.viewerAdminUserId }
      : {}),
    ...(input.q
      ? {
          OR: [
            {
              user: {
                is: {
                  email: {
                    contains: input.q,
                    mode: "insensitive"
                  }
                }
              }
            },
            {
              guestEmail: {
                contains: input.q,
                mode: "insensitive"
              }
            },
            {
              order: {
                is: {
                  orderNumber: {
                    contains: input.q,
                    mode: "insensitive"
                  }
                }
              }
            },
            {
              subject: {
                contains: input.q,
                mode: "insensitive"
              }
            },
            ...(isUuidString(input.q) ? [{ id: input.q }] : [])
          ]
        }
      : {})
  };

  const [items, totalItems] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      include: ticketInclude,
      orderBy: {
        updatedAt: "desc"
      },
      ...buildPagination(input)
    }),
    prisma.supportTicket.count({ where })
  ]);

  return {
    items: items.map(serializeTicketSummary),
    pagination: buildPaginationPayload(input, totalItems)
  };
};

export const getAdminTicketDetail = async (ticketId: string) => {
  const ticket = await loadAdminTicketOrThrow(ticketId);
  return {
    entity: serializeTicketDetail(ticket, "admin")
  };
};

export const assignAdminTicket = async (input: {
  actorAdminUserId: string;
  ticketId: string;
  assignedToAdminUserId: string | null;
  note?: string;
}) =>
  runInTransaction(async (transaction) => {
    const ticket = await loadAdminTicketOrThrow(input.ticketId, transaction);

    if (input.assignedToAdminUserId) {
      const assignee = await transaction.adminUser.findUnique({
        where: {
          id: input.assignedToAdminUserId
        }
      });

      if (!assignee) {
        throw notFoundError("The assignee admin user was not found.");
      }
    }

    await transaction.supportTicket.update({
      where: {
        id: ticket.id
      },
      data: {
        assignedToAdminUserId: input.assignedToAdminUserId
      }
    });

    await recordSupportAdminMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "support.assign",
      ticketId: ticket.id,
      note: input.note,
      before: {
        assignedToAdminUserId: ticket.assignedToAdminUserId
      },
      after: {
        assignedToAdminUserId: input.assignedToAdminUserId
      },
      eventType: "SUPPORT_TICKET_ASSIGNED",
      payload: {
        assignedToAdminUserId: input.assignedToAdminUserId,
        note: input.note
      }
    });

    const updated = await loadAdminTicketOrThrow(ticket.id, transaction);

    return {
      entity: serializeTicketDetail(updated, "admin")
    };
  });

export const updateAdminTicketStatus = async (input: {
  actorAdminUserId: string;
  ticketId: string;
  status: TicketStatus;
  note?: string;
}) =>
  runInTransaction(async (transaction) => {
    const ticket = await loadAdminTicketOrThrow(input.ticketId, transaction);

    if (ticket.status === input.status) {
      throw invalidStateTransitionError("The ticket is already in the requested status.");
    }

    await transaction.supportTicket.update({
      where: {
        id: ticket.id
      },
      data: {
        status: input.status
      }
    });

    await recordSupportAdminMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "support.status.update",
      ticketId: ticket.id,
      note: input.note,
      before: {
        status: ticket.status
      },
      after: {
        status: input.status
      },
      eventType: "SUPPORT_TICKET_STATUS_UPDATED",
      payload: {
        fromStatus: ticket.status,
        toStatus: input.status,
        note: input.note
      }
    });

    const updated = await loadAdminTicketOrThrow(ticket.id, transaction);

    return {
      entity: serializeTicketDetail(updated, "admin")
    };
  });

export const recordAdminTicketCsat = async (input: {
  actorAdminUserId: string;
  ticketId: string;
  csatScore: number;
  note?: string;
}) =>
  runInTransaction(async (transaction) => {
    const ticket = await loadAdminTicketOrThrow(input.ticketId, transaction);

    if (ticket.status !== TicketStatus.CLOSED) {
      throw invalidStateTransitionError("CSAT can only be recorded after the ticket is closed.");
    }

    const submittedAt = new Date();
    const beforeCsat = {
      csatScore: ticket.csatScore,
      csatSubmittedAt: ticket.csatSubmittedAt?.toISOString() ?? null
    };

    await transaction.supportTicket.update({
      where: {
        id: ticket.id
      },
      data: {
        csatScore: input.csatScore,
        csatSubmittedAt: submittedAt
      }
    });

    await recordSupportAdminMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "support.csat.record",
      ticketId: ticket.id,
      note: input.note,
      before: beforeCsat,
      after: {
        csatScore: input.csatScore,
        csatSubmittedAt: submittedAt.toISOString()
      },
      eventType: "SUPPORT_TICKET_CSAT_RECORDED",
      payload: {
        csatScore: input.csatScore,
        note: input.note
      }
    });

    const updated = await loadAdminTicketOrThrow(ticket.id, transaction);

    return {
      entity: serializeTicketDetail(updated, "admin")
    };
  });

export const bulkAssignSupportTickets = async (input: {
  actorAdminUserId: string;
  ticketIds: string[];
  assignedToAdminUserId: string | null;
}) => {
  const results = { updated: 0, skipped: 0, failed: 0 };
  for (const ticketId of input.ticketIds) {
    try {
      const ticket = await prisma.supportTicket.findUnique({
        where: {
          id: ticketId
        }
      });
      if (!ticket) {
        results.failed += 1;
        continue;
      }
      if (ticket.assignedToAdminUserId === input.assignedToAdminUserId) {
        results.skipped += 1;
        continue;
      }
      await assignAdminTicket({
        actorAdminUserId: input.actorAdminUserId,
        ticketId,
        assignedToAdminUserId: input.assignedToAdminUserId
      });
      results.updated += 1;
    } catch {
      results.failed += 1;
    }
  }

  return results;
};

export const bulkUpdateSupportTicketStatus = async (input: {
  actorAdminUserId: string;
  ticketIds: string[];
  status: TicketStatus;
  note?: string;
}) => {
  const results = { updated: 0, skipped: 0, failed: 0 };
  for (const ticketId of input.ticketIds) {
    try {
      const ticket = await prisma.supportTicket.findUnique({
        where: {
          id: ticketId
        }
      });
      if (!ticket) {
        results.failed += 1;
        continue;
      }
      if (ticket.status === input.status) {
        results.skipped += 1;
        continue;
      }
      await updateAdminTicketStatus({
        actorAdminUserId: input.actorAdminUserId,
        ticketId,
        status: input.status,
        note: input.note
      });
      results.updated += 1;
    } catch {
      results.failed += 1;
    }
  }

  return results;
};

export const createAdminTicketMessage = async (input: {
  actorAdminUserId: string;
  ticketId: string;
  body: string;
}) =>
  runInTransaction(async (transaction) => {
    const ticket = await loadAdminTicketOrThrow(input.ticketId, transaction);
    const beforeStatus = ticket.status;

    const createdMessage = await transaction.supportMessage.create({
      data: {
        ticketId: ticket.id,
        authorType: "ADMIN",
        authorUserId: input.actorAdminUserId,
        body: input.body
      }
    });

    await transaction.supportTicket.update({
      where: {
        id: ticket.id
      },
      data: {
        status: TicketStatus.PENDING_CUSTOMER
      }
    });

    await recordSupportAdminMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "support.message.create",
      ticketId: ticket.id,
      note: input.body,
      before: {
        status: beforeStatus
      },
      after: {
        status: TicketStatus.PENDING_CUSTOMER,
        messageId: createdMessage.id
      },
      eventType: "SUPPORT_TICKET_ADMIN_REPLIED",
      payload: {
        messageId: createdMessage.id,
        previousStatus: beforeStatus,
        nextStatus: TicketStatus.PENDING_CUSTOMER
      }
    });

    const updated = await loadAdminTicketOrThrow(ticket.id, transaction);

    return {
      entity: serializeTicketDetail(updated, "admin")
    };
  }).then((result) => {
    const updated = result.entity;

    const recipientUserId = updated.customer?.id ?? null;
    const recipientEmail = updated.customer?.email ?? null;

    if (recipientUserId || recipientEmail) {
      void enqueueNotification({
        type: "SUPPORT_REPLY",
        recipientUserId,
        recipientEmail,
        recipientType: recipientUserId ? "USER" : "GUEST",
        payload: {
          ticketId: updated.id,
          orderId: updated.order?.id ?? null,
          orderNumber: updated.order?.orderNumber ?? null,
          status: updated.status
        }
      }).catch((error) => {
        logger.warn(
          {
            ticketId: updated.id,
            error
          },
          "Failed to enqueue support reply notification."
        );
      });
    }

    return result;
  });

export const createAdminInternalNote = async (input: {
  actorAdminUserId: string;
  ticketId: string;
  note: string;
}) =>
  runInTransaction(async (transaction) => {
    const ticket = await loadAdminTicketOrThrow(input.ticketId, transaction);

    const createdNote = await transaction.supportInternalNote.create({
      data: {
        ticketId: ticket.id,
        actorAdminUserId: input.actorAdminUserId,
        note: input.note
      }
    });

    await recordSupportAdminMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "support.note.create",
      ticketId: ticket.id,
      note: input.note,
      after: {
        internalNoteId: createdNote.id
      },
      eventType: "SUPPORT_TICKET_INTERNAL_NOTE_CREATED",
      payload: {
        internalNoteId: createdNote.id
      }
    });

    const updated = await loadAdminTicketOrThrow(ticket.id, transaction);

    return {
      entity: serializeTicketDetail(updated, "admin")
    };
  });

export const getSupportQueueSla = async () => {
  const openWhere = {
    status: {
      in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS]
    }
  };

  const [tickets, openCount] = await Promise.all([
    prisma.supportTicket.findMany({
      where: openWhere,
      include: ticketInclude,
      take: 4000
    }),
    prisma.supportTicket.count({ where: openWhere })
  ]);

  const serialized = tickets.map(serializeTicketSummary);
  const attention = serialized.filter((t) => {
    if (t.firstAdminReplyAt) {
      return false;
    }
    if (t.slaBreached) {
      return true;
    }
    if (t.slaSecondsRemaining != null && t.slaSecondsRemaining > 0 && t.slaSecondsRemaining <= 3600) {
      return true;
    }
    return false;
  });
  attention.sort((a, b) => {
    const ar = a.slaSecondsRemaining ?? Number.POSITIVE_INFINITY;
    const br = b.slaSecondsRemaining ?? Number.POSITIVE_INFINITY;
    return ar - br;
  });

  const overdueCount = attention.filter((t) => t.slaBreached).length;
  const atRiskCount = attention.length - overdueCount;

  return {
    metrics: {
      openCount,
      overdueCount,
      atRiskCount
    },
    items: attention
  };
};

const severityForTicketPriority = (priority: TicketPriority) => {
  switch (priority) {
    case TicketPriority.URGENT:
      return SecuritySeverity.HIGH;
    case TicketPriority.HIGH:
      return SecuritySeverity.MEDIUM;
    default:
      return SecuritySeverity.LOW;
  }
};

export const processSupportSlaSweepJob = async () => {
  const tickets = await prisma.supportTicket.findMany({
    where: {
      status: {
        in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS]
      }
    },
    select: {
      id: true,
      orderId: true,
      priority: true,
      status: true,
      createdAt: true,
      messages: {
        where: {
          authorType: "ADMIN"
        },
        orderBy: {
          createdAt: "asc"
        },
        take: 1,
        select: {
          createdAt: true
        }
      }
    }
  });

  const breachedTickets = tickets.filter((ticket) =>
    computeTicketSla({
      createdAt: ticket.createdAt,
      priority: ticket.priority,
      status: ticket.status,
      firstAdminReplyAt: ticket.messages[0]?.createdAt ?? null
    }).slaBreached
  );

  if (breachedTickets.length === 0) {
    return {
      scanned: tickets.length,
      breached: 0,
      alerted: 0,
      alreadyAlerted: 0
    };
  }

  const priorAlerts = await prisma.timelineEvent.findMany({
    where: {
      entityType: "SUPPORT_TICKET",
      eventType: supportSlaAlertEventType,
      entityId: {
        in: breachedTickets.map((ticket) => ticket.id)
      }
    },
    select: {
      entityId: true
    }
  });

  const alertedTicketIds = new Set(priorAlerts.map((event) => event.entityId));
  let alerted = 0;

  for (const ticket of breachedTickets) {
    if (alertedTicketIds.has(ticket.id)) {
      continue;
    }

    const sla = computeTicketSla({
      createdAt: ticket.createdAt,
      priority: ticket.priority,
      status: ticket.status,
      firstAdminReplyAt: ticket.messages[0]?.createdAt ?? null
    });

    const alert = await createAlert({
      type: "SUPPORT_SLA_BREACH",
      severity: severityForTicketPriority(ticket.priority),
      relatedOrderId: ticket.orderId ?? undefined,
      metadata: {
        ticketId: ticket.id,
        priority: ticket.priority,
        slaDueAt: sla.slaDueAt,
        slaSecondsRemaining: sla.slaSecondsRemaining
      }
    });

    await prisma.timelineEvent.create({
      data: {
        entityType: "SUPPORT_TICKET",
        entityId: ticket.id,
        eventType: supportSlaAlertEventType,
        actorType: "SYSTEM",
        payload: toPrismaJsonValue({
          alertId: alert.id,
          priority: ticket.priority,
          slaDueAt: sla.slaDueAt
        })
      }
    });

    alerted += 1;
  }

  return {
    scanned: tickets.length,
    breached: breachedTickets.length,
    alerted,
    alreadyAlerted: breachedTickets.length - alerted
  };
};

type SupportQueueQueryInput = PaginationInput & {
  status?: TicketStatus;
  priority?: TicketPriority;
  q?: string;
  supportType?: string;
  assignment?: "any" | "unassigned" | "me";
  viewerAdminUserId?: string;
};

const ticketSearchOrClause = (q: string): Prisma.SupportTicketWhereInput["OR"] => [
  {
    user: {
      is: {
        email: {
          contains: q,
          mode: "insensitive"
        }
      }
    }
  },
  {
    guestEmail: {
      contains: q,
      mode: "insensitive"
    }
  },
  {
    order: {
      is: {
        orderNumber: {
          contains: q,
          mode: "insensitive"
        }
      }
    }
  },
  {
    subject: {
      contains: q,
      mode: "insensitive"
    }
  },
  ...(isUuidString(q) ? [{ id: q }] : [])
];

export const getSupportPrePurchaseQueue = async (input: SupportQueueQueryInput) => {
  const where: Prisma.SupportTicketWhereInput = {
    orderId: null,
    ...(input.status
      ? { status: input.status }
      : {
          status: {
            not: TicketStatus.CLOSED
          }
        }),
    ...(input.priority ? { priority: input.priority } : {}),
    ...(input.supportType ? { supportType: input.supportType } : {}),
    ...(input.assignment === "unassigned" ? { assignedToAdminUserId: null } : {}),
    ...(input.assignment === "me" && input.viewerAdminUserId
      ? { assignedToAdminUserId: input.viewerAdminUserId }
      : {}),
    ...(input.q
      ? {
          OR: ticketSearchOrClause(input.q)
        }
      : {})
  };

  const [items, totalItems] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      include: ticketInclude,
      orderBy: {
        updatedAt: "desc"
      },
      ...buildPagination(input)
    }),
    prisma.supportTicket.count({ where })
  ]);

  return {
    items: items.map(serializeTicketSummary),
    pagination: buildPaginationPayload(input, totalItems)
  };
};

export const getSupportComplaintsQueue = async (input: SupportQueueQueryInput) => {
  const where: Prisma.SupportTicketWhereInput = {
    orderId: {
      not: null
    },
    ...(input.priority
      ? { priority: input.priority }
      : { priority: { in: [TicketPriority.HIGH, TicketPriority.URGENT] } }),
    ...(input.status
      ? { status: input.status }
      : { status: { not: TicketStatus.CLOSED } }),
    ...(input.supportType ? { supportType: input.supportType } : {}),
    ...(input.assignment === "unassigned" ? { assignedToAdminUserId: null } : {}),
    ...(input.assignment === "me" && input.viewerAdminUserId
      ? { assignedToAdminUserId: input.viewerAdminUserId }
      : {}),
    ...(input.q
      ? {
          OR: ticketSearchOrClause(input.q)
        }
      : {})
  };

  const [items, totalItems] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      include: ticketInclude,
      orderBy: {
        updatedAt: "desc"
      },
      ...buildPagination(input)
    }),
    prisma.supportTicket.count({ where })
  ]);

  return {
    items: items.map(serializeTicketSummary),
    pagination: buildPaginationPayload(input, totalItems)
  };
};

export const getSupportReports = async (input: { period: "daily" | "weekly" | "monthly" }) => {
  const periodMs =
    input.period === "daily" ? 86400000 : input.period === "weekly" ? 7 * 86400000 : 30 * 86400000;
  const windowStart = new Date(Date.now() - periodMs);

  const [
    totalsByStatus,
    totalsByPriority,
    openCount,
    closedInWindow,
    touchTickets,
    preOpenTickets,
    preClosedRecent,
    compOpen,
    compRiskTickets,
    compResolvedInWindow
  ] = await Promise.all([
    prisma.supportTicket.groupBy({
      by: ["status"],
      _count: {
        _all: true
      }
    }),
    prisma.supportTicket.groupBy({
      by: ["priority"],
      _count: {
        _all: true
      }
    }),
    prisma.supportTicket.count({
      where: {
        status: {
          not: TicketStatus.CLOSED
        }
      }
    }),
    prisma.supportTicket.findMany({
      where: {
        status: TicketStatus.CLOSED,
        updatedAt: {
          gte: windowStart
        }
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        assignedToAdminUserId: true,
        assignee: {
          select: {
            id: true,
            email: true
          }
        }
      }
    }),
    prisma.supportTicket.findMany({
      where: {
        OR: [{ createdAt: { gte: windowStart } }, { updatedAt: { gte: windowStart } }]
      },
      select: {
        id: true,
        createdAt: true,
        priority: true,
        messages: {
          orderBy: {
            createdAt: "asc"
          },
          select: {
            authorType: true,
            createdAt: true
          }
        }
      },
      take: 1500,
      orderBy: {
        updatedAt: "desc"
      }
    }),
    prisma.supportTicket.findMany({
      where: {
        orderId: null,
        status: {
          not: TicketStatus.CLOSED
        }
      },
      include: ticketInclude,
      take: 500,
      orderBy: {
        updatedAt: "desc"
      }
    }),
    prisma.supportTicket.findMany({
      where: {
        orderId: null,
        status: TicketStatus.CLOSED,
        updatedAt: {
          gte: windowStart
        }
      },
      include: {
        messages: {
          orderBy: {
            createdAt: "asc"
          },
          select: {
            authorType: true,
            createdAt: true
          }
        }
      },
      take: 400
    }),
    prisma.supportTicket.count({
      where: {
        orderId: {
          not: null
        },
        priority: {
          in: [TicketPriority.HIGH, TicketPriority.URGENT]
        },
        status: {
          not: TicketStatus.CLOSED
        }
      }
    }),
    prisma.supportTicket.findMany({
      where: {
        orderId: {
          not: null
        },
        priority: {
          in: [TicketPriority.HIGH, TicketPriority.URGENT]
        },
        status: {
          not: TicketStatus.CLOSED
        }
      },
      include: ticketInclude,
      take: 400,
      orderBy: {
        updatedAt: "desc"
      }
    }),
    prisma.supportTicket.count({
      where: {
        orderId: {
          not: null
        },
        priority: {
          in: [TicketPriority.HIGH, TicketPriority.URGENT]
        },
        status: TicketStatus.CLOSED,
        updatedAt: {
          gte: windowStart
        }
      }
    })
  ]);

  const avgResolutionMinutes =
    closedInWindow.length > 0
      ? closedInWindow.reduce(
          (acc, row) => acc + (row.updatedAt.getTime() - row.createdAt.getTime()) / 60000,
          0
        ) / closedInWindow.length
      : null;

  let firstResponseSumMin = 0;
  let firstResponseCount = 0;
  let slaHits = 0;
  let slaTracked = 0;
  for (const ticket of touchTickets) {
    const firstCustomer = ticket.messages.find((message) => message.authorType === "CUSTOMER");
    const firstAdmin = ticket.messages.find((message) => message.authorType === "ADMIN");
    const openAt = firstCustomer?.createdAt ?? ticket.createdAt;
    if (firstAdmin) {
      firstResponseSumMin += (firstAdmin.createdAt.getTime() - openAt.getTime()) / 60000;
      firstResponseCount += 1;
      const due = firstResponseDueAt(ticket.createdAt, ticket.priority);
      slaTracked += 1;
      if (firstAdmin.createdAt.getTime() <= due.getTime()) {
        slaHits += 1;
      }
    }
  }

  const avgFirstResponseMinutes = firstResponseCount > 0 ? firstResponseSumMin / firstResponseCount : null;
  const slaFirstResponseCompliancePercent =
    slaTracked > 0 ? Math.round((slaHits / slaTracked) * 1000) / 10 : null;

  const agentMap = new Map<string, { email: string | null; resolved: number; resolutionMinutesSum: number }>();
  for (const row of closedInWindow) {
    const adminId = row.assignee?.id ?? row.assignedToAdminUserId;
    if (!adminId) {
      continue;
    }
    const email = row.assignee?.email ?? null;
    const prev = agentMap.get(adminId) ?? {
      email,
      resolved: 0,
      resolutionMinutesSum: 0
    };
    prev.resolved += 1;
    prev.resolutionMinutesSum += (row.updatedAt.getTime() - row.createdAt.getTime()) / 60000;
    if (!prev.email && email) {
      prev.email = email;
    }
    agentMap.set(adminId, prev);
  }

  const agentLeaderboard = [...agentMap.entries()]
    .map(([adminUserId, stats]) => ({
      adminUserId,
      email: stats.email,
      resolved: stats.resolved,
      avgResolutionMinutes:
        stats.resolved > 0 ? Math.round((stats.resolutionMinutesSum / stats.resolved) * 10) / 10 : null
    }))
    .sort((a, b) => b.resolved - a.resolved)
    .slice(0, 15);

  let preSlaAtRisk = 0;
  for (const ticket of preOpenTickets) {
    const firstAdminReplyAt =
      ticket.messages.find((message) => message.authorType === "ADMIN")?.createdAt ?? null;
    const sla = computeTicketSla({
      createdAt: ticket.createdAt,
      priority: ticket.priority,
      status: ticket.status,
      firstAdminReplyAt
    });
    if (sla.slaBreached) {
      preSlaAtRisk += 1;
    }
  }

  let preAvgSum = 0;
  let preAvgN = 0;
  for (const ticket of preClosedRecent) {
    const customer = ticket.messages.find((message) => message.authorType === "CUSTOMER");
    const admin = ticket.messages.find((message) => message.authorType === "ADMIN");
    if (customer && admin) {
      preAvgSum += (admin.createdAt.getTime() - customer.createdAt.getTime()) / 60000;
      preAvgN += 1;
    }
  }

  const [preActiveCount, preGuestCount] = await Promise.all([
    prisma.supportTicket.count({
      where: {
        orderId: null,
        status: {
          not: TicketStatus.CLOSED
        }
      }
    }),
    prisma.supportTicket.count({
      where: {
        orderId: null,
        status: {
          not: TicketStatus.CLOSED
        },
        userId: null
      }
    })
  ]);

  let compSlaAtRisk = 0;
  for (const ticket of compRiskTickets) {
    const firstAdminReplyAt =
      ticket.messages.find((message) => message.authorType === "ADMIN")?.createdAt ?? null;
    const sla = computeTicketSla({
      createdAt: ticket.createdAt,
      priority: ticket.priority,
      status: ticket.status,
      firstAdminReplyAt
    });
    if (sla.slaBreached) {
      compSlaAtRisk += 1;
    }
  }

  const complaintsDenominator = compOpen + compResolvedInWindow;
  const complaintsResolutionRatePercent =
    complaintsDenominator > 0
      ? Math.round((compResolvedInWindow / complaintsDenominator) * 1000) / 10
      : null;

  const openSlaScan = await prisma.supportTicket.findMany({
    where: {
      status: {
        not: TicketStatus.CLOSED
      }
    },
    select: {
      createdAt: true,
      priority: true,
      status: true,
      messages: {
        where: {
          authorType: "ADMIN"
        },
        take: 1,
        orderBy: {
          createdAt: "asc"
        },
        select: {
          createdAt: true
        }
      }
    },
    take: 5000
  });

  let openSlaBreachedCount = 0;
  for (const row of openSlaScan) {
    const firstAdminReplyAt = row.messages[0]?.createdAt ?? null;
    const sla = computeTicketSla({
      createdAt: row.createdAt,
      priority: row.priority,
      status: row.status,
      firstAdminReplyAt
    });
    if (sla.slaBreached) {
      openSlaBreachedCount += 1;
    }
  }

  const totalTicketsAll = totalsByStatus.reduce((acc, row) => acc + row._count._all, 0);
  const closedTotal = totalsByStatus.find((row) => row.status === TicketStatus.CLOSED)?._count._all ?? 0;
  const resolutionRatePercent =
    totalTicketsAll > 0 ? Math.round((closedTotal / totalTicketsAll) * 1000) / 10 : null;

  return {
    period: input.period,
    window: {
      start: windowStart.toISOString(),
      end: new Date().toISOString()
    },
    openCount,
    openSlaBreachedCount,
    openSlaSampleCapped: openSlaScan.length >= 5000,
    byStatus: totalsByStatus.map((entry) => ({
      status: entry.status,
      count: entry._count._all
    })),
    byPriority: totalsByPriority.map((entry) => ({
      priority: entry.priority,
      count: entry._count._all
    })),
    averages: {
      firstResponseMinutes: avgFirstResponseMinutes,
      resolutionMinutes: avgResolutionMinutes
    },
    sla: {
      firstResponseCompliancePercent: slaFirstResponseCompliancePercent,
      byPriority: (Object.values(TicketPriority) as TicketPriority[]).map((priority) => {
        let hit = 0;
        let tracked = 0;
        for (const ticket of touchTickets) {
          if (ticket.priority !== priority) {
            continue;
          }
          const firstAdmin = ticket.messages.find((message) => message.authorType === "ADMIN");
          if (!firstAdmin) {
            continue;
          }
          tracked += 1;
          const due = firstResponseDueAt(ticket.createdAt, ticket.priority);
          if (firstAdmin.createdAt.getTime() <= due.getTime()) {
            hit += 1;
          }
        }
        return {
          priority,
          compliancePercent: tracked > 0 ? Math.round((hit / tracked) * 1000) / 10 : null,
          sampleSize: tracked
        };
      })
    },
    csat: {
      score: null as number | null,
      note: "Customer satisfaction scores are not stored on support tickets yet."
    },
    agentLeaderboard,
    prePurchase: {
      activeCount: preActiveCount,
      guestCount: preGuestCount,
      avgFirstResponseMinutes: preAvgN > 0 ? preAvgSum / preAvgN : null,
      slaAtRiskCount: preSlaAtRisk
    },
    complaints: {
      openCount: compOpen,
      slaAtRiskCount: compSlaAtRisk,
      resolvedInPeriod: compResolvedInWindow,
      resolutionRatePercent: complaintsResolutionRatePercent
    },
    totals: {
      resolutionRatePercent
    }
  };
};
