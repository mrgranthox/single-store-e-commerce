import type React from "react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Icon } from "@/components/Icon";
import { StoreBrandLink } from "@/components/layout";
import { LOGO_ALT, LOGO_SRC, STORE_NAME_FULL } from "@/lib/brand";
import { useCustomerStore } from "@/lib/store/customer-store";

const AuthFooter = () => (
  <footer className="w-full mt-auto py-12 bg-slate-100 border-t border-slate-200">
    <div className="flex flex-col md:flex-row justify-between items-center px-8 max-w-7xl mx-auto gap-6 md:gap-0">
      <div className="flex flex-col items-center md:items-start gap-2">
        <div className="flex items-center gap-2">
          <img src={LOGO_SRC} alt={LOGO_ALT} className="h-8 w-auto object-contain rounded-xl" width={100} height={32} />
          <span className="font-bold text-slate-900 font-headline tracking-tighter text-xl">{STORE_NAME_FULL}</span>
        </div>
        <p className="text-sm text-slate-500">© 2024 {STORE_NAME_FULL}. All rights reserved.</p>
      </div>
      <nav className="flex flex-wrap justify-center gap-6">
        {[["Privacy Policy", "/pages/privacy-policy"], ["Terms of Service", "/pages/terms"], ["Shipping Info", "/pages/shipping-policy"], ["Returns", "/pages/returns-policy"]].map(([label, to]) => (
          <Link key={label} className="text-sm text-slate-500 hover:text-slate-800 transition-all" to={to}>{label}</Link>
        ))}
      </nav>
      <div className="flex gap-4">
        <Icon name="credit_card" className="text-slate-400" />
        <Icon name="shield" className="text-slate-400" />
      </div>
    </div>
  </footer>
);

/* ─────────────────────────────────────────────
   LOGIN PAGE — matches login/code.html
───────────────────────────────────────────── */
const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  remember: z.boolean().optional(),
});

