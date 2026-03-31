import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";

import { BannerLinkSelect } from "@/components/admin/BannerLinkSelect";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SurfaceCard } from "@/components/primitives/SurfaceCard";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { ApiError, createAdminCatalogBrand } from "@/features/catalog/api/admin-catalog.api";
import { listAdminBanners } from "@/features/content/api/admin-content.api";

const parseGalleryText = (text: string) =>
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

export const BrandCreatePage = () => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [publishImmediately, setPublishImmediately] = useState(false);
  const [bannerId, setBannerId] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [galleryText, setGalleryText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const bannersQ = useQuery({
    queryKey: ["admin-banners-picker"],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return listAdminBanners(accessToken);
    },
    enabled: Boolean(accessToken)
  });

  const mut = useMutation({
    mutationFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return createAdminCatalogBrand(accessToken, {
        slug: slug.trim(),
        name: name.trim(),
        ...(publishImmediately ? { status: "ACTIVE" as const } : {}),
        ...(bannerId.trim() ? { bannerId: bannerId.trim() } : {}),
        ...(logoUrl.trim() ? { logoUrl: logoUrl.trim() } : {}),
        ...(parseGalleryText(galleryText).length > 0 ? { galleryImageUrls: parseGalleryText(galleryText) } : {})
      });
    },
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["admin-catalog-brands"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-catalog-brands-options"] });
      navigate(`/admin/catalog/brands/${res.data.entity.id}/edit`, { replace: true });
    },
    onError: (e: unknown) => {
      setMsg(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Save failed.");
    }
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="New brand"
        description="Create a brand record for use on product detail and filters. The URL slug must be unique."
        actions={
          <Link to="/admin/catalog/brands" className="text-sm font-semibold text-[#4f7ef8] hover:underline">
            Back to brands
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
                When unchecked, the brand is created as a draft (not assignable to products until published).
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
              placeholder="e.g. Northwind"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            URL slug
            <input
              required
              className="rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
              placeholder="northwind"
            />
          </label>
          <BannerLinkSelect
            label="Linked banner (optional)"
            value={bannerId}
            onChange={setBannerId}
            banners={bannersQ.data?.data.items ?? []}
            loading={bannersQ.isLoading}
            hint="Most banners are not tied to a brand; linking is optional."
          />
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Logo URL (optional)
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://…"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Gallery image URLs (optional, one per line)
            <textarea
              className="min-h-[88px] rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
              value={galleryText}
              onChange={(e) => setGalleryText(e.target.value)}
              placeholder="https://…"
            />
          </label>
          <button
            type="submit"
            disabled={mut.isPending || !slug.trim() || !name.trim()}
            className="w-fit rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {mut.isPending ? "Saving…" : "Create brand"}
          </button>
        </form>
      </SurfaceCard>
    </div>
  );
};
