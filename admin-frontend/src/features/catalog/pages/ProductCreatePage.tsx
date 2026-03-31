import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { PageHeader } from "@/components/primitives/PageHeader";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import {
  ApiError,
  createAdminCatalogProduct,
  listAdminCatalogBrands,
  listAdminCatalogCategories
} from "@/features/catalog/api/admin-catalog.api";
import { applyZodIssuesToRhf } from "@/lib/forms/apply-zod-issues";
import { datetimeLocalValueToUtcIso } from "@/features/catalog/lib/datetime-local";
import { brandsForProductPicker, categoriesForProductPicker } from "@/features/catalog/lib/taxonomyPicker";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const productCreateSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(3, "Slug must be at least 3 characters.")
    .max(150)
    .regex(slugRegex, "Use lowercase letters, numbers, and single hyphens (e.g. summer-tote)."),
  title: z.string().trim().min(1, "Title is required.").max(255),
  description: z.string().trim().max(10_000).optional(),
  richDescription: z.string().trim().max(50_000).optional(),
  brandId: z.string().optional(),
  initialVariantSku: z.string().trim().max(120).optional(),
  categoryIds: z.array(z.string().uuid()).default([]),
  metaTitle: z.string().trim().max(255).optional(),
  metaDescription: z.string().trim().max(2000).optional(),
  scheduledPublishLocal: z.string().optional(),
  tagsInput: z.string().trim().max(500).optional()
});

type ProductCreateFormValues = z.infer<typeof productCreateSchema>;

const sectionTitle = (n: number, label: string) => (
  <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
    <span className="mr-2 text-[#4f7ef8]">{n}.</span>
    {label}
  </h2>
);

