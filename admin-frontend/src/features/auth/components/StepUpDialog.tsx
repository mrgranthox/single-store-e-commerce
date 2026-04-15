import { useEffect, useId, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { useStepUpStore } from "@/lib/step-up/step-up.store";

const FOCUSABLE =
  'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export const StepUpDialog = () => {
  const { isOpen, confirm, cancel } = useStepUpStore();
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;
    setPassword("");
    setShowPw(false);
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancel();
        return;
      }
      if (e.key === "Tab") {
        const el = dialogRef.current;
        if (!el) return;
        const nodes = el.querySelectorAll<HTMLElement>(FOCUSABLE);
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cancel, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Dismiss"
        onClick={cancel}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md rounded-xl border border-[#e5e7eb] bg-white p-6 shadow-2xl"
      >
        <h2 id={titleId} className="font-headline text-lg font-bold text-[#181b25]">
          Re-authenticate to continue
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[#60626c]">
          This action requires your admin password for verification.
        </p>

        <div className="mt-4">
          <label
            htmlFor="step-up-password"
            className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#737685]"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="step-up-password"
              ref={inputRef}
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && password) confirm(password);
              }}
              autoComplete="current-password"
              className="w-full rounded-lg border border-[#e5e7eb] bg-[#f8f9fb] px-3 py-2.5 pr-10 text-sm text-[#181b25] focus:border-[#1653cc] focus:outline-none focus:ring-2 focus:ring-[#1653cc]/20"
            />
            <button
              type="button"
              tabIndex={-1}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#737685] hover:text-[#181b25]"
              onClick={() => setShowPw((s) => !s)}
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-[#e5e7eb] px-4 py-2 text-sm font-semibold text-[#434654] transition-colors hover:bg-[#f8f9fb]"
            onClick={cancel}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!password}
            className="rounded-lg bg-[#1653cc] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1653cc]/90 disabled:opacity-50"
            onClick={() => confirm(password)}
          >
            Verify &amp; continue
          </button>
        </div>
      </div>
    </div>
  );
};
