"use client";

import { useRef } from "react";

import { useMountEffect } from "@/lib/hooks/use-mount-effect";

/**
 * iOS Safari scrolls the page to keep a focused input above the on-screen keyboard and does
 * not scroll back when the keyboard closes. With the guess input stuck to the bottom of the
 * screen, every focus pushed the page further down. The returned handlers put the scroll
 * position back on blur, unless the player scrolled the page while typing.
 * @returns Focus and blur handlers for the input.
 */
export function useKeyboardScrollRestore(): {
  onBlur: () => void;
  onFocus: () => void;
} {
  const scrollBeforeFocus = useRef<number | null>(null);
  const scrolledByPlayer = useRef(false);

  useMountEffect(() => {
    const handleTouchMove = () => {
      if (scrollBeforeFocus.current !== null) {
        scrolledByPlayer.current = true;
      }
    };
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    return () => {
      document.removeEventListener("touchmove", handleTouchMove);
    };
  });

  return {
    onBlur: () => {
      const top = scrollBeforeFocus.current;
      scrollBeforeFocus.current = null;
      if (top === null || scrolledByPlayer.current) return;
      globalThis.scrollTo({ behavior: "instant", top });
    },
    onFocus: () => {
      scrollBeforeFocus.current = globalThis.scrollY;
      scrolledByPlayer.current = false;
    },
  };
}
