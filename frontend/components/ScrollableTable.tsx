"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { shouldShowScrollHint } from "./overflow";

type ScrollableTableProps = {
  label: string;
  /** Named for screen readers so the hint says what is actually offscreen. */
  offscreenColumns: string;
  children: ReactNode;
};

export function ScrollableTable({ label, offscreenColumns, children }: ScrollableTableProps) {
  const regionRef = useRef<HTMLDivElement>(null);
  const [showHint, setShowHint] = useState(false);
  const hintId = `${useId()}-scroll-hint`;

  const sync = useCallback(() => {
    const node = regionRef.current;
    if (!node) return;
    setShowHint(
      shouldShowScrollHint({
        scrollLeft: node.scrollLeft,
        scrollWidth: node.scrollWidth,
        clientWidth: node.clientWidth,
      }),
    );
  }, []);

  useEffect(() => {
    const node = regionRef.current;
    if (!node) return;

    sync();
    node.addEventListener("scroll", sync, { passive: true });

    const observer = new ResizeObserver(sync);
    observer.observe(node);
    const table = node.firstElementChild;
    if (table) observer.observe(table);

    return () => {
      node.removeEventListener("scroll", sync);
      observer.disconnect();
    };
  }, [sync]);

  return (
    <>
      {showHint && (
        <p className="table-scroll-hint" id={hintId}>
          Scroll horizontally to view all columns.
          <span className="sr-only"> Offscreen columns include {offscreenColumns}.</span>
        </p>
      )}
      <div
        className="table-scroll"
        ref={regionRef}
        role="region"
        aria-label={label}
        aria-describedby={showHint ? hintId : undefined}
        tabIndex={0}
      >
        {children}
      </div>
    </>
  );
}
