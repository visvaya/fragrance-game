// eslint-disable-next-line no-restricted-imports -- DOM_SYNC: locks and restores the document scroll
import { useEffect } from "react";

/**
 * Stops the page behind a modal from scrolling while `active`; restores the previous value after.
 * Locks `<body>` like the Radix dialogs do, so the smooth scroll provider sees the lock and pauses
 * Lenis, which would otherwise keep scrolling the page on wheel input.
 */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const root = document.body;
    const previous = root.style.overflow;
    // eslint-disable-next-line fp/no-mutation -- DOM style assignment, no immutable API available
    root.style.overflow = "hidden";
    return () => {
      // eslint-disable-next-line fp/no-mutation -- restores the value saved above
      root.style.overflow = previous;
    };
  }, [active]);
}
