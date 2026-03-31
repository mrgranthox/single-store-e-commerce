import { NavLink, useLocation } from "react-router-dom";
import clsx from "clsx";

const tabClass = (active: boolean) =>
  clsx(
    "rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors",
    active
      ? "bg-white text-[#1653cc] shadow-sm ring-1 ring-[#e5e7eb]"
      : "text-[#6b7280] hover:bg-white/80 hover:text-[#111827]"
  );

/** Secondary nav across coupons, analytics, promotions, rules, and campaigns. */
export const MarketingWorkspaceNav = ({ className }: { className?: string }) => {
  const { pathname } = useLocation();
  const rulesDetailActive = /\/admin\/marketing\/promotions\/[^/]+\/rules/.test(pathname);

  return (
    <nav
      className={clsx(
        "flex flex-wrap gap-1 rounded-xl border border-[#e5e7eb] bg-[#f8f9fb] p-1 shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
        className
      )}
      aria-label="Marketing workspace"
    >
      <NavLink to="/admin/marketing/coupons" end className={({ isActive }) => tabClass(isActive)}>
        Coupons
      </NavLink>
      <NavLink to="/admin/marketing/coupons/analytics" end className={({ isActive }) => tabClass(isActive)}>
        Redemption analytics
      </NavLink>
      <NavLink to="/admin/marketing/promotions" end className={({ isActive }) => tabClass(isActive)}>
        Promotions
      </NavLink>
      <NavLink
        to="/admin/marketing/promotion-rules"
        className={({ isActive }) => tabClass(isActive || rulesDetailActive)}
      >
        Promotion rules
      </NavLink>
      <NavLink
        to="/admin/marketing/campaigns/performance"
        end
        className={({ isActive }) => tabClass(isActive)}
      >
        Campaign performance
      </NavLink>
    </nav>
  );
};
