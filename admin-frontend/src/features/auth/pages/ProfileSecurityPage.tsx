import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import {
  fetchAdminSessions,
  fetchCurrentAdmin,
  revokeAdminSession,
  revokeAllAdminSessions
} from "@/features/auth/auth.api";
import { requestAdminStepUpToken } from "@/features/auth/step-up";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

const formatLastActive = (iso: string | null | undefined, isCurrent: boolean) => {
  if (isCurrent) {
    return "ONLINE";
  }
  if (!iso) {
    return "—";
  }
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const deviceSummary = (userAgent: string | null) => {
  if (!userAgent || !userAgent.trim()) {
    return { title: "Web session", detail: "Unknown browser" };
  }
  const ua = userAgent.toLowerCase();
  let title = "Web session";
  if (ua.includes("iphone")) title = "iPhone";
  else if (ua.includes("android")) title = "Android device";
  else if (ua.includes("ipad")) title = "iPad";
  else if (ua.includes("mac os")) title = "Mac";
  else if (ua.includes("windows")) title = "Windows PC";
  let browser = "Browser";
  if (ua.includes("edg/")) browser = "Edge";
  else if (ua.includes("chrome")) browser = "Chrome";
  else if (ua.includes("safari") && !ua.includes("chrome")) browser = "Safari";
  else if (ua.includes("firefox")) browser = "Firefox";
  return { title, detail: browser };
};

export const ProfileSecurityPage = () => {
  const accessToken = useAdminAuthStore((state) => state.accessToken);
  const queryClient = useQueryClient();

  const meQuery = useQuery({
    queryKey: ["admin-me", accessToken],
    queryFn: () => fetchCurrentAdmin(accessToken!),
    enabled: Boolean(accessToken)
  });

  const sessionsQuery = useQuery({
    queryKey: ["admin-sessions", accessToken],
    queryFn: () => fetchAdminSessions(accessToken!),
    enabled: Boolean(accessToken)
  });

  const revokeOne = useMutation({
    mutationFn: async (sessionId: string) => {
      const stepUpToken = await requestAdminStepUpToken({
        accessToken: accessToken!,
        email: admin?.email ?? null
      });
      return revokeAdminSession(accessToken!, sessionId, stepUpToken);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-sessions"] });
    }
  });

  const revokeAll = useMutation({
    mutationFn: async () => {
      const stepUpToken = await requestAdminStepUpToken({
        accessToken: accessToken!,
        email: admin?.email ?? null
      });
      return revokeAllAdminSessions(accessToken!, stepUpToken);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-sessions"] });
    }
  });

  const admin = meQuery.data?.data.admin;
  const roles = meQuery.data?.data.roles ?? [];
  const roleLabel = roles.map((r) => r.name).join(", ") || "—";
  const email = admin?.email ?? "—";
  const fullName = email.includes("@") ? email.split("@")[0]?.replace(/\./g, " ") ?? "—" : email;

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="mb-8">
        <h1 className="font-headline text-2xl font-bold text-[#0f1117]">Profile &amp; Security</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your administrative credentials and monitor account access.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 space-y-8 lg:col-span-8">
          <section className="rounded-xl border border-[#e5e7eb] bg-white p-8 shadow-sm">
            <h2 className="mb-6 flex items-center gap-2 text-base font-semibold font-headline text-[#181b25]">
              <MaterialIcon name="person" className="text-[var(--color-primary)]" />
              Profile Details
            </h2>
            <div className="flex flex-col gap-10 md:flex-row">
              <div className="flex flex-col items-center space-y-4">
                <div className="relative">
                  <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-4 border-slate-50 bg-slate-100">
                    <span className="font-headline text-2xl font-semibold text-slate-400">
                      {email !== "—" ? email.slice(0, 2).toUpperCase() : "?"}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled
                    className="absolute bottom-0 right-0 rounded-full bg-[var(--color-primary)] p-2 text-white shadow-lg opacity-50"
                    aria-label="Change photo (unavailable)"
                  >
                    <MaterialIcon name="photo_camera" className="text-sm text-white" />
                  </button>
                </div>
                <div className="text-center">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-[0.7rem] font-bold uppercase tracking-wider text-slate-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-primary)]" />
                    {roles[0]?.name ?? "Administrator"}
                  </span>
                </div>
              </div>
              <div className="flex-1 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-500">
                      Full Name
                    </label>
                    <input
                      className="h-11 rounded-lg border border-[#e5e7eb] bg-white px-4 text-sm text-[#181b25] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                      type="text"
                      readOnly
                      value={fullName}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-500">
                      Role (Read-Only)
                    </label>
                    <input
                      className="h-11 cursor-not-allowed rounded-lg border border-[#e5e7eb] bg-slate-50 px-4 text-sm text-slate-400"
                      readOnly
                      type="text"
                      value={roleLabel}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-500">
                    Email Address
                  </label>
                  <input
                    className="h-11 rounded-lg border border-[#e5e7eb] bg-white px-4 text-sm text-[#181b25] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                    type="email"
                    readOnly
                    value={email}
                  />
                </div>
                <div className="flex justify-end pt-4">
                  <button
                    type="button"
                    disabled
                    title="Profile updates are managed by your administrator."
                    className="flex items-center gap-2 rounded-lg bg-gradient-to-br from-[#4f7ef8] to-[#3b6de6] px-6 py-3 text-sm font-semibold text-white opacity-50"
                  >
                    <MaterialIcon name="save" className="text-lg text-white" />
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-[#e5e7eb] bg-white p-8 shadow-sm">
            <h2 className="mb-6 flex items-center gap-2 text-base font-semibold font-headline text-[#181b25]">
              <MaterialIcon name="lock" className="text-[var(--color-primary)]" />
              Security Credentials
            </h2>
            <div className="max-w-xl space-y-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-500">
                  Current Password
                </label>
                <input
                  className="h-11 cursor-not-allowed rounded-lg border border-[#e5e7eb] bg-slate-50 px-4 text-sm text-slate-400"
                  disabled
                  placeholder="••••••••••••"
                  type="password"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-500">
                    New Password
                  </label>
                  <input
                    className="h-11 cursor-not-allowed rounded-lg border border-[#e5e7eb] bg-slate-50 px-4 text-sm text-slate-400"
                    disabled
                    type="password"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-500">
                    Confirm New Password
                  </label>
                  <input
                    className="h-11 cursor-not-allowed rounded-lg border border-[#e5e7eb] bg-slate-50 px-4 text-sm text-slate-400"
                    disabled
                    type="password"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  type="button"
                  disabled
                  className="rounded-lg bg-gradient-to-br from-[#4f7ef8] to-[#3b6de6] px-6 py-3 text-sm font-semibold text-white opacity-50"
                  title="Password changes use the forgot-password flow or your identity provider."
                >
                  Update Password
                </button>
                <p className="text-xs italic text-slate-400">
                  Password must be at least 12 characters with symbols.
                </p>
              </div>
            </div>
          </section>
        </div>

        <div className="col-span-12 space-y-8 lg:col-span-4">
          <section className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-sm">
            <div className="border-b border-slate-50 p-6">
              <h2 className="flex items-center gap-2 text-base font-semibold font-headline text-[#181b25]">
                <MaterialIcon name="devices" className="text-[var(--color-primary)]" />
                Active Sessions
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-6 py-3 text-[0.625rem] font-bold uppercase tracking-widest text-slate-500">
                      Device / Browser
                    </th>
                    <th className="px-6 py-3 text-right text-[0.625rem] font-bold uppercase tracking-widest text-slate-500">
                      Last Active
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sessionsQuery.isLoading ? (
                    <tr>
                      <td colSpan={2} className="px-6 py-8 text-center text-sm text-slate-500">
                        Loading sessions…
                      </td>
                    </tr>
                  ) : null}
                  {!sessionsQuery.isLoading && !sessionsQuery.data?.data.items.length ? (
                    <tr>
                      <td colSpan={2} className="px-6 py-8 text-center text-sm text-slate-500">
                        No session records are available yet.
                      </td>
                    </tr>
                  ) : null}
                  {sessionsQuery.data?.data.items.map((sessionItem) => {
                    const dev = deviceSummary(sessionItem.userAgent);
                    const last = formatLastActive(sessionItem.lastSeenAt ?? sessionItem.issuedAt, sessionItem.current);
                    return (
                      <tr key={sessionItem.id} className="group hover:bg-slate-50/50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <MaterialIcon name="laptop_mac" className="text-slate-400" />
                            <div>
                              <p className="text-sm font-semibold text-slate-800">{dev.title}</p>
                              <p className="text-xs text-slate-500">
                                {dev.detail}
                                {sessionItem.ipAddress ? ` · ${sessionItem.ipAddress}` : ""}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p
                            className={`font-mono text-[0.7rem] font-medium ${
                              sessionItem.current ? "text-[var(--color-primary)]" : "text-slate-500"
                            }`}
                          >
                            {last}
                          </p>
                          {!sessionItem.current ? (
                            <button
                              type="button"
                              className="text-[0.65rem] font-bold uppercase tracking-tighter text-red-600 opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-40"
                              disabled={revokeOne.isPending}
                              onClick={() => revokeOne.mutate(sessionItem.id)}
                            >
                              Revoke
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="bg-slate-50/30 p-6">
              <button
                type="button"
                className="w-full rounded-lg border border-red-600/20 py-2.5 text-sm font-bold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                disabled={
                  revokeAll.isPending || !(sessionsQuery.data?.data.items ?? []).some((s) => !s.current)
                }
                onClick={() => revokeAll.mutate()}
              >
                Revoke all other sessions
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-[#e5e7eb] bg-white p-6 shadow-sm">
            <h2 className="mb-6 flex items-center gap-2 text-base font-semibold font-headline text-[#181b25]">
              <MaterialIcon name="history" className="text-[var(--color-primary)]" />
              Security Events
            </h2>
            <div className="relative space-y-6 before:absolute before:bottom-2 before:left-[11px] before:top-2 before:w-0.5 before:bg-slate-100">
              <p className="pl-8 text-sm text-slate-500">
                Recent sign-in activity for your account appears here when the security service records events. Use the
                audit log for the full history.
              </p>
            </div>
            <Link
              to="/admin/security/audit-logs"
              className="mt-8 block w-full text-center text-xs font-bold uppercase tracking-widest text-slate-400 transition-colors hover:text-[var(--color-primary)]"
            >
              View full audit log
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
};
