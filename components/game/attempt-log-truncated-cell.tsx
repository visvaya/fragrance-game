"use client";

// eslint-disable-next-line no-restricted-imports -- dom read: checks truncation overflow + debounced resize listener
import { useRef, useState, useEffect } from "react";

import { cn } from "@/lib/utils";

import { GameTooltip } from "./game-tooltip";

/**
 * Component that truncates text with a tooltip if it overflows.
 * @param props - Component properties.
 * @param props.children - Optional element content (overrides content prop).
 * @param props.className - Container class name.
 * @param props.content - Text content to display and show in tooltip.
 * @param props.textClassName - Inner text class name.
 */
export function TruncatedCell({
  children,
  className,
  content,
  textClassName = "font-medium text-foreground text-sm line-clamp-1 break-words max-w-full tracking-normal",
}: Readonly<{
  children?: React.ReactNode;
  className?: string;
  content: string;
  textClassName?: string;
}>) {
  const ref = useRef<HTMLDivElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  // Use IntersectionObserver for more efficient truncation detection
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Check truncation only once after mount and on resize (debounced)
    const checkTruncation = () => {
      const hasHorizontalOverflow = element.scrollWidth > element.offsetWidth;
      const hasVerticalOverflow = element.scrollHeight > element.clientHeight;
      setIsTruncated(hasHorizontalOverflow || hasVerticalOverflow);
    };

    // Initial check with slight delay to ensure layout is complete
    const timeoutId = setTimeout(checkTruncation, 0);

    // Debounced resize handler
    let resizeTimeoutId: NodeJS.Timeout | null = null;
    const handleResize = () => {
      if (resizeTimeoutId) clearTimeout(resizeTimeoutId);
      // eslint-disable-next-line fp/no-mutation -- necessary for timeout management
      resizeTimeoutId = globalThis.setTimeout(checkTruncation, 150);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      clearTimeout(timeoutId);
      if (resizeTimeoutId) clearTimeout(resizeTimeoutId);
      window.removeEventListener("resize", handleResize);
    };
  }, [content, children]);

  const inner = (
    <div className={cn(textClassName, "max-w-full")} ref={ref}>
      {children ?? content}
    </div>
  );

  if (isTruncated) {
    return (
      <GameTooltip className={className} content={content}>
        {inner}
      </GameTooltip>
    );
  }

  return <div className={className}>{inner}</div>;
}
