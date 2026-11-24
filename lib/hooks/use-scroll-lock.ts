// eslint-disable-next-line no-restricted-imports -- DOM_SYNC: locks and restores the document scroll
import { useEffect } from "react";

/**
 * Stops the page behind a modal from scrolling while `active`; restores the previous values after.
 * Locks `<html>`, which globals.css makes the scroll container, and `<body>` like the Radix dialogs
 * do, so the smooth scroll provider sees the lock and pauses Lenis, which would otherwise keep
 * scrolling the page on wheel input.
 */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const elements = [document.documentElement, document.body];
    const previous = elements.map((element) => element.style.overflow);
    for (const element of elements) {
      // eslint-disable-next-line fp/no-mutation -- DOM style assignment, no immutable API available
      element.style.overflow = "hidden";
    }
    return () => {
      for (const [index, element] of elements.entries()) {
        // eslint-disable-next-line fp/no-mutation -- restores the value saved above
        element.style.overflow = previous[index] ?? "";
      }
    };
  }, [active]);
}
