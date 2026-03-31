import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ArrowRight, CheckCircle2, Keyboard } from "lucide-react";

import { forgotAdminPassword } from "@/features/auth/auth.api";
import { applyZodIssuesToRhf } from "@/lib/forms/apply-zod-issues";

const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email.")
    .email("Enter a valid email address.")
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export const ForgotPasswordPage = () => {
  const [submitted, setSubmitted] = useState(false);
  const [lastEmail, setLastEmail] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const form = useForm<ForgotPasswordValues>({
    defaultValues: {
      email: ""
    },
    mode: "onSubmit"
  });

  const sendReset = async (values: ForgotPasswordValues) => {
    setIsSending(true);
    setServerError(null);
    try {
      await forgotAdminPassword(values);
      setLastEmail(values.email);
      setSubmitted(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "We couldn’t send the reset link. Try again.";
      setServerError(message);
    } finally {
      setIsSending(false);
    }
  };

  const onFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError(null);
    form.clearErrors();

    const parsed = forgotPasswordSchema.safeParse({
      email: form.getValues("email")
    });

    if (!parsed.success) {
      applyZodIssuesToRhf(parsed.error.issues, form.setError);
      return;
    }

    void sendReset(parsed.data);
  };

  const emailInvalid = Boolean(form.formState.errors.email);

  return (
    <div className="w-full max-w-md space-y-10">
      <div className="space-y-2">
        <h2 className="font-headline text-3xl font-bold tracking-tight text-[#0f1117]">Recover your access</h2>
        <p className="text-slate-500">
          Enter your verified email address and we&apos;ll send a secure link to reset your administrative credentials.
        </p>
      </div>

      {!submitted ? (
        <form className="space-y-6" onSubmit={onFormSubmit} noValidate>
          <div className="space-y-2">
            <label
              className="text-[0.6875rem] font-semibold uppercase tracking-widest text-slate-500"
              htmlFor="admin-forgot-email"
            >
              Email Address
            </label>
            <div className="relative">
            <input
              id="admin-forgot-email"
              autoComplete="email"
              aria-invalid={emailInvalid}
              className={`h-11 w-full rounded-lg border bg-white px-4 text-sm text-[#181b25] outline-none transition focus:ring-2 focus:ring-[var(--color-primary)] ${
                emailInvalid
                  ? "border-red-500 focus:border-red-500"
                  : "border-[#e5e7eb] focus:border-[var(--color-primary)]"
              }`}
              placeholder="name@enterprise.com"
              disabled={isSending}
              {...form.register("email")}
            />
            </div>
            {form.formState.errors.email ? (
              <p className="text-xs text-red-600" role="alert">
                {form.formState.errors.email.message}
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
            disabled={isSending}
            className="auth-primary-gradient flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white shadow-lg shadow-[#1653cc]/20 transition-opacity hover:opacity-95 disabled:opacity-70"
          >
            {isSending ? "Sending…" : "Send Reset Link"}
            <ArrowRight className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
        </form>
      ) : null}

      {submitted ? (
        <div className="flex items-start gap-4 rounded-xl border border-[#006b2d]/20 bg-white p-6 shadow-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#006b2d]/10 text-[#006b2d]">
            <CheckCircle2 className="h-5 w-5" strokeWidth={2} aria-hidden />
          </div>
          <div>
            <h4 className="font-headline text-sm font-semibold text-[#181b25]">Email sent</h4>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Check your inbox. If an account exists for{" "}
              <span className="font-mono text-[var(--color-primary)]">{lastEmail}</span>, you will receive instructions
              shortly.
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex justify-center border-t border-[#e5e7eb]/50 pt-4">
        <Link
          to="/admin/login"
          className="flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-[var(--color-primary)]"
        >
          <Keyboard className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
          Return to secure login
        </Link>
      </div>
    </div>
  );
};
