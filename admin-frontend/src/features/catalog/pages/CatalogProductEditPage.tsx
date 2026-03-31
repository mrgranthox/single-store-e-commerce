import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useBlocker, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { ProductAdminNav } from "@/components/catalog/ProductAdminNav";
import { PageHeader } from "@/components/primitives/PageHeader";
import { StatusBadge, type StatusBadgeTone } from "@/components/primitives/StatusBadge";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import {
  ApiError,
  archiveAdminCatalogProduct,
  getAdminCatalogProduct,
  listAdminCatalogBrands,
  listAdminCatalogCategories,
  publishAdminCatalogProduct,
  unpublishAdminCatalogProduct,
  updateAdminCatalogProduct,
  type AdminCatalogProductDetailEntity
} from "@/features/catalog/api/admin-catalog.api";
import { datetimeLocalValueToUtcIso, utcIsoToDatetimeLocalValue } from "@/features/catalog/lib/datetime-local";
import { brandsForProductPicker, categoriesForProductPicker } from "@/features/catalog/lib/taxonomyPicker";
import { applyZodIssuesToRhf } from "@/lib/forms/apply-zod-issues";
import { refreshDataMenuItem } from "@/lib/page-action-menu";
import { listAdminAuditLogs } from "@/features/security/api/admin-audit.api";

const productEditSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(255),
  description: z.string().trim().max(10_000).optional(),
  richDescription: z.string().trim().max(50_000).optional(),
  brandId: z.string().optional(),
  categoryIds: z.array(z.string().uuid()).default([]),
  metaTitle: z.string().trim().max(255).optional(),
  metaDescription: z.string().trim().max(2000).optional(),
  scheduledPublishLocal: z.string().optional()
});

type ProductEditFormValues = z.infer<typeof productEditSchema>;

const sectionTitle = (n: number, label: string) => (
  <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
    <span className="mr-2 text-[#4f7ef8]">{n}.</span>
    {label}
  </h2>
);

const statusTone = (status: string): StatusBadgeTone => {
  switch (status) {
    case "PUBLISHED":
      return "active";
    case "DRAFT":
      return "draft";
    case "ARCHIVED":
      return "danger";
    default:
      return "draft";
  }
};

