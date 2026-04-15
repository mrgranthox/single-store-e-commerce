import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Minimal virtual list hook for large, fixed-height admin tables.
 *
 * Renders only the rows visible in the scroll viewport plus an overscan
 * buffer above and below, dramatically reducing DOM nodes for tables with
 * hundreds of rows (e.g. audit logs, inventory movements, security events).
 *
 * Usage:
 * ```tsx
 * const containerRef = useRef<HTMLDivElement>(null);
 * const { visibleItems, totalHeight, offsetTop } = useVirtualList({
 *   items,
 *   itemHeight: 48,
 *   containerRef,
 *   overscan: 5,
 * });
 *
 * return (
 *   <div ref={containerRef} style={{ height: 600, overflowY: "auto" }}>
 *     <div style={{ height: totalHeight, position: "relative" }}>
 *       <div style={{ position: "absolute", top: offsetTop, width: "100%" }}>
 *         {visibleItems.map(({ item, index }) => <Row key={index} data={item} />)}
 *       </div>
 *     </div>
 *   </div>
 * );
 * ```
 *
 * For tables with dynamic row heights, pass `estimatedItemHeight` and the hook
 * will measure rows after paint (future extension).
 */
export interface VirtualListOptions<T> {
  items: T[];
  /** Fixed pixel height per row. */
  itemHeight: number;
  /** Ref to the scrollable container element. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Number of extra rows to render above and below the visible window. */
  overscan?: number;
  /** Height of the visible container (px). Falls back to container.clientHeight. */
  containerHeight?: number;
}

export interface VirtualListResult<T> {
  /** Slice of `items` that should be rendered. */
  visibleItems: Array<{ item: T; index: number }>;
  /** Total pixel height needed to represent all rows. */
  totalHeight: number;
  /** Pixel offset from the top of the virtual container to the first rendered row. */
  offsetTop: number;
  /** Index of the first rendered row in the original `items` array. */
  startIndex: number;
  /** Index of the last rendered row (exclusive) in the original `items` array. */
  endIndex: number;
}

export function useVirtualList<T>({
  items,
  itemHeight,
  containerRef,
  overscan = 3,
  containerHeight: containerHeightProp }: VirtualListOptions<T>): VirtualListResult<T> {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(containerHeightProp ?? 600);

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop);
    }
  }, [containerRef]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Measure container on mount and on resize
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setContainerHeight(entry.contentRect.height);
    });
    ro.observe(el);
    setContainerHeight(el.clientHeight);

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", handleScroll);
    };
  }, [containerRef, handleScroll]);

  return useMemo(() => {
    const totalHeight = items.length * itemHeight;
    const rawStart = Math.floor(scrollTop / itemHeight);
    const rawEnd = Math.ceil((scrollTop + containerHeight) / itemHeight);

    const startIndex = Math.max(0, rawStart - overscan);
    const endIndex = Math.min(items.length, rawEnd + overscan);

    const visibleItems = items.slice(startIndex, endIndex).map((item, i) => ({
      item,
      index: startIndex + i }));

    const offsetTop = startIndex * itemHeight;

    return { visibleItems, totalHeight, offsetTop, startIndex, endIndex };
  }, [items, itemHeight, scrollTop, containerHeight, overscan]);
}

/**
 * Convenience ref hook — creates a typed ref you can pass to the container div.
 */
export const useVirtualListRef = () => useRef<HTMLDivElement>(null);
