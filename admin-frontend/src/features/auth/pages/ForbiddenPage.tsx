import { useNavigate, Link } from "react-router-dom";

import { logoutAdmin } from "@/features/auth/auth.api";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

export const ForbiddenPage = () => {
  const navigate = useNavigate();
  const accessToken = useAdminAuthStore((state) => state.accessToken);
  const clearSession = useAdminAuthStore((state) => state.clearSession);

  const handleSignOut = async () => {
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

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--color-bg-page)] antialiased">
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: "radial-gradient(#13161e 0.5px, transparent 0.5px)",
          backgroundSize: "24px 24px",
          opacity: 0.03
        }}
        aria-hidden
      />
      <main className="relative z-10 mx-auto flex w-full max-w-[1280px] flex-col items-center px-6">
        <div className="w-full max-w-xl rounded-xl border border-[#c3c6d6]/15 bg-white p-12 text-center shadow-[0px_24px_48px_rgba(24,27,37,0.04)]">
          <div className="mb-8 inline-flex h-24 w-24 items-center justify-center rounded-full bg-[#f2f3ff] text-[#3b6de6]">
            <MaterialIcon name="lock" className="!text-[64px]" />
          </div>
          <h1 className="mb-4 font-headline text-3xl font-bold tracking-tight text-[#181b25]">Access Restricted</h1>
          <p className="mx-auto mb-10 max-w-md text-lg leading-relaxed text-[#434654]">
            You don&apos;t have permission to view this page. Contact your administrator if you believe this is an error.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              to="/admin/dashboard"
              className="auth-primary-gradient flex items-center gap-2 rounded-xl px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-[#1653cc]/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <MaterialIcon name="dashboard" className="!text-[20px] !text-white" />
              Go to Dashboard
            </Link>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="flex items-center gap-2 rounded-xl px-8 py-3 text-sm font-medium text-[#434654] transition-colors duration-200 hover:bg-[#ecedfb]"
            >
              <MaterialIcon name="logout" className="!text-[20px]" />
              Sign out
            </button>
          </div>
          <details className="mt-12 border-t border-[#c3c6d6]/10 pt-8 text-left">
            <summary className="cursor-pointer text-center text-[0.6875rem] font-medium uppercase tracking-wider text-[#737685]">
              Advanced details
            </summary>
            <div className="mt-4 flex flex-col items-center gap-2">
              <span className="font-mono text-[0.6875rem] uppercase tracking-[0.05em] text-[#737685]">
                Reference Code
              </span>
              <code className="rounded-md bg-[#ecedfb] px-3 py-1 font-mono text-sm text-[#5b5e68]">
                ERR_403_AUTH_SCOPE_MISSING
              </code>
            </div>
          </details>
        </div>
        <div className="pointer-events-none absolute -left-32 -top-32 h-64 w-64 rounded-full bg-[#1653cc]/5 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-[#3b6de6]/5 blur-3xl" aria-hidden />
      </main>
      <footer className="fixed bottom-8 w-full px-6 text-center">
        <p className="text-xs text-[#737685]">
          Need immediate assistance?{" "}
          <a className="ml-1 font-medium text-[var(--color-primary)] hover:underline" href="mailto:support@example.com">
            Connect with Security Operations
          </a>
        </p>
      </footer>
    </div>
  );
};
