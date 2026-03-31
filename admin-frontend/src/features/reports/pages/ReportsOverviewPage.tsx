import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3,
  Boxes,
  ChevronRight,
  Headphones,
  LineChart,
  Megaphone,
  Package,
  RotateCcw,
  Users
} from "lucide-react";

import { PageHeader } from "@/components/primitives/PageHeader";
import { StitchFieldLabel, StitchFilterPanel, StitchPageBody, stitchInputClass } from "@/components/stitch";

const RECENT_KEY = "admin-reports-recent-v1";

type RecentEntry = { path: string; title: string; at: number };

const readRecent = (): RecentEntry[] => {
  try {
    const raw = sessionStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is RecentEntry =>
        typeof x === "object" &&
        x !== null &&
        typeof (x as RecentEntry).path === "string" &&
        typeof (x as RecentEntry).title === "string" &&
        typeof (x as RecentEntry).at === "number"
    );
  } catch {
    return [];
  }
};

const writeRecent = (path: string, title: string) => {
  try {
    const list = readRecent().filter((x) => x.path !== path);
    const next = [{ path, title, at: Date.now() }, ...list].slice(0, 12);
    sessionStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
};

const reportCards: Array<{
  title: string;
  description: string;
  path: string;
  icon: typeof BarChart3;
  disabled?: boolean;
}> = [
  {
    title: "Sales",
    description: "Revenue, orders, and trend lines for the selected period.",
    path: "/admin/reports/sales",
    icon: BarChart3
  },
  {
    title: "Products",
    description: "Top sellers, revenue concentration, and performance signals.",
    path: "/admin/reports/products",
    icon: Package
  },
  {
    title: "Inventory",
    description: "Stock health, low-SKU risk, and warehouse coverage.",
    path: "/admin/reports/inventory",
    icon: Boxes
  },
  {
    title: "Customers",
    description: "Spend, engagement, and top accounts in range.",
    path: "/admin/reports/customers",
    icon: Users
  },
  {
    title: "Support",
    description: "Ticket volume, SLA risk, and category mix.",
    path: "/admin/reports/support",
    icon: Headphones
  },
  {
    title: "Refunds & returns",
    description: "Refund totals, return pipeline, and review moderation snapshot.",
    path: "/admin/reports/refunds-returns",
    icon: RotateCcw
  },
  {
    title: "Marketing",
    description: "Coupons, promotions, campaigns, and redemptions.",
    path: "/admin/reports/marketing",
    icon: Megaphone
  },
  {
    title: "Custom",
    description: "Saved and scheduled reports (coming soon).",
    path: "#",
    icon: LineChart,
    disabled: true
  }
];

export const ReportsOverviewPage = () => {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const rangeQs = useMemo(() => {
    const p = new URLSearchParams();
    if (from.trim()) p.set("from", from.trim());
    if (to.trim()) p.set("to", to.trim());
    const s = p.toString();
    return s ? `?${s}` : "";
  }, [from, to]);

  const recent = readRecent().slice(0, 3);

  return (
    <StitchPageBody>
      <PageHeader
        title="Reports"
        titleSize="screen"
        description="Operational and commercial reporting hub. Pick a category, then refine with the date range."
      />

      <StitchFilterPanel className="flex flex-wrap items-end gap-4">
        <p className="mb-1 w-full text-xs font-medium text-[var(--color-text-muted)]">
          Date range applies when you open a report (passed via link).
        </p>
        <label className="flex min-w-[160px] flex-1 flex-col gap-1">
          <StitchFieldLabel>From</StitchFieldLabel>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={stitchInputClass} />
        </label>
        <label className="flex min-w-[160px] flex-1 flex-col gap-1">
          <StitchFieldLabel>To</StitchFieldLabel>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={stitchInputClass} />
        </label>
        {from.trim() || to.trim() ? (
          <button
            type="button"
            onClick={() => {
              setFrom("");
              setTo("");
            }}
            className="mb-0.5 text-xs font-semibold uppercase tracking-wider text-[#1653cc] hover:underline"
          >
            Clear filters
          </button>
        ) : null}
      </StitchFilterPanel>

      <section aria-label="Report categories">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {reportCards.map((card) => {
            const Icon = card.icon;
            const href = card.disabled ? undefined : `${card.path}${rangeQs}`;
            const inner = (
              <article
                className={`flex h-full flex-col rounded-xl border border-[var(--color-border-light)] bg-white p-5 shadow-card transition-transform ${
                  card.disabled ? "opacity-55" : "hover:-translate-y-px"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="rounded-lg bg-[rgba(79,126,248,0.12)] p-2 text-[var(--color-primary)]">
                    <Icon className="h-6 w-6" aria-hidden />
                  </div>
                  {card.disabled ? (
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Soon
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-4 font-headline text-base font-bold text-[#0f1117]">{card.title}</h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--color-text-body)]">{card.description}</p>
                <div className="mt-4 flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-[#1653cc]">
                  {card.disabled ? (
                    <span className="text-slate-400">Unavailable</span>
                  ) : (
                    <>
                      Open report
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    </>
                  )}
                </div>
              </article>
            );

            if (card.disabled || !href) {
              return (
                <div key={card.title} className="block cursor-not-allowed">
                  {inner}
                </div>
              );
            }

            return (
              <Link
                key={card.path}
                to={href}
                onClick={() => writeRecent(card.path, `${card.title} report`)}
                className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] focus-visible:ring-offset-2"
              >
                {inner}
              </Link>
            );
          })}
        </div>
      </section>

      <section aria-label="Recently viewed reports" className="rounded-xl border border-[var(--color-border-light)] bg-white shadow-card">
        <header className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-headline text-base font-bold text-[#0f1117]">Recently viewed</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">Last reports opened on this browser.</p>
        </header>
        <div className="px-5 py-4">
          {recent.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">No recent reports yet. Open a category above.</p>
          ) : (
            <ul className="space-y-2">
              {recent.map((r) => (
                <li key={`${r.path}-${r.at}`}>
                  <Link
                    to={`${r.path}${rangeQs}`}
                    className="flex items-center justify-between rounded-lg border border-transparent px-3 py-2 text-sm font-medium text-[#1653cc] hover:border-slate-100 hover:bg-[#f8f9fb]"
                  >
                    <span>{r.title}</span>
                    <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </StitchPageBody>
  );
};
