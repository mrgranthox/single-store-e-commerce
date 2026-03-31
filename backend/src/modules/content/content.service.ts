import { Prisma } from "@prisma/client";

import { badRequestError, notFoundError } from "../../common/errors/app-error";
import { toPrismaJsonValue } from "../../common/database/prisma-json";
import { createSignedUploadIntent, resolveCloudinaryAsset } from "../../config/cloudinary";
import { prisma } from "../../config/prisma";

const serializePage = (page: Prisma.CmsPageGetPayload<object>) => ({
  id: page.id,
  slug: page.slug,
  title: page.title,
  status: page.status,
  content: page.content,
  createdAt: page.createdAt,
  updatedAt: page.updatedAt
});

const serializeBanner = (banner: Prisma.BannerGetPayload<object>) => ({
  id: banner.id,
  placement: banner.placement,
  status: banner.status,
  sortOrder: banner.sortOrder,
  title: banner.title,
  mediaUrl: banner.mediaUrl,
  mediaStorageProvider: banner.mediaStorageProvider,
  mediaPublicId: banner.mediaPublicId,
  mediaResourceType: banner.mediaResourceType,
  mediaDeliveryType: banner.mediaDeliveryType,
  mediaMimeType: banner.mediaMimeType,
  mediaFileSizeBytes: banner.mediaFileSizeBytes,
  mediaWidth: banner.mediaWidth,
  mediaHeight: banner.mediaHeight,
  mediaDurationSeconds: banner.mediaDurationSeconds,
  mediaOriginalFilename: banner.mediaOriginalFilename,
  linkUrl: banner.linkUrl,
  createdAt: banner.createdAt,
  updatedAt: banner.updatedAt
});

const recordContentAdminMutation = async (
  transaction: Prisma.TransactionClient,
  input: {
    actorAdminUserId: string;
    actionCode: string;
    entityType: "CMS_PAGE" | "BANNER";
    entityId: string;
    before?: unknown;
    after?: unknown;
  }
) => {
  await Promise.all([
    transaction.auditLog.create({
      data: {
        actorType: "ADMIN",
        actorAdminUserId: input.actorAdminUserId,
        actionCode: input.actionCode,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: toPrismaJsonValue({ after: input.after })
      }
    }),
    transaction.adminActionLog.create({
      data: {
        adminUserId: input.actorAdminUserId,
        screen: "content.management",
        actionCode: input.actionCode,
        entityType: input.entityType,
        entityId: input.entityId,
        before: toPrismaJsonValue(input.before),
        after: toPrismaJsonValue(input.after)
      }
    }),
    transaction.timelineEvent.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        eventType: input.actionCode.toUpperCase().replaceAll(".", "_"),
        actorAdminUserId: input.actorAdminUserId,
        actorType: "ADMIN",
        payload: toPrismaJsonValue({
          before: input.before,
          after: input.after
        })
      }
    })
  ]);
};

export const getPublicContentPage = async (slug: string) => {
  const page = await prisma.cmsPage.findUnique({
    where: {
      slug
    }
  });

  if (!page || page.status !== "PUBLISHED") {
    throw notFoundError("The requested content page was not found.");
  }

  return {
    entity: serializePage(page)
  };
};

export const listPublicBanners = async (placement?: string) => {
  const items = await prisma.banner.findMany({
    where: {
      status: "PUBLISHED",
      ...(placement ? { placement } : {})
    },
    orderBy: [
      {
        sortOrder: "asc"
      },
      {
        createdAt: "desc"
      }
    ]
  });

  return {
    items: items.map(serializeBanner)
  };
};

export const listAdminPages = async () => {
  const items = await prisma.cmsPage.findMany({
    orderBy: {
      updatedAt: "desc"
    }
  });

  return {
    items: items.map(serializePage)
  };
};

