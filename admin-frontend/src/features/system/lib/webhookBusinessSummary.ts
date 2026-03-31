import { STORE_CURRENCY_CODE, formatMinorGhs } from "@/lib/store-currency";

const asRecord = (v: unknown): Record<string, unknown> | null =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

/** Human-readable lines for admin webhook detail — no raw JSON. */
export const buildWebhookBusinessSummary = (
  payload: unknown,
  provider: string,
  eventType: string
): Array<{ label: string; value: string }> => {
  const rows: Array<{ label: string; value: string }> = [];
  const p = asRecord(payload);

  rows.push({ label: "Inbound channel", value: provider || "—" });
  rows.push({ label: "Event name", value: eventType || "—" });

  if (!p) {
    rows.push({ label: "Details", value: "No structured fields were returned for this event." });
    return rows;
  }

  const event = typeof p.event === "string" ? p.event : null;
  if (event) {
    rows.push({ label: "Provider event", value: event });
  }

  const data = asRecord(p.data);
  if (data) {
    const reference =
      (typeof data.reference === "string" && data.reference) ||
      (typeof data.transaction_reference === "string" && data.transaction_reference) ||
      (typeof data.id === "string" && data.id) ||
      null;
    if (reference) {
      rows.push({ label: "Reference / id", value: reference });
    }

    const amountRaw = data.amount;
    const currencyRaw = data.currency;
    if (typeof amountRaw === "number" || typeof amountRaw === "string") {
      const n = typeof amountRaw === "number" ? amountRaw : Number.parseFloat(String(amountRaw));
      if (!Number.isNaN(n)) {
        const cur = typeof currencyRaw === "string" && currencyRaw ? currencyRaw.toUpperCase() : STORE_CURRENCY_CODE;
        const isPaystack = provider.toLowerCase().includes("paystack");
        const formatted =
          isPaystack && Number.isInteger(n) && cur === STORE_CURRENCY_CODE
            ? formatMinorGhs(Math.round(n))
            : cur === STORE_CURRENCY_CODE
              ? formatMinorGhs(Math.round(n * 100))
              : `${n.toFixed(2)} ${cur}`;
        rows.push({ label: "Amount", value: formatted });
      }
    }

    const status = data.status;
    if (typeof status === "string" && status) {
      rows.push({ label: "Payment / charge status", value: status.replace(/_/g, " ") });
    }

    const customer = asRecord(data.customer);
    if (customer) {
      const email = customer.email;
      if (typeof email === "string" && email) {
        rows.push({ label: "Customer email", value: email });
      }
      const phone = customer.phone || customer.customer_code;
      if (typeof phone === "string" && phone) {
        rows.push({ label: "Customer phone / code", value: phone });
      }
    }

    const domain = data.domain;
    if (typeof domain === "string" && domain) {
      rows.push({ label: "Paystack domain", value: domain });
    }
  }

  return rows;
};
