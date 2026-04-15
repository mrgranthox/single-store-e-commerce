import { formatGhs } from "@/lib/currency";

export const centsToGhsAmount = (cents: number | null | undefined): number =>
  typeof cents === "number" && Number.isFinite(cents) ? cents / 100 : 0;

export const formatGhsFromCents = (cents: number | null | undefined): string => formatGhs(centsToGhsAmount(cents));

export const readGrandTotalCents = (totals: unknown): number | null => {
  if (!totals || typeof totals !== "object") return null;
  const c = (totals as { grandTotalCents?: unknown }).grandTotalCents;
  return typeof c === "number" && Number.isFinite(c) ? c : null;
};

export const formatOrderStatusLabel = (status: string): string => {
  const map: Record<string, string> = {
    DRAFT: "Draft",
    PENDING_PAYMENT: "Pending payment",
    CONFIRMED: "Confirmed",
    PROCESSING: "Processing",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    CLOSED: "Closed"
  };
  return (
    map[status] ??
    status
      .toLowerCase()
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  );
};

export const formatIsoDate = (iso: string | Date): string => {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("en-GH", { year: "numeric", month: "short", day: "numeric" });
};

export const ticketStatusBadgeClass = (status: string): string => {
  switch (status) {
    case "OPEN":
    case "PENDING_CUSTOMER":
      return "bg-error/10 text-error";
    case "CLOSED":
    case "RESOLVED":
      return "bg-secondary/10 text-secondary";
    default:
      return "bg-surface-container-high text-on-surface-variant";
  }
};