export const createAdminPage = async (input: {
  actorAdminUserId: string;
  slug: string;
  title?: string;
  status: string;
  content: Record<string, unknown>;
}) => {
  const page = await prisma.$transaction(async (transaction) => {
    const created = await transaction.cmsPage.create({
      data: {
        slug: input.slug,
        title: input.title,
        status: input.status,
        content: toPrismaJsonValue(input.content) ?? Prisma.JsonNull
      }
    });
    await recordContentAdminMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "content.pages.create",
      entityType: "CMS_PAGE",
      entityId: created.id,
      after: serializePage(created)
    });
    return created;
  });

  return {
    entity: serializePage(page)
  };
};

export const updateAdminPage = async (input: {
  actorAdminUserId: string;
  pageId: string;
  title?: string;
  status?: string;
  content?: Record<string, unknown>;
}) => {
  const page = await prisma.$transaction(async (transaction) => {
    const existing = await transaction.cmsPage.findUnique({
      where: {
        id: input.pageId
      }
    });

    if (!existing) {
      throw notFoundError("The requested page was not found.");
    }

    const updated = await transaction.cmsPage.update({
      where: {
        id: existing.id
      },
      data: {
        title: input.title ?? existing.title,
        status: input.status ?? existing.status,
        content: input.content
          ? (toPrismaJsonValue(input.content) ?? Prisma.JsonNull)
          : (toPrismaJsonValue(existing.content) ?? Prisma.JsonNull)
      }
    });

    await recordContentAdminMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "content.pages.update",
      entityType: "CMS_PAGE",
      entityId: updated.id,
      before: serializePage(existing),
      after: serializePage(updated)
    });
    return updated;
  });

  return {
    entity: serializePage(page)
  };
};

export const getAdminPage = async (pageId: string) => {
  const page = await prisma.cmsPage.findUnique({
    where: {
      id: pageId
    }
  });

  if (!page) {
    throw notFoundError("The requested page was not found.");
  }

  return {
    entity: serializePage(page)
  };
};

export const publishAdminPage = async (pageId: string) => {
  const page = await prisma.cmsPage.findUnique({
    where: {
      id: pageId
    }
  });

  if (!page) {
    throw notFoundError("The requested page was not found.");
  }

  const updated = await prisma.cmsPage.update({
    where: {
      id: page.id
    },
    data: {
      status: "PUBLISHED"
    }
  });

  return {
    entity: serializePage(updated)
  };
};

export const unpublishAdminPage = async (pageId: string) => {
  const page = await prisma.cmsPage.findUnique({
    where: {
      id: pageId
    }
  });

  if (!page) {
    throw notFoundError("The requested page was not found.");
  }

  const updated = await prisma.cmsPage.update({
    where: {
      id: page.id
    },
    data: {
      status: "DRAFT"
    }
  });

  return {
    entity: serializePage(updated)
  };
};

export const archiveAdminPage = async (pageId: string) => {
  const page = await prisma.cmsPage.findUnique({
    where: {
      id: pageId
    }
  });

  if (!page) {
    throw notFoundError("The requested page was not found.");
  }

  const updated = await prisma.cmsPage.update({
    where: {
      id: page.id
    },
    data: {
      status: "ARCHIVED"
    }
  });

  return {
    entity: serializePage(updated)
  };
};

export const restoreAdminPage = async (pageId: string) => {
  const page = await prisma.cmsPage.findUnique({
    where: {
      id: pageId
    }
  });

  if (!page) {
    throw notFoundError("The requested page was not found.");
  }

  if (page.status !== "ARCHIVED") {
    throw badRequestError("Only archived pages can be restored.");
  }

  const updated = await prisma.cmsPage.update({
    where: {
      id: page.id
    },
    data: {
      status: "DRAFT"
    }
  });

  return {
    entity: serializePage(updated)
  };
};

export const deleteAdminPagePermanent = async (input: {
  actorAdminUserId: string;
  pageId: string;
}) => {
  await prisma.$transaction(async (transaction) => {
    const page = await transaction.cmsPage.findUnique({
      where: {
        id: input.pageId
      }
    });

    if (!page) {
      throw notFoundError("The requested page was not found.");
    }

    if (page.status !== "ARCHIVED") {
      throw badRequestError("Archive the page before permanent deletion.");
    }

    await transaction.cmsPage.delete({
      where: {
        id: page.id
      }
    });

    await recordContentAdminMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "content.pages.delete",
      entityType: "CMS_PAGE",
      entityId: page.id,
      before: serializePage(page),
      after: { deleted: true }
    });
  });

  return {
    ok: true as const
  };
};

