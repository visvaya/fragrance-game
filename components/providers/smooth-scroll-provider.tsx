"use client";

import { type ReactNode, useEffect } from "react";

import Lenis from "lenis";

/**
 *
 * @param root0
 * @param root0.children
 */
export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Disable Lenis on mobile/tablet to allow native scrolling to handle 
    // sticky elements and browser UI bars correctly.
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      return;
    }

    const lenis = new Lenis({
      gestureOrientation: "vertical",
      lerp: 0.08,
      orientation: "vertical",
      smoothWheel: true,
      touchMultiplier: 1.5,
      wheelMultiplier: 0.8,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
