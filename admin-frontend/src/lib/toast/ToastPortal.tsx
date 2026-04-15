import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { type Toast, type ToastVariant, useToastStore } from "./toast.store";

const VARIANTS: Record<
  ToastVariant,
  {
    icon: React.ElementType;
    iconClass: string;
    border: string;
    bg: string;
  }
> = {
  success: {
    icon: CheckCircle2,
    iconClass: "text-emerald-400",
    border: "border-l-emerald-500",
    bg: "bg-[#181b25]",
  },
  error: {
    icon: XCircle,
    iconClass: "text-red-400",
    border: "border-l-red-500",
    bg: "bg-[#181b25]",
  },
  warning: {
    icon: AlertTriangle,
    iconClass: "text-amber-400",
    border: "border-l-amber-500",
    bg: "bg-[#181b25]",
  },
  info: {
    icon: Info,
    iconClass: "text-blue-400",
    border: "border-l-blue-500",
    bg: "bg-[#181b25]",
  },
};

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const v = VARIANTS[toast.variant];
  const Icon = v.icon;

  // Trigger enter animation on mount
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(onDismiss, 200);
  };

  return (
    <div
      role={toast.variant === "error" ? "alert" : "status"}
      aria-atomic="true"
      className={[
        "pointer-events-auto flex w-80 items-start gap-3 rounded-lg border border-[#2a2f3e] border-l-4",
        v.border,
        v.bg,
        "px-4 py-3 shadow-2xl ring-1 ring-black/20",
        "transition-all duration-200",
        visible ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0",
      ].join(" ")}
    >
      <Icon className={["mt-0.5 h-4 w-4 shrink-0", v.iconClass].join(" ")} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight text-white">
          {toast.title}
        </p>
        {toast.description && (
          <p className="mt-0.5 text-xs leading-relaxed text-[#9ca3af]">
            {toast.description}
          </p>
        )}
      </div>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss notification"
        className="ml-1 mt-0.5 shrink-0 rounded p-0.5 text-[#6b7280] transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/**
 * Mount once at the app root (inside AppProviders).
 * Uses a fixed container with aria-live so screen readers announce toasts.
 */
export const ToastPortal = () => {
  const { toasts, dismiss } = useToastStore();

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="pointer-events-none fixed right-4 top-4 z-[9999] flex flex-col gap-2"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
};
