import { useCallback, useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthedQuery } from "@/lib/api/useAuthedQuery";
import { Link, useNavigate, useParams } from "react-router-dom";
import clsx from "clsx";

import { BannerLinkSelect } from "@/components/admin/BannerLinkSelect";
import {
  CatalogTaxonomyGalleryUpload,
  CatalogTaxonomyImageUpload
} from "@/components/catalog/CatalogTaxonomyImageUpload";
import { ConfirmDialog } from "@/components/primitives/ConfirmDialog";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SurfaceCard } from "@/components/primitives/SurfaceCard";
import { StatusBadge } from "@/components/primitives/StatusBadge";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { StitchFieldLabel, StitchPageBody, stitchInputClass } from "@/components/stitch";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { ApiError, formatAdminValidationMessage } from "@/lib/api/http";
import {
  archiveAdminCatalogBrand,
  getAdminCatalogBrand,
  publishAdminCatalogBrand,
  restoreAdminCatalogBrand,
  unpublishAdminCatalogBrand,
  createCatalogBrandMediaUploadIntent,
  updateAdminCatalogBrand
} from "@/features/catalog/api/admin-catalog.api";
import { listAdminBanners } from "@/features/content/api/admin-content.api";
import { normalizeTaxonomySlugInput } from "@/features/catalog/lib/normalizeTaxonomySlug";

const BANNER_LINK_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeHttpsMediaUrl = (raw: string) => {
  const t = raw.trim();
  return t.startsWith("//") ? `https:${t}` : t;
};