export const ProductCreatePage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ProductCreateFormValues>({
    defaultValues: {
      slug: "",
      title: "",
      description: "",
      brandId: "",
      initialVariantSku: "",
      categoryIds: [],
      metaTitle: "",
      metaDescription: "",
      richDescription: "",
      scheduledPublishLocal: "",
      tagsInput: ""
    },
    mode: "onSubmit"
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

  const toggleCategory = (id: string) => {
    const cur = form.getValues("categoryIds");
    const next = cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id];
    form.setValue("categoryIds", next, { shouldDirty: true, shouldValidate: true });
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError(null);
    form.clearErrors();

    const parsed = productCreateSchema.safeParse(form.getValues());

    if (!parsed.success) {
      applyZodIssuesToRhf(parsed.error.issues, form.setError);
      return;
    }

    if (!accessToken) {
      setServerError("Not signed in.");
      return;
    }

    const brandId = parsed.data.brandId?.trim();
    const scheduledIso = datetimeLocalValueToUtcIso(parsed.data.scheduledPublishLocal ?? "");
    const body: Parameters<typeof createAdminCatalogProduct>[1] = {
      slug: parsed.data.slug,
      title: parsed.data.title,
      categoryIds: parsed.data.categoryIds,
      ...(parsed.data.description ? { description: parsed.data.description } : {}),
      ...(parsed.data.richDescription?.trim() ? { richDescription: parsed.data.richDescription.trim() } : {}),
      ...(parsed.data.metaTitle?.trim() ? { metaTitle: parsed.data.metaTitle.trim() } : {}),
      ...(parsed.data.metaDescription?.trim() ? { metaDescription: parsed.data.metaDescription.trim() } : {}),
      ...(scheduledIso ? { scheduledPublishAt: scheduledIso } : {}),
      ...(brandId ? { brandId } : {}),
      ...(parsed.data.initialVariantSku?.trim()
        ? { initialVariantSku: parsed.data.initialVariantSku.trim() }
        : {})
    };

    setIsSubmitting(true);
    try {
      const res = await createAdminCatalogProduct(accessToken, body);
      await queryClient.invalidateQueries({ queryKey: ["admin-catalog-products"] });
      navigate(`/admin/catalog/products/${res.data.entity.id}`, { replace: true });
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Could not create product.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create product"
        description={
          <span className="flex flex-wrap items-center gap-3">
            <span>
              Add a draft product. SEO, schedule, and rich description persist on the product; a future worker can
              publish when the scheduled time is reached.
            </span>
            {isDirty ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />
                Unsaved changes
              </span>
            ) : null}
          </span>
        }
        meta={
          <Link to="/admin/catalog/products" className="text-sm font-semibold text-[#4f7ef8] hover:underline">
            ← Product list
          </Link>
        }
      />

      {serverError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{serverError}</div>
      ) : null}

      <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            {sectionTitle(1, "Basic info")}
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              Product name *
              <input
                {...form.register("title")}
                className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#4f7ef8] focus:ring-1 focus:ring-[#4f7ef8]"
                placeholder="Summer tote"
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
                placeholder="Listing copy and product story (plain text)."
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              Full description (rich HTML)
              <textarea
                {...form.register("richDescription")}
                rows={6}
                className="rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs outline-none focus:border-[#4f7ef8] focus:ring-1 focus:ring-[#4f7ef8]"
                placeholder="Optional HTML for PDP; sanitize before storefront render."
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
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                Tags
                <input
                  {...form.register("tagsInput")}
                  className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#4f7ef8] focus:ring-1 focus:ring-[#4f7ef8]"
                  placeholder="Comma-separated (not saved yet)"
                />
              </label>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Categories</p>
              {categoriesQuery.isLoading ? (
                <p className="mt-2 text-sm text-slate-500">Loading categories…</p>
              ) : categories.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No categories in the system yet.</p>
              ) : (
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
                        <span className="text-xs text-slate-400">({c.slug})</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            {sectionTitle(3, "SEO")}
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              Meta title
              <input
                {...form.register("metaTitle")}
                className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#4f7ef8] focus:ring-1 focus:ring-[#4f7ef8]"
                placeholder="Saved on the product"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              Meta description
              <textarea
                {...form.register("metaDescription")}
                rows={3}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#4f7ef8] focus:ring-1 focus:ring-[#4f7ef8]"
                placeholder="Saved on the product"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              URL slug *
              <input
                {...form.register("slug")}
                autoComplete="off"
                className="h-11 rounded-lg border border-slate-200 px-3 font-mono text-sm outline-none focus:border-[#4f7ef8] focus:ring-1 focus:ring-[#4f7ef8]"
                placeholder="summer-tote"
              />
              {form.formState.errors.slug ? (
                <span className="text-xs font-normal text-red-600">{form.formState.errors.slug.message}</span>
              ) : null}
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={isSubmitting || !accessToken}
              className="rounded-lg bg-[#4f7ef8] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-50"
            >
              {isSubmitting ? "Saving…" : "Save draft"}
            </button>
            <Link
              to="/admin/catalog/products"
              className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Link>
          </div>
        </div>

        <div className="space-y-4 lg:col-span-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800">Publish</h3>
            <p className="mt-2 text-xs text-slate-500">
              New products are created in <strong>Draft</strong>. Publish from the overview or edit screen once content
              is ready.
            </p>
            <div className="mt-4 space-y-3 text-xs text-slate-600">
              <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <span>Status</span>
                <span className="font-semibold text-slate-800">Draft</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <span>Visibility</span>
                <span className="font-semibold text-slate-800">Private</span>
              </div>
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
              Stored as UTC on save. A worker can promote draft → published when due.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800">Pricing</h3>
            <p className="mt-2 text-xs text-slate-500">Set base and compare-at prices on the Pricing tab after creation.</p>
            <div className="mt-4 space-y-2">
              <input
                disabled
                className="h-11 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-400"
                placeholder="Base price"
              />
              <input
                disabled
                className="h-11 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-400"
                placeholder="Compare-at price"
              />
              <input
                disabled
                className="h-11 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-400"
                placeholder="Cost (private)"
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800">Inventory</h3>
            <label className="mt-3 flex flex-col gap-1 text-xs font-medium text-slate-500">
              Initial variant SKU
              <input
                {...form.register("initialVariantSku")}
                className="h-11 rounded-lg border border-slate-200 px-3 font-mono text-sm outline-none focus:border-[#4f7ef8] focus:ring-1 focus:ring-[#4f7ef8]"
                placeholder="Optional default variant"
              />
              {form.formState.errors.initialVariantSku ? (
                <span className="text-xs font-normal text-red-600">
                  {form.formState.errors.initialVariantSku.message}
                </span>
              ) : null}
            </label>
            <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked disabled className="h-4 w-4 rounded border-slate-300" />
              Track inventory (on by default)
            </label>
            <input
              disabled
              className="mt-2 h-11 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-sm text-slate-400"
              placeholder="Barcode (optional)"
            />
          </div>
        </div>
      </form>
    </div>
  );
};
