import * as Sentry from "@sentry/react";

/** Minimal shape shared by catalog and content upload-intent entities. */
export type CloudinarySignedUploadIntent = {
  apiKey: string;
  signature: string;
  signedFormFields?: Record<string, string>;
  uploadUrl: string;
  cloudName: string;
  resourceType: string;
};

export const parseCloudinaryUploadErrorMessage = async (response: Response): Promise<string> => {
  try {
    const raw = await response.text();
    const parsed = JSON.parse(raw) as { error?: { message?: string } };
    const msg = parsed?.error?.message;
    return msg && msg.trim().length > 0 ? msg : raw.slice(0, 240);
  } catch {
    return response.statusText || "Upload rejected.";
  }
};

/**
 * POST `file` to Cloudinary using a backend-issued signed intent.
 * Wrapped in a Sentry span (`op: http.client`) for performance/error correlation.
 */
export const postSignedCloudinaryDirectUpload = async (
  intent: CloudinarySignedUploadIntent,
  file: File,
  options?: { operation?: string }
): Promise<string> => {
  const operation = options?.operation ?? "media.cloudinary_upload";

  const execute = async (): Promise<string> => {
    const form = new FormData();
    for (const [key, value] of Object.entries(intent.signedFormFields ?? {})) {
      form.append(key, value);
    }
    form.append("api_key", intent.apiKey);
    form.append("signature", intent.signature);
    form.append("file", file);

    const up = await fetch(intent.uploadUrl, { method: "POST", body: form });
    if (!up.ok) {
      const detail = await parseCloudinaryUploadErrorMessage(up);
      throw new Error(
        up.status === 401
          ? `Cloudinary rejected the upload (401). Usually invalid signature or API credentials — ${detail}`
          : `Upload to media provider failed (${up.status}): ${detail}`
      );
    }
    const json = (await up.json()) as { secure_url?: string; url?: string };
    const url = json.secure_url ?? json.url;
    if (!url) {
      throw new Error("Upload response missing delivery URL.");
    }
    return url;
  };

  return Sentry.startSpan(
    {
      name: operation,
      op: "http.client",
      attributes: {
        "http.url": intent.uploadUrl,
        "cloudinary.cloud": intent.cloudName,
        "cloudinary.resource_type": intent.resourceType,
        "file.size_bytes": file.size,
        "file.content_type": file.type || "application/octet-stream"
      }
    },
    () => execute()
  );
};
