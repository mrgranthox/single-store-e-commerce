import { Link, useLocation } from "react-router-dom";
import { Link2 } from "lucide-react";
import clsx from "clsx";

const HUB_ITEMS: { to: string; label: string; match: (path: string) => boolean }[] = [
  { to: "/admin/security/alerts", label: "Alerts", match: (p) => p.includes("/admin/security/alerts") },
  {
    to: "/admin/security/audit-logs",
    label: "Audit logs",
    match: (p) => p.includes("/admin/security/audit-logs")
  },
  {
    to: "/admin/security/admin-actions",
    label: "Admin actions",
    match: (p) => p.includes("/admin/security/admin-actions")
  },
  {
    to: "/admin/security/user-activity",
    label: "User activity",
    match: (p) => p.includes("/admin/security/user-activity")
  },
  {
    to: "/admin/security/events",
    label: "Security events",
    match: (p) => p.includes("/admin/security/events")
  },
  {
    to: "/admin/security/incidents",
    label: "Incidents",
    match: (p) => p.includes("/admin/security/incidents")
  },
  {
    to: "/admin/security/risk-signals",
    label: "Risk & fraud",
    match: (p) => p.includes("/admin/security/risk-signals")
  }
];

const baseTab =
  "inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors sm:px-3.5";
const idleTab = "border-transparent bg-[#f2f3ff]/80 text-[#1653cc] hover:border-[#1653cc]/25 hover:bg-white";
const activeTab = "border-[#1653cc] bg-white text-[#0f3d99] shadow-sm ring-1 ring-[#1653cc]/15";

/**
 * Stitch-style horizontal hub: all security explorers visible and tappable (scrolls on narrow viewports).
 */
export const SecurityHubNav = () => {
  const { pathname } = useLocation();

  return (
    <div className="w-full min-w-0">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#737685]">Security workspace</p>
      <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-thin sm:flex-wrap sm:overflow-visible">
        {HUB_ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={clsx(baseTab, active ? activeTab : idleTab)}
            >
              <Link2 className="h-3.5 w-3.5 shrink-0 text-[#1653cc]" strokeWidth={2.25} aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
};