export const BrandEditPage = () => {
  const { brandId } = useParams<{ brandId: string }>();
  const navigate = useNavigate();
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [bannerId, setBannerId] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [archiveReason, setArchiveReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  type LifecycleAction = "draft" | "restore" | "archive";
  const [lifecycleConfirm, setLifecycleConfirm] = useState<LifecycleAction | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const bannersQ = useAuthedQuery(
  ["admin-banners-picker"],
  (token) => listAdminBanners(token)
);

  const detailQ = useAuthedQuery(
    ["admin-catalog-brand", brandId],
    (token) => getAdminCatalogBrand(token, brandId!),
    { enabled: Boolean(brandId) },
  );

  const row = detailQ.data?.data.entity;
  const notFound = detailQ.isError && detailQ.error instanceof ApiError && detailQ.error.statusCode === 404;

  useEffect(() => {
    if (!row) {
      return;
    }
    setSlug(row.slug);
    setName(row.name);
    setBannerId(row.bannerId ?? "");
    setLogoUrl(row.logoUrl ?? null);
    setGalleryUrls(row.galleryImageUrls?.length ? [...row.galleryImageUrls] : []);
  }, [row?.id, row?.slug, row?.name, row?.bannerId, row?.logoUrl, row?.galleryImageUrls]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!accessToken || !brandId) {
        throw new Error("Missing context.");
      }
      const trimmedBanner = bannerId.trim();
      const nextBannerId =
        trimmedBanner === "" ? null : BANNER_LINK_UUID.test(trimmedBanner) ? trimmedBanner : null;
      const nextLogo = logoUrl?.trim();
      return updateAdminCatalogBrand(accessToken, brandId, {
        slug: normalizeTaxonomySlugInput(slug),
        name: name.trim(),
        bannerId: nextBannerId,
        logoUrl: nextLogo ? normalizeHttpsMediaUrl(nextLogo) : null,
        galleryImageUrls: galleryUrls.map((u) => normalizeHttpsMediaUrl(u))
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-catalog-brands"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-catalog-brands-options"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-catalog-brand", brandId] });
      setMsg(null);
      setSuccessMsg("Changes saved.");
      window.setTimeout(() => setSuccessMsg(null), 5000);
    },
    onError: (e: unknown) => {
      setSuccessMsg(null);
      const fallback = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Update failed.";
      setMsg(e instanceof ApiError ? formatAdminValidationMessage(e.payload, fallback) : fallback);
    }
  });

  const saveBrandDetails = useCallback(() => {
    setMsg(null);
    saveMut.mutate();
  }, [saveMut]);

  const invalidateBrandQueries = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-catalog-brands"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-catalog-brands-options"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-catalog-brand", brandId] });
  };

  const publishMut = useMutation({
    mutationFn: async () => {
      if (!accessToken || !brandId) {
        throw new Error("Missing context.");
      }
      return publishAdminCatalogBrand(accessToken, brandId);
    },
    onSuccess: () => {
      invalidateBrandQueries();
      setMsg(null);
    },
    onError: (e: unknown) => {
      setMsg(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Publish failed.");
    }
  });

  const unpublishMut = useMutation({
    mutationFn: async () => {
      if (!accessToken || !brandId) {
        throw new Error("Missing context.");
      }
      return unpublishAdminCatalogBrand(accessToken, brandId);
    },
    onSuccess: () => {
      invalidateBrandQueries();
      setMsg(null);
    },
    onError: (e: unknown) => {
      setMsg(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Unpublish failed.");
    }
  });

  const restoreMut = useMutation({
    mutationFn: async () => {
      if (!accessToken || !brandId) {
        throw new Error("Missing context.");
      }
      return restoreAdminCatalogBrand(accessToken, brandId);
    },
    onSuccess: () => {
      invalidateBrandQueries();
      setMsg(null);
    },
    onError: (e: unknown) => {
      setMsg(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Restore failed.");
    }
  });

  const archiveMut = useMutation({
    mutationFn: async () => {
      if (!accessToken || !brandId) {
        throw new Error("Missing context.");
      }
      return archiveAdminCatalogBrand(accessToken, brandId, {
        ...(archiveReason.trim() ? { reason: archiveReason.trim() } : {})
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-catalog-brands"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-catalog-brands-options"] });
      navigate("/admin/catalog/brands");
    },
    onError: (e: unknown) => {
      setMsg(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Archive failed.");
    }
  });

  if (!brandId) {
    return <p className="text-sm text-slate-500">Missing brand.</p>;
  }

  const primarySaveClass =
    "inline-flex items-center justify-center gap-2 rounded-sm bg-gradient-to-br from-[#1653cc] to-[#3b6de6] px-5 py-2.5 font-headline text-sm font-semibold text-white shadow-lg shadow-[#1653cc]/20 transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100";

  return (
    <StitchPageBody>
      <PageHeader
        title={row ? `Edit: ${row.name}` : "Edit brand"}
        description="Update how this brand appears and is addressed in URLs."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {row && row.status !== "ARCHIVED" ? (
              <button
                type="button"
                disabled={saveMut.isPending}
                className={primarySaveClass}
                onClick={saveBrandDetails}
              >
                <MaterialIcon name="save" className="text-lg text-white" />
                {saveMut.isPending ? "Saving…" : "Save changes"}
              </button>
            ) : null}
            <Link to="/admin/catalog/brands" className="text-sm font-semibold text-[#1653cc] hover:underline">
              Back to brands
            </Link>
          </div>
        }
      />
      {successMsg ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{successMsg}</div>
      ) : null}
      {msg ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{msg}</div>
      ) : null}
      {detailQ.isPending ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : notFound ? (
        <p className="text-sm text-slate-500">Brand not found. It may have been removed.</p>
      ) : detailQ.isError ? (
        <p className="text-sm text-red-800">
          {detailQ.error instanceof Error ? detailQ.error.message : "Could not load brand."}
        </p>
      ) : row ? (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-slate-500">Status</span>
            <StatusBadge
              label={
                row.status === "ACTIVE"
                  ? "Active"
                  : row.status === "ARCHIVED"
                    ? "Archived"
                    : row.status === "DRAFT"
                      ? "Draft"
                      : row.status
              }
              tone={
                row.status === "ACTIVE" ? "active" : row.status === "ARCHIVED" ? "draft" : "pending"
              }
            />
            <span className="text-slate-500">
              {row.productCount.toLocaleString()} product{row.productCount === 1 ? "" : "s"}
            </span>
            <Link
              className="font-semibold text-[#1653cc] hover:underline"
              to={`/admin/catalog/products?brandId=${encodeURIComponent(brandId)}`}
            >
              View products in catalog
            </Link>
          </div>
          <SurfaceCard
            title="Details"
            action={
              row.status !== "ARCHIVED" ? (
                <button
                  type="button"
                  disabled={saveMut.isPending}
                  className={clsx(primarySaveClass, "px-4 py-2 text-xs")}
                  onClick={saveBrandDetails}
                >
                  <MaterialIcon name="save" className="text-base text-white" />
                  {saveMut.isPending ? "Saving…" : "Save"}
                </button>
              ) : null
            }
          >
            <form
              id="brand-edit-details-form"
              className="grid max-w-lg gap-5"
              onSubmit={(e) => {
                e.preventDefault();
                saveBrandDetails();
              }}
            >
              <label className="block">
                <StitchFieldLabel>Display name</StitchFieldLabel>
                <input
                  required
                  className={stitchInputClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="block">
                <StitchFieldLabel>URL slug</StitchFieldLabel>
                <input
                  required
                  className={clsx(stitchInputClass, "font-mono")}
                  value={slug}
                  onChange={(e) =>
                    setSlug(
                      e.target.value
                        .toLowerCase()
                        .replace(/_/g, "-")
                        .replace(/\s+/g, "-")
                        .replace(/-{2,}/g, "-")
                        .replace(/^-+|-+$/g, "")
                    )
                  }
                />
              </label>
              <BannerLinkSelect
                label="Linked banner (optional)"
                value={bannerId}
                onChange={setBannerId}
                banners={bannersQ.data?.data.items ?? []}
                loading={bannersQ.isLoading}
                disabled={row.status === "ARCHIVED"}
                hint="Banners are independent content assets; only this brand points to the chosen banner."
              />
              <CatalogTaxonomyImageUpload
                accessToken={accessToken}
                createIntent={createCatalogBrandMediaUploadIntent}
                value={logoUrl}
                onChange={setLogoUrl}
                disabled={row.status === "ARCHIVED"}
                label="Logo (optional)"
                hint="Square logo works best. JPG, PNG, WebP, or AVIF, max 8MB."
                purpose="logo"
                traceOperation="media.catalog_brand_logo"
              />
              <CatalogTaxonomyGalleryUpload
                accessToken={accessToken}
                createIntent={createCatalogBrandMediaUploadIntent}
                urls={galleryUrls}
                onChange={setGalleryUrls}
                disabled={row.status === "ARCHIVED"}
                traceOperation="media.catalog_brand_gallery"
              />
              <div className="border-t border-[#737685]/10 pt-5">
                <button
                  type="submit"
                  disabled={saveMut.isPending || row.status === "ARCHIVED"}
                  className={clsx(primarySaveClass, "w-full py-3 sm:w-auto sm:min-w-[220px]")}
                >
                  <MaterialIcon name="save" className="text-lg text-white" />
                  {saveMut.isPending ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </SurfaceCard>
          <SurfaceCard
            title="Lifecycle"
            description={
              row.status === "DRAFT"
                ? "Draft brands are not shown on the storefront and cannot be assigned to products until published."
                : row.status === "ACTIVE"
                  ? "Active brands can be assigned to products and appear on brand landing pages."
                  : "Archived brands are hidden from merchandising. Restore to make this brand active again."
            }
          >
            <div className="flex max-w-lg flex-col gap-3">
              {row.status === "DRAFT" ? (
                <button
                  type="button"
                  disabled={publishMut.isPending}
                  className="w-fit rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  onClick={() => {
                    setMsg(null);
                    publishMut.mutate();
                  }}
                >
                  {publishMut.isPending ? "Publishing…" : "Publish (make active)"}
                </button>
              ) : null}
              {row.status === "ACTIVE" ? (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={unpublishMut.isPending || row.productCount > 0}
                    title={
                      row.productCount > 0
                        ? "Remove this brand from all products before moving it back to draft."
                        : undefined
                    }
                    className="w-fit rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => setLifecycleConfirm("draft")}
                  >
                    {unpublishMut.isPending ? "Updating…" : "Move to draft"}
                  </button>
                  {row.productCount > 0 ? (
                    <p className="text-xs text-slate-500">
                      This brand is still linked to {row.productCount} product{row.productCount === 1 ? "" : "s"}. Clear
                      the brand on those products before moving to draft.
                    </p>
                  ) : null}
                </div>
              ) : null}
              {row.status === "ARCHIVED" ? (
                <button
                  type="button"
                  disabled={restoreMut.isPending}
                  className="w-fit rounded-lg bg-[#1653cc] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    onClick={() => setLifecycleConfirm("restore")}
                >
                  {restoreMut.isPending ? "Restoring…" : "Restore to active"}
                </button>
              ) : null}
            </div>
          </SurfaceCard>
          {row.status !== "ARCHIVED" ? (
            <SurfaceCard title="Archive brand" description="Archived brands stay in the system but are hidden from normal merchandising flows.">
              <div className="grid max-w-lg gap-3">
                <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                  Reason (optional)
                  <input
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={archiveReason}
                    onChange={(e) => setArchiveReason(e.target.value)}
                    placeholder="e.g. Vendor exit"
                  />
                </label>
                <button
                  type="button"
                  disabled={archiveMut.isPending}
                  className="w-fit rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-900 disabled:opacity-50"
                    onClick={() => setLifecycleConfirm("archive")}
                >
                  {archiveMut.isPending ? "Archiving…" : "Archive brand"}
                </button>
              </div>
            </SurfaceCard>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-slate-500">Loading…</p>
      )}
      <ConfirmDialog
        open={lifecycleConfirm !== null}
        title={
          lifecycleConfirm === "draft"
            ? "Move brand to draft?"
            : lifecycleConfirm === "restore"
              ? "Restore brand to active?"
              : "Archive this brand?"
        }
        body={
          lifecycleConfirm === "draft"
            ? "The brand will no longer appear on the storefront and cannot be assigned to new products."
            : lifecycleConfirm === "restore"
              ? "The brand will become active and visible on brand landing pages."
              : "The brand will be hidden from merchandising flows. You can restore it later from the list."
        }
        confirmLabel={
          lifecycleConfirm === "draft"
            ? "Move to draft"
            : lifecycleConfirm === "restore"
              ? "Restore"
              : "Archive"
        }
        danger={lifecycleConfirm === "archive"}
        onClose={() => setLifecycleConfirm(null)}
        onConfirm={() => {
          const action = lifecycleConfirm;
          setLifecycleConfirm(null);
          setMsg(null);
          if (action === "draft") unpublishMut.mutate();
          else if (action === "restore") restoreMut.mutate();
          else if (action === "archive") archiveMut.mutate();
        }}
      />
    </StitchPageBody>
  );
};
