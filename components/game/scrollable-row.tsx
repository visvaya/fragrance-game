"use client";

import {
  edgeMaskClass,
  OVERFLOW_MASKS,
  useIsOverflowing,
} from "@/hooks/use-is-overflowing";
import { cn } from "@/lib/utils";

/**
 * Wrapper component that applies dynamic gradient masks when its content overflows horizontally.
 */
export function ScrollableRow({
  children,
  className,
}: Readonly<{
  children: React.ReactNode;
  className?: string;
}>) {
  const { canScrollLeft, canScrollRight, ref } =
    useIsOverflowing<HTMLDivElement>();

  const maskClass = edgeMaskClass(
    OVERFLOW_MASKS,
    canScrollLeft,
    canScrollRight,
  );

  return (
    <div
      className={cn(
        "[scrollbar-width:none] overflow-x-auto [&::-webkit-scrollbar]:hidden",
        maskClass,
        className,
      )}
      ref={ref}
    >
      {children}
    </div>
  );
}
