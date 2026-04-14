import clsx from "clsx";
import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type AsyncIconButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    pending?: boolean;
  }
>;

export const AsyncIconButton = ({
  children,
  className,
  disabled,
  pending = false,
  ...props
}: AsyncIconButtonProps) => (
  <button
    type="button"
    className={clsx(
      "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#d8dbe8] text-[#434654] transition-colors hover:bg-[#f8f9fb] disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    disabled={disabled || pending}
    aria-busy={pending || undefined}
    {...props}
  >
    {children}
  </button>
);
