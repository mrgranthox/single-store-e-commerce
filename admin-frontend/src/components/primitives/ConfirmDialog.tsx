import { useEffect, useId, useRef } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive action — confirm button uses danger styling. */
  danger?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export const ConfirmDialog = ({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  confirmDisabled = false,
  onConfirm,
  onClose
}: ConfirmDialogProps) => {
  const titleId = useId();
  const bodyId = useId();
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    cancelButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Dismiss"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-md rounded-xl border border-[#e5e7eb] bg-white p-6 shadow-2xl"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={body ? bodyId : undefined}
      >
        <h2 id={titleId} className="font-headline text-lg font-bold text-[#181b25]">
          {title}
        </h2>
        {body ? (
          <p id={bodyId} className="mt-2 text-sm leading-relaxed text-[#60626c]">
            {body}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            ref={cancelButtonRef}
            type="button"
            className="rounded-lg border border-[#e5e7eb] px-4 py-2 text-sm font-semibold text-[#434654] transition-colors hover:bg-[#f8f9fb]"
            onClick={onClose}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={confirmDisabled}
            className={
              danger
                ? "rounded-lg bg-[#ba1a1a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ba1a1a]/90 disabled:opacity-50"
                : "rounded-lg bg-[#1653cc] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1653cc]/90 disabled:opacity-50"
            }
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