export const listAdminBanners = async () => {
  const items = await prisma.banner.findMany({
    orderBy: [
      {
        placement: "asc"
      },
      {
        sortOrder: "asc"
      }
    ]
  });

  return {
    items: items.map(serializeBanner)
  };
};

export const createAdminContentMediaUploadIntent = async (input: {
  actorAdminUserId: string;
  fileName: string;
  contentType: string;
  fileSizeBytes?: number;
  resourceType?: "image" | "video" | "raw";
}) => ({
  // audit-admin-action-exempt: signed upload intent generation is non-persistent.
  entity: createSignedUploadIntent({
    scope: "content_banner",
    actorId: input.actorAdminUserId,
    fileName: input.fileName,
    contentType: input.contentType,
    fileSizeBytes: input.fileSizeBytes,
    requestedResourceType: input.resourceType
  })
});

export const createAdminBanner = async (input: {
  actorAdminUserId: string;
  placement: string;
  status: string;
  sortOrder: number;
  title?: string;
  mediaUrl?: string;
  mediaStorageProvider?: string;
  mediaPublicId?: string;
  mediaResourceType?: "image" | "video" | "raw";
  mediaDeliveryType?: "upload" | "private";
  mediaMimeType?: string;
  mediaFileSizeBytes?: number;
  mediaWidth?: number;
  mediaHeight?: number;
  mediaDurationSeconds?: number;
  mediaOriginalFilename?: string;
  linkUrl?: string | null;
}) => {
  const resolvedAsset =
    input.mediaUrl && input.mediaStorageProvider === "cloudinary" && input.mediaPublicId
      ? await resolveCloudinaryAsset("content_banner", {
          publicId: input.mediaPublicId,
          resourceType: input.mediaResourceType,
          deliveryType: input.mediaDeliveryType,
          secureUrl: input.mediaUrl
        })
      : null;

  const banner = await prisma.$transaction(async (transaction) => {
    const created = await transaction.banner.create({
    data: {
      placement: input.placement,
      status: input.status,
      sortOrder: input.sortOrder,
      title: input.title,
      mediaUrl: resolvedAsset?.url ?? input.mediaUrl,
      mediaStorageProvider: input.mediaStorageProvider ?? null,
      mediaPublicId: resolvedAsset?.publicId ?? input.mediaPublicId,
      mediaResourceType: resolvedAsset?.resourceType ?? input.mediaResourceType ?? null,
      mediaDeliveryType:
        resolvedAsset?.deliveryType ?? input.mediaDeliveryType ?? "upload",
      mediaMimeType: input.mediaMimeType ?? null,
      mediaFileSizeBytes:
        input.mediaFileSizeBytes ?? resolvedAsset?.fileSizeBytes ?? null,
      mediaWidth: input.mediaWidth ?? resolvedAsset?.width ?? null,
      mediaHeight: input.mediaHeight ?? resolvedAsset?.height ?? null,
      mediaDurationSeconds:
        input.mediaDurationSeconds ?? resolvedAsset?.durationSeconds ?? null,
      mediaOriginalFilename:
        input.mediaOriginalFilename ?? resolvedAsset?.originalFilename ?? null,
      linkUrl: input.linkUrl ?? null
    }
  });
    await recordContentAdminMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "content.banners.create",
      entityType: "BANNER",
      entityId: created.id,
      after: serializeBanner(created)
    });
    return created;
  });

  return {
    entity: serializeBanner(banner)
  };
};

