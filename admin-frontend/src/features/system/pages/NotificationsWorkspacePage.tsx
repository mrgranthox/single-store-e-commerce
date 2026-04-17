import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthedQuery } from "@/lib/api/useAuthedQuery";
import { z } from "zod";

import { preloadLazyNamedComponent } from "@/app/lazy-admin-routes";
import { DataTableShell } from "@/components/primitives/DataTableShell";
import { AsyncActionButton } from "@/components/primitives/AsyncActionButton";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SurfaceCard } from "@/components/primitives/SurfaceCard";
import { requestAdminStepUpToken } from "@/features/auth/step-up";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { useAdminAction } from "@/lib/admin-actions/useAdminAction";
import { useAdminDetailPrefetch } from "@/lib/performance/useAdminDetailPrefetch";
import { formatDateTime } from "@/lib/format";
import { CACHE } from "@/lib/api/cache-strategy";
import { QueryError } from "@/components/primitives/QueryError";
import { SkeletonTable } from "@/components/primitives/Skeleton";
import { useListFilters } from "@/lib/hooks/useListFilters";
import {
  ApiError,
  broadcastAdminNotifications,
  createAdminNotification,
  getAdminNotification,
  getBroadcastSegmentPreview,
  listAdminNotifications,
  retryAdminNotification,
  type BroadcastSegment,
  type NotificationRow
} from "@/features/system/api/admin-system.api";

const notificationDraftSchema = z.object({
  type: z.string().trim().min(1, "Notification type is required."),
  recipientEmail: z.string().trim().email("Enter a valid recipient email."),
  payloadJson: z.string().trim().min(2, "Payload JSON is required.")
});

const DEFAULT_PAYLOAD_TEMPLATE = `{
  "subject": "",
  "heading": "",
  "message": "",
  "detail": "",
  "ctaLabel": "",
  "ctaUrl": ""
}`;

const PAYLOAD_FIELD_HINT =
  "Payload fields used by email rendering: subject, heading, message, optional detail (extra copy), optional ctaLabel and ctaUrl. Type ADMIN_BROADCAST uses the announcement template; other types fall back to the generic template when unlisted.";

const SEGMENT_COPY: Record<BroadcastSegment, { label: string; description: string }> = {
  ALL_ACTIVE_CUSTOMERS: {
    label: "All active customers",
    description: "Every customer user with status ACTIVE (one queued email per user)."
  },
  MARKETING_OPT_IN: {
    label: "Marketing opt-in",
    description: "ACTIVE users who enabled marketing email in notification preferences."
  },
  ALL_ACTIVE_ADMINS: {
    label: "All active admins",
    description: "Every admin operator with status ACTIVE (one queued email per admin email)."
  }
};

type ComposeMode = "single" | "broadcast";

const NOTIFICATION_LIST_DEFAULTS = { status: "", type: "", recipient: "" };

