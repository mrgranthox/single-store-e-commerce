import type { ReactNode } from "react";
import {
  Check,
  Circle,
  CreditCard,
  Package,
  ShoppingCart,
  Truck
} from "lucide-react";

import type { AdminOrderTimelineItem } from "@/features/orders/api/admin-orders.api";

const formatWhen = (iso: string) => {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "medium"
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const humanize = (raw: string) => raw.replace(/_/g, " ");

const looksLikeEnum = (s: string) => /^[A-Z0-9_]+$/.test(s.trim());

const eventTitle = (t: AdminOrderTimelineItem) => {
  if (t.kind === "STATUS_CHANGE") {
    return `Status · ${humanize(t.label)}`;
  }
  const label = t.label?.trim() ?? "";
  if (label && !looksLikeEnum(label) && label !== t.eventType) {
    return label;
  }
  return humanize(t.eventType);
};

const eventSubtitle = (t: AdminOrderTimelineItem) => {
  if (t.kind === "STATUS_CHANGE") {
    return null;
  }
  const label = t.label?.trim() ?? "";
  const primary = eventTitle(t);
  const technical = humanize(t.eventType);
  if (label && !looksLikeEnum(label) && label !== t.eventType && primary === label) {
    return technical !== primary ? technical : null;
  }
  if (t.label && t.label !== t.eventType && looksLikeEnum(label)) {
    return humanize(t.label);
  }
  return null;
};

type IconKind = "delivered" | "ship" | "payment" | "cart" | "inventory" | "default";

const iconKindFor = (t: AdminOrderTimelineItem): IconKind => {
  const u = `${t.kind} ${t.eventType}`.toUpperCase();
  if (u.includes("DELIVER")) return "delivered";
  if (u.includes("SHIP") || u.includes("DISPATCH") || u.includes("PACK")) return "ship";
  if (u.includes("PAYMENT") || u.includes("PAID")) return "payment";
  if (u.includes("PLACED") || u.includes("BASKET") || u.includes("ORDER_CREATED")) return "cart";
  if (u.includes("FULFILL") || u.includes("INVENTORY") || u.includes("WAREHOUSE")) return "inventory";
  return "default";
};

const EventIcon = ({ kind, muted }: { kind: IconKind; muted: boolean }) => {
  const wrap = (node: ReactNode, cls: string) => (
    <div
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-white shadow-sm ${cls}`}
    >
      {node}
    </div>
  );

  if (kind === "delivered") {
    return wrap(<Check className="h-3 w-3 text-white" strokeWidth={3} />, "bg-emerald-600");
  }
  if (kind === "ship") {
    return wrap(<Truck className="h-3 w-3 text-white" />, "bg-[#1653cc]");
  }
  if (kind === "payment") {
    return wrap(<CreditCard className="h-3 w-3 text-[#737685]" />, "border border-[#c3c6d6] bg-[#e0e2f0]");
  }
  if (kind === "cart") {
    return wrap(<ShoppingCart className="h-3 w-3 text-[#737685]" />, "border border-[#c3c6d6] bg-[#e0e2f0]");
  }
  if (kind === "inventory") {
    return wrap(<Package className="h-3 w-3 text-[#737685]" />, "border border-[#c3c6d6] bg-[#e0e2f0]");
  }
  return wrap(
    muted ? (
      <Circle className="h-2 w-2 text-[#737685]" />
    ) : (
      <Circle className="h-2.5 w-2.5 fill-[#737685] text-[#737685]" />
    ),
    "border border-[#c3c6d6] bg-white"
  );
};

export const OrderStitchFulfillmentTimeline = ({ events }: { events: AdminOrderTimelineItem[] }) => {
  const ordered = [...events].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );

  if (ordered.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[#434654]">No timeline events yet.</p>
    );
  }

  return (
    <div className="relative">
      <div className="absolute bottom-8 left-[11px] top-8 w-0.5 bg-[#e0e2f0]" aria-hidden />
      <ul className="relative space-y-12">
        {ordered.map((t, i) => {
          const kind = iconKindFor(t);
          const muted = i > 2;
          const sub = eventSubtitle(t);
          return (
            <li key={t.id} className="relative pl-12">
              <div className="absolute left-0 top-0 z-10">
                <EventIcon kind={kind} muted={muted} />
              </div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="font-semibold text-[#181b25]">{eventTitle(t)}</h4>
                  {sub ? <p className="mt-1 text-sm text-[#434654]">{sub}</p> : null}
                  <p className="mt-2 text-xs text-[#737685]">
                    {t.actorType === "SYSTEM" ? "System" : `Actor · ${humanize(t.actorType)}`}
                  </p>
                </div>
                <time
                  className="shrink-0 rounded bg-[#f2f3ff] px-2 py-1 font-mono text-xs text-[#434654]"
                  dateTime={t.occurredAt}
                >
                  {formatWhen(t.occurredAt)}
                </time>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
