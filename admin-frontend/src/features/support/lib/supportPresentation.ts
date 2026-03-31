export const formatTicketNumber = (id: string) => {
  const short = id.replace(/-/g, "").slice(0, 6).toUpperCase();
  return `#TK-${short}`;
};

export const initialsFromCustomer = (name: string | null, email: string | null) => {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
  }
  if (email?.trim()) {
    return email.trim().slice(0, 2).toUpperCase();
  }
  return "?";
};

export const relativeShort = (iso: string) => {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) {
    return "—";
  }
  const diffMs = Date.now() - t;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) {
    return "Just now";
  }
  const min = Math.floor(sec / 60);
  if (min < 60) {
    return `${min}m ago`;
  }
  const hr = Math.floor(min / 60);
  if (hr < 48) {
    return `${hr}h ago`;
  }
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
};

export const priorityDotClass = (p: string) => {
  if (p === "URGENT") {
    return "bg-[#ba1a1a]";
  }
  if (p === "HIGH") {
    return "bg-amber-500";
  }
  if (p === "MEDIUM") {
    return "bg-[#1653cc]";
  }
  return "bg-slate-300";
};

export const priorityChipClass = (p: string) => {
  if (p === "URGENT") {
    return "border border-[#ba1a1a]/20 bg-[#ba1a1a]/10 text-[#ba1a1a]";
  }
  if (p === "HIGH") {
    return "border border-amber-500/20 bg-amber-500/10 text-amber-700";
  }
  if (p === "MEDIUM") {
    return "border border-[#1653cc]/20 bg-[#1653cc]/10 text-[#1653cc]";
  }
  return "border border-slate-300/50 bg-slate-100 text-slate-600";
};

export const humanizeSupportType = (code: string) =>
  code.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const countByPriority = (rows: { priority: string; count: number }[], priority: string) =>
  rows.find((r) => r.priority === priority)?.count ?? 0;

export const countByStatus = (rows: { status: string; count: number }[], status: string) =>
  rows.find((r) => r.status === status)?.count ?? 0;

export const totalTickets = (byStatus: { count: number }[]) => byStatus.reduce((a, r) => a + r.count, 0);

/** Positive = time until SLA due; negative = overdue by that many seconds. */
export const formatSlaCountdown = (slaSecondsRemaining: number | null) => {
  if (slaSecondsRemaining === null) {
    return "—";
  }
  const sign = slaSecondsRemaining < 0 ? "−" : "";
  const abs = Math.abs(slaSecondsRemaining);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  if (h > 0) {
    return `${sign}${h}h ${m}m`;
  }
  if (m > 0) {
    return `${sign}${m}m ${s}s`;
  }
  return `${sign}${s}s`;
};

export const formatMinutesLabel = (min: number | null) => {
  if (min === null || Number.isNaN(min)) {
    return "—";
  }
  if (min < 60) {
    return `${Math.round(min)}m`;
  }
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h ${m}m`;
};
