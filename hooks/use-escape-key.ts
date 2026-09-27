"use client";

// eslint-disable-next-line no-restricted-imports -- SUBSCRIPTION: document keydown listener, re-subscribed when `active` or the handler changes
import { useEffect } from "react";

/**
 * Calls `onEscape` when the Escape key is pressed anywhere in the document,
 * but only while `active` is true. Use it to close menus and popovers from
 * the keyboard regardless of which element currently has focus.
 */
export function useEscapeKey(active: boolean, onEscape: () => void): void {
  useEffect(() => {
    if (!active) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onEscape();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [active, onEscape]);
}
