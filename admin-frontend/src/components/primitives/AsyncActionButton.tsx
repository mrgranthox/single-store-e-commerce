import clsx from "clsx";
import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type AsyncActionButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    pending?: boolean;
    blocked?: boolean;
  }
>;

export const AsyncActionButton = ({
  children,
  className,
  disabled,
  pending = false,
  blocked = false,
  ...props
}: AsyncActionButtonProps) => (
  <button
    type="button"
    className={clsx(
      "inline-flex items-center justify-center gap-2 rounded-lg bg-[#1653cc] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:bg-[#1653cc]/90 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    disabled={disabled || pending || blocked}
    aria-busy={pending || undefined}
    {...props}
  >
    {pending ? "Working…" : children}
  </button>
);
