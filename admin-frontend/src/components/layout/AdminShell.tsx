import type { PropsWithChildren } from "react";
import { useEffect, useState } from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { Bell, ChevronLeft, ChevronRight, HelpCircle, LogOut, Menu, Search, Settings, User, X } from "lucide-react";
import clsx from "clsx";

import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { logoutAdmin } from "@/features/auth/auth.api";
import {
  adminScreenLookup,
  adminSidebarGroups,
  type AdminScreenGroup
} from "@/lib/contracts/admin-screen-catalog";
import { findAdminScreenByPathname } from "@/lib/admin-paths/matchAdminScreen";
import { adminMayAccessScreen } from "@/lib/admin-rbac/screenAccess";
import { useAdminAuthStore } from "@/features/auth/auth.store";

const SIDEBAR_COLLAPSED_KEY = "admin-sidebar-collapsed";

const groupMaterialIcon: Record<AdminScreenGroup, string> = {
  dashboard: "dashboard",
  catalog: "inventory_2",
  inventory: "warehouse",
  orders: "shopping_cart",
  payments: "payments",
  customers: "group",
  support: "support_agent",
  content: "article",
  marketing: "campaign",
  reports: "bar_chart",
  security: "shield_person",
  system: "settings",
  "access-shell": "lock"
};

/** Distinct sidebar glyphs for payments workspace screens (same group, different destinations). */
const paymentsGroupScreenIcon: Record<string, string> = {
  "payments-list": "payments",
  "refunds-queue": "currency_exchange",
  "payments-failed-investigations": "credit_card_off",
  "finance-exceptions": "account_balance"
};

const supportGroupScreenIcon: Record<string, string> = {
  "support-tickets": "confirmation_number",
  "support-sla-queue": "priority_high",
  "support-pre-purchase": "shopping_bag",
  "support-complaints": "feedback",
  "support-analytics": "analytics"
};

const contentGroupScreenIcon: Record<string, string> = {
  "content-banners": "view_carousel",
  "content-pages": "description"
};

const marketingGroupScreenIcon: Record<string, string> = {
  "marketing-coupons": "confirmation_number",
  "marketing-coupon-analytics": "analytics",
  "marketing-promotions": "sell",
  "marketing-promotion-rules-hub": "account_tree",
  "marketing-promotion-rules": "rule_settings",
  "marketing-campaign-performance": "trending_up"
};

const navMaterialIcon = (screenId: string, group: AdminScreenGroup) =>
  group === "payments" && paymentsGroupScreenIcon[screenId]
    ? paymentsGroupScreenIcon[screenId]!
    : group === "support" && supportGroupScreenIcon[screenId]
      ? supportGroupScreenIcon[screenId]!
      : group === "content" && contentGroupScreenIcon[screenId]
        ? contentGroupScreenIcon[screenId]!
        : group === "marketing" && marketingGroupScreenIcon[screenId]
          ? marketingGroupScreenIcon[screenId]!
          : groupMaterialIcon[group];

const navLinkClass = (isActive: boolean, collapsed: boolean) =>
  clsx(
    "flex items-center border-l-4 transition-colors duration-200",
    collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider",
    isActive
      ? "border-[#1653cc] bg-[#1653cc]/15 text-white"
      : "border-transparent text-[#c5cee0] hover:bg-white/[0.06] hover:text-white"
  );

