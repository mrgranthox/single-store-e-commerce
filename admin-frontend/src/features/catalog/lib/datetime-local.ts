/** Convert API UTC ISO string to `datetime-local` input value (local wall time). */
export const utcIsoToDatetimeLocalValue = (iso: string | null | undefined): string => {
  if (!iso) {
    return "";
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Parse `datetime-local` value to UTC ISO string for JSON body. */
export const datetimeLocalValueToUtcIso = (value: string): string | undefined => {
  const v = value.trim();
  if (!v) {
    return undefined;
  }
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) {
    return undefined;
  }
  return d.toISOString();
};
