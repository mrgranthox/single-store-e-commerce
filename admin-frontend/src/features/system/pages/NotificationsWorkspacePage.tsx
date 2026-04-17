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
  recipientEmail: z.string().trim().email("Enter a valid recipient email.")
});

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

type MessageContent = {
  emailSubject: string;
  headline: string;
  mainMessage: string;
  extraDetails: string;
  buttonLabel: string;
  buttonLink: string;
};

const emptyMessageContent = (): MessageContent => ({
  emailSubject: "",
  headline: "",
  mainMessage: "",
  extraDetails: "",
  buttonLabel: "",
  buttonLink: ""
});

const buildPayloadFromMessageContent = (m: MessageContent): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};
  const subject = m.emailSubject.trim();
  const heading = m.headline.trim();
  const message = m.mainMessage.trim();
  const detail = m.extraDetails.trim();
  const ctaLabel = m.buttonLabel.trim();
  const ctaUrl = m.buttonLink.trim();
  if (subject) payload.subject = subject;
  if (heading) payload.heading = heading;
  if (message) payload.message = message;
  if (detail) payload.detail = detail;
  if (ctaLabel) payload.ctaLabel = ctaLabel;
  if (ctaUrl) payload.ctaUrl = ctaUrl;
  return payload;
};

const isAdminBroadcastType = (type: string) => type.trim() === "ADMIN_BROADCAST";

const NOTIFICATION_LIST_DEFAULTS = { status: "", type: "", recipient: "" };