export const AdminShell = ({ children }: PropsWithChildren) => {
  const navigate = useNavigate();
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const clearSession = useAdminAuthStore((s) => s.clearSession);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed]);

  const location = useLocation();
  const actor = useAdminAuthStore((state) => state.actor);
  const currentScreen = findAdminScreenByPathname(location.pathname);
  const breadcrumbTrail = [currentScreen?.group?.replace(/-/g, " "), currentScreen?.title].filter(Boolean);

  const initials = (() => {
    const n = actor?.fullName ?? actor?.email ?? "A";
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  })();

  const mayOpenProfile = adminMayAccessScreen(
    actor?.permissions,
    adminScreenLookup["admin-profile-security"]!.permissionHints,
    actor?.roles
  );

  const handleLogout = async () => {
    if (accessToken) {
      try {
        await logoutAdmin(accessToken);
      } catch {
        /* still clear local session */
      }
    }
    clearSession();
    navigate("/admin/login", { replace: true });
  };

  const sidebarWidth = sidebarCollapsed ? "md:w-[72px]" : "md:w-64";
  const mainOffset = sidebarCollapsed ? "md:ml-[72px]" : "md:ml-64";

  return (
    <div className="min-h-screen stitch-canvas antialiased">
      {mobileNavOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          aria-label="Close menu"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      <aside
        aria-label="Admin navigation"
        className={clsx(
          "admin-shell-sidebar fixed left-0 top-0 z-50 flex h-screen flex-col bg-[#13161e] text-[#c5cee0] shadow-sidebar transition-[width,transform] duration-200 ease-out md:translate-x-0",
          sidebarWidth,
          "w-64 max-md:w-64",
          mobileNavOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div
          className={clsx(
            "flex shrink-0 items-center border-b border-white/[0.06]",
            sidebarCollapsed ? "flex-col gap-2 px-2 py-4" : "flex-row gap-3 px-5 py-4"
          )}
        >
          <div className="tonal-depth flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white">
            <MaterialIcon name="architecture" className="text-base text-white" />
          </div>
          {!sidebarCollapsed ? (
            <span className="min-w-0 flex-1 font-headline text-base font-bold tracking-tight text-white">
              Operational Architect
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            className="hidden rounded-lg p-1.5 text-[#c5cee0] transition-colors hover:bg-white/10 hover:text-white md:flex"
            aria-expanded={!sidebarCollapsed}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <ChevronRight className="h-5 w-5" strokeWidth={2} /> : <ChevronLeft className="h-5 w-5" strokeWidth={2} />}
          </button>
        </div>

        <nav className="sidebar-scroll min-h-0 flex-1 overflow-y-auto px-2 py-3">
          <div className="space-y-5">
            {adminSidebarGroups.map((group) => {
              const visibleScreens = group.screens.filter((screenItem) =>
                adminMayAccessScreen(actor?.permissions, screenItem.permissionHints, actor?.roles)
              );
              if (visibleScreens.length === 0) {
                return null;
              }
              return (
              <section key={group.id}>
                {!sidebarCollapsed ? (
                  <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#7d8aa3]">
                    {group.title}
                  </p>
                ) : null}
                <div className="space-y-0.5">
                  {visibleScreens.map((screenItem) => (
                    <NavLink
                      key={screenItem.id}
                      to={screenItem.path}
                      className={({ isActive }) => navLinkClass(isActive, sidebarCollapsed)}
                      end={
                        screenItem.path === "/admin/dashboard" ||
                        screenItem.path === "/admin/inventory/overview" ||
                        screenItem.path === "/admin/inventory/warehouses" ||
                        screenItem.path === "/admin/shipments" ||
                        screenItem.path === "/admin/payments" ||
                        screenItem.path === "/admin/refunds" ||
                        screenItem.path === "/admin/payments/failed-investigations" ||
                        screenItem.path === "/admin/finance/exceptions"
                      }
                      title={sidebarCollapsed ? (screenItem.navLabel ?? screenItem.title) : undefined}
                      onClick={() => setMobileNavOpen(false)}
                    >
                      <MaterialIcon
                        name={navMaterialIcon(screenItem.id, group.id)}
                        className={clsx("shrink-0 text-current opacity-90", sidebarCollapsed ? "text-[22px]" : "text-[20px]")}
                      />
                      {!sidebarCollapsed ? (
                        <span className="min-w-0 truncate">{screenItem.navLabel ?? screenItem.title}</span>
                      ) : null}
                    </NavLink>
                  ))}
                </div>
              </section>
              );
            })}
          </div>
        </nav>

        <div className="shrink-0 space-y-0.5 border-t border-white/[0.08] px-2 py-4">
          {adminMayAccessScreen(actor?.permissions, adminScreenLookup["system-settings"].permissionHints, actor?.roles) ? (
            <Link
              to="/admin/system/settings"
              className={clsx(
                "flex items-center rounded-md text-[11px] font-semibold uppercase tracking-wider text-[#c5cee0] transition-colors hover:bg-white/[0.06] hover:text-white",
                sidebarCollapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5"
              )}
              title={sidebarCollapsed ? "Settings" : undefined}
              onClick={() => setMobileNavOpen(false)}
            >
              <MaterialIcon name="settings" className="shrink-0 text-[20px] text-current opacity-90" />
              {!sidebarCollapsed ? <span>Settings</span> : null}
            </Link>
          ) : null}
          <a
            href="https://support.example.com"
            className={clsx(
              "flex items-center rounded-md text-[11px] font-semibold uppercase tracking-wider text-[#c5cee0] transition-colors hover:bg-white/[0.06] hover:text-white",
              sidebarCollapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5"
            )}
            title={sidebarCollapsed ? "Help" : undefined}
            target="_blank"
            rel="noreferrer"
          >
            <MaterialIcon name="help" className="shrink-0 text-[20px] text-current opacity-90" />
            {!sidebarCollapsed ? <span>Help</span> : null}
          </a>
          <div
            className={clsx(
              "mt-3 flex items-center border-t border-white/[0.08] pt-4",
              sidebarCollapsed ? "justify-center px-0" : "gap-3 px-3"
            )}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#3d4558] bg-[#1e2433] text-[10px] font-bold text-[#e2e8f4]">
              {initials}
            </div>
            {!sidebarCollapsed ? (
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="truncate text-xs font-bold text-white">
                  {actor?.fullName ?? actor?.email ?? "Admin User"}
                </p>
                <p className="truncate text-[10px] uppercase tracking-tighter text-[#7d8aa3]">
                  {(actor?.roles?.[0] ?? "Enterprise").replace(/_/g, " ")} admin
                </p>
              </div>
            ) : null}
          </div>
          <div
            className={clsx(
              "mt-2 flex w-full gap-1",
              sidebarCollapsed ? "flex-col items-center px-0" : "flex-row px-2"
            )}
          >
            {mayOpenProfile ? (
              <NavLink
                to="/admin/profile/security"
                className={({ isActive }) =>
                  clsx(
                    "flex items-center justify-center rounded-lg text-[#c5cee0] transition-colors hover:bg-white/10 hover:text-white",
                    sidebarCollapsed ? "p-2" : "flex-1 gap-2 px-2 py-2 text-[10px] font-semibold uppercase tracking-wider",
                    isActive && "bg-white/10 text-white"
                  )
                }
                title="Profile & security"
                onClick={() => setMobileNavOpen(false)}
              >
                <User className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                {!sidebarCollapsed ? <span>Profile</span> : null}
              </NavLink>
            ) : null}
            <button
              type="button"
              onClick={() => void handleLogout()}
              className={clsx(
                "flex items-center justify-center rounded-lg text-[#c5cee0] transition-colors hover:bg-red-500/15 hover:text-red-200",
                sidebarCollapsed ? "p-2" : "flex-1 gap-2 px-2 py-2 text-[10px] font-semibold uppercase tracking-wider"
              )}
              title="Sign out"
            >
              <LogOut className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
              {!sidebarCollapsed ? <span>Log out</span> : null}
            </button>
          </div>
        </div>
      </aside>

      <div className={clsx("min-h-screen transition-[margin] duration-200 ease-out", mainOffset)}>
        <header className="no-print sticky top-0 z-40 flex h-[60px] w-full items-center justify-between border-b border-slate-100 bg-white px-4 text-[#0f1117] shadow-[0_1px_4px_rgba(0,0,0,0.06)] md:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3 md:gap-4">
            <button
              type="button"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
              aria-expanded={mobileNavOpen}
              aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
              onClick={() => setMobileNavOpen((o) => !o)}
            >
              {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <button
              type="button"
              className="hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:flex"
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={() => setSidebarCollapsed((c) => !c)}
            >
              {sidebarCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
            </button>
            <span className="font-headline text-xl font-bold text-slate-900">Command Deck</span>
            <span className="hidden h-4 w-px bg-slate-200 sm:block" aria-hidden />
            <span className="hidden truncate text-xs text-slate-500 sm:block">
              {breadcrumbTrail.length > 0 ? breadcrumbTrail.join(" / ") : "Admin workspace"}
            </span>
          </div>

          <div className="flex items-center gap-4 md:gap-6">
            <div className="relative hidden md:block">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                strokeWidth={2}
                aria-hidden
              />
              <input
                type="search"
                placeholder="Global system search…"
                className="w-64 rounded-md border-0 bg-slate-50 py-1.5 pl-9 pr-4 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1653cc]/30"
                readOnly
                aria-label="Global search (placeholder)"
              />
            </div>
            <div className="flex items-center gap-1 text-slate-500">
              <button
                type="button"
                className="relative rounded-full p-2 transition-colors hover:bg-slate-100 hover:text-[#1653cc]"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" strokeWidth={2} />
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border-2 border-white bg-[#1653cc]" />
              </button>
              <button
                type="button"
                className="rounded-full p-2 transition-colors hover:bg-slate-100 hover:text-[#1653cc]"
                aria-label="Help"
              >
                <HelpCircle className="h-5 w-5" strokeWidth={2} />
              </button>
              <Link
                to="/admin/system/settings"
                className="rounded-full p-2 transition-colors hover:bg-slate-100 hover:text-[#1653cc]"
                aria-label="Settings"
              >
                <Settings className="h-5 w-5" strokeWidth={2} />
              </Link>
              {mayOpenProfile ? (
                <Link
                  to="/admin/profile/security"
                  className="rounded-full p-2 transition-colors hover:bg-slate-100 hover:text-[#1653cc]"
                  aria-label="Profile and security"
                >
                  <User className="h-5 w-5" strokeWidth={2} />
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="rounded-full p-2 transition-colors hover:bg-slate-100 hover:text-red-600"
                aria-label="Sign out"
              >
                <LogOut className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>
            <div className="flex items-center gap-3 border-l border-slate-200 pl-3 sm:pl-4">
              <div className="hidden text-right sm:block">
                <p className="text-xs font-bold leading-none text-slate-900">
                  {actor?.fullName ?? actor?.email ?? "Admin"}
                </p>
                <p className="max-w-[140px] truncate text-[10px] font-medium text-slate-500">
                  {(actor?.roles?.[0] ?? "Admin").replace(/_/g, " ")}
                </p>
              </div>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-white bg-slate-200 text-[10px] font-bold text-slate-700 shadow-sm">
                {initials}
              </div>
            </div>
          </div>
        </header>

        <main className="stitch-canvas stitch-admin-scope min-h-[calc(100vh-60px)] px-4 py-6 text-[#0f1117] md:px-8 md:py-8">
          <div className="mx-auto max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
  );
};
