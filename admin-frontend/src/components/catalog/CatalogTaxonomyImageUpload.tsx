import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";
import { ImageIcon, Loader2, Upload, X } from "lucide-react";

import { StitchFieldLabel } from "@/components/stitch";
import { ApiError, type CatalogMediaUploadIntentEntity } from "@/features/catalog/api/admin-catalog.api";

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";
const MAX_BYTES = 8 * 1024 * 1024;

type IntentFn = (
  accessToken: string,
  body: {
    fileName: string;
    contentType: string;
    fileSizeBytes?: number;
    resourceType?: "image" | "video" | "raw";
  }
) => Promise<{ success: true; data: { entity: CatalogMediaUploadIntentEntity } }>;

const postToCloudinary = async (intent: CatalogMediaUploadIntentEntity, file: File) => {
  const form = new FormData();
  for (const [key, value] of Object.entries(intent.signedFormFields ?? {})) {
    form.append(key, value);
  }
  form.append("api_key", intent.apiKey);
  form.append("signature", intent.signature);
  form.append("file", file);
  const up = await fetch(intent.uploadUrl, { method: "POST", body: form });
  if (!up.ok) {
    throw new Error("Upload to media provider failed.");
  }
  const json = (await up.json()) as { secure_url?: string; url?: string };
  const url = json.secure_url ?? json.url;
  if (!url) {
    throw new Error("Upload response missing URL.");
  }
  return url;
};

export type CatalogTaxonomyImageUploadProps = {
  accessToken: string | null;
  createIntent: IntentFn;
  value: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
  label: ReactNode;
  hint?: string;
  /** e.g. "Logo" vs "Cover image" */
  purpose?: "logo" | "cover";
};

/**
 * Single-image upload for catalog taxonomy (brand logo, category cover) via signed Cloudinary intent.
 */
