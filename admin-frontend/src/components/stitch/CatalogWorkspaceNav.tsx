import { NavLink } from "react-router-dom";
import clsx from "clsx";

const tabs = [
  { to: "/admin/catalog/categories", label: "Categories", end: true },
  { to: "/admin/catalog/brands", label: "Brands", end: true },
  { to: "/admin/catalog/reviews", label: "Reviews", end: true },
  { to: "/admin/catalog/products", label: "Overview", end: true },
  { to: "/admin/inventory/low-stock", label: "Low stock", end: true }
] as const;

/** Matches Stitch `brand_management` / `category_management` catalog rail (horizontal). */
export const CatalogWorkspaceNav = ({ className }: { className?: string }) => (
  <nav
    className={clsx(
      "flex flex-wrap gap-1 rounded-xl border border-[#e5e7eb] bg-[#f8f9fb] p-1 shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
      className
    )}
    aria-label="Catalog workspace"
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
