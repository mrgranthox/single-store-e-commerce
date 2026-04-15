import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthedQuery } from "@/lib/api/useAuthedQuery";
import { useCallback, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useParams } from "react-router-dom";

import { ConfirmDialog } from "@/components/primitives/ConfirmDialog";

import { ProductAdminNav } from "@/components/catalog/ProductAdminNav";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SurfaceCard } from "@/components/primitives/SurfaceCard";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import {
  ApiError,
  createAdminCatalogProductMediaRecord,
  createCatalogMediaUploadIntent,
  deleteAdminCatalogProductMedia,
  getAdminCatalogProduct,
  getAdminCatalogProductMedia,
  getAdminCatalogProductVariants,
  patchAdminCatalogProductMedia,
  reorderAdminCatalogProductMedia,
  type AdminCatalogProductMedia
} from "@/features/catalog/api/admin-catalog.api";
import { formatVariantOptions } from "@/features/catalog/lib/catalogFormat";
import { refreshDataMenuItem } from "@/lib/page-action-menu";
import { postSignedCloudinaryDirectUpload } from "@/lib/media/cloudinaryDirectUpload";

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 5 * 1024 * 1024;

export const CatalogProductMediaPage = () => {
  const { productId } = useParams<{ productId: string }>();
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadInFlightRef = useRef(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadStep, setUploadStep] = useState<string | null>(null);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [uploadMsgTone, setUploadMsgTone] = useState<"success" | "error" | "neutral">("neutral");
  const [dragOver, setDragOver] = useState(false);
  const [mappingBusy, setMappingBusy] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const productQ = useAuthedQuery(
    ["admin-catalog-product", productId],
    (token) => getAdminCatalogProduct(token, productId!),
    { enabled: Boolean(productId) },
  );

  const variantsQ = useAuthedQuery(
    ["admin-catalog-product-variants", productId],
    (token) => getAdminCatalogProductVariants(token, productId!),
    { enabled: Boolean(productId) },
  );

  const q = useAuthedQuery(
    ["admin-catalog-product-media", productId],
    (token) => getAdminCatalogProductMedia(token, productId!),
    { enabled: Boolean(productId) },
  );

  const items = useMemo(() => {
    const raw = q.data?.data.items ?? [];
    return [...raw].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  }, [q.data?.data.items]);

  const variants = variantsQ.data?.data.items ?? [];
  const productTitle = productQ.data?.data.entity.title ?? "Product";

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-catalog-product-media", productId] });
    void queryClient.invalidateQueries({ queryKey: ["admin-catalog-product", productId] });
  };

  const deleteMut = useMutation({
    mutationFn: async (mediaId: string) => {
      if (!accessToken) {
        throw new Error("Missing session.");
      }
      return deleteAdminCatalogProductMedia(accessToken, mediaId);
    },
    onSuccess: invalidate
  });

  const reorderMut = useMutation({
    mutationFn: async (ordered: AdminCatalogProductMedia[]) => {
      if (!accessToken || !productId) {
        throw new Error("Missing context.");
      }
      const payload = ordered.map((m, i) => ({ mediaId: m.id, sortOrder: i }));
      return reorderAdminCatalogProductMedia(accessToken, productId, payload);
    },
    onSuccess: invalidate
  });

  const uploadFile = useCallback(
    async (file: File) => {
      if (!accessToken || !productId) {
        return;
      }
      if (uploadInFlightRef.current) {
        return;
      }
      if (!ACCEPT.split(",").some((t) => file.type === t)) {
        setUploadMsgTone("error");
        setUploadMsg("Use JPG, PNG, or WebP.");
        return;
      }
      if (file.size > MAX_BYTES) {
        setUploadMsgTone("error");
        setUploadMsg("File must be 5MB or smaller.");
        return;
      }
      uploadInFlightRef.current = true;
      setUploadBusy(true);
      setUploadStep("Preparing upload…");
      setUploadMsg(null);
      setUploadMsgTone("neutral");
      try {
        const intentRes = await createCatalogMediaUploadIntent(accessToken, productId, {
          fileName: file.name,
          contentType: file.type,
          fileSizeBytes: file.size,
          resourceType: "image"
        });
        const intent = intentRes.data.entity;
        setUploadStep("Uploading image…");
        const url = await postSignedCloudinaryDirectUpload(intent, file, {
          operation: "media.catalog_product_gallery"
        });
        setUploadStep("Saving to catalog…");
        await createAdminCatalogProductMediaRecord(accessToken, productId, {
          url,
          kind: "IMAGE",
          sortOrder: items.length,
          storageProvider: "cloudinary",
          publicId: intent.publicId,
          resourceType: "image",
          deliveryType: intent.deliveryType === "private" ? "private" : "upload",
          mimeType: file.type,
          fileSizeBytes: file.size,
          originalFilename: file.name
        });
        invalidate();
        setUploadMsgTone("success");
        setUploadMsg("Upload complete.");
      } catch (e) {
        setUploadMsgTone("error");
        setUploadMsg(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Upload failed.");
      } finally {
        uploadInFlightRef.current = false;
        setUploadBusy(false);
        setUploadStep(null);
      }
    },
    [accessToken, productId, items.length]
  );

  const err =
    q.error instanceof ApiError ? q.error.message : q.error instanceof Error ? q.error.message : null;

  const setPrimary = (mediaId: string) => {
    const next = [...items];
    const idx = next.findIndex((m) => m.id === mediaId);
    if (idx <= 0) {
      return;
    }
    const [picked] = next.splice(idx, 1);
    next.unshift(picked!);
    reorderMut.mutate(next);
  };

  const onReorderDrag = (fromId: string, toId: string) => {
    if (fromId === toId) {
      return;
    }
    const next = [...items];
    const fromIdx = next.findIndex((m) => m.id === fromId);
    const toIdx = next.findIndex((m) => m.id === toId);
    if (fromIdx < 0 || toIdx < 0) {
      return;
    }
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved!);
    reorderMut.mutate(next);
  };

  if (!productId) {
    return <p className="text-sm text-[var(--color-text-muted)]">Missing product id.</p>;
  }

  const primaryId = items[0]?.id;

  return (
    <div className="space-y-6">
      <PageHeader
        title={productQ.isLoading ? "Loading…" : productTitle}
        description="Gallery, uploads, and which images appear for each variant."
        actionMenuItems={[refreshDataMenuItem(queryClient, ["admin-catalog-product-media", productId])]}
      />
      <ProductAdminNav />
      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div
            role="button"
            tabIndex={uploadBusy ? -1 : 0}
            aria-busy={uploadBusy}
            onKeyDown={(e) => {
              if (uploadBusy) {
                return;
              }
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              if (uploadBusy) {
                return;
              }
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (uploadBusy) {
                return;
              }
              const f = e.dataTransfer.files[0];
              if (f) {
                void uploadFile(f);
              }
            }}
            onClick={() => {
              if (!uploadBusy) {
                fileInputRef.current?.click();
              }
            }}
            className={[
              "flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors",
              uploadBusy ? "cursor-wait border-[#4f7ef8]/40 bg-slate-50" : "cursor-pointer",
              !uploadBusy && dragOver ? "border-[#4f7ef8] bg-[rgba(79,126,248,0.06)]" : "",
              !uploadBusy && !dragOver ? "border-slate-200 bg-slate-50/50 hover:border-slate-300" : ""
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              disabled={uploadBusy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  void uploadFile(f);
                }
                e.target.value = "";
              }}
            />
            {uploadBusy ? (
              <>
                <Loader2 className="h-10 w-10 shrink-0 animate-spin text-[#4f7ef8]" aria-hidden />
                <p className="mt-3 text-sm font-semibold text-slate-800">{uploadStep}</p>
                <p className="mt-1 max-w-xs text-xs text-[var(--color-text-muted)]">
                  Keep this tab open until the upload finishes.
                </p>
              </>
            ) : (
              <>
                <div className="text-3xl text-slate-400" aria-hidden>
                  ☁
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-800">Drag & drop or click to upload</p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">JPG, PNG, or WebP · max 5MB</p>
              </>
            )}
            {!uploadBusy && uploadMsg ? (
              <p
                className={[
                  "mt-3 text-sm font-medium",
                  uploadMsgTone === "error" ? "text-rose-700" : "",
                  uploadMsgTone === "success" ? "text-emerald-800" : "",
                  uploadMsgTone === "neutral" ? "text-slate-700" : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {uploadMsg}
              </p>
            ) : null}
          </div>

          {q.isLoading ? (
            <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {items.map((m) => (
                <MediaTile
                  key={m.id}
                  media={m}
                  isPrimary={m.id === primaryId}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/media-id", m.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from = e.dataTransfer.getData("text/media-id");
                    if (from) {
                      onReorderDrag(from, m.id);
                    }
                  }}
                  onSetPrimary={() => setPrimary(m.id)}
                  onDelete={() => setDeleteConfirmId(m.id)}
                  disabled={uploadBusy || reorderMut.isPending || deleteMut.isPending}
                />
              ))}
            </div>
          )}
        </div>

        <SurfaceCard title="Variant media mapping" description="Assign catalog images to a variant for PDP context.">
          {variants.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">Add variants before mapping media.</p>
          ) : (
            <ul className="space-y-3">
              {variants.map((v) => {
                const assigned = items.filter((m) => m.variantId === v.id);
                return (
                  <li key={v.id} className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {formatVariantOptions(v.attributes)}
                    </div>
                    <div className="font-mono text-xs text-slate-700">{v.sku}</div>
                    <label className="mt-2 block text-xs font-medium text-slate-600">
                      Linked image
                      <select
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                        value={assigned[0]?.id ?? ""}
                        onChange={async (e) => {
                          const val = e.target.value;
                          if (!accessToken) {
                            return;
                          }
                          setMappingBusy(true);
                          setUploadMsg(null);
                          setUploadMsgTone("neutral");
                          try {
                            for (const m of assigned) {
                              await patchAdminCatalogProductMedia(accessToken, m.id, { variantId: null });
                            }
                            if (!val) {
                              invalidate();
                              return;
                            }
                            await patchAdminCatalogProductMedia(accessToken, val, { variantId: v.id });
                            invalidate();
                          } catch {
                            setUploadMsgTone("error");
                            setUploadMsg("Could not update variant mapping.");
                          } finally {
                            setMappingBusy(false);
                          }
                        }}
                        disabled={mappingBusy}
                      >
                        <option value="">Product gallery only</option>
                        {items.map((m) => (
                          <option key={m.id} value={m.id}>
                            Image {items.indexOf(m) + 1}
                            {m.originalFilename ? ` — ${m.originalFilename}` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    {assigned.length > 1 ? (
                      <p className="mt-1 text-xs text-amber-800">
                        Multiple assets reference this variant; the first in sort order is shown in storefront flows.
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </SurfaceCard>
      </div>
      <ConfirmDialog
        open={deleteConfirmId !== null}
        title="Remove this image?"
        body="The image will be permanently removed from this product's gallery."
        confirmLabel="Remove image"
        danger
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => {
          if (deleteConfirmId) deleteMut.mutate(deleteConfirmId);
          setDeleteConfirmId(null);
        }}
      />
    </div>
  );
};

const MediaTile = ({
  media,
  isPrimary,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  onSetPrimary,
  onDelete,
  disabled
}: {
  media: AdminCatalogProductMedia;
  isPrimary: boolean;
  draggable: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onSetPrimary: () => void;
  onDelete: () => void;
  disabled: boolean;
}) => (
  <div
    draggable={draggable}
    onDragStart={onDragStart}
    onDragOver={onDragOver}
    onDrop={onDrop}
    className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
  >
    <div className="absolute left-2 top-2 z-10 cursor-grab rounded bg-white/90 px-1.5 py-0.5 text-xs text-slate-500 shadow-sm active:cursor-grabbing">
      ⣿
    </div>
    {isPrimary ? (
      <span className="absolute right-2 top-2 z-10 rounded-full bg-[#4f7ef8] px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
        Primary
      </span>
    ) : null}
    <div className="aspect-square bg-slate-100">
      <img
        src={media.url}
        alt=""
        className="h-full w-full object-cover"
        loading="lazy"
        draggable={false}
      />
    </div>
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/0 opacity-0 transition-all group-hover:bg-slate-900/45 group-hover:opacity-100">
      <button
        type="button"
        disabled={disabled || isPrimary}
        onClick={(e) => {
          e.stopPropagation();
          onSetPrimary();
        }}
        className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow disabled:cursor-not-allowed disabled:opacity-40"
      >
        Set as primary
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow disabled:opacity-50"
      >
        Delete
      </button>
    </div>
    <div className="truncate px-2 py-1.5 text-xs text-slate-500">
      {media.originalFilename?.trim() || media.kind}
    </div>
  </div>
);
