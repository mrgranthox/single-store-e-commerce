import type { SettingsScope, SystemSettingRow } from "@/features/system/api/admin-system.api";
import { STORE_CURRENCY_CODE, formatMinorGhs } from "@/lib/store-currency";

const PREFIX: Record<SettingsScope, string> = {
  checkout: "checkout.",
  reviews: "reviews.",
  support: "support."
};

const readBool = (v: unknown, fallback = false): boolean => (typeof v === "boolean" ? v : fallback);

const readNum = (v: unknown, fallback = 0): number => (typeof v === "number" && !Number.isNaN(v) ? v : fallback);

const readStr = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);

const readStrArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

const val = (items: SystemSettingRow[], scope: SettingsScope, shortKey: string): unknown => {
  const p = PREFIX[scope];
  const full = `${p}${shortKey}`;
  return items.find((r) => r.key === full)?.value;
};

type ToggleProps = {
  on: boolean;
  disabled?: boolean;
  onToggle: () => void;
};

const StitchToggle = ({ on, disabled, onToggle }: ToggleProps) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onToggle}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#1653cc]/30 disabled:opacity-50 ${
      on ? "bg-[#1653cc]" : "bg-[#737685]/40"
    }`}
    aria-pressed={on}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
        on ? "translate-x-6" : "translate-x-1"
      }`}
    />
  </button>
);

type Props = {
  scope: SettingsScope;
  items: SystemSettingRow[];
  onPatch: (shortKey: string, value: unknown) => void;
  patching: boolean;
};

