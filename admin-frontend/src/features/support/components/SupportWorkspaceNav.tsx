import { NavLink } from "react-router-dom";

const tabs: { to: string; label: string; end?: boolean }[] = [
  { to: "/admin/support/tickets", label: "Tickets" },
  { to: "/admin/support/queue", label: "SLA queue", end: true },
  { to: "/admin/support/pre-purchase", label: "Pre-purchase", end: true },
  { to: "/admin/support/complaints", label: "Complaints", end: true },
  { to: "/admin/support/analytics", label: "Analytics", end: true }
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
    isActive ? "bg-[#1653cc] text-white shadow-sm" : "bg-[#f2f3ff] text-[#434654] hover:bg-[#e0e4ff]"
  }`;

export const SupportWorkspaceNav = () => (
  <nav
    className="flex flex-wrap gap-2 rounded-xl border border-[#e0e2f0]/80 bg-white p-3 shadow-sm"
    aria-label="Support workspace"
  >
    {tabs.map(({ to, label, end }) => (
      <NavLink key={to} to={to} className={linkClass} end={Boolean(end)}>
        {label}
      </NavLink>
    ))}
  </nav>
);
