import { useRef } from "react";
import { ChevronDown } from "lucide-react";

export type PageActionItem = {
  id: string;
  label: string;
  onSelect?: () => void;
  disabled?: boolean;
  /** Non-clickable section label inside the menu */
  kind?: "section";
};

type PageActionsMenuProps = {
  items: PageActionItem[];
  triggerLabel?: string;
};

export const PageActionsMenu = ({ items, triggerLabel = "Actions" }: PageActionsMenuProps) => {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  const close = () => {
    const el = detailsRef.current;
    if (el) {
      el.open = false;
    }
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <details
      ref={detailsRef}
      className="relative z-30"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          close();
        }
      }}
    >
      <summary
        className="flex cursor-pointer list-none items-center gap-2 rounded-lg bg-gradient-to-br from-[#1653cc] to-[#3b6de6] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#1653cc]/20 transition-transform hover:opacity-95 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1653cc] [&::-webkit-details-marker]:hidden"
        aria-label={`${triggerLabel}, menu`}
      >
        {triggerLabel}
        <ChevronDown className="h-4 w-4 shrink-0 opacity-90" strokeWidth={2} aria-hidden />
      </summary>
      <div
        className="absolute right-0 mt-2 min-w-[min(100vw-2rem,260px)] max-w-[min(100vw-2rem,320px)] overflow-hidden rounded-lg border border-[var(--color-border-light)] bg-white py-1 shadow-panel ring-1 ring-black/5"
        role="menu"
      >
        {items.map((item) =>
          item.kind === "section" ? (
            <div
              key={item.id}
              className="px-4 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]"
              role="presentation"
            >
              {item.label}
            </div>
          ) : (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              title={item.label.length > 64 ? item.label : undefined}
              className="flex w-full px-4 py-2.5 text-left text-sm text-[var(--color-text-body)] transition-colors hover:bg-[var(--color-bg-content)] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => {
                if (item.disabled) {
                  return;
                }
                item.onSelect?.();
                close();
              }}
            >
              <span className="line-clamp-3">{item.label}</span>
            </button>
          )
        )}
      </div>
    </details>
  );
};
