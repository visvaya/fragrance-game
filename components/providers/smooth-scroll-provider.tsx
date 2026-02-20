"use client";

import { type ReactNode, useEffect } from "react";

/**
 *
 * @param root0
 * @param root0.children
 */
export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Disable Lenis on mobile/tablet to allow native scrolling to handle
    // sticky elements and browser UI bars correctly.
    if (globalThis.window !== undefined && window.innerWidth < 1024) {
      return;
    }

    let lenis: any;

    const initLenis = async () => {
      const { default: LenisLibrary } = await import("lenis");

      lenis = new LenisLibrary({
        gestureOrientation: "vertical",
        lerp: 0.08,
        orientation: "vertical",
        smoothWheel: true,
        touchMultiplier: 1.5,
        wheelMultiplier: 0.8,
      });

      function raf(time: number) {
        lenis?.raf(time);
        requestAnimationFrame(raf);
      }

      requestAnimationFrame(raf);
    };

    initLenis();

    return () => {
      lenis?.destroy();
    };
  }, []);

  return <>{children}</>;
}
