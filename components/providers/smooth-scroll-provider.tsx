"use client";

import { type ReactNode, useEffect } from "react";

import type Lenis from "lenis";

let lenis: Lenis | null = null;
async function initLenis() {
  // eslint-disable-next-line unicorn/prefer-global-this
  if (typeof window === "undefined" || globalThis.window.innerWidth < 1024) {
    return;
  }

  const { default: LenisLibrary } = await import("lenis");

  if (lenis) return;

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
}

/**
 * SmoothScrollProvider - Handles Lenis smooth scrolling initialization.
 * @param props - Component props.
 * @param props.children - Child elements to wrap.
 */
export function SmoothScrollProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  useEffect(() => {
    // Skip Lenis entirely on mobile — no init, no RAF loop, no MutationObserver
    // eslint-disable-next-line unicorn/prefer-global-this
    if (typeof window !== "undefined" && globalThis.window.innerWidth < 1024) {
      return;
    }

    void initLenis();

    const observer = new MutationObserver(() => {
      // Radix UI adds data-scroll-locked or pointer-events: none
      // Our custom modals add overflow: hidden
      if (
        document.body.style.overflow === "hidden" ||
        Object.hasOwn(document.body.dataset, "scrollLocked") ||
        document.body.style.pointerEvents === "none"
      ) {
        lenis?.stop();
      } else {
        lenis?.start();
      }
    });

    observer.observe(document.body, {
      attributeFilter: ["style", "data-scroll-locked"],
      attributes: true,
    });

    return () => {
      observer.disconnect();
      lenis?.destroy();
      lenis = null;
    };
  }, []);

  return <>{children}</>;
}