const labelClass = "mb-1 block text-xs font-semibold uppercase tracking-wide text-[#5b5e68]";
const inputClass = "w-full rounded-lg border border-[#d8dbe8] px-3 py-2 text-sm text-[#181b25] placeholder:text-[#9aa3b2]";
const textAreaClass = `${inputClass} min-h-[88px] resize-y`;

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
    recipientEmail: ""
  });
  const [messageContent, setMessageContent] = useState<MessageContent>(emptyMessageContent);
  /** Used when notification type is not ADMIN_BROADCAST (e.g. admin invite) — technical payload. */
  const [technicalPayloadJson, setTechnicalPayloadJson] = useState("{}");
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
    const simple = isAdminBroadcastType(form.type);

    let payload: Record<string, unknown>;

    if (simple) {
      if (!messageContent.emailSubject.trim()) {
        return { ok: false as const, message: "Email subject is required." };
      }
      if (!messageContent.mainMessage.trim()) {
        return { ok: false as const, message: "Main message is required." };
      }
      payload = buildPayloadFromMessageContent(messageContent);
    } else {
      const raw = technicalPayloadJson.trim();
      if (raw.length < 2) {
        return { ok: false as const, message: "Payload JSON is required for this notification type." };
      }
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          return { ok: false as const, message: "Payload must be a JSON object." };
        }
        payload = parsed as Record<string, unknown>;
      } catch {
        return { ok: false as const, message: "Payload must be valid JSON." };
      }
    }

    if (composeMode === "broadcast") {
      if (!form.type.trim()) {
        return { ok: false as const, message: "Notification type is required." };
      }
      if (!isAdminBroadcastType(form.type)) {
        return {
          ok: false as const,
          message: "Broadcasts use the simple email form. Set type to ADMIN_BROADCAST, or send other types to one recipient only."
        };
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
  }, [form, composeMode, messageContent, technicalPayloadJson]);

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

  const showSimpleForm = isAdminBroadcastType(form.type);

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
            onClick={() => {
              setMessageContent(emptyMessageContent());
              setTechnicalPayloadJson("{}");
            }}
          >
            Clear message
          </button>
        </div>

        {!draftValidation.ok ? (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {draftValidation.message}
          </div>
        ) : null}

        <div className="mb-4">
          <label className={labelClass} htmlFor="notification-type-compose">
            Notification type
          </label>
          <input
            id="notification-type-compose"
            value={form.type}
            onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
            placeholder="ADMIN_BROADCAST for store announcements"
            className={inputClass}
          />
          <p className="mt-2 text-xs text-[#737685]">
            Use <span className="font-mono">ADMIN_BROADCAST</span> for the form below. For other types (e.g. invitations), switch
            the type and use the technical JSON payload.
          </p>
        </div>

        {showSimpleForm ? (
          <div className="rounded-xl border border-[#e5e7eb] bg-[#f8f9fc] p-4 md:p-5">
            <h3 className="mb-1 text-sm font-bold text-[#181b25]">Email content</h3>
            <p className="mb-4 text-xs text-[#5b5e68]">
              This is what recipients see in their inbox. Required fields are marked. Optional fields add a second paragraph or a
              button link.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className={labelClass} htmlFor="msg-subject">
                  Email subject <span className="text-red-600">*</span>
                </label>
                <input
                  id="msg-subject"
                  value={messageContent.emailSubject}
                  onChange={(e) => setMessageContent((c) => ({ ...c, emailSubject: e.target.value }))}
                  placeholder="e.g. Scheduled maintenance this Sunday"
                  className={inputClass}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass} htmlFor="msg-headline">
                  Headline <span className="font-normal normal-case text-[#9aa3b2]">(optional)</span>
                </label>
                <input
                  id="msg-headline"
                  value={messageContent.headline}
                  onChange={(e) => setMessageContent((c) => ({ ...c, headline: e.target.value }))}
                  placeholder="Large title inside the email; defaults to the subject if left blank"
                  className={inputClass}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass} htmlFor="msg-main">
                  Main message <span className="text-red-600">*</span>
                </label>
                <textarea
                  id="msg-main"
                  value={messageContent.mainMessage}
                  onChange={(e) => setMessageContent((c) => ({ ...c, mainMessage: e.target.value }))}
                  placeholder="The opening paragraph customers read first."
                  className={textAreaClass}
                  rows={4}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass} htmlFor="msg-extra">
                  Extra details <span className="font-normal normal-case text-[#9aa3b2]">(optional)</span>
                </label>
                <textarea
                  id="msg-extra"
                  value={messageContent.extraDetails}
                  onChange={(e) => setMessageContent((c) => ({ ...c, extraDetails: e.target.value }))}
                  placeholder="Optional second paragraph (timelines, links to policy, etc.)"
                  className={textAreaClass}
                  rows={3}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="msg-cta-label">
                  Button label <span className="font-normal normal-case text-[#9aa3b2]">(optional)</span>
                </label>
                <input
                  id="msg-cta-label"
                  value={messageContent.buttonLabel}
                  onChange={(e) => setMessageContent((c) => ({ ...c, buttonLabel: e.target.value }))}
                  placeholder="e.g. View your account"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="msg-cta-url">
                  Button link <span className="font-normal normal-case text-[#9aa3b2]">(optional)</span>
                </label>
                <input
                  id="msg-cta-url"
                  value={messageContent.buttonLink}
                  onChange={(e) => setMessageContent((c) => ({ ...c, buttonLink: e.target.value }))}
                  placeholder="https://…"
                  className={inputClass}
                  inputMode="url"
                />
              </div>
            </div>
          </div>
        ) : (
          <div>
            <label className={labelClass} htmlFor="technical-payload">
              Technical payload (JSON)
            </label>
            <p className="mb-2 text-xs text-[#737685]">
              This notification type expects structured fields in JSON (for example invite links for{" "}
              <span className="font-mono">ADMIN_INVITATION</span>). Switch type back to{" "}
              <span className="font-mono">ADMIN_BROADCAST</span> to use the simple form.
            </p>
            <textarea
              id="technical-payload"
              value={technicalPayloadJson}
              onChange={(e) => setTechnicalPayloadJson(e.target.value)}
              className="min-h-48 w-full rounded-xl border border-[#d8dbe8] bg-[#0f172a] p-4 font-mono text-xs text-slate-100"
              spellCheck={false}
              aria-label="Technical notification payload JSON"
            />
          </div>
        )}

        {composeMode === "single" ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_auto]">
            <div>
              <label className={labelClass} htmlFor="recipient-email">
                Recipient email
              </label>
              <input
                id="recipient-email"
                value={form.recipientEmail}
                onChange={(event) => setForm((current) => ({ ...current, recipientEmail: event.target.value }))}
                placeholder="recipient@example.com"
                className={inputClass}
              />
            </div>
            <div className="flex items-end">
              <AsyncActionButton
                pending={createMutation.isPending}
                blocked={createMutation.blocked}
                onClick={() => createMutation.run(undefined)}
              >
                Queue notification
              </AsyncActionButton>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="broadcast-segment">
                  Segment
                </label>
                <select
                  id="broadcast-segment"
                  value={broadcastSegment}
                  onChange={(event) => setBroadcastSegment(event.target.value as BroadcastSegment)}
                  className={inputClass}
                >
                  {(Object.keys(SEGMENT_COPY) as BroadcastSegment[]).map((key) => (
                    <option key={key} value={key}>
                      {SEGMENT_COPY[key].label}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-[#737685]">{SEGMENT_COPY[broadcastSegment].description}</p>
              </div>
              <div className="flex flex-col justify-end">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-[#d8dbe8] px-3 py-2 text-xs font-semibold text-[#434654] hover:bg-white disabled:opacity-50"
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
            <div className="flex flex-col items-end gap-2 border-t border-[#e5e7eb] pt-4">
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
