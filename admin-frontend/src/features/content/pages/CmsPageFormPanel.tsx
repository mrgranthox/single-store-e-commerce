import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { X } from "lucide-react";

import { useAdminAuthStore } from "@/features/auth/auth.store";
import {
  ApiError,
  createAdminContentPage,
  updateAdminContentPage,
  type ContentPageListItem,
  type CmsPageEntity
} from "@/features/content/api/admin-content.api";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

type Mode = "create" | "edit" | "view";

const BLOCK_TYPES = new Set(["heading", "intro", "paragraph", "body", "text"]);

const readBlockText = (b: Record<string, unknown>): string => {
  const t = b.text ?? b.content ?? b.body;
  return typeof t === "string" ? t : "";
};

const extractIntroBody = (content: Record<string, unknown> | undefined): { intro: string; body: string } => {
  const blocks = content?.blocks;
  if (!Array.isArray(blocks)) {
    return { intro: "", body: "" };
  }
  const intros: string[] = [];
  const bodies: string[] = [];
  for (const raw of blocks) {
    if (!raw || typeof raw !== "object" || !("type" in raw)) {
      continue;
    }
    const b = raw as Record<string, unknown>;
    const type = String(b.type ?? "");
    if (!BLOCK_TYPES.has(type)) {
      continue;
    }
    const text = readBlockText(b).trim();
    if (!text) {
      continue;
    }
    if (type === "heading" || type === "intro") {
      intros.push(text);
    }
    if (type === "paragraph" || type === "body" || type === "text") {
      bodies.push(text);
    }
  }
  return { intro: intros.join("\n"), body: bodies.join("\n\n") };
};

const mergeContentBlocks = (
  previous: Record<string, unknown> | undefined,
  intro: string,
  body: string
): Record<string, unknown> => {
  const prev = previous && typeof previous === "object" ? { ...previous } : {};
  const existing = Array.isArray(prev.blocks) ? [...(prev.blocks as unknown[])] : [];
  const preserved = existing.filter((raw) => {
    if (!raw || typeof raw !== "object" || !("type" in raw)) {
      return true;
    }
    const t = String((raw as Record<string, unknown>).type ?? "");
    return !BLOCK_TYPES.has(t);
  });
  const nextBlocks: unknown[] = [...preserved];
  const i = intro.trim();
  const b = body.trim();
  if (i) {
    nextBlocks.unshift({ type: "heading", text: i });
  }
  if (b) {
    nextBlocks.splice(i ? 1 : 0, 0, { type: "paragraph", text: b });
  }
  return { ...prev, blocks: nextBlocks };
};

