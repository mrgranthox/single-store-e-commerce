import { randomUUID } from "node:crypto";
import { extname } from "node:path";

import { v2 as cloudinary } from "cloudinary";

import {
  invalidInputError,
  providerFailureError,
  serviceUnavailableError
} from "../common/errors/app-error";
import { env } from "./env";

export type CloudinaryScope = "catalog_product" | "content_banner" | "support_attachment";
export type CloudinaryResourceType = "image" | "video" | "raw";
export type CloudinaryDeliveryType = "upload" | "private";

type CloudinaryIntentInput = {
  scope: CloudinaryScope;
  entityId?: string;
  secondaryId?: string | null;
  fileName: string;
  contentType: string;
  fileSizeBytes?: number;
  requestedResourceType?: CloudinaryResourceType;
  actorId?: string | null;
};

type CloudinaryAssetReference = {
  publicId: string;
  resourceType?: string | null;
  deliveryType?: string | null;
  secureUrl?: string | null;
};

const scopedFolders: Record<CloudinaryScope, string> = {
  catalog_product: env.CLOUDINARY_PRODUCT_MEDIA_FOLDER,
  content_banner: env.CLOUDINARY_BANNER_FOLDER,
  support_attachment: env.CLOUDINARY_SUPPORT_FOLDER
};

let configured = false;

const ensureConfigured = () => {
  if (
    !env.CLOUDINARY_CLOUD_NAME ||
    !env.CLOUDINARY_API_KEY ||
    !env.CLOUDINARY_API_SECRET
  ) {
    throw serviceUnavailableError("Cloudinary is not configured for this environment.");
  }

  if (!configured) {
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
      secure: true
    });
    configured = true;
  }
};

const sanitizePublicIdSegment = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-/]+|[-/]+$/g, "");

const normalizeExtension = (fileName: string) => {
  const extension = extname(fileName).slice(1).toLowerCase();
  return extension || null;
};

const inferResourceType = (
  contentType: string,
  requestedResourceType?: CloudinaryResourceType
): CloudinaryResourceType => {
  if (requestedResourceType) {
    return requestedResourceType;
  }

  if (contentType.startsWith("image/")) {
    return "image";
  }

  if (contentType.startsWith("video/")) {
    return "video";
  }

  return "raw";
};

const buildAllowedFormats = (resourceType: CloudinaryResourceType, scope: CloudinaryScope) => {
  if (resourceType === "image") {
    return env.cloudinaryAllowedImageFormats;
  }

  if (resourceType === "video") {
    if (scope === "support_attachment") {
      throw invalidInputError("Support attachments do not allow video uploads.");
    }

    return env.cloudinaryAllowedVideoFormats;
  }

  return scope === "support_attachment"
    ? [...new Set([...env.cloudinaryAllowedDocumentFormats, ...env.cloudinaryAllowedImageFormats])]
    : env.cloudinaryAllowedDocumentFormats;
};

const resolveMaxBytes = (resourceType: CloudinaryResourceType) => {
  if (resourceType === "image") {
    return env.CLOUDINARY_MAX_IMAGE_BYTES;
  }

  if (resourceType === "video") {
    return env.CLOUDINARY_MAX_VIDEO_BYTES;
  }

  return env.CLOUDINARY_MAX_DOCUMENT_BYTES;
};

const buildFolder = (scope: CloudinaryScope, entityId?: string, secondaryId?: string | null) => {
  const parts = [
    env.CLOUDINARY_UPLOAD_FOLDER,
    scopedFolders[scope],
    entityId ? sanitizePublicIdSegment(entityId) : null,
    secondaryId ? sanitizePublicIdSegment(secondaryId) : null
  ].filter(Boolean);

  return parts.join("/");
};

const buildPublicId = (input: CloudinaryIntentInput, resourceType: CloudinaryResourceType) => {
  const baseName = sanitizePublicIdSegment(
    input.fileName.replace(/\.[^.]+$/, "") || `${resourceType}-asset`
  );
  const folder = buildFolder(input.scope, input.entityId, input.secondaryId);
  return `${folder}/${baseName}-${randomUUID()}`;
};

const assertFileWithinPolicy = (input: {
  resourceType: CloudinaryResourceType;
  scope: CloudinaryScope;
  fileName: string;
  fileSizeBytes?: number;
}) => {
  const extension = normalizeExtension(input.fileName);
  const allowedFormats = buildAllowedFormats(input.resourceType, input.scope);

  if (extension && !allowedFormats.includes(extension)) {
    throw invalidInputError("The requested file extension is not allowed for this upload.", {
      extension,
      allowedFormats
    });
  }

  if (
    typeof input.fileSizeBytes === "number" &&
    input.fileSizeBytes > resolveMaxBytes(input.resourceType)
  ) {
    throw invalidInputError("The requested file exceeds the maximum allowed size.", {
      fileSizeBytes: input.fileSizeBytes,
      maxFileSizeBytes: resolveMaxBytes(input.resourceType)
    });
  }
};

const normalizeResourceType = (value: string | null | undefined): CloudinaryResourceType =>
  value === "video" || value === "raw" ? value : "image";

const normalizeDeliveryType = (
  value: string | null | undefined,
  fallback: CloudinaryDeliveryType
): CloudinaryDeliveryType => (value === "private" ? "private" : fallback);

const readAssetString = (payload: Record<string, unknown>, key: string) => {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value : null;
};

const readAssetNumber = (payload: Record<string, unknown>, key: string) => {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const parseCloudinaryUrlFormat = (value: string) => {
  const candidate = value.split("?")[0]?.split(".").pop()?.toLowerCase() ?? null;
  return candidate && candidate.length <= 10 ? candidate : null;
};

const resolveExpectedDeliveryType = (scope: CloudinaryScope): CloudinaryDeliveryType =>
  scope === "support_attachment" ? "private" : "upload";

export const isCloudinaryConfigured = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
);

