import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import clsx from "clsx";

import { PageHeader } from "@/components/primitives/PageHeader";
import { SurfaceCard } from "@/components/primitives/SurfaceCard";
import { StatusBadge } from "@/components/primitives/StatusBadge";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { StitchFieldLabel, StitchPageBody, stitchInputClass } from "@/components/stitch";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import {
  ApiError,
  archiveAdminCatalogCategory,
  getAdminCatalogCategory,
  publishAdminCatalogCategory,
  restoreAdminCatalogCategory,
  unpublishAdminCatalogCategory,
  updateAdminCatalogCategory
} from "@/features/catalog/api/admin-catalog.api";

export const CategoryEditPage = () => {
  const { categoryId } = useParams<{ categoryId: string }>();
  const navigate = useNavigate();
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [archiveReason, setArchiveReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const detailQ = useQuery({
    queryKey: ["admin-catalog-category", categoryId],
    queryFn: async () => {
      if (!accessToken || !categoryId) {
        throw new Error("Not signed in.");
      }
      return getAdminCatalogCategory(accessToken, categoryId);
    },
    enabled: Boolean(accessToken && categoryId),
    retry: false
  });

  const row = detailQ.data?.data.entity;
  const notFound =
    detailQ.isError && detailQ.error instanceof ApiError && detailQ.error.statusCode === 404;

  useEffect(() => {
    if (!row) {
      return;
    }
    setSlug(row.slug);
    setName(row.name);
  }, [row?.id, row?.slug, row?.name]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!accessToken || !categoryId) {
        throw new Error("Missing context.");
      }
      return updateAdminCatalogCategory(accessToken, categoryId, {
        slug: slug.trim(),
        name: name.trim()
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-catalog-categories"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-catalog-categories-options"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-catalog-category", categoryId] });
      setMsg(null);
      setSuccessMsg("Changes saved.");
      window.setTimeout(() => setSuccessMsg(null), 5000);
    },
    onError: (e: unknown) => {
      setSuccessMsg(null);
      setMsg(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Update failed.");
    }
  });

  const saveCategoryDetails = useCallback(() => {
    setMsg(null);
    saveMut.mutate();
  }, [saveMut]);

  const invalidateCategoryQueries = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-catalog-categories"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-catalog-categories-options"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-catalog-category", categoryId] });
  };

  const publishMut = useMutation({
    mutationFn: async () => {
      if (!accessToken || !categoryId) {
        throw new Error("Missing context.");
      }
      return publishAdminCatalogCategory(accessToken, categoryId);
    },
    onSuccess: () => {
      invalidateCategoryQueries();
      setMsg(null);
    },
    onError: (e: unknown) => {
      setMsg(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Publish failed.");
    }
  });

  const unpublishMut = useMutation({
    mutationFn: async () => {
      if (!accessToken || !categoryId) {
        throw new Error("Missing context.");
      }
      return unpublishAdminCatalogCategory(accessToken, categoryId);
    },
    onSuccess: () => {
      invalidateCategoryQueries();
      setMsg(null);
    },
    onError: (e: unknown) => {
      setMsg(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Unpublish failed.");
    }
  });

  const restoreMut = useMutation({
    mutationFn: async () => {
      if (!accessToken || !categoryId) {
        throw new Error("Missing context.");
      }
      return restoreAdminCatalogCategory(accessToken, categoryId);
    },
    onSuccess: () => {
      invalidateCategoryQueries();
      setMsg(null);
    },
    onError: (e: unknown) => {
      setMsg(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Restore failed.");
    }
  });

  const archiveMut = useMutation({
    mutationFn: async () => {
      if (!accessToken || !categoryId) {
        throw new Error("Missing context.");
      }
      return archiveAdminCatalogCategory(accessToken, categoryId, {
        ...(archiveReason.trim() ? { reason: archiveReason.trim() } : {})
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-catalog-categories"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-catalog-categories-options"] });
      navigate("/admin/catalog/categories");
    },
    onError: (e: unknown) => {
      setMsg(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Archive failed.");
    }
  });

  if (!categoryId) {
    return <p className="text-sm text-slate-500">Missing category.</p>;
  }

  const primarySaveClass =
    "inline-flex items-center justify-center gap-2 rounded-sm bg-gradient-to-br from-[#1653cc] to-[#3b6de6] px-5 py-2.5 font-headline text-sm font-semibold text-white shadow-lg shadow-[#1653cc]/20 transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100";

  return (
    <StitchPageBody>
      <PageHeader
        title={row ? `Edit: ${row.name}` : "Edit category"}
        description="Update how this category appears and is addressed in URLs."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {row && row.status !== "ARCHIVED" ? (
              <button
                type="button"
                disabled={saveMut.isPending}
                className={primarySaveClass}
                onClick={saveCategoryDetails}
              >
                <MaterialIcon name="save" className="text-lg text-white" />
                {saveMut.isPending ? "Saving…" : "Save changes"}
              </button>
            ) : null}
            <Link
              to="/admin/catalog/categories"
              className="text-sm font-semibold text-[#1653cc] hover:underline"
            >
              Back to categories
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
        <p className="text-sm text-slate-500">Category not found. It may have been removed.</p>
      ) : detailQ.isError ? (
        <p className="text-sm text-red-800">
          {detailQ.error instanceof Error ? detailQ.error.message : "Could not load category."}
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
              className="font-semibold text-[#4f7ef8] hover:underline"
              to={`/admin/catalog/products?categoryId=${encodeURIComponent(categoryId)}`}
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
                  className={clsx(primarySaveClass, "py-2 px-4 text-xs")}
                  onClick={saveCategoryDetails}
                >
                  <MaterialIcon name="save" className="text-base text-white" />
                  {saveMut.isPending ? "Saving…" : "Save"}
                </button>
              ) : null
            }
          >
            <form
              id="category-edit-details-form"
              className="grid max-w-lg gap-5"
              onSubmit={(e) => {
                e.preventDefault();
                saveCategoryDetails();
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
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                />
              </label>
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
                ? "Draft categories are hidden from the public category list and cannot be assigned to new products until published."
                : row.status === "ACTIVE"
                  ? "Active categories appear in navigation and can be linked to products."
                  : "Archived categories are hidden from merchandising. Restore to make this category active again."
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
                        ? "Remove all products from this category before moving it back to draft."
                        : undefined
                    }
                    className="w-fit rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => {
                      if (window.confirm("Move this category to draft? It will disappear from the storefront.")) {
                        setMsg(null);
                        unpublishMut.mutate();
                      }
                    }}
                  >
                    {unpublishMut.isPending ? "Updating…" : "Move to draft"}
                  </button>
                  {row.productCount > 0 ? (
                    <p className="text-xs text-slate-500">
                      {row.productCount} product{row.productCount === 1 ? "" : "s"} still linked. Unlink them before
                      moving to draft.
                    </p>
                  ) : null}
                </div>
              ) : null}
              {row.status === "ARCHIVED" ? (
                <button
                  type="button"
                  disabled={restoreMut.isPending}
                  className="w-fit rounded-lg bg-[#1653cc] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  onClick={() => {
                    if (window.confirm("Restore this category to active?")) {
                      setMsg(null);
                      restoreMut.mutate();
                    }
                  }}
                >
                  {restoreMut.isPending ? "Restoring…" : "Restore to active"}
                </button>
              ) : null}
            </div>
          </SurfaceCard>
          {row.status !== "ARCHIVED" ? (
            <SurfaceCard title="Archive category" description="Archived categories stay in the system but are hidden from normal merchandising flows.">
              <div className="grid max-w-lg gap-3">
                <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                  Reason (optional)
                  <input
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={archiveReason}
                    onChange={(e) => setArchiveReason(e.target.value)}
                    placeholder="e.g. Seasonal cleanup"
                  />
                </label>
                <button
                  type="button"
                  disabled={archiveMut.isPending}
                  className="w-fit rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-900 disabled:opacity-50"
                  onClick={() => {
                    if (window.confirm("Archive this category? You can still find it in the list when showing archived statuses.")) {
                      setMsg(null);
                      archiveMut.mutate();
                    }
                  }}
                >
                  {archiveMut.isPending ? "Archiving…" : "Archive category"}
                </button>
              </div>
            </SurfaceCard>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-slate-500">Loading…</p>
      )}
    </StitchPageBody>
  );
};
