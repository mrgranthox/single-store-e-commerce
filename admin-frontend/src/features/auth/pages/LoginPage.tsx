import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Lock, LogIn, Mail, AlertCircle } from "lucide-react";

import { adminLoginPayloadToActor, loginAdmin } from "@/features/auth/auth.api";
import { useAdminAuthStore } from "@/features/auth/auth.store";
import { resolveFrontendEnvironmentLabel, frontendEnv } from "@/lib/config/env";
import { applyZodIssuesToRhf } from "@/lib/forms/apply-zod-issues";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your work email.")
    .email("Enter a valid email address."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(128, "Password must be 128 characters or fewer.")
});

type LoginFormValues = z.infer<typeof loginSchema>;

const envLabel = resolveFrontendEnvironmentLabel();

export const LoginPage = () => {
  const navigate = useNavigate();
  const setSession = useAdminAuthStore((state) => state.setSession);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);

  const form = useForm<LoginFormValues>({
    defaultValues: {
      email: "",
      password: ""
    },
    mode: "onSubmit"
  });

  const submitLogin = async (values: LoginFormValues) => {
    setIsAuthenticating(true);
    setServerError(null);
    try {
      const response = await loginAdmin(values);
      const payload = response.data;
      setSession({
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
        actor: adminLoginPayloadToActor(payload),
        remember: rememberDevice
      });
      navigate("/admin/dashboard", { replace: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "We couldn’t sign you in. Please try again.";
      setServerError(message);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const onFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError(null);
    form.clearErrors();

    const parsed = loginSchema.safeParse({
      email: form.getValues("email"),
      password: form.getValues("password")
    });

    if (!parsed.success) {
      applyZodIssuesToRhf(parsed.error.issues, form.setError);
      return;
    }

    void submitLogin(parsed.data);
  };

  const emailInvalid = Boolean(form.formState.errors.email);
  const passwordInvalid = Boolean(form.formState.errors.password) || Boolean(serverError);

  return (
    <div className="relative w-full">
      <div className="absolute right-8 top-8 z-10 flex items-center gap-2 rounded-full border border-[#c3c6d6] bg-white px-3 py-1 shadow-sm">
        <span
          className={`h-1.5 w-1.5 rounded-full ${frontendEnv.isDev ? "bg-amber-500" : "bg-[#006b2d]"}`}
        />
        <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#434654]">
          {envLabel}
        </span>
      </div>

      <div className="mx-auto w-full max-w-[420px] pt-14 lg:pt-0">
      <div className="mb-10 text-center lg:text-left">
        <h3 className="mb-2 font-headline text-3xl font-bold text-[#0f1117]">Sign In</h3>
        <p className="font-medium text-[#434654]">Access your Command Deck</p>
      </div>

      <form className="space-y-6" onSubmit={onFormSubmit} noValidate>
        <div className="space-y-2">
          <label
            className="ml-1 text-[0.6875rem] font-bold uppercase tracking-wider text-slate-500"
            htmlFor="admin-login-email"
          >
            Email Address
          </label>
          <div className="relative">
            <input
              id="admin-login-email"
              autoComplete="email"
              aria-invalid={emailInvalid}
              className={`h-11 w-full rounded-xl border bg-white px-4 pr-11 text-sm outline-none transition focus:ring-2 focus:ring-[var(--color-primary)] ${
                emailInvalid
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/30"
                  : "border-[#e5e7eb] focus:border-[var(--color-primary)]"
              }`}
              placeholder="name@company.com"
              disabled={isAuthenticating}
              {...form.register("email")}
            />
            <Mail
              className="pointer-events-none absolute right-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400"
              strokeWidth={2}
              aria-hidden
            />
          </div>
          {form.formState.errors.email ? (
            <p className="text-xs font-medium text-red-600" role="alert">
              {form.formState.errors.email.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="ml-1 flex items-end justify-between gap-2">
            <label
              className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-500"
              htmlFor="admin-login-password"
            >
              Security key
            </label>
            <Link
              to="/admin/forgot-password"
              className="text-[11px] font-semibold text-[var(--color-primary)] hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="admin-login-password"
              type="password"
              autoComplete="current-password"
              aria-invalid={passwordInvalid}
              className={`h-11 w-full rounded-xl border bg-white px-4 pr-11 text-sm outline-none transition focus:ring-2 focus:ring-[var(--color-primary)] ${
                passwordInvalid
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/30"
                  : "border-[#e5e7eb] focus:border-[var(--color-primary)]"
              }`}
              placeholder="••••••••"
              disabled={isAuthenticating}
              {...form.register("password")}
            />
            <Lock
              className="pointer-events-none absolute right-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400"
              strokeWidth={2}
              aria-hidden
            />
          </div>
          {serverError ? (
            <div className="mt-2 flex items-center gap-2 px-1" role="alert">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" strokeWidth={2} aria-hidden />
              <span className="text-xs font-medium text-red-600">{serverError}</span>
            </div>
          ) : form.formState.errors.password ? (
            <p className="text-xs font-medium text-red-600" role="alert">
              {form.formState.errors.password.message}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-3 py-2">
          <input
            id="admin-login-remember"
            type="checkbox"
            checked={rememberDevice}
            onChange={(event) => setRememberDevice(event.target.checked)}
            className="h-5 w-5 cursor-pointer rounded border-[#e5e7eb] text-[var(--color-primary)] focus:ring-[var(--color-primary)] focus:ring-offset-2"
            disabled={isAuthenticating}
          />
          <label htmlFor="admin-login-remember" className="cursor-pointer select-none text-sm font-medium text-slate-600">
            Remember this device
          </label>
        </div>

        <button
          type="submit"
          disabled={isAuthenticating}
          className="auth-primary-gradient flex h-12 w-full items-center justify-center gap-2 rounded-xl font-headline text-sm font-bold text-white shadow-lg shadow-[#1653cc]/20 transition hover:opacity-[0.98] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
        >
          <span>{isAuthenticating ? "Authenticating…" : "Authenticate Session"}</span>
          <LogIn className="h-5 w-5" strokeWidth={2} aria-hidden />
        </button>
      </form>

      <div className="mt-12 border-t border-[#c3c6d6]/30 pt-8 text-center">
        <p className="text-xs font-medium text-slate-400">
          Secure Enterprise Portal © 2024 Command Deck Systems.
          <br />
          All access attempts are logged and monitored.
        </p>
      </div>
      </div>
    </div>
  );
};