export const LoginPage = () => {
  const navigate = useNavigate();
  const signIn = useCustomerStore((s) => s.signIn);
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = () => {
    signIn();
    navigate("/account");
  };

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col">
      <main className="flex-grow flex items-center justify-center py-12 px-6">
        <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 overflow-hidden bg-surface-container-lowest rounded-xl shadow-[0_20px_50px_rgba(11,28,48,0.08)]">
          {/* Editorial Side */}
          <div className="hidden lg:block relative min-h-[600px] overflow-hidden">
            <div className="absolute inset-0 bg-primary-container/20 mix-blend-multiply z-10" />
            <img
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCu3-W9TBN4tmE0Yf9_E5vUepA0oiO7jJvjId8d2enoyBYXM3Ql70L-a7n65pgbUelQhTKJaAhVgRn9y-8ntg1xgzz7gVISLGw0z0lXFpmE6mDmo2EXS6V3CHTuPidT313QQo3GlgLwd2SvwUMZqNUsbDWPGoKBMvQJE3HFFauvqBI9RTS-XiahUUGwyDGUGdBECWZ3C25rN6EGtSRSoEwaj4CDaAt91Sy2aozMM4XBWto6THU4Jy4iT1iUrCyiVtuLDm3zr8sMUX4C"
            />
            <div className="absolute bottom-12 left-12 right-12 z-20">
              <div className="text-surface-bright mb-4">
                <span className="font-headline font-bold text-4xl tracking-tighter block mb-2">{STORE_NAME_FULL}</span>
                <p className="font-body text-surface-container-highest/90 max-w-sm leading-relaxed">
                  Curated tees and everyday staples — easy checkout with card or mobile money via Paystack.
                </p>
              </div>
              <div className="flex gap-4">
                <div className="h-[1px] w-12 bg-surface-bright/30 self-center" />
                <span className="text-surface-bright/60 text-xs font-label uppercase tracking-[0.2em]">Est. 2024</span>
              </div>
            </div>
          </div>

          {/* Form Side */}
          <div className="p-8 md:p-12 lg:p-16 flex flex-col justify-center bg-surface-container-lowest">
            <div className="mb-10 text-center lg:text-left">
              <h2 className="font-headline font-extrabold text-3xl md:text-4xl text-on-surface tracking-tight mb-2">Welcome Back</h2>
              <p className="text-on-surface-variant font-body">Enter your details to access your {STORE_NAME_FULL} account.</p>
            </div>

            {/* Social Logins */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <button className="flex items-center justify-center gap-3 py-3 px-6 bg-surface-container-low text-on-surface rounded-md font-label font-medium transition-all hover:bg-surface-container-highest active:scale-[0.98]">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Google
              </button>
              <button className="flex items-center justify-center gap-3 py-3 px-6 bg-surface-container-low text-on-surface rounded-md font-label font-medium transition-all hover:bg-surface-container-highest active:scale-[0.98]">
                <Icon name="phone_iphone" className="text-on-surface" />
                Apple
              </button>
            </div>

            <div className="relative flex py-5 items-center">
              <div className="flex-grow border-t border-outline-variant/30" />
              <span className="flex-shrink mx-4 text-outline font-label text-xs uppercase tracking-widest">or email</span>
              <div className="flex-grow border-t border-outline-variant/30" />
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className="block text-xs font-label font-bold uppercase tracking-wider text-on-surface mb-2" htmlFor="email">
                  Email Address
                </label>
                <input
                  {...register("email")}
                  id="email"
                  className="w-full px-5 py-4 bg-surface-container-high border-none rounded-md focus:ring-2 focus:ring-secondary/20 focus:bg-surface-container-lowest transition-all text-on-surface font-body outline-none placeholder:text-outline/60"
                  placeholder="name@example.com"
                  type="email"
                />
                {errors.email && <p className="text-xs text-error mt-1">{errors.email.message}</p>}
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-label font-bold uppercase tracking-wider text-on-surface" htmlFor="password">
                    Password
                  </label>
                  <Link className="text-xs font-label text-secondary hover:underline transition-all" to="/forgot-password">
                    Forgot password?
                  </Link>
                </div>
                <input
                  {...register("password")}
                  id="password"
                  className="w-full px-5 py-4 bg-surface-container-high border-none rounded-md focus:ring-2 focus:ring-secondary/20 focus:bg-surface-container-lowest transition-all text-on-surface font-body outline-none placeholder:text-outline/60"
                  placeholder="••••••••"
                  type="password"
                />
                {errors.password && <p className="text-xs text-error mt-1">{errors.password.message}</p>}
              </div>
              <div className="flex items-center gap-2 py-2">
                <input
                  {...register("remember")}
                  id="remember"
                  type="checkbox"
                  className="w-4 h-4 rounded-sm border-outline-variant bg-surface-container-high text-secondary focus:ring-secondary"
                />
                <label className="text-sm font-body text-on-surface-variant" htmlFor="remember">Keep me signed in</label>
              </div>
              <button
                type="submit"
                className="w-full py-4 bg-primary text-on-primary font-headline font-bold rounded-md hover:bg-on-surface transition-all active:scale-[0.99] shadow-lg shadow-primary/10 mt-2"
              >
                Sign In
              </button>
            </form>

            <p className="mt-8 text-center text-sm font-body text-on-surface-variant">
              Don't have an account?{" "}
              <Link className="text-secondary font-semibold hover:underline" to="/register">Create an account</Link>
            </p>

            <div className="mt-12 flex justify-center items-center gap-6 opacity-60">
              <div className="flex items-center gap-2">
                <Icon name="lock" filled className="text-sm" />
                <span className="text-[10px] font-label uppercase tracking-widest">SSL Secure</span>
              </div>
              <div className="flex items-center gap-2">
                <Icon name="verified_user" filled className="text-sm" />
                <span className="text-[10px] font-label uppercase tracking-widest">Verified Merchant</span>
              </div>
            </div>
          </div>
        </div>
      </main>
      <AuthFooter />
    </div>
  );
};

