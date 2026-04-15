import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/**
 * Saves and restores the scroll position for a scrollable container on
 * back-navigation.  Uses sessionStorage keyed by the current pathname so that
 * each list route gets its own independent scroll memory.
 *
 * Usage:
 * ```tsx
 * const scrollRef = useScrollRestoration<HTMLDivElement>();
 * return <div ref={scrollRef} className="overflow-y-auto h-full">...</div>;
 * ```
 *
 * The hook reads from sessionStorage on mount (so the position is available
 * after a forward-back navigation) and saves to sessionStorage on every scroll
 * event (debounced to avoid excessive writes).
 */
export function useScrollRestoration<T extends HTMLElement = HTMLDivElement>() {
  const { pathname } = useLocation();
  const ref = useRef<T>(null);
  const storageKey = `scroll-position:${pathname}`;
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore scroll on mount
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const saved = sessionStorage.getItem(storageKey);
    if (saved !== null) {
      el.scrollTop = Number(saved);
    }
  // Only runs once on mount — intentionally no deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save scroll position on scroll (debounced 150ms)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleScroll = () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        sessionStorage.setItem(storageKey, String(el.scrollTop));
      }, 150);
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", handleScroll);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [storageKey]);

  return ref;
}
