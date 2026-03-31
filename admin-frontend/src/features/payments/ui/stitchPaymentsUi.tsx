import { Link } from "react-router-dom";

import { MaterialIcon } from "@/components/ui/MaterialIcon";

export const customerInitials = (name: string | null | undefined, email: string | null | undefined): string => {
  const n = (name ?? "").trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase();
    return n.slice(0, 2).toUpperCase();
  }
  const e = (email ?? "").trim();
  if (e) return e.slice(0, 2).toUpperCase();
  return "—";
};

/** Stitch `payments_list` status chip: dot + uppercase label */
export const StitchPaymentStatusPill = ({ paymentState }: { paymentState: string }) => {
  const label = (() => {
    switch (paymentState) {
      case "PAID":
        return "Completed";
      case "FAILED":
        return "Failed";
      case "CANCELLED":
        return "Cancelled";
      case "REFUNDED":
      case "PARTIALLY_REFUNDED":
      case "REFUND_PENDING":
        return "Refunded";
      case "AWAITING_CUSTOMER_ACTION":
      case "INITIALIZED":
      case "PENDING_INITIALIZATION":
        return "Pending";
      default:
        return paymentState.replace(/_/g, " ");
    }
  })();

  const dot =
    paymentState === "PAID"
      ? "bg-emerald-600"
      : paymentState === "FAILED"
        ? "bg-red-600"
        : paymentState === "CANCELLED"
          ? "bg-slate-400"
          : ["REFUNDED", "PARTIALLY_REFUNDED", "REFUND_PENDING"].includes(paymentState)
            ? "bg-slate-400"
            : "bg-amber-400";

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-tight text-slate-700">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
};

export const StitchTableActions = ({
  detailTo,
  orderTo
}: {
  detailTo: string;
  orderTo: string;
}) => (
  <div className="flex justify-center gap-3">
    <Link
      to={detailTo}
      className="text-slate-400 transition-colors hover:text-[#1653cc]"
      title="View Details"
      aria-label="View payment details"
    >
      <MaterialIcon name="visibility" className="text-lg" />
    </Link>
    <Link
      to={orderTo}
      className="text-slate-400 transition-colors hover:text-[#1653cc]"
      title="Go to Order"
      aria-label="Go to order"
    >
      <MaterialIcon name="shopping_bag" className="text-lg" />
    </Link>
  </div>
);

export const stitchProviderSwatch = (label: string): { swatch: string; text: string } => {
  const l = label.toLowerCase();
  if (l.includes("mtn") || l.includes("momo") || l.includes("mobile"))
    return { swatch: "bg-yellow-500", text: label };
  if (l.includes("telecel")) return { swatch: "bg-violet-500", text: label };
  if (l.includes("airtel") || l.includes("tigo")) return { swatch: "bg-red-500", text: label };
  if (l.includes("visa")) return { swatch: "bg-blue-700", text: label };
  if (l.includes("master")) return { swatch: "bg-orange-600", text: label };
  if (l.includes("paystack")) return { swatch: "bg-cyan-600", text: label };
  return { swatch: "bg-slate-400", text: label };
};
