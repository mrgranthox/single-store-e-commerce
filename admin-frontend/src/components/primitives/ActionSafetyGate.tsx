import { useState, type ReactNode } from "react";
import { DestructiveActionButton } from "@/components/primitives/DestructiveActionButton";
import { ConfirmDialog } from "@/components/primitives/ConfirmDialog";

type ActionSafetyGateProps = {
  /** Label shown on the trigger button */
  label: string;
  /** Dialog title */
  title: string;
  /** Dialog body copy */
  body?: ReactNode;
  /** Short consequence note rendered in muted danger styling above the action buttons */
  impactSummary?: ReactNode;
  /** Confirm button label (defaults to the trigger label) */
  confirmLabel?: string;
  /** Cancel button label */
  cancelLabel?: string;
  /** Called when the user confirms */
  onConfirm: () => void;
  /** Show spinner on the trigger button while the action is in-flight */
  pending?: boolean;
  /** Prevent triggering when a precondition is not met */
  blocked?: boolean;
  /** Dialog width: sm=480, md=640, lg=800 */
  size?: "sm" | "md" | "lg";
  /** Additional className forwarded to the trigger button */
  className?: string;
};

/**
 * ActionSafetyGate
 *
 * Single compound component for all destructive admin actions.
 * Renders a DestructiveActionButton that opens a ConfirmDialog with
 * danger styling, optional impact summary, and typed confirmation.
 *
 * Usage:
 *   <ActionSafetyGate
 *     label="Cancel order"
 *     title="Cancel this order?"
 *     body="This will void the reservation and notify the customer."
 *     impactSummary="Irreversible — cannot be undone."
 *     onConfirm={handleCancel}
 *     pending={cancelAction.pending}
 *   />
 */
export const ActionSafetyGate = ({
  label,
  title,
  body,
  impactSummary,
  confirmLabel,
  cancelLabel,
  onConfirm,
  pending = false,
  blocked = false,
  size = "sm",
  className
}: ActionSafetyGateProps) => {
  const [open, setOpen] = useState(false);

  const handleConfirm = () => {
    setOpen(false);
    onConfirm();
  };

  return (
    <>
      <DestructiveActionButton
        onClick={() => setOpen(true)}
        pending={pending}
        blocked={blocked}
        className={className}
      >
        {label}
      </DestructiveActionButton>
      <ConfirmDialog
        open={open}
        title={title}
        body={body}
        impactSummary={impactSummary}
        confirmLabel={confirmLabel ?? label}
        cancelLabel={cancelLabel}
        danger
        size={size}
        onConfirm={handleConfirm}
        onClose={() => setOpen(false)}
      />
    </>
  );
};
