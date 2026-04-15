import { useCallback, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";

import { CatalogTaxonomyImageUpload } from "@/components/catalog/CatalogTaxonomyImageUpload";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SurfaceCard } from "@/components/primitives/SurfaceCard";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { StitchFieldLabel, StitchPageBody, stitchInputClass } from "@/components/stitch";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import {
  ApiError,
  createAdminCatalogCategory,
  createCatalogCategoryMediaUploadIntent
} from "@/features/catalog/api/admin-catalog.api";

const primarySaveClass =
  "inline-flex items-center justify-center gap-2 rounded-sm bg-gradient-to-br from-[#1653cc] to-[#3b6de6] px-5 py-2.5 font-headline text-sm font-semibold text-white shadow-lg shadow-[#1653cc]/20 transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100";

export const CategoryCreatePage = () => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [publishImmediately, setPublishImmediately] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return createAdminCatalogCategory(accessToken, {
        slug: slug.trim(),
        name: name.trim(),
        ...(publishImmediately ? { status: "ACTIVE" as const } : {}),
        ...(imageUrl ? { imageUrl } : {})
      });
    },
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["admin-catalog-categories"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-catalog-categories-options"] });
      navigate(`/admin/catalog/categories/${res.data.entity.id}/edit`, { replace: true });
    },
    onError: (e: unknown) => {
      setMsg(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Save failed.");
    }
  });

  const submit = useCallback(() => {
    setMsg(null);
    mut.mutate();
  }, [mut]);

  return (
    <StitchPageBody>
      <PageHeader
        title="New category"
        description="Add a category shoppers see on the storefront. The URL slug must be unique."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={mut.isPending || !slug.trim() || !name.trim()}
              className={primarySaveClass}
              onClick={() => formRef.current?.requestSubmit()}
            >
              <MaterialIcon name="save" className="text-lg text-white" />
              {mut.isPending ? "Saving…" : "Save category"}
            </button>
            <Link
              to="/admin/catalog/categories"
              className="text-sm font-semibold text-[#1653cc] hover:underline"
            >
              Back to categories
            </Link>
          </div>
        }
      />
      {msg ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{msg}</div>
      ) : null}
      <SurfaceCard title="Details">
        <form
          ref={formRef}
          className="grid max-w-lg gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-1 rounded border-slate-300"
              checked={publishImmediately}
              onChange={(e) => setPublishImmediately(e.target.checked)}
            />
            <span>
              <span className="font-semibold text-slate-900">Publish immediately</span>
              <span className="mt-0.5 block text-xs font-normal text-slate-500">
                When unchecked, the category is created as a draft (hidden from the storefront until published).
              </span>
            </span>
          </label>
          <label className="block">
            <StitchFieldLabel>Display name</StitchFieldLabel>
            <input
              required
              className={stitchInputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Footwear"
            />
          </label>
          <label className="block">
            <StitchFieldLabel>URL slug</StitchFieldLabel>
            <input
              required
              className={`${stitchInputClass} font-mono`}
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
              placeholder="footwear"
            />
          </label>
          <CatalogTaxonomyImageUpload
            accessToken={accessToken}
            createIntent={createCatalogCategoryMediaUploadIntent}
            value={imageUrl}
            onChange={setImageUrl}
            label="Cover image (optional)"
            hint="Shown on category surfaces. Upload a wide image (JPG, PNG, WebP, or AVIF, max 8MB)."
            purpose="cover"
          />
          <div className="border-t border-[#737685]/10 pt-5">
            <button
              type="submit"
              disabled={mut.isPending || !slug.trim() || !name.trim()}
              className={`${primarySaveClass} w-full py-3 sm:w-auto sm:min-w-[220px]`}
            >
              <MaterialIcon name="save" className="text-lg text-white" />
              {mut.isPending ? "Saving…" : "Save category"}
            </button>
          </div>
        </form>
      </SurfaceCard>
    </StitchPageBody>
  );
};
