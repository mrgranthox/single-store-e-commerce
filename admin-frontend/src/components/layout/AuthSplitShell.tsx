import type { PropsWithChildren, ReactNode } from "react";
import clsx from "clsx";
import { Terminal, ShieldCheck } from "lucide-react";

export type AuthSplitVariant = "login" | "forgot" | "reset";

type AuthSplitShellProps = PropsWithChildren<{
  variant: AuthSplitVariant;
  className?: string;
}>;

const leftPanels: Record<
  AuthSplitVariant,
  { brand: string; title: ReactNode; subtitle: string; footer: ReactNode }
> = {
  login: {
    brand: "Admin Panel",
    title: "Operational control.\nComplete visibility.",
    subtitle:
      "Manage enterprise-grade systems with precision, speed, and authoritative data oversight.",
    footer: (
      <div className="flex items-center gap-4">
        <div className="flex -space-x-2">
          {["A", "B", "C"].map((letter) => (
            <div
              key={letter}
              className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#13161e] bg-slate-700 text-[10px] font-semibold text-slate-200"
            >
              {letter}
            </div>
          ))}
        </div>
        <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-slate-500">
          Active operators online
        </span>
      </div>
    )
  },
  forgot: {
    brand: "Command Deck",
    title: "Enterprise-Grade\nControl Systems.",
    subtitle:
      "Secure access recovery for the administrative layer. Follow the protocol to restore your workspace credentials.",
    footer: (
      <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-slate-500">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--color-primary)]" />
        System Operational // v4.2.0
      </div>
    )
  },
  reset: {
    brand: "Admin Panel",
    title: (
      <>
        Secure your <br />
        <span className="text-[#b4c5ff]">Command Deck.</span>
      </>
    ),
    subtitle:
      "Establish your new credentials to maintain high-level operational control.",
    footer: (
      <div className="space-y-4 rounded-xl border border-white/5 bg-[#1a1d27] p-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#b4c5ff]" strokeWidth={2} aria-hidden />
          <span className="font-mono text-xs uppercase tracking-[0.1em] text-slate-500">System Integrity</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex -space-x-2">
            <div className="h-8 w-8 rounded-full border-2 border-[#1a1d27] bg-slate-600" />
            <div className="h-8 w-8 rounded-full border-2 border-[#1a1d27] bg-slate-500" />
          </div>
          <span className="text-xs text-slate-400">Joined by 2.4k operators worldwide.</span>
        </div>
      </div>
    )
  }
};

export const AuthSplitShell = ({ variant, className, children }: AuthSplitShellProps) => {
  const panel = leftPanels[variant];

  return (
    <main
      className={clsx(
        "mx-auto flex min-h-screen w-full max-w-[1280px] overflow-hidden bg-[var(--color-bg-page)]",
        className
      )}
    >
      <section
        className={clsx(
          "relative hidden flex-col justify-between bg-[#13161e] p-12 lg:flex",
          variant === "reset" ? "lg:w-[480px] lg:max-w-[50%] lg:shrink-0" : "lg:w-1/2"
        )}
      >
        <div className="auth-dot-grid pointer-events-none absolute inset-0" />
        <div className="relative z-10">
          <div className={clsx("flex items-center gap-3", variant === "reset" ? "mb-16" : "")}>
            <div className="auth-primary-gradient flex h-10 w-10 items-center justify-center rounded-lg">
              <Terminal className="h-5 w-5 text-white" strokeWidth={2} aria-hidden />
            </div>
            <h1 className="font-headline text-2xl font-bold tracking-tight text-white">{panel.brand}</h1>
          </div>
        </div>

        <div className={clsx("relative z-10 mb-20", variant === "reset" ? "" : "mt-12")}>
          <h2
            className={clsx(
              "font-headline font-bold leading-tight text-white",
              variant === "reset" ? "text-3xl lg:text-4xl" : "text-4xl"
            )}
          >
            {typeof panel.title === "string" ? (
              panel.title.split("\n").map((line, i) => (
                <span key={i}>
                  {i > 0 ? <br /> : null}
                  {line}
                </span>
              ))
            ) : (
              panel.title
            )}
          </h2>
          <p className={clsx("text-lg text-slate-400", variant === "reset" ? "mt-6 max-w-xs" : "mt-4 max-w-md")}>
            {panel.subtitle}
          </p>
        </div>

        <div className="relative z-10">{panel.footer}</div>

        <div className="auth-primary-gradient pointer-events-none absolute bottom-0 right-0 h-64 w-64 translate-x-1/2 translate-y-1/2 rounded-full opacity-10 blur-[120px]" />
      </section>

      <section
        className={clsx(
          "relative flex flex-1 flex-col items-center justify-center bg-[#f0f2f7]",
          variant === "reset" ? "px-6 py-8 lg:px-24" : "p-8 lg:p-20"
        )}
      >
        {children}
      </section>
    </main>
  );
};
