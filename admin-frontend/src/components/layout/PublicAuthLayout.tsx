import { Outlet, useLocation } from "react-router-dom";
import { HelpCircle } from "lucide-react";

import { AuthSplitShell, type AuthSplitVariant } from "@/components/layout/AuthSplitShell";

const variantFromPath = (pathname: string): AuthSplitVariant => {
  if (pathname.includes("/admin/forgot-password")) {
    return "forgot";
  }
  if (pathname.includes("/admin/reset-password")) {
    return "reset";
  }
  return "login";
};

export const PublicAuthLayout = () => {
  const location = useLocation();
  const variant = variantFromPath(location.pathname);
  const isForbiddenRoute = location.pathname.includes("/admin/forbidden");

  if (isForbiddenRoute) {
    return <Outlet />;
  }

  return (
    <>
      <AuthSplitShell variant={variant} className={variant === "forgot" ? "shadow-2xl" : undefined}>
        <Outlet />
      </AuthSplitShell>
      <a
        href="mailto:support@commanddeck.systems?subject=Admin%20Support%20Request"
        className="fixed bottom-6 right-6 flex h-12 w-12 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-500 shadow-xl transition-colors hover:text-[var(--color-primary)]"
        aria-label="Help and support"
        title="Email support"
      >
        <HelpCircle className="h-5 w-5" strokeWidth={2} />
      </a>
    </>
  );
};
