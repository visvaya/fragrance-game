"use client";

// eslint-disable-next-line no-restricted-imports -- custom hook encapsulating ResizeObserver logic
import { useState, useEffect, useRef } from "react";

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

/**
 * Tailwind mask class that fades the scrollable row edge(s) with hidden content (15% fade).
 */
export function scrollFadeMaskClass(
  canScrollLeft: boolean,
  canScrollRight: boolean,
) {
  if (canScrollLeft && canScrollRight) {
    return "[mask-image:linear-gradient(to_right,transparent_0%,black_15%,black_85%,transparent_100%)]";
  }
  if (canScrollLeft) {
    return "[mask-image:linear-gradient(to_right,transparent_0%,black_15%,black_100%)]";
  }
  if (canScrollRight) {
    return "[mask-image:linear-gradient(to_right,black_85%,transparent_100%)]";
  }
  return "";
}
