type WorkspaceStateCardProps = {
  eyebrow?: string;
  title: string;
  description: string;
  primaryActionLabel?: string;
  secondaryActionLabel?: string;
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
};

export const WorkspaceStateCard = ({
  eyebrow = "Admin workspace",
  title,
  description,
  primaryActionLabel,
  secondaryActionLabel,
  onPrimaryAction,
  onSecondaryAction
}: WorkspaceStateCardProps) => (
  <div className="flex min-h-screen items-center justify-center bg-[#f8f9fb] p-6">
    <div className="w-full max-w-lg rounded-2xl border border-[#e0e2f0] bg-white p-8 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#737685]">{eyebrow}</p>
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