/** Stitch-aligned controls bound to canonical scoped keys (upsert on change). */
export const ScopedSettingsStitchWorkspace = ({ scope, items, onPatch, patching }: Props) => {
  if (scope === "checkout") {
    const guest = readBool(val(items, scope, "guestCheckoutEnabled"), true);
    const minCents = readNum(val(items, scope, "orderMinimumCents"), 2500);
    const cancelHrs = readNum(val(items, scope, "selfCancelWindowHours"), 24);
    const hideOos = readBool(val(items, scope, "autoHideOutOfStock"), false);
    const syncFreq = readStr(val(items, scope, "inventorySyncFrequency"), "realtime");
    const taxPct = readNum(val(items, scope, "globalTaxRatePercent"), 8.5);
    const gwPaystack = readBool(val(items, scope, "paymentGatewayPaystack"), true);
    const taxInclusive = readBool(val(items, scope, "taxInclusivePricing"), true);

    return (
      <div className="mb-8 space-y-6">
        <section className="rounded-sm border-l-4 border-[#1653cc] bg-white p-6 shadow-sm">
          <h3 className="mb-6 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[#434654]">
            Checkout logic
          </h3>
          <div className="space-y-8">
            <div className="flex items-start justify-between gap-4">
              <div className="max-w-md">
                <p className="text-sm font-semibold text-[#181b25]">Guest checkout</p>
                <p className="mt-1 text-xs leading-relaxed text-[#434654]">
                  Allow checkout without a permanent account. Increases conversion; less CRM history.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StitchToggle
                  on={guest}
                  disabled={patching}
                  onToggle={() => onPatch("guestCheckoutEnabled", !guest)}
                />
                <span className="text-xs font-bold text-[#1653cc]">{guest ? "ENABLED" : "OFF"}</span>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase text-[#737685]">
                  Order minimum ({STORE_CURRENCY_CODE})
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-[#434654]">
                    ₵
                  </span>
                  <input
                    type="text"
                    defaultValue={(minCents / 100).toFixed(2)}
                    disabled={patching}
                    onBlur={(e) => {
                      const n = Number.parseFloat(e.target.value.replace(/,/g, ""));
                      if (Number.isNaN(n) || n < 0) {
                        return;
                      }
                      onPatch("orderMinimumCents", Math.round(n * 100));
                    }}
                    className="block w-full rounded-sm border-0 bg-[#f2f3ff] py-2 pl-7 pr-3 font-mono text-sm font-medium text-[#181b25] focus:ring-1 focus:ring-[#1653cc]"
                  />
                </div>
                <p className="mt-1.5 text-[10px] text-[#737685]">
                  Amounts in Ghana Cedis ({STORE_CURRENCY_CODE}). Example display: {formatMinorGhs(minCents)}. Set to 0.00 to
                  disable threshold logic.
                </p>
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase text-[#737685]">Self-cancel window</label>
                <div className="relative flex">
                  <input
                    type="number"
                    defaultValue={cancelHrs}
                    disabled={patching}
                    onBlur={(e) => {
                      const n = Number.parseInt(e.target.value, 10);
                      if (Number.isNaN(n) || n < 0) {
                        return;
                      }
                      onPatch("selfCancelWindowHours", n);
                    }}
                    className="block w-full rounded-sm border-0 bg-[#f2f3ff] px-3 py-2 font-mono text-sm font-medium text-[#181b25] focus:ring-1 focus:ring-[#1653cc]"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#434654]">
                    HOURS
                  </span>
                </div>
                <p className="mt-1.5 text-[10px] text-[#737685]">Grace period for customer-initiated cancellation.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-sm bg-white p-6 shadow-sm">
          <h3 className="mb-6 text-sm font-bold uppercase tracking-wider text-[#434654]">Payment &amp; inventory</h3>
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
            <div>
              <label className="mb-4 block text-xs font-bold uppercase text-[#737685]">Payment processor</label>
              <p className="mb-3 text-xs leading-relaxed text-[#434654]">
                This store uses <span className="font-semibold text-[#181b25]">Paystack</span> for card and mobile money
                checkout. No other gateways are enabled.
              </p>
              <label className="flex cursor-pointer items-center rounded-sm border border-[#e0e2f0]/40 p-3 transition-colors hover:bg-[#f2f3ff]">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded-sm border-[#737685] text-[#1653cc] focus:ring-[#1653cc]"
                  checked={gwPaystack}
                  disabled={patching}
                  onChange={() => onPatch("paymentGatewayPaystack", !gwPaystack)}
                />
                <span className="ml-3 text-sm font-medium text-[#181b25]">Paystack (cards &amp; MoMo)</span>
              </label>
            </div>
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div className="pr-4">
                  <p className="text-sm font-semibold text-[#181b25]">Auto-hide out-of-stock</p>
                  <p className="mt-1 text-xs leading-snug text-[#434654]">
                    Remove storefront visibility when inventory hits zero.
                  </p>
                </div>
                <StitchToggle
                  on={hideOos}
                  disabled={patching}
                  onToggle={() => onPatch("autoHideOutOfStock", !hideOos)}
                />
              </div>
              <div className="border-t border-[#e0e2f0]/30 pt-4">
                <label className="mb-3 block text-xs font-bold uppercase text-[#737685]">Inventory sync frequency</label>
                <select
                  value={syncFreq}
                  disabled={patching}
                  onChange={(e) => onPatch("inventorySyncFrequency", e.target.value)}
                  className="block w-full rounded-sm border-0 bg-[#f2f3ff] px-3 py-2 text-sm font-medium text-[#181b25] focus:ring-1 focus:ring-[#1653cc]"
                >
                  <option value="realtime">Real-time (active)</option>
                  <option value="m5">Every 5 minutes</option>
                  <option value="hourly">Hourly batch</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-sm bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#434654]">Tax architecture</h3>
            <span className="flex items-center gap-1 rounded-full bg-[#00873b]/10 px-2 py-0.5 text-[10px] font-bold text-[#006b2d]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#006b2d]" />
              Regulatory mode
            </span>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <label className="mb-2 block text-xs font-bold uppercase text-[#737685]">Global tax rate (%)</label>
              <div className="relative">
                <input
                  type="text"
                  defaultValue={String(taxPct)}
                  disabled={patching}
                  onBlur={(e) => {
                    const n = Number.parseFloat(e.target.value);
                    if (Number.isNaN(n) || n < 0) {
                      return;
                    }
                    onPatch("globalTaxRatePercent", n);
                  }}
                  className="block w-full rounded-sm border-0 bg-[#f2f3ff] px-3 py-2 pr-10 font-mono text-sm font-medium text-[#181b25] focus:ring-1 focus:ring-[#1653cc]"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[#434654]">
                  %
                </span>
              </div>
            </div>
            <div className="lg:col-span-8">
              <label className="mb-2 block text-xs font-bold uppercase text-[#737685]">Tax calculation logic</label>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={patching}
                  onClick={() => onPatch("taxInclusivePricing", true)}
                  className={`flex-1 min-w-[140px] rounded-sm py-2 px-4 text-xs font-bold transition-colors ${
                    taxInclusive
                      ? "bg-[#1653cc] text-white shadow-sm"
                      : "border border-[#e0e2f0]/60 bg-[#f2f3ff] text-[#434654] hover:bg-[#e8ebff]"
                  }`}
                >
                  TAX INCLUSIVE
                </button>
                <button
                  type="button"
                  disabled={patching}
                  onClick={() => onPatch("taxInclusivePricing", false)}
                  className={`flex-1 min-w-[140px] rounded-sm py-2 px-4 text-xs font-bold transition-colors ${
                    !taxInclusive
                      ? "bg-[#1653cc] text-white shadow-sm"
                      : "border border-[#e0e2f0]/60 bg-[#f2f3ff] text-[#434654] hover:bg-[#e8ebff]"
                  }`}
                >
                  TAX EXCLUSIVE
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (scope === "reviews") {
    const autoPub = readBool(val(items, scope, "autoPublishEnabled"), false);
    const profanity = readBool(val(items, scope, "profanityFilterEnabled"), true);
    const verified = readBool(val(items, scope, "requireVerifiedPurchase"), true);

    return (
      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className="rounded-xl border-l-4 border-[#1653cc] bg-white p-6 shadow-sm">
          <h3 className="mb-6 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[#434654]">
            Content automation
          </h3>
          <div className="space-y-6">
            {[
              {
                title: "Auto-publish reviews",
                body: "Bypass moderation queue for clean, non-flagged submissions.",
                on: autoPub,
                key: "autoPublishEnabled"
              },
              {
                title: "Profanity filter",
                body: "Auto-quarantine reviews that match blocklists.",
                on: profanity,
                key: "profanityFilterEnabled"
              },
              {
                title: "Require verified purchase",
                body: "Only buyers who completed checkout can leave public reviews.",
                on: verified,
                key: "requireVerifiedPurchase"
              }
            ].map((row) => (
              <div key={row.key} className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[#181b25]">{row.title}</p>
                  <p className="mt-1 text-xs text-[#434654]">{row.body}</p>
                </div>
                <StitchToggle
                  on={row.on}
                  disabled={patching}
                  onToggle={() => onPatch(row.key, !row.on)}
                />
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  /* support */
  const slaFirst = readNum(val(items, scope, "slaFirstResponseHours"), 4);
  const slaResolve = readNum(val(items, scope, "slaResolutionHours"), 48);
  const categories = readStrArr(val(items, scope, "ticketCategories"));
  const displayCats =
    categories.length > 0
      ? categories
      : ["Critical bug", "Billing & invoice", "Shipping delay", "Account access", "General inquiry"];

  return (
    <div className="mb-8 space-y-6">
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-headline text-lg font-semibold text-[#181b25]">Ticket categories</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {displayCats.slice(0, 6).map((cat) => (
            <div
              key={cat}
              className="flex items-center justify-between rounded-sm border-l-4 border-[#1653cc] bg-[#f2f3ff] p-4"
            >
              <span className="text-sm font-medium text-[#181b25]">{cat}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-[#737685]">
          Categories apply to new tickets and routing rules. Adjust the list in the settings table below if your team uses
          different labels.
        </p>
      </section>

      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="mb-6 text-sm font-bold uppercase tracking-wider text-[#434654]">SLA targets</h3>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-[#737685]">First response (hours)</label>
            <input
              type="number"
              defaultValue={slaFirst}
              disabled={patching}
              onBlur={(e) => {
                const n = Number.parseInt(e.target.value, 10);
                if (Number.isNaN(n) || n < 0) {
                  return;
                }
                onPatch("slaFirstResponseHours", n);
              }}
              className="w-full rounded-sm border-0 bg-[#f2f3ff] px-3 py-2 font-mono text-sm text-[#181b25] focus:ring-1 focus:ring-[#1653cc]"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-[#737685]">Resolution target (hours)</label>
            <input
              type="number"
              defaultValue={slaResolve}
              disabled={patching}
              onBlur={(e) => {
                const n = Number.parseInt(e.target.value, 10);
                if (Number.isNaN(n) || n < 0) {
                  return;
                }
                onPatch("slaResolutionHours", n);
              }}
              className="w-full rounded-sm border-0 bg-[#f2f3ff] px-3 py-2 font-mono text-sm text-[#181b25] focus:ring-1 focus:ring-[#1653cc]"
            />
          </div>
        </div>
      </section>
    </div>
  );
};

export const stitchBoundKeys = (scope: SettingsScope): Set<string> => {
  const p = PREFIX[scope];
  if (scope === "checkout") {
    return new Set(
      [
        "guestCheckoutEnabled",
        "orderMinimumCents",
        "selfCancelWindowHours",
        "autoHideOutOfStock",
        "inventorySyncFrequency",
        "globalTaxRatePercent",
        "taxInclusivePricing",
        "paymentGatewayPaystack"
      ].map((k) => `${p}${k}`)
    );
  }
  if (scope === "reviews") {
    return new Set(["autoPublishEnabled", "profanityFilterEnabled", "requireVerifiedPurchase"].map((k) => `${p}${k}`));
  }
  return new Set(
    ["slaFirstResponseHours", "slaResolutionHours", "ticketCategories"].map((k) => `${p}${k}`)
  );
};
