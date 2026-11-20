"use client";

// eslint-disable-next-line no-restricted-imports -- DOM_SYNC: ResizeObserver re-attaches when the bar mounts again
import { useEffect, useRef, useState } from "react";

// Spare width so the attempt counter, skip button and score never touch.
const STACK_BUFFER_PX = 8;

/**
 * Decides whether the status bar under the guess input must stack its items vertically,
 * by comparing the bar's width with an invisible one-row copy of its content.
 * The bar unmounts while a reset shows the skeleton, so the observer re-attaches whenever
 * `visible` turns true again; a detached bar measures 0 and keeps the last layout.
 * @param visible - Whether the status bar is rendered.
 * @returns Refs for the bar container and the measuring copy, and the stacking flag.
 */
export function useStatusBarStack(visible: boolean) {
  const [needsStack, setNeedsStack] = useState(false);
  const containerReference = useRef<HTMLDivElement>(null);
  const measureReference = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerReference.current;
    const measure = measureReference.current;
    if (!visible || !container || !measure) return;

    const observer = new ResizeObserver(() => {
      const containerWidth = container.clientWidth;
      if (containerWidth === 0) return;
      setNeedsStack(containerWidth < measure.scrollWidth + STACK_BUFFER_PX);
    });

    observer.observe(container);
    observer.observe(measure);

    return () => observer.disconnect();
  }, [visible]);

  return { containerReference, measureReference, needsStack };
}
