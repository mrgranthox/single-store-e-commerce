import clsx from "clsx";
import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type DestructiveActionButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    pending?: boolean;
  }
>;

export const DestructiveActionButton = ({
  children,
  className,
  disabled,
  pending = false,
  ...props
}: DestructiveActionButtonProps) => (
  <button
    type="button"
    className={clsx(
      "inline-flex items-center justify-center gap-2 rounded-lg bg-[#ba1a1a] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:bg-[#ba1a1a]/90 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    disabled={disabled || pending}
    aria-busy={pending || undefined}
    {...props}
  >
    {pending ? "Working…" : children}
  </button>
);
