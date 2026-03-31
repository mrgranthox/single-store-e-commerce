import { useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Eye, EyeOff, AlertTriangle } from "lucide-react";

import { resetAdminPassword } from "@/features/auth/auth.api";
import { applyZodIssuesToRhf } from "@/lib/forms/apply-zod-issues";

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Use at least 8 characters.")
      .max(128, "Password must be 128 characters or fewer."),
    confirmPassword: z
      .string()
      .min(1, "Confirm your password.")
      .max(128, "Password must be 128 characters or fewer.")
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords must match.",
    path: ["confirmPassword"]
  });

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

const strengthMeta = (password: string) => {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  const capped = Math.min(4, Math.max(1, score));
  const tiers = [
    { label: "Weak" as const, bar: "bg-red-500", text: "text-red-600" },
    { label: "Fair" as const, bar: "bg-orange-500", text: "text-orange-600" },
    { label: "Medium" as const, bar: "bg-amber-400", text: "text-amber-700" },
    { label: "Strong" as const, bar: "bg-emerald-500", text: "text-emerald-700" }
  ];
  const tier = tiers[capped - 1];
  return { filled: capped, label: tier.label, barClass: tier.bar, textClass: tier.text };
};

export const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);

  const form = useForm<ResetPasswordValues>({
    defaultValues: {
      password: "",
      confirmPassword: ""
    },
    mode: "onSubmit"
  });

  const passwordValue = form.watch("password");
  const strength = strengthMeta(passwordValue);

  const savePassword = async (values: ResetPasswordValues) => {
    setIsSaving(true);
    setServerError(null);
    try {
      await resetAdminPassword({ token, newPassword: values.password });
      setSubmitted(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "We couldn’t update your password. Try again.";
      setServerError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const onFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError(null);
    form.clearErrors();

    const parsed = resetPasswordSchema.safeParse({
      password: form.getValues("password"),
      confirmPassword: form.getValues("confirmPassword")
    });

    if (!parsed.success) {
      applyZodIssuesToRhf(parsed.error.issues, form.setError);
      return;
    }

    void savePassword(parsed.data);
  };

  const tokenMissing = !token;
  const expiredOrInvalid = Boolean(serverError && /expired|invalid|token/i.test(serverError));

  const passwordFieldInvalid = Boolean(form.formState.errors.password);
  const confirmFieldInvalid = Boolean(form.formState.errors.confirmPassword);

  return (
    <>
    <div className="w-full max-w-[440px]">
      <div className="mb-10">
        <h1 className="mb-2 font-headline text-[2rem] font-bold text-[#0f1117]">Set new password</h1>
        <p className="text-[#434654]">Enter a strong password to protect your account access.</p>
      </div>

      {tokenMissing ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900" role="alert">
          No reset token is present in the URL. Open the link from your email or request a new reset.
        </div>
      ) : null}

      {expiredOrInvalid ? (
        <div className="mt-6 rounded-r-xl border-l-4 border-red-600 bg-red-50/80 p-5" role="alert">
          <div className="flex gap-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" strokeWidth={2} aria-hidden />
            <div className="space-y-2">
              <p className="font-headline text-sm font-bold text-red-900">Reset link issue</p>
              <p className="text-xs leading-relaxed text-red-800/90">{serverError}</p>
              <Link to="/admin/forgot-password" className="inline-block text-xs font-bold text-red-700 hover:underline">
                Back to forgot password
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {!tokenMissing && submitted ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900" role="status">
          Password updated.{" "}
          <Link to="/admin/login" className="font-semibold text-[var(--color-primary)] hover:underline">
            Sign in
          </Link>
        </div>
      ) : null}

      {!tokenMissing && !submitted && !expiredOrInvalid ? (
        <form className="space-y-6" onSubmit={onFormSubmit} noValidate>
          <div className="space-y-2">
            <label
              className="text-xs font-semibold uppercase tracking-wider text-[#434654]"
              htmlFor="admin-reset-password"
            >
              New Password
            </label>
            <div className="relative">
              <input
                id="admin-reset-password"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                aria-invalid={passwordFieldInvalid}
                className={`h-11 w-full rounded-xl border bg-white px-4 pr-12 text-sm outline-none transition focus:ring-2 focus:ring-[var(--color-primary)] ${
                  passwordFieldInvalid
                    ? "border-red-500 focus:border-red-500"
                    : "border-[#e5e7eb] focus:border-[var(--color-primary)]"
                }`}
                placeholder="••••••••••••"
                disabled={isSaving}
                {...form.register("password")}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "Hide password" : "Show password"}
                disabled={isSaving}
              >
                {showPw ? <EyeOff className="h-5 w-5" strokeWidth={2} /> : <Eye className="h-5 w-5" strokeWidth={2} />}
              </button>
            </div>
            <div className="pt-2">
              <div className="mb-2 flex gap-1.5">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full ${i < strength.filled ? strength.barClass : "bg-slate-200"}`}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-500">
                  Strength: <span className={strength.textClass}>{strength.label}</span>
                </span>
                <span className="font-mono text-[11px] text-[#737685]">8+ Characters</span>
              </div>
            </div>
            {form.formState.errors.password ? (
              <p className="text-xs text-red-600" role="alert">
                {form.formState.errors.password.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label
              className="text-xs font-semibold uppercase tracking-wider text-[#434654]"
              htmlFor="admin-reset-confirm"
            >
              Confirm Password
            </label>
            <input
              id="admin-reset-confirm"
              type="password"
              autoComplete="new-password"
              aria-invalid={confirmFieldInvalid}
              className={`h-11 w-full rounded-xl border bg-white px-4 text-sm outline-none transition focus:ring-2 focus:ring-[var(--color-primary)] ${
                confirmFieldInvalid
                  ? "border-red-500 focus:border-red-500"
                  : "border-[#e5e7eb] focus:border-[var(--color-primary)]"
              }`}
              placeholder="••••••••••••"
              disabled={isSaving}
              {...form.register("confirmPassword")}
            />
            {form.formState.errors.confirmPassword ? (
              <p className="text-xs text-red-600" role="alert">
                {form.formState.errors.confirmPassword.message}
              </p>
            ) : null}
          </div>

          {serverError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {serverError}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSaving}
            className="auth-primary-gradient flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white shadow-lg shadow-[#1653cc]/20 transition hover:opacity-95 disabled:opacity-70"
          >
            {isSaving ? "Saving…" : "Save Password"}
          </button>
        </form>
      ) : null}

      {!submitted ? (
        <p className="mt-12 text-center text-sm text-[#737685]">
          Suddenly remembered?{" "}
          <Link to="/admin/login" className="ml-1 font-semibold text-[var(--color-primary)] hover:underline">
            Log in here
          </Link>
        </p>
      ) : null}
    </div>
      <div className="pointer-events-none fixed bottom-8 right-8 hidden items-center gap-6 lg:flex">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-slate-400">TLS encrypted</span>
        </div>
      </div>
    </>
  );
};
