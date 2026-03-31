import { NavLink } from "react-router-dom";
import clsx from "clsx";

const baseLinks: Array<{ to: string; label: string; end?: boolean }> = [
  { to: "/admin/inventory/overview", label: "Overview", end: true },
  { to: "/admin/inventory/low-stock", label: "Low stock" },
  { to: "/admin/inventory/out-of-stock", label: "Out of stock" },
  { to: "/admin/inventory/warehouses", label: "Warehouses", end: true },
  { to: "/admin/inventory/movements", label: "Movements" },
  { to: "/admin/inventory/adjustments", label: "Adjustments" }
];

const linkClass = (isActive: boolean) =>
  clsx(
    "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
    isActive ? "bg-[#1653cc] text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
  );

type InventorySubNavProps = {
  warehouseId?: string;
  className?: string;
};

export const InventorySubNav = ({ warehouseId, className = "" }: InventorySubNavProps) => (
  <div
    className={clsx(
      "mb-4 rounded-lg border border-[#e5e7eb] bg-white px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.06)]",
      className
    )}
  >
    <nav className="flex flex-wrap items-center gap-2" aria-label="Inventory section">
      {baseLinks.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => linkClass(isActive)}>
          {item.label}
        </NavLink>
      ))}
      {warehouseId ? (
        <>
          <span className="text-slate-300" aria-hidden>
            |
          </span>
          <NavLink
            to={`/admin/inventory/warehouses/${warehouseId}`}
            className={({ isActive }) => linkClass(isActive)}
          >
            Warehouse detail
          </NavLink>
          <NavLink
            to={`/admin/inventory/warehouses/${warehouseId}/inventory`}
            className={({ isActive }) => linkClass(isActive)}
          >
            Warehouse inventory
          </NavLink>
        </>
      ) : null}
    </nav>
  </div>
);