export const updateAdminBanner = async (input: {
  actorAdminUserId: string;
  bannerId: string;
  placement?: string;
  status?: string;
  sortOrder?: number;
  title?: string;
  mediaUrl?: string;
  mediaStorageProvider?: string;
  mediaPublicId?: string;
  mediaResourceType?: "image" | "video" | "raw";
  mediaDeliveryType?: "upload" | "private";
  mediaMimeType?: string;
  mediaFileSizeBytes?: number;
  mediaWidth?: number;
  mediaHeight?: number;
  mediaDurationSeconds?: number;
  mediaOriginalFilename?: string;
  linkUrl?: string | null;
}) => {
  const banner = await prisma.$transaction(async (transaction) => {
    const existing = await transaction.banner.findUnique({
      where: {
        id: input.bannerId
      }
    });

    if (!existing) {
      throw notFoundError("The requested banner was not found.");
    }

    const resolvedAsset =
      input.mediaUrl && input.mediaStorageProvider === "cloudinary" && input.mediaPublicId
        ? await resolveCloudinaryAsset("content_banner", {
            publicId: input.mediaPublicId,
            resourceType: input.mediaResourceType,
            deliveryType: input.mediaDeliveryType,
            secureUrl: input.mediaUrl
          })
        : null;

    const updated = await transaction.banner.update({
      where: {
        id: existing.id
      },
      data: {
        placement: input.placement ?? existing.placement,
        status: input.status ?? existing.status,
        sortOrder: input.sortOrder ?? existing.sortOrder,
        title: input.title ?? existing.title,
        mediaUrl: resolvedAsset?.url ?? input.mediaUrl ?? existing.mediaUrl,
        mediaStorageProvider: input.mediaStorageProvider ?? existing.mediaStorageProvider,
        mediaPublicId: resolvedAsset?.publicId ?? input.mediaPublicId ?? existing.mediaPublicId,
        mediaResourceType:
          resolvedAsset?.resourceType ?? input.mediaResourceType ?? existing.mediaResourceType,
        mediaDeliveryType:
          resolvedAsset?.deliveryType ?? input.mediaDeliveryType ?? existing.mediaDeliveryType,
        mediaMimeType: input.mediaMimeType ?? existing.mediaMimeType,
        mediaFileSizeBytes:
          input.mediaFileSizeBytes ?? resolvedAsset?.fileSizeBytes ?? existing.mediaFileSizeBytes,
        mediaWidth: input.mediaWidth ?? resolvedAsset?.width ?? existing.mediaWidth,
        mediaHeight: input.mediaHeight ?? resolvedAsset?.height ?? existing.mediaHeight,
        mediaDurationSeconds:
          input.mediaDurationSeconds ??
          resolvedAsset?.durationSeconds ??
          existing.mediaDurationSeconds,
        mediaOriginalFilename:
          input.mediaOriginalFilename ??
          resolvedAsset?.originalFilename ??
          existing.mediaOriginalFilename,
        linkUrl: input.linkUrl !== undefined ? input.linkUrl : existing.linkUrl
      }
    });

    await recordContentAdminMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "content.banners.update",
      entityType: "BANNER",
      entityId: updated.id,
      before: serializeBanner(existing),
      after: serializeBanner(updated)
    });
    return updated;
  });

  return {
    entity: serializeBanner(banner)
  };
};

export const publishAdminBanner = async (input: { actorAdminUserId: string; bannerId: string }) =>
  updateAdminBanner({
    actorAdminUserId: input.actorAdminUserId,
    bannerId: input.bannerId,
    status: "PUBLISHED"
  });

export const unpublishAdminBanner = async (input: { actorAdminUserId: string; bannerId: string }) =>
  updateAdminBanner({
    actorAdminUserId: input.actorAdminUserId,
    bannerId: input.bannerId,
    status: "DRAFT"
  });

export const deleteAdminBanner = async (input: {
  actorAdminUserId: string;
  bannerId: string;
}) => {
  await prisma.$transaction(async (transaction) => {
    const existing = await transaction.banner.findUnique({
      where: {
        id: input.bannerId
      }
    });

    if (!existing) {
      throw notFoundError("The requested banner was not found.");
    }

    await transaction.banner.delete({
      where: {
        id: existing.id
      }
    });

    await recordContentAdminMutation(transaction, {
      actorAdminUserId: input.actorAdminUserId,
      actionCode: "content.banners.delete",
      entityType: "BANNER",
      entityId: existing.id,
      before: serializeBanner(existing),
      after: { deleted: true }
    });
  });

  return {
    ok: true as const
  };
};
