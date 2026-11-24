"use client";

// eslint-disable-next-line no-restricted-imports -- custom hook encapsulating ResizeObserver logic
import { useState, useEffect, useRef } from "react";

/** Mask classes for each scrollable side; literal strings, so Tailwind generates them. */
export type EdgeMasks = Readonly<{ both: string; left: string; right: string }>;

/** 20px fade. */
export const OVERFLOW_MASKS: EdgeMasks = {
  both: "[mask-image:linear-gradient(to_right,transparent_0,black_20px,black_calc(100%-20px),transparent_100%)]",
  left: "[mask-image:linear-gradient(to_right,transparent_0,black_20px,black_100%)]",
  right:
    "[mask-image:linear-gradient(to_right,black_calc(100%-20px),transparent_100%)]",
};

/** 15% fade. */
export const SCROLL_FADE_MASKS: EdgeMasks = {
  both: "[mask-image:linear-gradient(to_right,transparent_0%,black_15%,black_85%,transparent_100%)]",
  left: "[mask-image:linear-gradient(to_right,transparent_0%,black_15%,black_100%)]",
  right: "[mask-image:linear-gradient(to_right,black_85%,transparent_100%)]",
};

/**
 * Gradient mask fading the edges of a row that can still scroll in that direction.
 * @param masks - Classes of one fade width, e.g. `OVERFLOW_MASKS`.
 * @param canScrollLeft - Content is hidden on the left.
 * @param canScrollRight - Content is hidden on the right.
 */
export function edgeMaskClass(
  masks: EdgeMasks,
  canScrollLeft: boolean,
  canScrollRight: boolean,
): string {
  if (canScrollLeft && canScrollRight) return masks.both;
  if (canScrollLeft) return masks.left;
  if (canScrollRight) return masks.right;
  return "";
}

/**
 * Zwraca informację, czy element zaczął ulegać nałożeniu overflow (np. tekst uciekający poza diva)
 * Monitoruje ResizeObserver i MutationObserver oraz zdarzenie 'scroll'.
 */
export function useIsOverflowing<T extends HTMLElement>() {
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const checkOverflow = () => {
      // 1px threshold for screen scaling rounding errors
      setCanScrollLeft(element.scrollLeft > 1);
      setCanScrollRight(
        Math.ceil(element.scrollLeft + element.clientWidth) <
          element.scrollWidth - 1,
      );
    };

    checkOverflow();

    element.addEventListener("scroll", checkOverflow, { passive: true });

    const resizeObserver =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(checkOverflow)
        : undefined;

    if (resizeObserver) {
      resizeObserver.observe(element);
    }

    const mutationObserver =
      typeof MutationObserver === "function"
        ? new MutationObserver(checkOverflow)
        : undefined;

    if (mutationObserver) {
      mutationObserver.observe(element, {
        characterData: true,
        childList: true,
        subtree: true,
      });
    }

    return () => {
      element.removeEventListener("scroll", checkOverflow);
      if (resizeObserver) resizeObserver.disconnect();
      if (mutationObserver) mutationObserver.disconnect();
    };
  }, []);

  return {
    canScrollLeft,
    canScrollRight,
    isOverflowing: canScrollLeft || canScrollRight,
    ref,
  };
}
