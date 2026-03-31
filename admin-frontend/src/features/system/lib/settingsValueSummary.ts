/** Short, non-JSON summary for settings table cells (ops-friendly). */
export const summarizeSettingValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "Not set";
  }
  if (typeof value === "string") {
    const t = value.trim();
    if (!t) {
      return "Empty text";
    }
    return t.length > 72 ? `${t.slice(0, 72)}…` : t;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? "Empty list" : `List · ${value.length} item${value.length === 1 ? "" : "s"}`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value as object);
    if (keys.length === 0) {
      return "Empty group";
    }
    return `Group · ${keys.length} field${keys.length === 1 ? "" : "s"}`;
  }
  return "Value";
};

export const humanizeSettingKey = (key: string): string =>
  key
    .replace(/[._]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
