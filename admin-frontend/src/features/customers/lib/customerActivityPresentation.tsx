import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { TechnicalJsonDisclosure } from "@/components/primitives/DataPresentation";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { CustomerActivityItem } from "@/features/customers/api/admin-customers.api";

const read = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

export const activityKindFilter = (kind: string) => {
  const k = kind.toUpperCase();
  if (k === "ORDER") return "orders" as const;
  if (k === "REVIEW") return "reviews" as const;
  if (k === "SUPPORT_TICKET") return "support" as const;
  if (k === "STATUS_CHANGE") return "status" as const;
  if (k === "SECURITY_EVENT") return "security" as const;
  if (k === "CUSTOMER_NOTE") return "notes" as const;
  if (k === "LOGIN_EVENT") return "logins" as const;
  return "other" as const;
};

export type ActivityFilterChip =
  | "all"
  | "logins"
  | "orders"
  | "reviews"
  | "support"
  | "status"
  | "security"
  | "notes";

export const ActivityEventCard = ({
  item,
  customerId
}: {
  item: CustomerActivityItem;
  customerId: string;
}) => {
  const p = read(item.payload);
  const kind = item.kind.toUpperCase();

  let title = item.kind.replace(/_/g, " ");
  let summary: React.ReactNode = null;
  let icon: string = "history";

  if (kind === "ORDER" && p) {
    icon = "shopping_bag";
    const num = str(p.orderNumber) ?? "Order";
    title = "Order placed";
    summary = (
      <p className="text-sm text-slate-600">
        <Link className="font-semibold text-[#1653cc] hover:underline" to={`/admin/orders/${String(p.orderId)}`}>
          {num}
        </Link>
        {p.status ? <span className="text-slate-500"> · {String(p.status).replace(/_/g, " ")}</span> : null}
      </p>
    );
  } else if (kind === "REVIEW" && p) {
    icon = "star";
    title = "Product review";
    const pid = p.productId != null ? String(p.productId) : null;
    summary = (
      <p className="text-sm text-slate-600">
        Rating {String(p.rating ?? "—")}★
        {p.status ? <span className="text-slate-500"> · {String(p.status).replace(/_/g, " ")}</span> : null}
        {pid ? (
          <span className="mt-1 block">
            <Link className="font-semibold text-[#1653cc] hover:underline" to={`/admin/catalog/products/${pid}`}>
              View product
            </Link>
          </span>
        ) : null}
      </p>
    );
  } else if (kind === "SUPPORT_TICKET" && p) {
    icon = "confirmation_number";
    title = "Support ticket";
    summary = (
      <p className="text-sm text-slate-600">
        <Link className="font-semibold text-[#1653cc] hover:underline" to={`/admin/support/tickets/${String(p.ticketId)}`}>
          Open ticket
        </Link>
        {p.status ? <span className="text-slate-500"> · {String(p.status).replace(/_/g, " ")}</span> : null}
        {p.priority ? <span className="text-slate-500"> · {String(p.priority)} priority</span> : null}
      </p>
    );
  } else if (kind === "STATUS_CHANGE" && p) {
    icon = "swap_horiz";
    title = "Account status changed";
    summary = (
      <p className="text-sm text-slate-600">
        {p.fromStatus ? String(p.fromStatus).replace(/_/g, " ") : "—"} → {p.toStatus ? String(p.toStatus).replace(/_/g, " ") : "—"}
        {p.reason ? <span className="mt-1 block text-xs text-slate-500">Reason: {String(p.reason)}</span> : null}
      </p>
    );
  } else if (kind === "SECURITY_EVENT" && p) {
    icon = "shield";
    title = "Security event";
    summary = (
      <p className="text-sm text-slate-600">
        <span className="font-medium">{String(p.type ?? "Event").replace(/_/g, " ")}</span>
        {p.severity ? <span className="text-slate-500"> · {String(p.severity)}</span> : null}
        {p.status ? <span className="text-slate-500"> · {String(p.status)}</span> : null}
      </p>
    );
  } else if (kind === "LOGIN_EVENT" && p) {
    icon = "login";
    title = "Login";
    const ok = p.success === true;
    const region = [str(p.ipRegion), str(p.ipCountry)].filter(Boolean).join(", ");
    const ua = str(p.userAgent);
    const uaShort = ua && ua.length > 72 ? `${ua.slice(0, 72)}…` : ua;
    summary = (
      <p className="text-sm text-slate-600">
        <span className={ok ? "font-semibold text-[#006b2d]" : "font-semibold text-[#ba1a1a]"}>
          {ok ? "Success" : "Failed"}
        </span>
        {!ok && p.failureReason ? <span className="text-slate-500"> · {String(p.failureReason)}</span> : null}
        {region ? <span className="mt-1 block text-xs text-slate-500">{region}</span> : null}
        {uaShort ? <span className="mt-1 block font-mono text-[10px] text-slate-400">{uaShort}</span> : null}
      </p>
    );
  } else if (kind === "CUSTOMER_NOTE" && p) {
    icon = "note_add";
    title = "Internal note";
    const noteText = str(p.note);
    const actor = read(p.actorAdmin);
    const actorEmail = actor ? str(actor.email) : null;
    summary = (
      <p className="text-sm text-slate-600">
        {noteText ? <span className="line-clamp-3 whitespace-pre-wrap">{noteText}</span> : "Note recorded."}
        {actorEmail ? <span className="mt-1 block text-xs text-slate-500">By {actorEmail}</span> : null}
      </p>
    );
  } else {
    summary = <p className="text-sm text-slate-600">Recorded activity.</p>;
  }

  const hasHeavyPayload =
    kind === "SECURITY_EVENT" &&
    p &&
    p.metadata != null &&
    typeof p.metadata === "object" &&
    Object.keys(p.metadata as object).length > 0;

  return (
    <div className="relative flex gap-4 pb-10 pl-2 last:pb-0">
      <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[#f2f3ff] bg-white shadow-sm">
        <MaterialIcon name={icon} className="text-lg text-[#1653cc]" />
      </div>
      <div className="min-w-0 flex-1 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{title}</p>
            <div className="mt-1">{summary}</div>
          </div>
          <time className="whitespace-nowrap text-xs text-slate-500">
            {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.occurredAt))}
          </time>
        </div>
        {hasHeavyPayload || (p && Object.keys(p).length > 6) ? (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <TechnicalJsonDisclosure label="Activity details" data={item.payload ?? {}} defaultOpen={false} />
          </div>
        ) : null}
      </div>
    </div>
  );
};
