import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { TechnicalJsonDisclosure } from "@/components/primitives/DataPresentation";
import { AsyncActionButton } from "@/components/primitives/AsyncActionButton";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SurfaceCard } from "@/components/primitives/SurfaceCard";
import { WorkspaceStateCard } from "@/components/primitives/WorkspaceStateCard";
import { requestAdminStepUpToken } from "@/features/auth/step-up";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { useAdminAction } from "@/lib/admin-actions/useAdminAction";
import { ApiError, getAdminNotification, retryAdminNotification } from "@/features/system/api/admin-system.api";

const formatWhen = (value: string | null) => {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
};

export const NotificationDetailPage = () => {
  const { notificationId = "" } = useParams<{ notificationId: string }>();
  const accessToken = useAdminAuthStore((state) => state.accessToken);
  const actorEmail = useAdminAuthStore((state) => state.actor?.email ?? null);

  const query = useQuery({
    queryKey: ["admin-notification", notificationId],
    queryFn: async () => {
      if (!accessToken) throw new Error("Not signed in.");
      return getAdminNotification(accessToken, notificationId);
    },
    enabled: Boolean(accessToken && notificationId)
  });

  const retryMutation = useAdminAction({
    mutationFn: async () => {
      if (!accessToken) throw new Error("Not signed in.");
      const stepUpToken = await requestAdminStepUpToken({ accessToken, email: actorEmail });
      return retryAdminNotification(accessToken, notificationId, stepUpToken);
    },
    invalidate: [["admin-notification", notificationId], ["admin-notifications"]]
  });

  const entity = query.data?.data.entity;

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader title="Notification detail" description="Inspect payload, recipient, delivery attempts, and retry state." />
        <SurfaceCard title="Loading notification">
          <div className="space-y-3" aria-busy="true">
            <div className="h-5 w-40 animate-pulse rounded bg-[#eef1f8]" />
            <div className="h-4 w-full animate-pulse rounded bg-[#f4f6fb]" />
            <div className="h-32 animate-pulse rounded-xl bg-[#f4f6fb]" />
          </div>
        </SurfaceCard>
      </div>
    );
  }

  if (!entity) {
    return (
      <WorkspaceStateCard
        eyebrow="Notifications workspace"
        title="Notification record unavailable"
        description="The notification could not be loaded, or it is no longer visible to your role."
        primaryActionLabel="Return to notifications"
        onPrimaryAction={() => window.history.back()}
      />
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={entity ? `Notification ${entity.type}` : "Notification detail"}
        description="Inspect payload, recipient, delivery attempts, and retry state."
        actions={
          <AsyncActionButton
            pending={retryMutation.isPending}
            blocked={retryMutation.blocked}
            onClick={() => retryMutation.run(undefined)}
          >
            Retry notification
          </AsyncActionButton>
        }
      />

      {query.error instanceof ApiError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{query.error.message}</div>
      ) : null}

      {
        <>
          <SurfaceCard title="Summary">
            <dl className="grid gap-4 md:grid-cols-2">
              <div>
                <dt className="text-xs font-bold uppercase tracking-wider text-[#737685]">Recipient</dt>
                <dd className="mt-1 text-sm text-[#181b25]">{entity.recipientEmail ?? entity.recipientUser?.email ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wider text-[#737685]">Status</dt>
                <dd className="mt-1 text-sm text-[#181b25]">{entity.status}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wider text-[#737685]">Channel</dt>
                <dd className="mt-1 text-sm text-[#181b25]">{entity.channel}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wider text-[#737685]">Created</dt>
                <dd className="mt-1 text-sm text-[#181b25]">{formatWhen(entity.createdAt)}</dd>
              </div>
            </dl>
          </SurfaceCard>

          <SurfaceCard title="Payload">
            <TechnicalJsonDisclosure data={entity.payload} defaultOpen />
          </SurfaceCard>

          <SurfaceCard title="Delivery attempts">
            <div className="space-y-3">
              {entity.deliveries.length === 0 ? (
                <p className="text-sm text-[#5b5e68]">No delivery attempts have been recorded yet.</p>
              ) : (
                entity.deliveries.map((delivery) => (
                  <div key={delivery.id} className="rounded-xl border border-[#e0e2f0] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#181b25]">{delivery.status}</p>
                        <p className="text-xs text-[#737685]">Created {formatWhen(delivery.createdAt)}</p>
                      </div>
                      <div className="text-right text-xs text-[#5b5e68]">
                        <p>Provider message: {delivery.providerMessageId ?? "—"}</p>
                        <p>Sent at: {formatWhen(delivery.sentAt)}</p>
                      </div>
                    </div>
                    {delivery.error ? <div className="mt-3"><TechnicalJsonDisclosure data={delivery.error} label="Delivery error" /></div> : null}
                  </div>
                ))
              )}
            </div>
          </SurfaceCard>
        </>
      }
    </div>
  );
};
