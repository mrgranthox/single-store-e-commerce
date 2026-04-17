import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthedQuery } from "@/lib/api/useAuthedQuery";
import { z } from "zod";

import { preloadLazyNamedComponent } from "@/app/lazy-admin-routes";
import { DataTableShell } from "@/components/primitives/DataTableShell";
import { AsyncActionButton } from "@/components/primitives/AsyncActionButton";
import { ConfirmDialog } from "@/components/primitives/ConfirmDialog";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SurfaceCard } from "@/components/primitives/SurfaceCard";
import { StitchFieldLabel, StitchPageBody, stitchInputClass, stitchSelectClass } from "@/components/stitch";
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
    description: "Customer accounts with status ACTIVE."
  },
  MARKETING_OPT_IN: {
    label: "Marketing opt-in",
    description: "Active customers who enabled marketing email."
  },
  ALL_ACTIVE_ADMINS: {
    label: "All active admins",
    description: "Admin operators with status ACTIVE."
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

const buildBasePayload = (m: MessageContent): Record<string, unknown> => {
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

const parseExtraPayload = (
  raw: string
): { ok: true; value: Record<string, unknown> } | { ok: false; message: string } => {
  const t = raw.trim();
  if (!t) return { ok: true, value: {} };
  try {
    const parsed = JSON.parse(t) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, message: "Additional payload must be a JSON object." };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, message: "Additional payload must be valid JSON." };
  }
};

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
  const [broadcastConfirmOpen, setBroadcastConfirmOpen] = useState(false);
  const [typeDraft, setTypeDraft] = useState("");
  const [recipientDraft, setRecipientDraft] = useState("");
  const [form, setForm] = useState({
    type: "ADMIN_BROADCAST",
    recipientEmail: ""
  });
  const [messageContent, setMessageContent] = useState<MessageContent>(emptyMessageContent);
  const [extraPayloadJson, setExtraPayloadJson] = useState("{}");
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
    if (!messageContent.emailSubject.trim()) {
      return { ok: false as const, message: "Email subject is required." };
    }
    if (!messageContent.mainMessage.trim()) {
      return { ok: false as const, message: "Main message is required." };
    }

    const extraParsed = parseExtraPayload(extraPayloadJson);
    if (!extraParsed.ok) {
      return { ok: false as const, message: extraParsed.message };
    }

    const payload = { ...buildBasePayload(messageContent), ...extraParsed.value };

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
  }, [form, composeMode, messageContent, extraPayloadJson]);

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

  const canRequestBroadcast =
    composeMode === "broadcast" && draftValidation.ok && previewCount !== null && previewCount > 0;

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Notifications workspace"
        description="Outbox, retries, single sends, and segment broadcasts."
      />

      <StitchPageBody>
        {flash ? (
          <div className="rounded-xl border border-[#e0e2f0] bg-white px-4 py-3 text-sm text-[#434654] shadow-sm">
            {flash}
          </div>
        ) : null}

        <SurfaceCard title="Outbox filters" description="Filter the delivery list.">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <StitchFieldLabel>Type</StitchFieldLabel>
              <input
                value={typeDraft}
                onChange={(event) => {
                  const v = event.target.value;
                  setTypeDraft(v);
                  setDebounced("type", v);
                }}
                placeholder="Filter by type"
                className={stitchInputClass}
              />
            </div>
            <div>
              <StitchFieldLabel>Recipient email</StitchFieldLabel>
              <input
                value={recipientDraft}
                onChange={(event) => {
                  const v = event.target.value;
                  setRecipientDraft(v);
                  setDebounced("recipient", v);
                }}
                placeholder="Filter by recipient"
                className={stitchInputClass}
              />
            </div>
            <div>
              <StitchFieldLabel>Status</StitchFieldLabel>
              <select
                value={filters.status}
                onChange={(event) => set("status", event.target.value)}
                className={stitchSelectClass}
              >
                <option value="">All statuses</option>
                <option value="QUEUED">Queued</option>
                <option value="SENT">Sent</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard
          title="Compose"
          description="Same layout for every notification type: email copy first, optional JSON merge for template-specific keys (e.g. invite tokens)."
        >
          {!draftValidation.ok ? (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {draftValidation.message}
            </div>
          ) : null}

          <div className="mb-6 inline-flex rounded-lg border border-[#d8dbe8] bg-[#f8f9fc] p-1">
            <button
              type="button"
              role="tab"
              aria-selected={composeMode === "single"}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                composeMode === "single" ? "bg-white text-[#181b25] shadow-sm" : "text-[#5b5e68] hover:text-[#181b25]"
              }`}
              onClick={() => setComposeMode("single")}
            >
              One recipient
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={composeMode === "broadcast"}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                composeMode === "broadcast" ? "bg-white text-[#181b25] shadow-sm" : "text-[#5b5e68] hover:text-[#181b25]"
              }`}
              onClick={() => setComposeMode("broadcast")}
            >
              Broadcast
            </button>
          </div>

          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <StitchFieldLabel>Notification type</StitchFieldLabel>
                <input
                  value={form.type}
                  onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
                  placeholder="e.g. ADMIN_BROADCAST, ADMIN_INVITATION, ORDER_CONFIRMED"
                  className={stitchInputClass}
                />
              </div>

              {composeMode === "single" ? (
                <div className="md:col-span-2">
                  <StitchFieldLabel>Recipient email</StitchFieldLabel>
                  <input
                    value={form.recipientEmail}
                    onChange={(event) => setForm((current) => ({ ...current, recipientEmail: event.target.value }))}
                    placeholder="recipient@example.com"
                    className={stitchInputClass}
                  />
                </div>
              ) : (
                <>
                  <div>
                    <StitchFieldLabel>Segment</StitchFieldLabel>
                    <select
                      value={broadcastSegment}
                      onChange={(event) => setBroadcastSegment(event.target.value as BroadcastSegment)}
                      className={stitchSelectClass}
                    >
                      {(Object.keys(SEGMENT_COPY) as BroadcastSegment[]).map((key) => (
                        <option key={key} value={key}>
                          {SEGMENT_COPY[key].label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 text-xs text-[#737685]">{SEGMENT_COPY[broadcastSegment].description}</p>
                  </div>
                  <div className="flex flex-col justify-end gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="rounded-lg border border-[#d8dbe8] bg-white px-3 py-2 text-xs font-semibold text-[#434654] hover:bg-[#f8f9fc] disabled:opacity-50"
                        disabled={previewLoading || !accessToken}
                        onClick={() => void loadPreview()}
                      >
                        {previewLoading ? "Loading…" : "Preview audience"}
                      </button>
                      {previewCount !== null ? (
                        <span className="text-sm font-semibold text-[#181b25]">{previewCount} recipients</span>
                      ) : null}
                    </div>
                    {previewError ? <p className="text-xs text-red-700">{previewError}</p> : null}
                    {previewCount === 0 ? (
                      <p className="text-xs text-[#737685]">No recipients in this segment.</p>
                    ) : null}
                  </div>
                </>
              )}
            </div>

            <div className="border-t border-[#eef1f8] pt-6">
              <h3 className="mb-1 text-sm font-bold text-[#181b25]">Email content</h3>
              <p className="mb-4 text-xs text-[#737685]">
                Shown in the email for types that use these fields. Required: subject and main message.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <StitchFieldLabel>
                    Email subject <span className="text-red-600">*</span>
                  </StitchFieldLabel>
                  <input
                    value={messageContent.emailSubject}
                    onChange={(e) => setMessageContent((c) => ({ ...c, emailSubject: e.target.value }))}
                    placeholder="Subject line in the inbox"
                    className={stitchInputClass}
                  />
                </div>
                <div className="md:col-span-2">
                  <StitchFieldLabel>Headline (optional)</StitchFieldLabel>
                  <input
                    value={messageContent.headline}
                    onChange={(e) => setMessageContent((c) => ({ ...c, headline: e.target.value }))}
                    placeholder="Large title inside the email"
                    className={stitchInputClass}
                  />
                </div>
                <div className="md:col-span-2">
                  <StitchFieldLabel>
                    Main message <span className="text-red-600">*</span>
                  </StitchFieldLabel>
                  <textarea
                    value={messageContent.mainMessage}
                    onChange={(e) => setMessageContent((c) => ({ ...c, mainMessage: e.target.value }))}
                    placeholder="Opening paragraph"
                    rows={4}
                    className={`${stitchInputClass} min-h-[96px] resize-y`}
                  />
                </div>
                <div className="md:col-span-2">
                  <StitchFieldLabel>Extra details (optional)</StitchFieldLabel>
                  <textarea
                    value={messageContent.extraDetails}
                    onChange={(e) => setMessageContent((c) => ({ ...c, extraDetails: e.target.value }))}
                    placeholder="Optional second paragraph"
                    rows={3}
                    className={`${stitchInputClass} min-h-[72px] resize-y`}
                  />
                </div>
                <div>
                  <StitchFieldLabel>Button label (optional)</StitchFieldLabel>
                  <input
                    value={messageContent.buttonLabel}
                    onChange={(e) => setMessageContent((c) => ({ ...c, buttonLabel: e.target.value }))}
                    placeholder="e.g. Open store"
                    className={stitchInputClass}
                  />
                </div>
                <div>
                  <StitchFieldLabel>Button link (optional)</StitchFieldLabel>
                  <input
                    value={messageContent.buttonLink}
                    onChange={(e) => setMessageContent((c) => ({ ...c, buttonLink: e.target.value }))}
                    placeholder="https://…"
                    className={stitchInputClass}
                    inputMode="url"
                  />
                </div>
              </div>
            </div>

            <details className="rounded-lg border border-[#eef1f8] bg-white px-4 py-3">
              <summary className="cursor-pointer text-sm font-semibold text-[#434654]">Additional payload (JSON)</summary>
              <p className="mt-2 text-xs text-[#737685]">
                Merged on top of the fields above. Use for keys your notification type expects (e.g.{" "}
                <span className="font-mono">inviteToken</span>, <span className="font-mono">ctaUrl</span>) — JSON keys
                here override the same key from the form.
              </p>
              <textarea
                value={extraPayloadJson}
                onChange={(e) => setExtraPayloadJson(e.target.value)}
                className="mt-3 min-h-32 w-full rounded-lg border border-[#d8dbe8] bg-[#fafbfc] p-3 font-mono text-xs text-[#181b25]"
                spellCheck={false}
                aria-label="Additional JSON payload"
              />
            </details>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[#eef1f8] pt-4">
              <button
                type="button"
                className="rounded-lg border border-[#d8dbe8] px-3 py-2 text-xs font-semibold text-[#434654] hover:bg-[#f8f9fc]"
                onClick={() => {
                  setMessageContent(emptyMessageContent());
                  setExtraPayloadJson("{}");
                }}
              >
                Clear
              </button>
              {composeMode === "single" ? (
                <AsyncActionButton
                  pending={createMutation.isPending}
                  blocked={createMutation.blocked}
                  onClick={() => createMutation.run(undefined)}
                >
                  Queue notification
                </AsyncActionButton>
              ) : (
                <>
                  {previewCount === null ? (
                    <span className="text-xs text-[#737685]">Preview audience before sending.</span>
                  ) : null}
                  <AsyncActionButton
                    pending={broadcastMutation.isPending}
                    blocked={broadcastMutation.blocked || !canRequestBroadcast}
                    onClick={() => {
                      if (canRequestBroadcast) setBroadcastConfirmOpen(true);
                    }}
                  >
                    Queue broadcast
                  </AsyncActionButton>
                </>
              )}
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard title="Delivery records" description="Recent notifications and retries.">
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
      </StitchPageBody>

      <ConfirmDialog
        open={broadcastConfirmOpen}
        title="Send broadcast?"
        body={
          previewCount !== null ? (
            <>
              This will queue <strong>{previewCount}</strong> separate notification{previewCount === 1 ? "" : "s"} for
              segment <strong>{SEGMENT_COPY[broadcastSegment].label}</strong> (type <span className="font-mono">{form.type.trim()}</span>
              ). Each recipient gets their own email job.
            </>
          ) : (
            "Confirm broadcast."
          )
        }
        confirmLabel="Queue broadcast"
        confirmDisabled={broadcastMutation.isPending}
        size="md"
        onClose={() => setBroadcastConfirmOpen(false)}
        onConfirm={() => {
          setBroadcastConfirmOpen(false);
          broadcastMutation.run(undefined);
        }}
      />
    </div>
  );
};
