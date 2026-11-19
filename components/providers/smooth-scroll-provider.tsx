"use client";

import type { ReactNode } from "react";

import type Lenis from "lenis";

import { useMountEffect } from "@/lib/hooks/use-mount-effect";

/** Narrowest viewport that gets smooth scrolling; phones keep native scrolling. */
const SMOOTH_SCROLL_MIN_WIDTH_PX = 1024;

const instance: { current: Lenis | null } = { current: null };

/**
 * Scroll to a target position using Lenis on desktop (avoids rAF conflicts),
 * or native window.scrollTo where Lenis is not running.
 */
export function lenisScrollTo(
  target: number,
  options?: { behavior?: ScrollBehavior },
): void {
  if (instance.current) {
    instance.current.scrollTo(target);
  } else {
    globalThis.scrollTo({
      behavior: options?.behavior ?? "smooth",
      top: target,
    });
  }
}

/** Smooth scrolling only on wide viewports and only when the user has not asked for less motion. */
function wantsSmoothScroll(): boolean {
  return (
    globalThis.innerWidth >= SMOOTH_SCROLL_MIN_WIDTH_PX &&
    !globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Pauses Lenis while a modal or Radix overlay locks the page scroll. */
function syncWithScrollLock(lenis: Lenis): MutationObserver {
  const observer = new MutationObserver(() => {
    const { dataset, style } = document.body;
    if (
      style.overflow === "hidden" ||
      Object.hasOwn(dataset, "scrollLocked") ||
      style.pointerEvents === "none"
    ) {
      lenis.stop();
    } else {
      lenis.start();
    }
  });
  observer.observe(document.body, {
    attributeFilter: ["style", "data-scroll-locked"],
    attributes: true,
  });
  return observer;
}

/**
 * SmoothScrollProvider - starts Lenis smooth scrolling on desktop. The library is loaded
 * with a dynamic import, so phones never download it.
 * @param props - Component props.
 * @param props.children - Child elements to wrap.
 */
export function SmoothScrollProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  useMountEffect(() => {
    if (!wantsSmoothScroll()) {
      return;
    }

    const unmounted = { current: false };
    const frame = { current: 0 };
    const observer: { current: MutationObserver | null } = { current: null };

    const start = async () => {
      const { default: LenisClass } = await import("lenis");
      if (unmounted.current) return;
      const lenis = new LenisClass({
        gestureOrientation: "vertical",
        lerp: 0.08,
        orientation: "vertical",
        smoothWheel: true,
        touchMultiplier: 1.5,
        wheelMultiplier: 0.8,
      });
      instance.current = lenis;
      observer.current = syncWithScrollLock(lenis);

      const loop = (time: number) => {
        lenis.raf(time);
        frame.current = requestAnimationFrame(loop);
      };
      frame.current = requestAnimationFrame(loop);
    };

    start().catch(() => {
      // A failed chunk load leaves native scrolling in place, which is the phone behaviour
      // anyway; nothing else depends on Lenis being present.
    });

    return () => {
      unmounted.current = true;
      cancelAnimationFrame(frame.current);
      observer.current?.disconnect();
      instance.current?.destroy();
      instance.current = null;
    };
  });

  return <>{children}</>;
}
