import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";

import { PageHeader } from "@/components/primitives/PageHeader";
import { SurfaceCard } from "@/components/primitives/SurfaceCard";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { ApiError, createAdminCatalogCategory } from "@/features/catalog/api/admin-catalog.api";

export const CategoryCreatePage = () => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
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
        ...(publishImmediately ? { status: "ACTIVE" as const } : {})
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="New category"
        description="Add a category shoppers see on the storefront. The URL slug must be unique."
        actions={
          <Link
            to="/admin/catalog/categories"
            className="text-sm font-semibold text-[#4f7ef8] hover:underline"
          >
            Back to categories
          </Link>
        }
      />
      {msg ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{msg}</div>
      ) : null}
      <SurfaceCard title="Details">
        <form
          className="grid max-w-lg gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setMsg(null);
            mut.mutate();
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
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Display name
            <input
              required
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Footwear"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            URL slug
            <input
              required
              className="rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
              placeholder="footwear"
            />
          </label>
          <button
            type="submit"
            disabled={mut.isPending || !slug.trim() || !name.trim()}
            className="w-fit rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {mut.isPending ? "Saving…" : "Create category"}
          </button>
        </form>
      </SurfaceCard>
    </div>
  );
};
