import { NavLink } from "react-router-dom";
import clsx from "clsx";

const tabs = [
  { to: "/admin/content/banners", label: "Banners", end: true },
  { to: "/admin/content/pages", label: "CMS pages", end: true }
] as const;

/** Secondary nav between storefront content surfaces (sidebar complement). */
export const ContentWorkspaceNav = ({ className }: { className?: string }) => (
  <nav
    className={clsx(
      "flex flex-wrap gap-1 rounded-xl border border-[#e5e7eb] bg-[#f8f9fb] p-1 shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
      className
    )}
    aria-label="Content workspace"
  >
    {tabs.map((tab) => (
      <NavLink
        key={tab.to}
        to={tab.to}
        end={tab.end}
        className={({ isActive }) =>
          clsx(
            "rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors",
            isActive
              ? "bg-white text-[#1653cc] shadow-sm ring-1 ring-[#e5e7eb]"
              : "text-[#6b7280] hover:bg-white/80 hover:text-[#111827]"
          )
        }
      >
        {tab.label}
      </NavLink>
    ))}
  </nav>
);