/* ─────────────────────────────────────────────
   REGISTER PAGE — matches register/code.html
───────────────────────────────────────────── */
const registerSchema = z.object({
  fullName: z.string().min(2, "Name required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Min 8 characters"),
  confirmPassword: z.string(),
  newsletter: z.boolean().optional(),
  terms: z.literal(true, { message: "You must accept the terms" }),
}).refine((d) => d.password === d.confirmPassword, { message: "Passwords must match", path: ["confirmPassword"] });

export const RegisterPage = () => {
  const navigate = useNavigate();
  const signIn = useCustomerStore((s) => s.signIn);
  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    resolver: zodResolver(registerSchema),
  });

  const pwd = watch("password") ?? "";
  const strength = Math.min(Math.floor((pwd.length / 12) * 4), 4);

  const onSubmit = () => {
    signIn();
    navigate("/account");
  };

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col">
      <header className="fixed top-0 w-full z-50 bg-slate-50/80 backdrop-blur-xl">
        <div className="flex justify-between items-center px-6 py-4 max-w-7xl mx-auto">
          <StoreBrandLink to="/" wordmarkClassName="text-slate-900" />
          <Link className="text-sm font-label font-medium text-secondary hover:underline transition-all" to="/login">
            Already have an account? Sign in
          </Link>
        </div>
      </header>

      <main className="flex-grow flex items-stretch pt-16">
        {/* Editorial Left */}
        <div className="hidden lg:flex lg:w-1/2 bg-surface-container-low items-center justify-center p-12 relative overflow-hidden">
          <div className="relative z-10 max-w-lg">
            <span className="text-secondary font-label font-bold uppercase tracking-[0.2em] text-xs block mb-6">Join {STORE_NAME_FULL}</span>
            <h1 className="text-5xl font-extrabold tracking-tighter leading-[1.1] mb-8 text-primary-container">
              Tees you will <br />wear on repeat — <br />fits that feel right.
            </h1>
            <p className="text-lg text-on-surface-variant font-body leading-relaxed mb-12">
              New drops, member offers, and secure checkout with Visa, Mastercard, or mobile money (MTN, Telecel, AirtelTigo) through Paystack.
            </p>
            <div className="flex items-center gap-4 py-6 border-t border-outline-variant/30">
              <div className="flex -space-x-3">
                {[
                  "https://lh3.googleusercontent.com/aida-public/AB6AXuAxy8QYrdZqDYWn6hgysyaoL_QWOgFmN4KGrxXWzwR4WIbvhq8N_prIGnV7jGZqci55kDlY-AkeR7Xszcgn-yV-GPgKoGD0r72I4ZPc-udGGefAHtm9vXGso8HT2qoc9PQyVe90KPXB5vFjfCTJDExVrbG0j0XhEB00u1FvxAF5XEMUZpc8n5y4UTU3D11yseYfwbMDfNk3ZJYkt1XyFsDHvg9pXm5aoXa75xUhgPGUsfnXzchleCh13qpqZnTK0ekxo5MCHWXPo8pg",
                  "https://lh3.googleusercontent.com/aida-public/AB6AXuDwdrliLEbTO45JGNbnUMXahiw0EE4THyi6BES4BSAmHCW8bq0xivisjeYWgsoYcf1JYQhGiuuuoklMLpRZ0QFb6hGjwAxGonBt4YDAXxw9a3b8WYyy5tNddftDfqZ7UVCfv8iJXmlSRoO9RhEBlLiQ0VHtGNVoSJS3pZU4yiWxiCGQbzCfs5gVqS0CL_0fBAQ6JZD72f40JHhstYMcnvvkmNk4Xt0zOebV4-UmFd4YQkhDp3-Sz_A11SygofcZNxLBfAEHvfE78PAB",
                ].map((src, i) => (
                  <img key={i} className="w-10 h-10 rounded-full border-2 border-surface-container-low object-cover" src={src} alt="" />
                ))}
              </div>
              <p className="text-sm text-outline font-medium italic">Join 12,000+ tastemakers worldwide.</p>
            </div>
          </div>
          <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-surface-container-highest rounded-full blur-3xl opacity-50" />
        </div>

        {/* Form Right */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8 md:p-16 lg:p-24 bg-surface">
          <div className="w-full max-w-md">
            <div className="mb-10 lg:hidden">
              <h2 className="text-3xl font-bold tracking-tighter text-on-surface">Create Account</h2>
              <p className="text-on-surface-variant mt-2">Start shopping with {STORE_NAME_FULL}.</p>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {[
                { name: "fullName", label: "Full Name", placeholder: "Elias Sjöberg", type: "text" },
                { name: "email", label: "Email Address", placeholder: "you@example.com", type: "email" },
              ].map(({ name, label, placeholder, type }) => (
                <div key={name} className="space-y-1.5">
                  <label className="block text-xs font-label font-bold uppercase tracking-wider text-outline" htmlFor={name}>{label}</label>
                  <input
                    {...register(name as "fullName" | "email")}
                    id={name}
                    className="w-full px-4 py-3 bg-surface-container-high border-none rounded-md focus:ring-2 focus:ring-secondary/20 focus:bg-surface-container-lowest transition-all text-on-surface outline-none placeholder:text-outline-variant"
                    placeholder={placeholder}
                    type={type}
                  />
                  {errors[name as keyof typeof errors] && (
                    <p className="text-xs text-error">{String(errors[name as keyof typeof errors]?.message ?? "")}</p>
                  )}
                </div>
              ))}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { name: "password", label: "Password", placeholder: "••••••••" },
                  { name: "confirmPassword", label: "Confirm", placeholder: "••••••••" },
                ].map(({ name, label, placeholder }) => (
                  <div key={name} className="space-y-1.5">
                    <label className="block text-xs font-label font-bold uppercase tracking-wider text-outline" htmlFor={name}>{label}</label>
                    <input
                      {...register(name as "password" | "confirmPassword")}
                      id={name}
                      className="w-full px-4 py-3 bg-surface-container-high border-none rounded-md focus:ring-2 focus:ring-secondary/20 focus:bg-surface-container-lowest transition-all text-on-surface outline-none placeholder:text-outline-variant"
                      placeholder={placeholder}
                      type="password"
                    />
                    {errors[name as keyof typeof errors] && (
                      <p className="text-xs text-error">{String(errors[name as keyof typeof errors]?.message ?? "")}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Password strength */}
              <div className="flex gap-1.5 mt-2">
                {Array.from({ length: 4 }, (_, i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full ${i < strength ? "bg-secondary" : "bg-surface-container-highest"}`}
                  />
                ))}
                {strength > 0 && (
                  <span className="text-[10px] uppercase font-bold text-secondary ml-2 -mt-1">
                    {strength < 2 ? "Weak" : strength < 3 ? "Fair" : "Strong"}
                  </span>
                )}
              </div>

              {/* Options */}
              <div className="space-y-4 pt-4">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input {...register("newsletter")} type="checkbox" className="peer h-5 w-5 rounded border-outline-variant bg-surface-container-high text-secondary focus:ring-secondary/20" />
                  <span className="text-sm text-on-surface-variant font-body leading-tight group-hover:text-on-surface transition-colors">
                    Email me about new drops, restocks, and exclusive offers from {STORE_NAME_FULL}.
                  </span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input {...register("terms")} type="checkbox" required className="peer h-5 w-5 rounded border-outline-variant bg-surface-container-high text-secondary focus:ring-secondary/20" />
                  <span className="text-sm text-on-surface-variant font-body leading-tight group-hover:text-on-surface transition-colors">
                    I accept the{" "}
                    <Link className="text-on-surface font-semibold underline decoration-outline-variant hover:decoration-secondary transition-all" to="/pages/terms">Terms of Service</Link>{" "}
                    and{" "}
                    <Link className="text-on-surface font-semibold underline decoration-outline-variant hover:decoration-secondary transition-all" to="/pages/privacy-policy">Privacy Policy</Link>.
                  </span>
                </label>
                {errors.terms && <p className="text-xs text-error">{errors.terms.message}</p>}
              </div>

              <button type="submit" className="w-full mt-8 py-4 bg-primary text-on-primary font-headline font-bold text-base rounded-md hover:bg-secondary transition-all transform active:scale-[0.98] shadow-lg shadow-primary/10">
                Create Account
              </button>

              <div className="relative py-6 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-outline-variant/30" /></div>
                <span className="relative bg-surface px-4 text-xs font-label uppercase tracking-widest text-outline">Or register with</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button type="button" className="flex items-center justify-center gap-2 py-3 bg-surface-container-lowest border border-outline-variant/20 rounded-md hover:bg-surface-container-low transition-all">
                  <span className="text-sm font-label font-bold text-on-surface">Google</span>
                </button>
                <button type="button" className="flex items-center justify-center gap-2 py-3 bg-surface-container-lowest border border-outline-variant/20 rounded-md hover:bg-surface-container-low transition-all">
                  <span className="text-sm font-label font-bold text-on-surface">Apple</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
      <footer className="py-8 bg-slate-100 border-t border-slate-200">
        <p className="text-center text-sm text-slate-500">© 2024 {STORE_NAME_FULL}. Secure checkout with Paystack.</p>
      </footer>
    </div>
  );
};

/* ─────────────────────────────────────────────
   FORGOT PASSWORD
───────────────────────────────────────────── */
export const ForgotPasswordPage = () => {
  const [sent, setSent] = useState(false);

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col">
      <main className="flex-grow flex items-center justify-center py-12 px-6">
        <div className="max-w-md w-full bg-surface-container-lowest rounded-xl shadow-[0_20px_50px_rgba(11,28,48,0.08)] p-10">
          <Link to="/login" className="flex items-center gap-2 text-secondary text-sm font-label font-bold uppercase tracking-widest mb-8 hover:opacity-70 transition-opacity">
            <Icon name="arrow_back" className="text-sm" />
            Back to Sign In
          </Link>
          <h2 className="font-headline font-extrabold text-3xl text-on-surface tracking-tight mb-2">Reset Password</h2>
          <p className="text-on-surface-variant mb-8">
            Enter your email address and we'll send you a link to reset your password.
          </p>
          {!sent ? (
            <form onSubmit={(e) => { e.preventDefault(); setSent(true); }} className="space-y-6">
              <div>
                <label className="block text-xs font-label font-bold uppercase tracking-wider text-on-surface mb-2">Email Address</label>
                <input required className="w-full px-5 py-4 bg-surface-container-high border-none rounded-md focus:ring-2 focus:ring-secondary/20 focus:bg-surface-container-lowest transition-all outline-none" placeholder="name@example.com" type="email" />
              </div>
              <button type="submit" className="w-full py-4 bg-primary text-on-primary font-headline font-bold rounded-md hover:bg-on-surface transition-all">
                Send Reset Link
              </button>
            </form>
          ) : (
            <div className="text-center space-y-4">
              <Icon name="mark_email_read" filled className="text-5xl text-secondary mx-auto" />
              <h3 className="font-headline font-bold text-xl">Check your inbox</h3>
              <p className="text-on-surface-variant">A password reset link has been sent to your email address.</p>
              <Link to="/login" className="inline-block mt-4 bg-secondary text-on-secondary px-8 py-3 rounded-md font-bold hover:opacity-90">
                Return to Sign In
              </Link>
            </div>
          )}
        </div>
      </main>
      <AuthFooter />
    </div>
  );
};

/* ─────────────────────────────────────────────
   RESET PASSWORD
───────────────────────────────────────────── */
export const ResetPasswordPage = () => {
  const navigate = useNavigate();

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col">
      <main className="flex-grow flex items-center justify-center py-12 px-6">
        <div className="max-w-md w-full bg-surface-container-lowest rounded-xl shadow-[0_20px_50px_rgba(11,28,48,0.08)] p-10">
          <h2 className="font-headline font-extrabold text-3xl text-on-surface tracking-tight mb-2">Create New Password</h2>
          <p className="text-on-surface-variant mb-8">Your new password must be at least 8 characters.</p>
          <form onSubmit={(e) => { e.preventDefault(); navigate("/login"); }} className="space-y-6">
            {[{ label: "New Password", placeholder: "••••••••" }, { label: "Confirm Password", placeholder: "••••••••" }].map(({ label, placeholder }) => (
              <div key={label}>
                <label className="block text-xs font-label font-bold uppercase tracking-wider text-on-surface mb-2">{label}</label>
                <input required minLength={8} className="w-full px-5 py-4 bg-surface-container-high border-none rounded-md focus:ring-2 focus:ring-secondary/20 focus:bg-surface-container-lowest transition-all outline-none" placeholder={placeholder} type="password" />
              </div>
            ))}
            <button type="submit" className="w-full py-4 bg-primary text-on-primary font-headline font-bold rounded-md hover:bg-on-surface transition-all">
              Reset Password
            </button>
          </form>
        </div>
      </main>
      <AuthFooter />
    </div>
  );
};

/* ─────────────────────────────────────────────
   VERIFY EMAIL
───────────────────────────────────────────── */
export const VerifyEmailPage = () => (
  <div className="bg-background text-on-background min-h-screen flex flex-col">
    <main className="flex-grow flex items-center justify-center py-12 px-6">
      <div className="max-w-md w-full bg-surface-container-lowest rounded-xl shadow-[0_20px_50px_rgba(11,28,48,0.08)] p-10 text-center space-y-6">
        <Icon name="mark_email_unread" filled className="text-6xl text-secondary mx-auto" />
        <h2 className="font-headline font-extrabold text-3xl text-on-surface tracking-tight">Verify Your Email</h2>
        <p className="text-on-surface-variant">
          We sent a confirmation link to your email address. Click the link to activate your account.
        </p>
        <button className="w-full py-4 bg-primary text-on-primary font-headline font-bold rounded-md hover:bg-on-surface transition-all">
          Resend Email
        </button>
        <Link className="block text-sm text-secondary hover:underline" to="/login">Back to Sign In</Link>
      </div>
    </main>
    <AuthFooter />
  </div>
);

/* ─────────────────────────────────────────────
   SESSION EXPIRED
───────────────────────────────────────────── */
export const SessionExpiredPage = () => (
  <div className="bg-background text-on-background min-h-screen flex flex-col">
    <main className="flex-grow flex items-center justify-center py-12 px-6">
      <div className="max-w-md w-full bg-surface-container-lowest rounded-xl shadow-[0_20px_50px_rgba(11,28,48,0.08)] p-10 text-center space-y-6">
        <Icon name="lock_clock" className="text-6xl text-error mx-auto" />
        <h2 className="font-headline font-extrabold text-3xl text-on-surface tracking-tight">Session Expired</h2>
        <p className="text-on-surface-variant">
          Your session has expired for security reasons. Please sign in again to continue.
        </p>
        <Link to="/login" className="block w-full py-4 bg-secondary text-on-secondary font-headline font-bold rounded-md hover:opacity-90 transition-opacity text-center">
          Sign In Again
        </Link>
      </div>
    </main>
    <AuthFooter />
  </div>
);