export const NotificationsWorkspacePage = () => {
  const accessToken = useAdminAuthStore((state) => state.accessToken);
  const actorEmail = useAdminAuthStore((state) => state.actor?.email ?? null);
  const { filters, page, setPage, set, setDebounced } = useListFilters({ defaults: NOTIFICATION_LIST_DEFAULTS });
  const [composeMode, setComposeMode] = useState<ComposeMode>("single");
  const [broadcastSegment, setBroadcastSegment] = useState<BroadcastSegment>("ALL_ACTIVE_CUSTOMERS");
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [typeDraft, setTypeDraft] = useState("");
  const [recipientDraft, setRecipientDraft] = useState("");
  const [form, setForm] = useState({
    type: "ADMIN_BROADCAST",
    recipientEmail: "",
    payloadJson: DEFAULT_PAYLOAD_TEMPLATE
  });
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    setTypeDraft(filters.type);
    setRecipientDraft(filters.recipient);
  }, [filters.type, filters.recipient]);

  useEffect(() => {
    setPreviewCount(null);
    setPreviewError(null);
  }, [broadcastSegment, composeMode]);

  const draftValidation = useMemo(() => {
    const payloadJson = form.payloadJson.trim();
    if (payloadJson.length < 2) {
      return { ok: false as const, message: "Payload JSON is required." };
    }
    let payload: Record<string, unknown>;
    try {
      const parsedPayload = JSON.parse(payloadJson) as unknown;
      if (!parsedPayload || typeof parsedPayload !== "object" || Array.isArray(parsedPayload)) {
        return { ok: false as const, message: "Payload JSON must be an object." };
      }
      payload = parsedPayload as Record<string, unknown>;
    } catch {
      return { ok: false as const, message: "Payload JSON must be valid JSON." };
    }

    if (composeMode === "broadcast") {
      if (!form.type.trim()) {
        return { ok: false as const, message: "Notification type is required." };
      }
      return { ok: true as const, payload };
    }

    const parsed = notificationDraftSchema.safeParse(form);
    if (!parsed.success) {
      return {
        ok: false as const,
        message: parsed.error.issues[0]?.message ?? "Complete the notification draft."
      };
    }
    return { ok: true as const, payload };
  }, [form, composeMode]);

  const query = useAuthedQuery(
    ["admin-notifications", page, filters.status, filters.type, filters.recipient],
    (token) =>
      listAdminNotifications(token, {
        page,
        page_size: 20,
        status: filters.status || undefined,
        type: filters.type || undefined,
        recipientEmail: filters.recipient || undefined
      })
  );

  const refreshKeys = useMemo(() => [["admin-notifications"]] as const, []);

  const createMutation = useAdminAction({
    mutationFn: async () => {
      if (!accessToken) throw new Error("Not signed in.");
      if (!draftValidation.ok) {
        throw new Error(draftValidation.message);
      }
      const stepUpToken = await requestAdminStepUpToken({ accessToken, email: actorEmail });
      return createAdminNotification(
        accessToken,
        {
          type: form.type.trim(),
          recipientEmail: form.recipientEmail.trim(),
          payload: draftValidation.payload
        },
        stepUpToken
      );
    },
    isAvailable: composeMode === "single" && draftValidation.ok,
    invalidate: [...refreshKeys],
    onSuccess: () => {
      setFlash("Notification queued.");
      setForm((current) => ({ ...current, recipientEmail: "" }));
      window.setTimeout(() => setFlash(null), 3000);
    },
    onError: (error) => {
      setFlash(error instanceof ApiError ? error.message : "Notification create failed.");
      window.setTimeout(() => setFlash(null), 5000);
    }
  });

  const broadcastMutation = useAdminAction({
    mutationFn: async () => {
      if (!accessToken) throw new Error("Not signed in.");
      if (!draftValidation.ok) {
        throw new Error(draftValidation.message);
      }
      if (previewCount === null) {
        throw new Error("Preview the audience size before sending a broadcast.");
      }
      if (previewCount > 0) {
        const ok = window.confirm(
          `Send this message to ${previewCount} recipient(s) in segment "${SEGMENT_COPY[broadcastSegment].label}"? Each recipient gets a separate queued notification.`
        );
        if (!ok) {
          throw new Error("Broadcast cancelled.");
        }
      }
      const stepUpToken = await requestAdminStepUpToken({ accessToken, email: actorEmail });
      return broadcastAdminNotifications(
        accessToken,
        {
          segment: broadcastSegment,
          type: form.type.trim() || undefined,
          payload: draftValidation.payload
        },
        stepUpToken
      );
    },
    isAvailable:
      composeMode === "broadcast" &&
      draftValidation.ok &&
      previewCount !== null &&
      previewCount > 0,
    invalidate: [...refreshKeys],
    onSuccess: (result) => {
      const d = result.data;
      const parts = [
        `Broadcast queued: ${d.enqueued} of ${d.expectedRecipients} notifications.`,
        d.failed > 0 ? `${d.failed} enqueue(s) failed.` : null
      ].filter(Boolean);
      setFlash(parts.join(" "));
      setPreviewCount(null);
      window.setTimeout(() => setFlash(null), 8000);
    },
    onError: (error) => {
      setFlash(error instanceof ApiError ? error.message : "Broadcast failed.");
      window.setTimeout(() => setFlash(null), 6000);
    }
  });

  const retryMutation = useAdminAction({
    mutationFn: async (notificationId: string) => {
      if (!accessToken) throw new Error("Not signed in.");
      const stepUpToken = await requestAdminStepUpToken({ accessToken, email: actorEmail });
      return retryAdminNotification(accessToken, notificationId, stepUpToken);
    },
    invalidate: [...refreshKeys]
  });

  const loadPreview = async () => {
    if (!accessToken) return;
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const res = await getBroadcastSegmentPreview(accessToken, broadcastSegment);
      setPreviewCount(res.data.recipientCount);
    } catch (error) {
      setPreviewCount(null);
      setPreviewError(error instanceof ApiError ? error.message : "Could not load preview.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const items = query.data?.data.items ?? [];
  const meta = query.data?.meta;
  const { prefetch: prefetchNotification, prefetchMany: prefetchNotifications } = useAdminDetailPrefetch({
    enabled: Boolean(accessToken),
    ...CACHE.OPERATIONAL,
    queryKeyFor: (notificationId: string) => ["admin-notification", notificationId],
    queryFnFor: (notificationId: string) => getAdminNotification(accessToken!, notificationId),
    onPrefetch: () =>
      preloadLazyNamedComponent("../features/system/pages/NotificationDetailPage.tsx", "NotificationDetailPage")
  });

  useEffect(() => {
    prefetchNotifications(items.map((item) => item.id), 2);
  }, [items, prefetchNotifications]);

  const rows = items.map((item: NotificationRow) => [
    <Link
      key={`id-${item.id}`}
      to={`/admin/system/notifications/${item.id}`}
      onMouseEnter={() => prefetchNotification(item.id)}
      onFocus={() => prefetchNotification(item.id)}
      className="font-mono text-xs font-semibold text-[#1653cc] hover:underline"
    >
      {item.id.slice(0, 10)}…
    </Link>,
    <span key={`type-${item.id}`} className="text-sm font-semibold text-[#181b25]">
      {item.type}
    </span>,
    <span key={`recipient-${item.id}`} className="text-sm text-[#434654]">
      {item.recipientEmail ?? item.recipientUser?.email ?? "—"}
    </span>,
    <span key={`status-${item.id}`} className="text-xs font-semibold uppercase text-[#5b5e68]">
      {item.status.replace(/_/g, " ")}
    </span>,
    <span key={`created-${item.id}`} className="text-xs text-[#737685]">
      {formatDateTime(item.createdAt)}
    </span>,
    <div key={`actions-${item.id}`} className="flex justify-end gap-2">
      <Link
        to={`/admin/system/notifications/${item.id}`}
        onMouseEnter={() => prefetchNotification(item.id)}
        onFocus={() => prefetchNotification(item.id)}
        className="text-xs font-semibold text-[#1653cc] hover:underline"
      >
        View
      </Link>
      <button
        type="button"
        className="text-xs font-semibold text-[#434654] underline decoration-dotted hover:text-[#1653cc]"
        onClick={() => retryMutation.run(item.id)}
        disabled={retryMutation.isPending || retryMutation.blocked}
      >
        Retry
      </button>
    </div>
  ]);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        title="Notifications workspace"
        description="Delivery state, replay controls, single-recipient sends, and segment broadcasts through the same outbox pipeline."
      />

      {flash ? (
        <div className="rounded-xl border border-[#e0e2f0] bg-white px-4 py-3 text-sm text-[#434654] shadow-sm">
          {flash}
        </div>
      ) : null}

      <SurfaceCard title="Outbox filters" description="Reduce delivery noise and isolate failed records.">
        <div className="grid gap-4 md:grid-cols-3">
          <input
            value={typeDraft}
            onChange={(event) => {
              const v = event.target.value;
              setTypeDraft(v);
              setDebounced("type", v);
            }}
            placeholder="Type"
            className="rounded-lg border border-[#d8dbe8] px-3 py-2 text-sm"
          />
          <input
            value={recipientDraft}
            onChange={(event) => {
              const v = event.target.value;
              setRecipientDraft(v);
              setDebounced("recipient", v);
            }}
            placeholder="Recipient email"
            className="rounded-lg border border-[#d8dbe8] px-3 py-2 text-sm"
          />
          <select
            value={filters.status}
            onChange={(event) => set("status", event.target.value)}
            className="rounded-lg border border-[#d8dbe8] px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="QUEUED">Queued</option>
            <option value="SENT">Sent</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </SurfaceCard>

      <SurfaceCard
        title="Compose notification"
        description="Send to one email address, or broadcast to a built-in segment (each recipient still gets an individual notification row and delivery job)."
      >
        <div className="mb-4 flex flex-wrap gap-2 border-b border-[#e5e7eb] pb-4">
          <button
            type="button"
            role="tab"
            aria-selected={composeMode === "single"}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              composeMode === "single"
                ? "bg-[#1653cc] text-white"
                : "bg-[#f2f3ff] text-[#434654] hover:bg-[#e8ebff]"
            }`}
            onClick={() => setComposeMode("single")}
          >
            One recipient
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={composeMode === "broadcast"}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              composeMode === "broadcast"
                ? "bg-[#1653cc] text-white"
                : "bg-[#f2f3ff] text-[#434654] hover:bg-[#e8ebff]"
            }`}
            onClick={() => setComposeMode("broadcast")}
          >
            Broadcast segment
          </button>
          <button
            type="button"
            className="ml-auto rounded-lg border border-[#d8dbe8] px-3 py-2 text-xs font-semibold text-[#434654] hover:bg-[#f8f9fc]"
            onClick={() => setForm((c) => ({ ...c, payloadJson: DEFAULT_PAYLOAD_TEMPLATE }))}
          >
            Reset payload template
          </button>
        </div>

        {!draftValidation.ok ? (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {draftValidation.message}
          </div>
        ) : null}

        <p className="mb-3 text-xs leading-relaxed text-[#5b5e68]">{PAYLOAD_FIELD_HINT}</p>

        {composeMode === "single" ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
            <input
              value={form.type}
              onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
              placeholder="Notification type (e.g. ADMIN_BROADCAST)"
              className="rounded-lg border border-[#d8dbe8] px-3 py-2 text-sm"
            />
            <input
              value={form.recipientEmail}
              onChange={(event) => setForm((current) => ({ ...current, recipientEmail: event.target.value }))}
              placeholder="recipient@example.com"
              className="rounded-lg border border-[#d8dbe8] px-3 py-2 text-sm"
            />
            <AsyncActionButton
              pending={createMutation.isPending}
              blocked={createMutation.blocked}
              onClick={() => createMutation.run(undefined)}
            >
              Queue notification
            </AsyncActionButton>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#5b5e68]">
                  Segment
                </label>
                <select
                  value={broadcastSegment}
                  onChange={(event) => setBroadcastSegment(event.target.value as BroadcastSegment)}
                  className="w-full rounded-lg border border-[#d8dbe8] px-3 py-2 text-sm"
                >
                  {(Object.keys(SEGMENT_COPY) as BroadcastSegment[]).map((key) => (
                    <option key={key} value={key}>
                      {SEGMENT_COPY[key].label}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-[#737685]">{SEGMENT_COPY[broadcastSegment].description}</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#5b5e68]">
                  Notification type
                </label>
                <input
                  value={form.type}
                  onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
                  placeholder="Leave as ADMIN_BROADCAST or choose another supported type"
                  className="w-full rounded-lg border border-[#d8dbe8] px-3 py-2 text-sm"
                />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-[#d8dbe8] px-3 py-2 text-xs font-semibold text-[#434654] hover:bg-[#f8f9fc] disabled:opacity-50"
                    disabled={previewLoading || !accessToken}
                    onClick={() => void loadPreview()}
                  >
                    {previewLoading ? "Loading…" : "Preview audience size"}
                  </button>
                  {previewCount !== null ? (
                    <span className="text-sm font-semibold text-[#181b25]">{previewCount} recipients</span>
                  ) : null}
                </div>
                {previewError ? <p className="mt-2 text-xs text-red-700">{previewError}</p> : null}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              {previewCount === null ? (
                <p className="max-w-md text-right text-xs text-[#737685]">
                  Preview the audience size to confirm how many emails will be queued, then use Queue broadcast.
                </p>
              ) : previewCount === 0 ? (
                <p className="max-w-md text-right text-xs text-amber-800">This segment has no recipients right now.</p>
              ) : null}
              <AsyncActionButton
                pending={broadcastMutation.isPending}
                blocked={broadcastMutation.blocked}
                onClick={() => broadcastMutation.run(undefined)}
              >
                Queue broadcast
              </AsyncActionButton>
            </div>
          </div>
        )}

        <textarea
          value={form.payloadJson}
          onChange={(event) => setForm((current) => ({ ...current, payloadJson: event.target.value }))}
          className="mt-4 min-h-48 w-full rounded-xl border border-[#d8dbe8] bg-[#0f172a] p-4 font-mono text-xs text-slate-100"
          spellCheck={false}
          aria-label="Notification payload JSON"
        />
      </SurfaceCard>

      <SurfaceCard title="Notification delivery records" description="Recent notifications and replay actions.">
        {query.isError ? (
          <QueryError label="notifications" error={query.error} onRetry={() => void query.refetch()} />
        ) : null}
        {query.isLoading ? (
          <div className="rounded-lg border border-[#eef1f8] bg-white p-4">
            <SkeletonTable rows={8} cols={6} label="Loading notifications" />
          </div>
        ) : (
          <DataTableShell
            columns={["Id", "Type", "Recipient", "Status", "Created", "Actions"]}
            rows={rows}
            emptyState="No notification records matched this filter."
            variant="stitchOperational"
          />
        )}
        <div className="mt-4 flex items-center justify-between text-sm text-[#5b5e68]">
          <span>
            Page {meta?.page ?? page} of {meta?.totalPages ?? 1}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-lg border border-[#d8dbe8] px-3 py-1.5 disabled:opacity-50"
              disabled={page <= 1}
              onClick={() => setPage(Math.max(1, page - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className="rounded-lg border border-[#d8dbe8] px-3 py-1.5 disabled:opacity-50"
              disabled={page >= (meta?.totalPages ?? 1)}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
};
