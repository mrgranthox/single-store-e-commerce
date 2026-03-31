/** Shared presentation helpers for security / audit admin screens (Stitch-aligned, non-technical copy). */

/** High-visibility in-table / in-body links (Stitch explorer parity). */
export const stitchVisibleLinkClass =
  "inline-flex items-center gap-1 font-semibold text-[#1653cc] underline decoration-[#1653cc]/45 underline-offset-[3px] transition-colors hover:text-[#0f3d99] hover:decoration-[#1653cc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1653cc]";

/** Compact “open record” control — smaller than full text links for dense tables. */
export const stitchRecordLinkClass =
  "inline-flex max-w-full items-center gap-0.5 rounded-md border border-[#1653cc]/20 bg-[#f4f6ff] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#0f3d99] shadow-[0_1px_0_rgba(22,83,204,0.06)] transition-colors hover:border-[#1653cc]/45 hover:bg-[#e8ebfc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1653cc]";

/** Wrapper: horizontal scroll for wide data tables on small viewports. */
export const securityTableScrollClass = "-mx-4 overflow-x-auto px-4 sm:mx-0 sm:overflow-x-auto sm:px-0";

export const formatAdminDateTime = (iso: string) => {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "medium" }).format(new Date(iso));
  } catch {
    return iso;
  }
};

export const formatAdminDateTimeLong = (iso: string) => {
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

export const relativeShort = (iso: string) => {
  try {
    const d = new Date(iso).getTime();
    const diff = Date.now() - d;
    const m = Math.floor(diff / 60000);
    if (m < 1) return "Just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 48) return `${h}h ago`;
    return formatAdminDateTime(iso);
  } catch {
    return iso;
  }
};

export const actorAdminEmail = (actor: unknown): string => {
  if (actor && typeof actor === "object" && "email" in actor) {
    const e = (actor as { email: string | null }).email;
    if (e && e.trim()) return e.trim();
  }
  return "—";
};

export const initialsFromEmail = (email: string) => {
  const base = email.split("@")[0] ?? email;
  const parts = base.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return base.slice(0, 2).toUpperCase() || "?";
};

/** One-line summary for admin action before/after JSON — not a raw dump in the cell. */
export const businessSnapshot = (v: unknown, maxLen = 72): string => {
  if (v == null) return "—";
  if (typeof v === "string") {
    const t = v.trim();
    return t.length > maxLen ? `${t.slice(0, maxLen)}…` : t || "—";
  }
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    return v.length === 0 ? "—" : `${v.length} item${v.length === 1 ? "" : "s"}`;
  }
  if (typeof v === "object") {
    const keys = Object.keys(v as object);
    if (keys.length === 0) return "—";
    const preview = keys.slice(0, 4).join(", ");
    return keys.length > 4 ? `${preview}…` : preview;
  }
  return "—";
};

export const timelinePayloadLine = (payload: unknown): string => {
  if (payload == null) return "—";
  if (typeof payload === "string") {
    return payload.length > 140 ? `${payload.slice(0, 140)}…` : payload;
  }
  if (typeof payload === "object" && !Array.isArray(payload)) {
    const o = payload as Record<string, unknown>;
    for (const k of ["message", "summary", "description", "title", "note"]) {
      const val = o[k];
      if (typeof val === "string" && val.trim()) {
        return val.length > 140 ? `${val.slice(0, 140)}…` : val;
      }
    }
    const keys = Object.keys(o);
    return keys.length ? keys.slice(0, 5).join(", ") + (keys.length > 5 ? " …" : "") : "—";
  }
  try {
    const s = JSON.stringify(payload);
    return s.length > 100 ? `${s.slice(0, 100)}…` : s;
  } catch {
    return "—";
  }
};

/** Best-effort device / client hint from timeline payload JSON. */
export const pickDeviceFromPayload = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const p = payload as Record<string, unknown>;
  for (const k of ["userAgent", "device", "deviceType", "clientDevice", "browser"]) {
    const v = p[k];
    if (typeof v === "string" && v.trim()) {
      const t = v.trim();
      return t.length > 80 ? `${t.slice(0, 80)}…` : t;
    }
  }
  return null;
};

export const pickIpFromMetadata = (metadata: unknown): string | null => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const m = metadata as Record<string, unknown>;
  for (const k of ["ip", "ipAddress", "sourceIp", "clientIp", "ip_address"]) {
    const v = m[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
};

export const incidentSeverityFromMetadata = (metadata: unknown): string => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return "—";
  }
  const s = (metadata as Record<string, unknown>).severity;
  return typeof s === "string" && s.trim() ? s.trim().toUpperCase() : "—";
};

export const humanizeEnumLabel = (s: string) =>
  s
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

