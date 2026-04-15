import type { ReactNode } from "react";

type WorkspaceStateCardProps = {
  eyebrow?: string;
  title: string;
  description: string;
  icon?: ReactNode;
  primaryActionLabel?: string;
  secondaryActionLabel?: string;
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
};

export const WorkspaceStateCard = ({
  eyebrow = "Admin workspace",
  title,
  description,
  icon,
  primaryActionLabel,
  secondaryActionLabel,
  onPrimaryAction,
  onSecondaryAction
}: WorkspaceStateCardProps) => (
  <div className="flex min-h-screen items-center justify-center bg-[#f8f9fb] p-6">
    <div className="w-full max-w-lg rounded-2xl border border-[#e0e2f0] bg-white p-8 shadow-sm">
      {icon ? (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#f2f3ff] text-[#1653cc]">
          {icon}
        </div>
      ) : null}
      <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#737685]">{eyebrow}</p>
      <h1 className="mt-2 font-headline text-2xl font-bold tracking-tight text-[#181b25]">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-[#5b5e68]">{description}</p>
      {(primaryActionLabel || secondaryActionLabel) && (
        <div className="mt-6 flex flex-wrap gap-3">
          {primaryActionLabel && onPrimaryAction ? (
            <button
              type="button"
              onClick={onPrimaryAction}
              className="rounded-lg bg-[#1653cc] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1653cc]/90"
            >
              {primaryActionLabel}
            </button>
          ) : null}
          {secondaryActionLabel && onSecondaryAction ? (
            <button
              type="button"
              onClick={onSecondaryAction}
              className="rounded-lg border border-[#d8dbe8] px-4 py-2 text-sm font-semibold text-[#434654] hover:bg-[#f8f9fb]"
            >
              {secondaryActionLabel}
            </button>
          ) : null}
        </div>
      )}
    </div>
  </div>
);
