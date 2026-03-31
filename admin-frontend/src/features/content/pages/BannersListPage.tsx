import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { ImageIcon, X } from "lucide-react";

import { ConfirmDialog } from "@/components/primitives/ConfirmDialog";
import { PageHeader } from "@/components/primitives/PageHeader";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import {
  ApiError,
  createAdminBanner,
  createContentMediaUploadIntent,
  deleteAdminBanner,
  listAdminBanners,
  publishAdminBanner,
  unpublishAdminBanner,
  updateAdminBanner,
  type BannerListItem
} from "@/features/content/api/admin-content.api";
import { refreshDataMenuItem } from "@/lib/page-action-menu";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { ContentWorkspaceNav, StitchFieldLabel, StitchPageBody, stitchInputClass } from "@/components/stitch";

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 8 * 1024 * 1024;

const bannerPrimaryActionClass =
  "inline-flex items-center justify-center gap-2 rounded-sm bg-gradient-to-br from-[#1653cc] to-[#3b6de6] px-5 py-2.5 font-headline text-sm font-semibold text-white shadow-lg shadow-[#1653cc]/20 transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100";

const formatShortDate = (iso: string | null | undefined) => {
  if (!iso) {
    return "NOT SET";
  }
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const statusPill = (status: string) => {
  const s = status.toUpperCase();
  if (s === "PUBLISHED") {
    return (
      <span className="flex items-center rounded-full bg-white/90 px-2 py-0.5 text-[0.625rem] font-bold text-[#006b2d] shadow-sm backdrop-blur-sm">
        <span className="mr-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#22c55e]" />
        LIVE
      </span>
    );
  }
  if (s === "DRAFT") {
    return (
      <span className="flex items-center rounded-full bg-slate-500/90 px-2 py-0.5 text-[0.625rem] font-bold uppercase text-white backdrop-blur-sm">
        <span className="mr-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-200" />
        Draft
      </span>
    );
  }
  return (
    <span className="flex items-center rounded-full bg-white/90 px-2 py-0.5 text-[0.625rem] font-bold uppercase text-[#1653cc] backdrop-blur-sm">
      <span className="mr-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1653cc]" />
      {status.replace(/_/g, " ")}
    </span>
  );
};

type PanelMode = "closed" | "create" | "edit" | "view";

export const BannersListPage = () => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const [placementFilter, setPlacementFilter] = useState("");
  const [panelMode, setPanelMode] = useState<PanelMode>("closed");
  const [panelBanner, setPanelBanner] = useState<BannerListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BannerListItem | null>(null);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return deleteAdminBanner(accessToken, id);
    },
    onSuccess: () => {
      setDeleteTarget(null);
      setDeleteErr(null);
      invalidate();
    },
    onError: (e) => {
      setDeleteErr(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Delete failed.");
    }
  });

  const listQuery = useQuery({
    queryKey: ["admin-banners"],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return listAdminBanners(accessToken);
    },
    enabled: Boolean(accessToken)
  });

  const items = listQuery.data?.data.items ?? [];

  const placements = useMemo(() => {
    const s = new Set<string>();
    items.forEach((b) => s.add(b.placement || "DEFAULT"));
    return ["", ...[...s].sort()];
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((b) => {
      if (statusFilter && b.status !== statusFilter) {
        return false;
      }
      if (placementFilter && (b.placement || "DEFAULT") !== placementFilter) {
        return false;
      }
      return true;
    });
  }, [items, statusFilter, placementFilter]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
  };

  const errorMessage =
    listQuery.error instanceof ApiError
      ? listQuery.error.message
      : listQuery.error instanceof Error
        ? listQuery.error.message
        : null;

  const openCreate = () => {
    setPanelBanner(null);
    setPanelMode("create");
  };

  const openEdit = (b: BannerListItem) => {
    setPanelBanner(b);
    setPanelMode("edit");
  };

  const openView = (b: BannerListItem) => {
    setPanelBanner(b);
    setPanelMode("view");
  };

  const closePanel = () => {
    setPanelMode("closed");
    setPanelBanner(null);
  };

  return (
    <StitchPageBody>
      <ContentWorkspaceNav />
      <PageHeader
        title="Banners"
        titleSize="deck"
        description="Manage global promotional assets and storefront placements."
        actionMenuItems={[refreshDataMenuItem(queryClient, ["admin-banners"])]}
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center rounded-sm bg-gradient-to-br from-[#1653cc] to-[#3b6de6] px-5 py-2.5 font-headline text-sm font-semibold text-white shadow-lg shadow-[#1653cc]/20 transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <MaterialIcon name="add_circle" className="mr-2 text-lg text-white" />
            Create Banner
          </button>
        }
      />

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div>
      ) : null}

      <div className="flex flex-wrap items-center gap-6 rounded-sm border border-[#737685]/15 bg-white p-4 shadow-sm">
        <div className="flex min-w-[160px] flex-col gap-1">
          <label className="px-1 text-[0.625rem] font-bold uppercase tracking-widest text-slate-400">Filter by Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="cursor-pointer border-none bg-transparent text-sm font-medium text-[#181b25] focus:ring-0"
          >
            <option value="">All Statuses</option>
            <option value="PUBLISHED">Published</option>
            <option value="DRAFT">Draft</option>
          </select>
        </div>
        <div className="hidden h-8 w-px bg-slate-100 sm:block" />
        <div className="flex min-w-[180px] flex-col gap-1">
          <label className="px-1 text-[0.625rem] font-bold uppercase tracking-widest text-slate-400">Position Placement</label>
          <select
            value={placementFilter}
            onChange={(e) => setPlacementFilter(e.target.value)}
            className="cursor-pointer border-none bg-transparent text-sm font-medium text-[#181b25] focus:ring-0"
          >
            {placements.map((p) => (
              <option key={p || "all"} value={p}>
                {p ? p.replace(/_/g, " ") : "All Positions"}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => {
            setStatusFilter("");
            setPlacementFilter("");
          }}
          className="flex items-center text-xs font-semibold uppercase tracking-wider text-slate-400 transition-colors hover:text-[#181b25]"
        >
          <MaterialIcon name="filter_alt_off" className="mr-1 text-sm" />
          Reset Filters
        </button>
      </div>

      {listQuery.isLoading ? (
        <p className="text-sm text-slate-500">Loading banners…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-sm border border-dashed border-slate-200 bg-white py-16 text-center text-sm text-slate-500">
          No banners match the current filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((b) => (
            <BannerCard
              key={b.id}
              banner={b}
              accessToken={accessToken}
              onInvalidate={invalidate}
              onEdit={() => openEdit(b)}
              onView={() => openView(b)}
              onRequestDelete={() => setDeleteTarget(b)}
            />
          ))}
        </div>
      )}

      {panelMode !== "closed" ? (
        <BannerEditorPanel
          key={`${panelMode}-${panelBanner?.id ?? "new"}`}
          accessToken={accessToken}
          mode={panelMode === "view" ? "view" : panelMode === "create" ? "create" : "edit"}
          banner={panelBanner}
          onClose={closePanel}
          onSwitchToEdit={() => setPanelMode("edit")}
          onSaved={() => {
            invalidate();
            closePanel();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete this banner?"
        body={
          deleteErr
            ? deleteErr
            : "This removes the banner record from the admin catalog. It cannot be undone."
        }
        confirmLabel="Delete"
        danger
        confirmDisabled={deleteMut.isPending}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteErr(null);
        }}
        onConfirm={() => {
          if (!deleteTarget) {
            return;
          }
          setDeleteErr(null);
          deleteMut.mutate(deleteTarget.id);
        }}
      />
    </StitchPageBody>
  );
};

const BannerCard = ({
  banner,
  accessToken,
  onInvalidate,
  onEdit,
  onView,
  onRequestDelete
}: {
  banner: BannerListItem;
  accessToken: string | null;
  onInvalidate: () => void;
  onEdit: () => void;
  onView: () => void;
  onRequestDelete: () => void;
}) => {
  const publishMut = useMutation({
    mutationFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return publishAdminBanner(accessToken, banner.id);
    },
    onSuccess: onInvalidate
  });
  const unpublishMut = useMutation({
    mutationFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return unpublishAdminBanner(accessToken, banner.id);
    },
    onSuccess: onInvalidate
  });

  const published = banner.status.toUpperCase() === "PUBLISHED";
  const mutating = publishMut.isPending || unpublishMut.isPending;

  return (
    <div className="group overflow-hidden rounded-sm border border-[#737685]/15 bg-white transition-all duration-300 hover:border-[#1653cc]/30">
      <button
        type="button"
        onClick={onView}
        className="relative block aspect-video w-full overflow-hidden bg-slate-100 text-left"
      >
        {banner.mediaUrl ? (
          <img
            src={banner.mediaUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-slate-200">
            <ImageIcon className="h-12 w-12 text-slate-300" aria-hidden />
          </div>
        )}
        <div className="absolute left-3 top-3 flex gap-2">{statusPill(banner.status)}</div>
      </button>
      <div className="p-5">
        <div className="mb-2">
          <h3 className="font-headline text-base font-bold leading-tight text-[#181b25]">
            {banner.title ?? "Untitled banner"}
          </h3>
        </div>
        <div className="mb-4 flex items-center">
          <span className="rounded-sm bg-slate-100 px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-tight text-slate-600">
            {(banner.placement || "DEFAULT").replace(/_/g, " ")}
          </span>
        </div>
        <div className="mb-5 space-y-2 border-t border-slate-50 pt-4">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Last updated</span>
            <span className="font-mono text-[#181b25]">{formatShortDate(banner.updatedAt)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Sort order</span>
            <span className="font-mono text-[#181b25]">{banner.sortOrder}</span>
          </div>
          {banner.linkUrl ? (
            <div className="truncate text-xs text-[#1653cc]">
              <a href={banner.linkUrl} target="_blank" rel="noreferrer" className="underline" onClick={(e) => e.stopPropagation()}>
                {banner.linkUrl}
              </a>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onView}
            className="flex-1 rounded-sm bg-slate-50 py-2 text-xs font-bold text-[#181b25] transition-colors hover:bg-slate-100"
          >
            VIEW
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="flex-1 rounded-sm bg-slate-50 py-2 text-xs font-bold text-[#181b25] transition-colors hover:bg-slate-100"
          >
            EDIT
          </button>
          {published ? (
            <button
              type="button"
              disabled={mutating}
              onClick={() => unpublishMut.mutate()}
              className="rounded-sm border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Unpublish
            </button>
          ) : (
            <button
              type="button"
              disabled={mutating}
              onClick={() => publishMut.mutate()}
              className="rounded-sm border border-[#1653cc]/30 bg-[#1653cc]/5 px-3 py-2 text-xs font-bold text-[#1653cc] hover:bg-[#1653cc]/10 disabled:opacity-50"
            >
              Publish
            </button>
          )}
          <button
            type="button"
            onClick={onRequestDelete}
            className="rounded-sm bg-slate-50 px-3 py-2 text-slate-400 transition-colors hover:bg-[#ffdad6] hover:text-[#ba1a1a]"
            aria-label="Delete banner"
          >
            <MaterialIcon name="delete" className="text-lg" />
          </button>
        </div>
      </div>
    </div>
  );
};

const BannerEditorPanel = ({
  accessToken,
  mode,
  banner,
  onClose,
  onSwitchToEdit,
  onSaved
}: {
  accessToken: string | null;
  mode: "create" | "edit" | "view";
  banner: BannerListItem | null;
  onClose: () => void;
  onSwitchToEdit?: () => void;
  onSaved: () => void;
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [placement, setPlacement] = useState("HERO");
  const [sortOrder, setSortOrder] = useState("0");
  const [title, setTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const saveDoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mediaMeta, setMediaMeta] = useState<{
    mediaUrl: string;
    mediaPublicId: string;
    mediaMimeType?: string;
    mediaFileSizeBytes?: number;
    mediaOriginalFilename?: string;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (saveDoneTimerRef.current) {
        clearTimeout(saveDoneTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setLocalError(null);
    setJustSaved(false);
    setUploadBusy(false);
    setMediaMeta(null);
    if (banner) {
      setPlacement(banner.placement || "HERO");
      setSortOrder(String(banner.sortOrder ?? 0));
      setTitle(banner.title ?? "");
      setLinkUrl(banner.linkUrl ?? "");
      setPreviewUrl(banner.mediaUrl);
    } else {
      setPlacement("HERO");
      setSortOrder("0");
      setTitle("");
      setLinkUrl("");
      setPreviewUrl(null);
    }
  }, [banner, mode]);

  const readOnly = mode === "view";

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      setLocalError(null);
      const so = Number.parseInt(sortOrder, 10);
      if (!Number.isFinite(so) || so < 0) {
        throw new Error("Sort order must be a non-negative integer.");
      }
      const link = linkUrl.trim();
      const payload = {
        placement: placement.trim() || "HERO",
        sortOrder: so,
        title: title.trim() || undefined,
        ...(mode === "create"
          ? link
            ? { linkUrl: link }
            : {}
          : { linkUrl: link || null })
      };
      const mediaPatch =
        mediaMeta?.mediaUrl && mediaMeta.mediaPublicId
          ? {
              mediaUrl: mediaMeta.mediaUrl,
              mediaStorageProvider: "cloudinary" as const,
              mediaPublicId: mediaMeta.mediaPublicId,
              mediaResourceType: "image" as const,
              mediaDeliveryType: "upload" as const,
              mediaMimeType: mediaMeta.mediaMimeType,
              mediaFileSizeBytes: mediaMeta.mediaFileSizeBytes,
              mediaOriginalFilename: mediaMeta.mediaOriginalFilename
            }
          : {};
      if (mode === "create") {
        return createAdminBanner(accessToken, {
          ...payload,
          status: "DRAFT",
          ...mediaPatch
        });
      }
      if (!banner) {
        throw new Error("Missing banner.");
      }
      return updateAdminBanner(accessToken, banner.id, {
        ...payload,
        ...mediaPatch
      });
    },
    onSuccess: () => {
      setJustSaved(true);
      if (saveDoneTimerRef.current) {
        clearTimeout(saveDoneTimerRef.current);
      }
      saveDoneTimerRef.current = setTimeout(() => {
        saveDoneTimerRef.current = null;
        setJustSaved(false);
        onSaved();
      }, 800);
    },
    onError: (e) => {
      setLocalError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Save failed.");
    }
  });

  const handleSave = useCallback(() => {
    if (readOnly) {
      return;
    }
    saveMut.mutate();
  }, [readOnly, saveMut]);

  const uploadFile = useCallback(
    async (file: File) => {
      if (!accessToken || readOnly) {
        return;
      }
      if (!ACCEPT.split(",").some((t) => file.type === t)) {
        setLocalError("Use JPG, PNG, or WebP.");
        return;
      }
      if (file.size > MAX_BYTES) {
        setLocalError("Image must be 8MB or smaller.");
        return;
      }
      setLocalError(null);
      setUploadBusy(true);
      try {
        const intentRes = await createContentMediaUploadIntent(accessToken, {
          fileName: file.name,
          contentType: file.type,
          fileSizeBytes: file.size,
          resourceType: "image"
        });
        const intent = intentRes.data.entity;
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
        setPreviewUrl(url);
        setMediaMeta({
          mediaUrl: url,
          mediaPublicId: intent.publicId,
          mediaMimeType: file.type,
          mediaFileSizeBytes: file.size,
          mediaOriginalFilename: file.name
        });
      } catch (e) {
        setLocalError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Upload failed.");
      } finally {
        setUploadBusy(false);
      }
    },
    [accessToken, readOnly]
  );

  return (
    <div className="fixed inset-0 z-[55] flex justify-end bg-black/40">
      <button type="button" className="h-full flex-1 cursor-default" aria-label="Close panel" onClick={onClose} />
      <div className="flex h-[100dvh] max-h-[100dvh] w-full max-w-lg flex-col overflow-hidden border-l border-[#737685]/20 bg-white shadow-2xl">
        <div className="h-1 shrink-0 bg-gradient-to-r from-[#1653cc] to-[#3b6de6]" />
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#737685]/10 bg-[#f2f3ff]/40 px-5 py-4">
          <h2 className="min-w-0 flex-1 font-headline text-lg font-bold text-[#181b25]">
            {mode === "create" ? "New banner" : mode === "edit" ? "Edit banner" : "Banner detail"}
          </h2>
          <div className="flex shrink-0 items-center gap-2">
            {!readOnly ? (
              <button
                type="button"
                disabled={saveMut.isPending || justSaved}
                className={clsx(bannerPrimaryActionClass, "py-2 pl-3 pr-4 text-xs")}
                onClick={handleSave}
              >
                <MaterialIcon name="save" className="text-base text-white" />
                {saveMut.isPending ? "Saving…" : justSaved ? "Saved" : mode === "create" ? "Create draft" : "Save"}
              </button>
            ) : null}
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-[#737685] hover:bg-[#f2f3ff]" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <form
          id="banner-editor-panel-form"
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {justSaved ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">
              Saved successfully.
            </div>
          ) : null}
          {localError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{localError}</div>
          ) : null}
          <div className="relative aspect-video overflow-hidden rounded-lg bg-slate-100">
            {previewUrl ? (
              <img src={previewUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">No image</div>
            )}
          </div>
          {!readOnly ? (
            <div>
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    void uploadFile(f);
                  }
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                disabled={uploadBusy}
                onClick={() => fileRef.current?.click()}
                className="w-full rounded-lg border border-[#1653cc]/25 bg-white py-2.5 text-sm font-semibold text-[#1653cc] shadow-sm transition-colors hover:bg-[#f2f3ff] disabled:opacity-50"
              >
                {uploadBusy ? "Uploading…" : "Upload image"}
              </button>
              <p className="mt-1 text-xs text-[#737685]">JPG, PNG, or WebP · max 8MB. Cloudinary must be configured on the API.</p>
            </div>
          ) : null}
          <label className="block">
            <StitchFieldLabel>Placement</StitchFieldLabel>
            <input
              value={placement}
              onChange={(e) => setPlacement(e.target.value)}
              disabled={readOnly}
              list="banner-placements"
              className={clsx(stitchInputClass, readOnly && "cursor-not-allowed opacity-80")}
            />
            <datalist id="banner-placements">
              <option value="HERO" />
              <option value="SIDEBAR" />
              <option value="FOOTER" />
              <option value="CATEGORY_TOP" />
              <option value="CHECKOUT_STRIP" />
            </datalist>
          </label>
          <label className="block">
            <StitchFieldLabel>Sort order</StitchFieldLabel>
            <input
              type="number"
              min={0}
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              disabled={readOnly}
              className={clsx(stitchInputClass, readOnly && "cursor-not-allowed opacity-80")}
            />
          </label>
          <label className="block">
            <StitchFieldLabel>Title</StitchFieldLabel>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={readOnly}
              className={clsx(stitchInputClass, readOnly && "cursor-not-allowed opacity-80")}
            />
          </label>
          <label className="block">
            <StitchFieldLabel>Link URL</StitchFieldLabel>
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              disabled={readOnly}
              placeholder="https://…"
              className={clsx(stitchInputClass, readOnly && "cursor-not-allowed opacity-80")}
            />
          </label>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 border-t border-[#737685]/15 bg-[#f2f3ff]/30 px-5 py-4 shadow-[0_-8px_24px_rgba(22,83,204,0.08)]">
            {readOnly ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  Close
                </button>
                {banner && onSwitchToEdit ? (
                  <button
                    type="button"
                    onClick={onSwitchToEdit}
                    className="rounded-lg bg-[#1653cc] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3b6de6]"
                  >
                    Edit
                  </button>
                ) : null}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saveMut.isPending || justSaved}
                  className={clsx(bannerPrimaryActionClass, "min-w-[160px] flex-1 py-3 sm:flex-none")}
                  onClick={handleSave}
                >
                  <MaterialIcon name="save" className="text-lg text-white" />
                  {saveMut.isPending ? "Saving…" : justSaved ? "Saved" : mode === "create" ? "Create draft" : "Save changes"}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