const formatSaved = (iso: string) => {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const mapEntityToForm = (entity: AdminCatalogProductDetailEntity): ProductEditFormValues => ({
  title: entity.title,
  description: entity.description ?? "",
  richDescription: entity.richDescription ?? "",
  brandId: entity.brand?.id ?? "",
  categoryIds: entity.categories.map((c) => c.id),
  metaTitle: entity.metaTitle ?? "",
  metaDescription: entity.metaDescription ?? "",
  scheduledPublishLocal: utcIsoToDatetimeLocalValue(entity.scheduledPublishAt ?? null)
});

export const CatalogProductEditPage = () => {
  const { productId } = useParams<{ productId: string }>();
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formInitRef = useRef<string | null>(null);

  const form = useForm<ProductEditFormValues>({
    defaultValues: {
      title: "",
      description: "",
      richDescription: "",
      brandId: "",
      categoryIds: [],
      metaTitle: "",
      metaDescription: "",
      scheduledPublishLocal: ""
    },
    mode: "onSubmit"
  });

  const q = useQuery({
    queryKey: ["admin-catalog-product", productId],
    queryFn: async () => {
      if (!accessToken || !productId) {
        throw new Error("Missing context.");
      }
      return getAdminCatalogProduct(accessToken, productId);
    },
    enabled: Boolean(accessToken && productId)
  });

  const categoriesQuery = useQuery({
    queryKey: ["admin-catalog-categories-options"],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return listAdminCatalogCategories(accessToken);
    },
    enabled: Boolean(accessToken)
  });

  const brandsQuery = useQuery({
    queryKey: ["admin-catalog-brands-options"],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return listAdminCatalogBrands(accessToken);
    },
    enabled: Boolean(accessToken)
  });

  const entity = q.data?.data.entity;
  const categories = categoriesQuery.data?.data.items ?? [];
  const brands = brandsQuery.data?.data.items ?? [];
  const categoryIds = form.watch("categoryIds");
  const brandIdWatch = form.watch("brandId");
  const pickerCategories = useMemo(
    () => categoriesForProductPicker(categories, categoryIds),
    [categories, categoryIds]
  );
  const pickerBrands = useMemo(
    () => brandsForProductPicker(brands, brandIdWatch?.trim() || undefined),
    [brands, brandIdWatch]
  );
  const isDirty = form.formState.isDirty;

  const auditCountQuery = useQuery({
    queryKey: ["admin-product-audit-count", productId],
    queryFn: async () => {
      if (!accessToken || !productId) {
        throw new Error("Missing context.");
      }
      return listAdminAuditLogs(accessToken, {
        page: 1,
        page_size: 1,
        entityType: "PRODUCT",
        entityId: productId
      });
    },
    enabled: Boolean(accessToken && productId && entity)
  });

  const auditChangeCount = auditCountQuery.isSuccess ? auditCountQuery.data.meta.totalItems : null;

  useEffect(() => {
    formInitRef.current = null;
  }, [productId]);

  useEffect(() => {
    if (!entity || !productId) {
      return;
    }
    if (formInitRef.current === productId) {
      return;
    }
    formInitRef.current = productId;
    form.reset(mapEntityToForm(entity));
  }, [entity, productId, form]);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname
  );

  const err =
    q.error instanceof ApiError ? q.error.message : q.error instanceof Error ? q.error.message : null;

  const toggleCategory = (id: string) => {
    const cur = form.getValues("categoryIds");
    const next = cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id];
    form.setValue("categoryIds", next, { shouldDirty: true, shouldValidate: true });
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken || !productId) {
      return;
    }
    setServerError(null);
    form.clearErrors();

    const parsed = productEditSchema.safeParse(form.getValues());
    if (!parsed.success) {
      applyZodIssuesToRhf(parsed.error.issues, form.setError);
      return;
    }

    const brandId = parsed.data.brandId?.trim();
    const schedLocal = (parsed.data.scheduledPublishLocal ?? "").trim();
    const scheduledPublishAt =
      schedLocal === "" ? null : (datetimeLocalValueToUtcIso(schedLocal) ?? null);

    setIsSubmitting(true);
    try {
      const res = await updateAdminCatalogProduct(accessToken, productId, {
        title: parsed.data.title,
        description: parsed.data.description?.trim() ? parsed.data.description : null,
        richDescription: parsed.data.richDescription?.trim() ? parsed.data.richDescription : null,
        metaTitle: parsed.data.metaTitle?.trim() ? parsed.data.metaTitle : null,
        metaDescription: parsed.data.metaDescription?.trim() ? parsed.data.metaDescription : null,
        scheduledPublishAt,
        brandId: brandId ? brandId : null,
        categoryIds: parsed.data.categoryIds
      });
      queryClient.setQueryData(["admin-catalog-product", productId], res);
      form.reset(mapEntityToForm(res.data.entity));
      await queryClient.invalidateQueries({ queryKey: ["admin-catalog-products"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-product-audit-count", productId] });
    } catch (e) {
      setServerError(e instanceof ApiError ? e.message : "Could not save product.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const runStatus = async (action: "publish" | "unpublish" | "archive") => {
    if (!accessToken || !productId) {
      return;
    }
    if (action === "archive") {
      if (!window.confirm("Archive this product? It cannot be sold while archived.")) {
        return;
      }
    }
    setStatusBusy(true);
    setServerError(null);
    try {
      const fn =
        action === "publish"
          ? publishAdminCatalogProduct
          : action === "unpublish"
            ? unpublishAdminCatalogProduct
            : archiveAdminCatalogProduct;
      await fn(accessToken, productId, {});
      await q.refetch();
      await queryClient.invalidateQueries({ queryKey: ["admin-catalog-products"] });
      if (action === "archive") {
        form.reset();
      }
    } catch (e) {
      setServerError(e instanceof ApiError ? e.message : "Status update failed.");
    } finally {
      setStatusBusy(false);
    }
  };

  if (!productId) {
    return <p className="text-sm text-slate-500">Missing product id.</p>;
  }

  return (
    <div className="space-y-6">
      {blocker.state === "blocked" ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="unsaved-title"
        >
          <div className="max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 id="unsaved-title" className="text-lg font-bold text-slate-900">
              Discard changes?
            </h2>
            <p className="mt-2 text-sm text-slate-600">You have unsaved edits. Leave without saving?</p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => blocker.reset()}
              >
                Keep editing
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                onClick={() => blocker.proceed()}
              >
                Leave page
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <PageHeader
        title="Edit product"
        description={
          entity ? (
            <span className="flex flex-wrap items-center gap-3">
              <span>
                Last saved <span className="font-semibold text-slate-700">{formatSaved(entity.updatedAt)}</span>
              </span>
              {isDirty ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                  <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />
                  Unsaved changes
                </span>
              ) : null}
            </span>
          ) : (
            "Load a product to edit catalog fields."
          )
        }
        actionMenuItems={[refreshDataMenuItem(queryClient, ["admin-catalog-product", productId])]}
      />
      <ProductAdminNav />

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
      ) : null}
      {serverError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{serverError}</div>
      ) : null}

      {q.isLoading || !entity ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <form id="catalog-product-edit" onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <span className="text-xs font-medium text-slate-500">Catalog status</span>
              <StatusBadge label={entity.status.replace(/_/g, " ")} tone={statusTone(entity.status)} />
              <span className="font-mono text-xs text-slate-500">{entity.slug}</span>
            </div>

            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              {sectionTitle(1, "Basic info")}
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                Product name *
                <input
                  {...form.register("title")}
                  className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#4f7ef8] focus:ring-1 focus:ring-[#4f7ef8]"
                />
                {form.formState.errors.title ? (
                  <span className="text-xs font-normal text-red-600">{form.formState.errors.title.message}</span>
                ) : null}
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                Description
                <textarea
                  {...form.register("description")}
                  rows={6}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#4f7ef8] focus:ring-1 focus:ring-[#4f7ef8]"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                Full description (rich HTML)
                <textarea
                  {...form.register("richDescription")}
                  rows={5}
                  className="rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs outline-none focus:border-[#4f7ef8] focus:ring-1 focus:ring-[#4f7ef8]"
                />
              </label>
            </div>

            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              {sectionTitle(2, "Organization")}
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                  Brand
                  <select
                    {...form.register("brandId")}
                    className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#4f7ef8] focus:ring-1 focus:ring-[#4f7ef8]"
                  >
                    <option value="">— None —</option>
                    {pickerBrands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Categories</p>
                <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
                  {pickerCategories.map((c) => (
                    <li key={c.id}>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={categoryIds.includes(c.id)}
                          onChange={() => toggleCategory(c.id)}
                        />
                        <span>{c.name}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              {sectionTitle(3, "SEO")}
              <p className="text-xs text-slate-500">Meta fields persist on the product. Slug is read-only here.</p>
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                Meta title
                <input
                  {...form.register("metaTitle")}
                  className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#4f7ef8] focus:ring-1 focus:ring-[#4f7ef8]"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                Meta description
                <textarea
                  {...form.register("metaDescription")}
                  rows={3}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#4f7ef8] focus:ring-1 focus:ring-[#4f7ef8]"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                URL slug
                <input
                  readOnly
                  value={entity.slug}
                  className="h-11 cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-sm text-slate-600"
                />
              </label>
            </div>

            <div className="rounded-xl border border-red-200 bg-red-50/40 p-6 shadow-sm">
              <h3 className="text-sm font-bold text-red-800">Danger zone</h3>
              <p className="mt-2 text-xs text-red-900/80">
                Archiving hides the product from merchandising flows. Re-publish is not available for archived items
                from this screen.
              </p>
              <button
                type="button"
                disabled={statusBusy || entity.status === "ARCHIVED"}
                onClick={() => runStatus("archive")}
                className="mt-4 rounded-lg border-2 border-red-600 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                Archive product
              </button>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={isSubmitting || !accessToken}
                className="rounded-lg bg-[#4f7ef8] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-50"
              >
                {isSubmitting ? "Saving…" : "Save changes"}
              </button>
              <Link
                to={`/admin/catalog/products/${productId}`}
                className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </Link>
            </div>
          </div>

          <div className="space-y-4 lg:col-span-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800">Publish</h3>
              <div className="mt-3 flex flex-col gap-2">
                {entity.status !== "PUBLISHED" ? (
                  <button
                    type="button"
                    disabled={statusBusy || entity.status === "ARCHIVED"}
                    onClick={() => runStatus("publish")}
                    className="h-10 rounded-lg bg-[#4f7ef8] text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
                  >
                    Publish
                  </button>
                ) : null}
                {entity.status === "PUBLISHED" ? (
                  <button
                    type="button"
                    disabled={statusBusy}
                    onClick={() => runStatus("unpublish")}
                    className="h-10 rounded-lg border border-slate-200 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    Unpublish (draft)
                  </button>
                ) : null}
                <button
                  type="submit"
                  form="catalog-product-edit"
                  disabled={isSubmitting}
                  className="h-10 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Save draft
                </button>
              </div>
              <label className="mt-3 flex flex-col gap-1 text-xs font-medium text-slate-500">
                Schedule publish (local time)
                <input
                  type="datetime-local"
                  {...form.register("scheduledPublishLocal")}
                  className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#4f7ef8] focus:ring-1 focus:ring-[#4f7ef8]"
                />
              </label>
              <p className="mt-2 text-[11px] text-slate-400">
                Clear the field and save to remove the schedule. Visibility still follows manual publish until a worker
                runs.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800">Change history</h3>
              <p className="mt-2 text-xs text-slate-500">
                Audit entries capture who changed catalog fields, pricing, and lifecycle events.
              </p>
              {auditCountQuery.isLoading ? (
                <p className="mt-2 text-xs text-slate-400">Counting audit entries…</p>
              ) : auditChangeCount != null ? (
                <Link
                  to={`/admin/security/audit-logs?entityType=PRODUCT&entityId=${encodeURIComponent(productId!)}`}
                  className="mt-3 inline-flex text-sm font-semibold text-[#4f7ef8] hover:underline"
                >
                  View {auditChangeCount.toLocaleString()} change{auditChangeCount === 1 ? "" : "s"} →
                </Link>
              ) : (
                <Link
                  to={`/admin/security/audit-logs?entityType=PRODUCT&entityId=${encodeURIComponent(productId!)}`}
                  className="mt-3 inline-flex text-sm font-semibold text-[#4f7ef8] hover:underline"
                >
                  View audit history →
                </Link>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800">Pricing & inventory</h3>
              <p className="mt-2 text-xs text-slate-500">
                Use the Pricing and Inventory tabs for variant-level price and stock operations.
              </p>
              <div className="mt-3 flex flex-col gap-2">
                <Link
                  to={`/admin/catalog/products/${productId}/pricing`}
                  className="text-sm font-semibold text-[#4f7ef8] hover:underline"
                >
                  Open pricing
                </Link>
                <Link
                  to={`/admin/catalog/products/${productId}/inventory`}
                  className="text-sm font-semibold text-[#4f7ef8] hover:underline"
                >
                  Open inventory
                </Link>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};
