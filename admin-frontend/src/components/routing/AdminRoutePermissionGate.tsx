import type { PropsWithChildren } from "react";
import { Link, useLocation } from "react-router-dom";
import { Lock } from "lucide-react";

import { useAdminAuthStore } from "@/features/auth/auth.store";
import { findAdminScreenByPathname } from "@/lib/admin-paths/matchAdminScreen";
import { adminMayAccessScreen } from "@/lib/admin-rbac/screenAccess";

/**
 * Soft route gate: blocks the outlet when the signed-in admin lacks any of the
 * current screen's `permissionHints`. Backend remains authoritative (403 on API).
 */
export const AdminRoutePermissionGate = ({ children }: PropsWithChildren) => {
  const location = useLocation();
  const actor = useAdminAuthStore((s) => s.actor);

  const screen = findAdminScreenByPathname(location.pathname);
  if (!screen) {
    return <>{children}</>;
  }

  const hints = screen.permissionHints;
  if (adminMayAccessScreen(actor?.permissions, hints, actor?.roles)) {
    return <>{children}</>;
  }

  const codes = hints.join(", ");

  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <div className="rounded-xl border border-[#e5e7eb] bg-white p-8 shadow-sm">
        <div className="flex gap-4">
          <Lock className="h-10 w-10 shrink-0 text-[#737685]" strokeWidth={1.5} aria-hidden />
          <div className="min-w-0">
            <h1 className="font-headline text-xl font-bold text-[#181b25]">Access restricted</h1>
            <p className="mt-2 text-sm leading-relaxed text-[#60626c]">
              Your account does not include permission to open <span className="font-semibold">{screen.title}</span>. Ask an
              administrator to grant one of:{" "}
              <span className="break-all font-mono text-xs text-[#434654]">{codes}</span>
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/admin/dashboard"
                className="inline-flex rounded-lg bg-[#1653cc] px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
              >
                Go to overview
              </Link>
              <Link to="/admin/forbidden" className="inline-flex rounded-lg border border-[#e5e7eb] px-4 py-2 text-sm font-semibold text-[#434654] hover:bg-[#f8f9fb]">
                Access help
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