/** In-app deep link for admin action / audit entity references (when routable). */
export const adminActionEntityHref = (entityType: string | null | undefined, entityId: string | null | undefined): string | null => {
  const t = entityType?.trim().toUpperCase();
  const id = entityId?.trim();
  if (!t || !id) {
    return null;
  }
  if (t === "ORDER") {
    return `/admin/orders/${encodeURIComponent(id)}`;
  }
  if (t === "USER" || t === "CUSTOMER") {
    return `/admin/customers/${encodeURIComponent(id)}`;
  }
  if (t === "PRODUCT") {
    return `/admin/catalog/products/${encodeURIComponent(id)}`;
  }
  if (t === "PAYMENT") {
    return `/admin/payments/${encodeURIComponent(id)}`;
  }
  if (t === "INCIDENT") {
    return `/admin/security/incidents/${encodeURIComponent(id)}`;
  }
  if (t === "ALERT") {
    return `/admin/security/alerts/${encodeURIComponent(id)}`;
  }
  if (t === "SECURITY_EVENT") {
    return `/admin/security/events/${encodeURIComponent(id)}`;
  }
  if (t === "RISK_SIGNAL") {
    return `/admin/security/risk-signals`;
  }
  return null;
};

export const downloadUtf8Csv = (filename: string, header: string[], rows: string[][]) => {
  const esc = (cell: string) => {
    if (/[",\n\r]/.test(cell)) {
      return `"${cell.replace(/"/g, '""')}"`;
    }
    return cell;
  };
  const lines = [header.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))];
  const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const summarizeUserRef = (u: unknown): string => {
  if (!u || typeof u !== "object") return "Unlinked";
  const o = u as { email?: string | null; name?: string | null; id?: string };
  if (o.name?.trim()) return o.name.trim();
  if (o.email?.trim()) return o.email.trim();
  if (o.id) return `User ${o.id.slice(0, 8)}…`;
  return "Linked account";
};

const METADATA_SENSITIVE_KEYS = new Set(
  ["password", "token", "secret", "authorization", "cookie", "cookies", "apikey", "api_key"].map((k) => k.toLowerCase())
);

/** Turn camel_case / snake keys into short titles for business-facing tables. */
export const humanizeFieldLabel = (key: string): string => {
  const spaced = key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
  return spaced.replace(/\b\w/g, (c) => c.toUpperCase());
};

const formatMetadataScalar = (v: unknown, maxLen: number): string => {
  if (v == null) return "—";
  if (typeof v === "string") {
    const t = v.trim();
    return t.length > maxLen ? `${t.slice(0, maxLen)}…` : t || "—";
  }
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return "—";
    const preview = v
      .slice(0, 4)
      .map((x) => formatMetadataScalar(x, 48))
      .join("; ");
    return v.length > 4 ? `${preview} (+${v.length - 4} more)` : preview;
  }
  if (typeof v === "object") {
    return businessSnapshot(v, maxLen);
  }
  return "—";
};

export type BusinessMetadataRow = { label: string; value: string };

/**
 * Flatten object metadata into label/value rows for business UI (no raw JSON).
 */
export const metadataToBusinessRows = (
  metadata: unknown,
  options?: { maxRows?: number; excludeKeys?: string[] }
): BusinessMetadataRow[] => {
  const maxRows = options?.maxRows ?? 28;
  const exclude = new Set([...(options?.excludeKeys ?? []), "investigationNotes"]);
  if (metadata == null) {
    return [];
  }
  if (typeof metadata === "string") {
    const t = metadata.trim();
    return t ? [{ label: "Summary", value: formatMetadataScalar(t, 400) }] : [];
  }
  if (typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }
  const o = metadata as Record<string, unknown>;
  const rows: BusinessMetadataRow[] = [];
  for (const [k, v] of Object.entries(o)) {
    if (exclude.has(k) || METADATA_SENSITIVE_KEYS.has(k.toLowerCase())) {
      continue;
    }
    if (v === undefined) {
      continue;
    }
    rows.push({ label: humanizeFieldLabel(k), value: formatMetadataScalar(v, 220) });
    if (rows.length >= maxRows) {
      break;
    }
  }
  return rows;
};

/** One-line preview for audit / list cells (no JSON). */
export const auditMetadataPreviewLine = (metadata: unknown): string => {
  const line = timelinePayloadLine(metadata);
  if (line !== "—") {
    return line;
  }
  const rows = metadataToBusinessRows(metadata, { maxRows: 3 });
  if (rows.length === 0) {
    return "—";
  }
  return rows.map((r) => `${r.label}: ${r.value}`).join(" · ");
};

export const summarizeAdminActor = (v: unknown): string => {
  if (!v || typeof v !== "object") return "Unassigned";
  const o = v as { email?: string | null; name?: string | null; id?: string | null };
  if (typeof o.email === "string" && o.email.trim()) {
    return o.email.trim();
  }
  if (typeof o.name === "string" && o.name.trim()) {
    return o.name.trim();
  }
  if (typeof o.id === "string" && o.id.trim()) {
    return `Admin ${o.id.slice(0, 8)}…`;
  }
  return "Assigned";
};

export const downloadTextFile = (filename: string, body: string) => {
  const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