export const createSignedUploadIntent = (input: CloudinaryIntentInput) => {
  ensureConfigured();

  const resourceType = inferResourceType(input.contentType, input.requestedResourceType);
  assertFileWithinPolicy({
    resourceType,
    scope: input.scope,
    fileName: input.fileName,
    fileSizeBytes: input.fileSizeBytes
  });

  const deliveryType = resolveExpectedDeliveryType(input.scope);
  const publicId = buildPublicId(input, resourceType);
  const folder = publicId.split("/").slice(0, -1).join("/");
  const timestamp = Math.floor(Date.now() / 1000);
  const allowedFormats = buildAllowedFormats(resourceType, input.scope);
  const uploadParams: Record<string, string | number | boolean> = {
    timestamp,
    folder,
    public_id: publicId,
    resource_type: resourceType,
    type: deliveryType,
    allowed_formats: allowedFormats.join(","),
    overwrite: false,
    unique_filename: false,
    invalidate: true
  };

  if (input.actorId) {
    uploadParams.context = `uploaded_by=${input.actorId}|scope=${input.scope}`;
  }

  const signature = cloudinary.utils.api_sign_request(
    uploadParams,
    env.CLOUDINARY_API_SECRET!
  );

  const signedFormFields: Record<string, string> = {};
  for (const [key, value] of Object.entries(uploadParams)) {
    signedFormFields[key] = typeof value === "boolean" ? String(value) : String(value);
  }

  return {
    provider: "cloudinary",
    cloudName: env.CLOUDINARY_CLOUD_NAME!,
    apiKey: env.CLOUDINARY_API_KEY!,
    timestamp,
    signature,
    /** Exact fields that were included in the signature — POST these with `file` and `signature`. */
    signedFormFields,
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
    resourceType,
    deliveryType,
    publicId,
    folder,
    allowedFormats,
    maxFileSizeBytes: resolveMaxBytes(resourceType),
    signed: env.CLOUDINARY_SIGNED_UPLOADS_ONLY
  };
};

export const resolveCloudinaryAsset = async (
  scope: CloudinaryScope,
  reference: CloudinaryAssetReference
) => {
  ensureConfigured();

  if (!reference.publicId) {
    throw invalidInputError("A Cloudinary publicId is required.");
  }

  const resourceType = normalizeResourceType(reference.resourceType);
  const deliveryType = normalizeDeliveryType(
    reference.deliveryType,
    resolveExpectedDeliveryType(scope)
  );

  try {
    const asset = (await cloudinary.api.resource(reference.publicId, {
      resource_type: resourceType,
      type: deliveryType
    })) as Record<string, unknown>;
    const secureUrl = readAssetString(asset, "secure_url");
    const originalFilename = readAssetString(asset, "original_filename");
    const format = readAssetString(asset, "format") ?? parseCloudinaryUrlFormat(secureUrl ?? "");

    if (!secureUrl) {
      throw providerFailureError("Cloudinary did not return a secure delivery URL for the asset.", {
        publicId: reference.publicId,
        resourceType,
        deliveryType
      });
    }

    if (!reference.publicId.startsWith(buildFolder(scope))) {
      throw invalidInputError("The supplied Cloudinary asset is not under the expected folder.", {
        publicId: reference.publicId,
        expectedFolder: buildFolder(scope)
      });
    }

    assertFileWithinPolicy({
      resourceType,
      scope,
      fileName: originalFilename && format ? `${originalFilename}.${format}` : secureUrl,
      fileSizeBytes: readAssetNumber(asset, "bytes") ?? undefined
    });

    return {
      url: secureUrl,
      publicId: reference.publicId,
      resourceType,
      deliveryType,
      mimeType: null,
      fileSizeBytes: readAssetNumber(asset, "bytes"),
      width: readAssetNumber(asset, "width"),
      height: readAssetNumber(asset, "height"),
      durationSeconds: readAssetNumber(asset, "duration"),
      originalFilename:
        originalFilename && format ? `${originalFilename}.${format}` : reference.publicId.split("/").pop() ?? null,
      format
    };
  } catch (error) {
    throw providerFailureError("The referenced Cloudinary asset could not be verified.", {
      publicId: reference.publicId,
      resourceType,
      deliveryType,
      cause: error instanceof Error ? error.message : error
    });
  }
};

export const buildPrivateCloudinaryDownloadUrl = (input: {
  publicId: string;
  format?: string | null;
  originalFilename?: string | null;
  resourceType?: string | null;
  expiresInSeconds?: number;
}) => {
  ensureConfigured();

  const format =
    input.format ??
    normalizeExtension(input.originalFilename ?? "") ??
    parseCloudinaryUrlFormat(input.originalFilename ?? "");

  if (!format) {
    return null;
  }

  return cloudinary.utils.private_download_url(input.publicId, format, {
    resource_type: normalizeResourceType(input.resourceType),
    type: "private",
    attachment: true,
    expires_at: Math.floor(Date.now() / 1000) + (input.expiresInSeconds ?? 3600)
  });
};

export const destroyCloudinaryAsset = async (input: {
  publicId: string;
  resourceType?: string | null;
  deliveryType?: string | null;
}) => {
  ensureConfigured();

  await cloudinary.uploader.destroy(input.publicId, {
    resource_type: normalizeResourceType(input.resourceType),
    type: normalizeDeliveryType(input.deliveryType, "upload"),
    invalidate: true
  });
};