export const CmsPageFormPanel = ({
  mode,
  page,
  onClose,
  onSwitchToEdit,
  onSaved
}: {
  mode: Mode;
  page: (ContentPageListItem & { content?: Record<string, unknown> }) | null;
  onClose: () => void;
  onSwitchToEdit?: () => void;
  onSaved: () => void;
}) => {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [intro, setIntro] = useState("");
  const [body, setBody] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setLocalError(null);
    if (page && (mode === "edit" || mode === "view")) {
      setSlug(page.slug);
      setTitle(page.title ?? "");
      setStatus(page.status);
      const c = (page as CmsPageEntity).content;
      const extracted = extractIntroBody(c);
      setIntro(extracted.intro);
      setBody(extracted.body);
    } else {
      setSlug("");
      setTitle("");
      setStatus("DRAFT");
      setIntro("");
      setBody("");
    }
  }, [page, mode]);

  const readOnly = mode === "view";

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      setLocalError(null);
      const content = mergeContentBlocks(
        page ? ((page as CmsPageEntity).content as Record<string, unknown> | undefined) : undefined,
        intro,
        body
      );
      if (mode === "create") {
        const s = slug.trim().replace(/^\//, "");
        if (s.length < 1) {
          throw new Error("Slug is required.");
        }
        return createAdminContentPage(accessToken, {
          slug: s,
          title: title.trim() || undefined,
          status,
          content
        });
      }
      if (!page) {
        throw new Error("Missing page.");
      }
      return updateAdminContentPage(accessToken, page.id, {
        title: title.trim() || undefined,
        status,
        content
      });
    },
    onSuccess: onSaved,
    onError: (e) => {
      setLocalError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Save failed.");
    }
  });

  return (
    <div className="fixed inset-0 z-[55] flex justify-end bg-black/40">
      <button type="button" className="h-full flex-1 cursor-default" aria-label="Close panel" onClick={onClose} />
      <div className="flex h-full w-full max-w-xl flex-col border-l border-[#c3c6d6]/25 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-1 rounded-full bg-[#1653cc]" />
            <h2 className="font-headline text-lg font-bold text-[#181b25]">
              {mode === "create" ? "New CMS page" : mode === "edit" ? "Edit page" : "Page detail"}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-[#f8f9fb]" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {localError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{localError}</div>
          ) : null}
          {mode === "create" ? (
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#737685]">URL slug</span>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                disabled={readOnly}
                placeholder="about-us"
                className="mt-1 w-full rounded-lg border border-[#e5e7eb] bg-[#f8f9fb] px-3 py-2 text-sm text-[#181b25] focus:border-[#1653cc] focus:outline-none focus:ring-1 focus:ring-[#1653cc]"
              />
            </label>
          ) : (
            <p className="text-sm text-[#434654]">
              Slug: <span className="font-mono font-semibold text-[#181b25]">/{slug.replace(/^\//, "")}</span>
            </p>
          )}
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#737685]">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={readOnly}
              className="mt-1 w-full rounded-lg border border-[#e5e7eb] bg-[#f8f9fb] px-3 py-2 text-sm text-[#181b25] focus:border-[#1653cc] focus:outline-none focus:ring-1 focus:ring-[#1653cc]"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#737685]">Workflow status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={readOnly}
              className="mt-1 w-full rounded-lg border border-[#e5e7eb] bg-[#f8f9fb] px-3 py-2 text-sm"
            >
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#737685]">Page headline</span>
            <input
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              disabled={readOnly}
              placeholder="Shown as the main heading on the page"
              className="mt-1 w-full rounded-lg border border-[#e5e7eb] bg-[#f8f9fb] px-3 py-2 text-sm text-[#181b25] focus:border-[#1653cc] focus:outline-none focus:ring-1 focus:ring-[#1653cc]"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#737685]">Body copy</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={readOnly}
              rows={12}
              placeholder="Main text visitors see below the headline."
              className="mt-1 w-full rounded-lg border border-[#e5e7eb] bg-[#f8f9fb] px-3 py-2 text-sm leading-relaxed text-[#181b25] focus:border-[#1653cc] focus:outline-none focus:ring-1 focus:ring-[#1653cc]"
            />
          </label>
          <p className="rounded-lg border border-[#1653cc]/15 bg-[#f2f3ff] px-3 py-2 text-xs text-[#434654]">
            Advanced layout blocks from earlier versions are kept when you save. Editing here updates the headline and body
            blocks only.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-slate-100 px-5 py-4">
          {readOnly ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-[#e5e7eb] px-4 py-2 text-sm font-semibold text-[#434654]"
              >
                Close
              </button>
              {page && onSwitchToEdit ? (
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
                className="rounded-lg border border-[#e5e7eb] px-4 py-2 text-sm font-semibold text-[#434654]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saveMut.isPending}
                onClick={() => saveMut.mutate()}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-br from-[#1653cc] to-[#3b6de6] px-4 py-2 text-sm font-semibold text-white shadow-md shadow-[#1653cc]/20 disabled:opacity-50"
              >
                <MaterialIcon name="save" className="text-base text-white" />
                {saveMut.isPending ? "Saving…" : mode === "create" ? "Create page" : "Save changes"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