export const CatalogTaxonomyImageUpload = ({
  accessToken,
  createIntent,
  value,
  onChange,
  disabled = false,
  label,
  hint,
  purpose = "cover"
}: CatalogTaxonomyImageUploadProps) => {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pickFile = useCallback(() => {
    if (!disabled) {
      fileRef.current?.click();
    }
  }, [disabled]);

  const onFile = useCallback(
    async (file: File | null) => {
      if (!file || disabled) {
        return;
      }
      if (!accessToken) {
        setErr("Not signed in.");
        return;
      }
      if (!ACCEPT.split(",").some((t) => file.type === t)) {
        setErr("Use JPG, PNG, WebP, or AVIF.");
        return;
      }
      if (file.size > MAX_BYTES) {
        setErr("Image must be 8MB or smaller.");
        return;
      }
      setErr(null);
      setBusy(true);
      try {
        const intentRes = await createIntent(accessToken, {
          fileName: file.name,
          contentType: file.type,
          fileSizeBytes: file.size,
          resourceType: "image"
        });
        const intent = intentRes.data.entity;
        const url = await postToCloudinary(intent, file);
        onChange(url);
      } catch (e) {
        setErr(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Upload failed.");
      } finally {
        setBusy(false);
        if (fileRef.current) {
          fileRef.current.value = "";
        }
      }
    },
    [accessToken, createIntent, disabled, onChange]
  );

  const frame =
    purpose === "logo"
      ? "aspect-square max-w-[140px] rounded-2xl border border-[#e0e2f0] bg-[#f8f9fb]"
      : "aspect-[16/9] max-w-md rounded-xl border border-[#e0e2f0] bg-[#f8f9fb]";

  return (
    <div className="space-y-2">
      <StitchFieldLabel>{label}</StitchFieldLabel>
      {hint ? <p className="text-xs text-[#737685]">{hint}</p> : null}
      <div className={clsx("relative flex flex-col overflow-hidden", frame)}>
        {value ? (
          <>
            <img src={value} alt="" className="h-full w-full object-contain p-2" />
            <div className="absolute right-2 top-2 flex gap-1">
              <button
                type="button"
                disabled={disabled || busy}
                onClick={pickFile}
                className="rounded-lg bg-white/95 p-2 text-[#1653cc] shadow-sm ring-1 ring-[#e0e2f0] hover:bg-white disabled:opacity-50"
                aria-label="Replace image"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              </button>
              <button
                type="button"
                disabled={disabled || busy}
                onClick={() => onChange(null)}
                className="rounded-lg bg-white/95 p-2 text-rose-700 shadow-sm ring-1 ring-[#e0e2f0] hover:bg-white disabled:opacity-50"
                aria-label="Remove image"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            disabled={disabled || busy || !accessToken}
            onClick={pickFile}
            className="flex h-full min-h-[120px] w-full flex-col items-center justify-center gap-2 px-4 text-center text-sm font-medium text-[#737685] transition-colors hover:bg-[#f2f3ff]/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-8 w-8 animate-spin text-[#1653cc]" /> : <ImageIcon className="h-8 w-8 text-[#1653cc]/70" />}
            {busy ? "Uploading…" : "Click to upload an image"}
            {!accessToken ? <span className="text-xs text-amber-700">Sign in to upload.</span> : null}
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        id={inputId}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        disabled={disabled || busy}
        onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
      />
      {err ? <p className="text-xs font-medium text-rose-700">{err}</p> : null}
    </div>
  );
};

const GALLERY_MAX = 30;

export type CatalogTaxonomyGalleryUploadProps = {
  accessToken: string | null;
  createIntent: IntentFn;
  urls: string[];
  onChange: (urls: string[]) => void;
  disabled?: boolean;
};

/**
 * Multi-image gallery for brands: upload to append; remove per tile.
 */
export const CatalogTaxonomyGalleryUpload = ({
  accessToken,
  createIntent,
  urls,
  onChange,
  disabled = false
}: CatalogTaxonomyGalleryUploadProps) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const append = useCallback(
    async (file: File | null) => {
      if (!file || disabled || urls.length >= GALLERY_MAX) {
        return;
      }
      if (!accessToken) {
        setErr("Not signed in.");
        return;
      }
      if (!ACCEPT.split(",").some((t) => file.type === t)) {
        setErr("Use JPG, PNG, WebP, or AVIF.");
        return;
      }
      if (file.size > MAX_BYTES) {
        setErr("Each image must be 8MB or smaller.");
        return;
      }
      setErr(null);
      setBusy(true);
      try {
        const intentRes = await createIntent(accessToken, {
          fileName: file.name,
          contentType: file.type,
          fileSizeBytes: file.size,
          resourceType: "image"
        });
        const url = await postToCloudinary(intentRes.data.entity, file);
        onChange([...urls, url]);
      } catch (e) {
        setErr(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Upload failed.");
      } finally {
        setBusy(false);
        if (fileRef.current) {
          fileRef.current.value = "";
        }
      }
    },
    [accessToken, createIntent, disabled, onChange, urls]
  );

  const removeAt = (idx: number) => {
    onChange(urls.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      <StitchFieldLabel>Gallery images</StitchFieldLabel>
      <p className="text-xs text-[#737685]">Upload images for the brand gallery (storefront). Up to {GALLERY_MAX} images.</p>
      <div className="flex flex-wrap gap-3">
        {urls.map((u, idx) => (
          <div
            key={`${u}-${idx}`}
            className="relative h-24 w-24 overflow-hidden rounded-lg border border-[#e0e2f0] bg-[#f8f9fb]"
          >
            <img src={u} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              disabled={disabled}
              onClick={() => removeAt(idx)}
              className="absolute right-1 top-1 rounded bg-white/90 p-1 text-rose-700 shadow-sm ring-1 ring-[#e0e2f0] hover:bg-white disabled:opacity-50"
              aria-label="Remove gallery image"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {urls.length < GALLERY_MAX ? (
          <div>
            <button
              type="button"
              disabled={disabled || busy || !accessToken}
              onClick={() => fileRef.current?.click()}
              className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[#1653cc]/35 bg-[#f2f3ff]/40 text-xs font-semibold text-[#1653cc] hover:bg-[#f2f3ff] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
              Add
            </button>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              disabled={disabled || busy}
              onChange={(e) => void append(e.target.files?.[0] ?? null)}
            />
          </div>
        ) : null}
      </div>
      {err ? <p className="text-xs font-medium text-rose-700">{err}</p> : null}
    </div>
  );
};
