import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { preloadLazyNamedComponent } from "@/app/lazy-admin-routes";
import { DataTableShell } from "@/components/primitives/DataTableShell";
import { TechnicalJsonDisclosure } from "@/components/primitives/DataPresentation";
import { AsyncActionButton } from "@/components/primitives/AsyncActionButton";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SurfaceCard } from "@/components/primitives/SurfaceCard";
import { requestAdminStepUpToken } from "@/features/auth/step-up";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { useAdminAction } from "@/lib/admin-actions/useAdminAction";
import { useAdminDetailPrefetch } from "@/lib/performance/useAdminDetailPrefetch";
import {
  ApiError,
  createAdminNotification,
  getAdminNotification,
  listAdminNotifications,
  retryAdminNotification,
  type NotificationRow
} from "@/features/system/api/admin-system.api";

const formatWhen = (value: string) => {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
};

const notificationDraftSchema = z.object({
  type: z.string().trim().min(1, "Notification type is required."),
  recipientEmail: z.string().trim().email("Enter a valid recipient email."),
  payloadJson: z.string().trim().min(2, "Payload JSON is required.")
});

export const NotificationsWorkspacePage = () => {
  const accessToken = useAdminAuthStore((state) => state.accessToken);
  const actorEmail = useAdminAuthStore((state) => state.actor?.email ?? null);
  const [status, setStatus] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [form, setForm] = useState({
    type: "ADMIN_INVITATION",
    recipientEmail: "",
    payloadJson: '{\n  "message": ""\n}'
  });
  const [page, setPage] = useState(1);
  const [flash, setFlash] = useState<string | null>(null);

  const draftValidation = useMemo(() => {
    const parsed = notificationDraftSchema.safeParse(form);
    if (!parsed.success) {
      return {
        ok: false as const,
        message: parsed.error.issues[0]?.message ?? "Complete the notification draft."
      };
    }
    try {
      const parsedPayload = JSON.parse(parsed.data.payloadJson) as unknown;
      if (!parsedPayload || typeof parsedPayload !== "object" || Array.isArray(parsedPayload)) {
        return {
          ok: false as const,
          message: "Payload JSON must be an object."
        };
      }
      return {
        ok: true as const,
        payload: parsedPayload as Record<string, unknown>
      };
    } catch {
      return {
        ok: false as const,
        message: "Payload JSON must be valid JSON."
      };
    }
  }, [form]);

  const query = useQuery({
    queryKey: ["admin-notifications", page, status, typeFilter, recipientEmail],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error("Not signed in.");
      }
      return listAdminNotifications(accessToken, {
        page,
        page_size: 20,
        status: status || undefined,
        type: typeFilter || undefined,
        recipientEmail: recipientEmail || undefined
      });
    },
    enabled: Boolean(accessToken)
  });

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
    isAvailable: draftValidation.ok,
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

  const retryMutation = useAdminAction({
    mutationFn: async (notificationId: string) => {
      if (!accessToken) throw new Error("Not signed in.");
      const stepUpToken = await requestAdminStepUpToken({ accessToken, email: actorEmail });
      return retryAdminNotification(accessToken, notificationId, stepUpToken);
    },
    invalidate: [...refreshKeys]
  });

  const items = query.data?.data.items ?? [];
  const meta = query.data?.meta;
  const { prefetch: prefetchNotification, prefetchMany: prefetchNotifications } = useAdminDetailPrefetch({
    enabled: Boolean(accessToken),
    staleTime: 20_000,
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
      {formatWhen(item.createdAt)}
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
        description="Delivery state, replay controls, and manual notification authoring."
      />

      {flash ? (
        <div className="rounded-xl border border-[#e0e2f0] bg-white px-4 py-3 text-sm text-[#434654] shadow-sm">
          {flash}
        </div>
      ) : null}

      <SurfaceCard title="Outbox filters" description="Reduce delivery noise and isolate failed records.">
        <div className="grid gap-4 md:grid-cols-3">
          <input
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            placeholder="Type"
            className="rounded-lg border border-[#d8dbe8] px-3 py-2 text-sm"
          />
          <input
            value={recipientEmail}
            onChange={(event) => setRecipientEmail(event.target.value)}
            placeholder="Recipient email"
            className="rounded-lg border border-[#d8dbe8] px-3 py-2 text-sm"
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-lg border border-[#d8dbe8] px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="QUEUED">Queued</option>
            <option value="SENT">Sent</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </SurfaceCard>

      <SurfaceCard title="Manual notification" description="Queue a one-off admin notification through the existing delivery pipeline.">
        {!draftValidation.ok ? (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {draftValidation.message}
          </div>
        ) : null}
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
          <input
            value={form.type}
            onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
            placeholder="Notification type"
            className="rounded-lg border border-[#d8dbe8] px-3 py-2 text-sm"
          />
          <input
            value={form.recipientEmail}
            onChange={(event) => setForm((current) => ({ ...current, recipientEmail: event.target.value }))}
            placeholder="recipient@example.com"
            className="rounded-lg border border-[#d8dbe8] px-3 py-2 text-sm"
          />
          <AsyncActionButton pending={createMutation.isPending} blocked={createMutation.blocked} onClick={() => createMutation.run(undefined)}>
            Queue notification
          </AsyncActionButton>
        </div>
        <textarea
          value={form.payloadJson}
          onChange={(event) => setForm((current) => ({ ...current, payloadJson: event.target.value }))}
          className="mt-4 min-h-48 w-full rounded-xl border border-[#d8dbe8] bg-[#0f172a] p-4 font-mono text-xs text-slate-100"
          spellCheck={false}
        />
      </SurfaceCard>

      <SurfaceCard title="Notification delivery records" description="Recent notifications and replay actions.">
        {query.error instanceof ApiError ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {query.error.message}
          </div>
        ) : null}
        <DataTableShell
          columns={["Id", "Type", "Recipient", "Status", "Created", "Actions"]}
          rows={rows}
          emptyState={query.isLoading ? "Loading notifications…" : "No notification records matched this filter."}
          variant="stitchOperational"
        />
        <div className="mt-4 flex items-center justify-between text-sm text-[#5b5e68]">
          <span>
            Page {meta?.page ?? page} of {meta?.totalPages ?? 1}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-lg border border-[#d8dbe8] px-3 py-1.5 disabled:opacity-50"
              disabled={(meta?.page ?? page) <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className="rounded-lg border border-[#d8dbe8] px-3 py-1.5 disabled:opacity-50"
              disabled={(meta?.page ?? page) >= (meta?.totalPages ?? 1)}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
};
