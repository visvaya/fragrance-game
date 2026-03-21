"use client";

import { useIsOverflowing } from "@/hooks/use-is-overflowing";
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

  const maskClass = (() => {
    if (canScrollLeft && canScrollRight) {
      return "[mask-image:linear-gradient(to_right,transparent_0,black_20px,black_calc(100%-20px),transparent_100%)]";
    }
    if (canScrollLeft) {
      return "[mask-image:linear-gradient(to_right,transparent_0,black_20px,black_100%)]";
    }
    if (canScrollRight) {
      return "[mask-image:linear-gradient(to_right,black_calc(100%-20px),transparent_100%)]";
    }
    return "";
  })();

  return (
    <div
      className={cn(
        "overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        maskClass,
        className,
      )}
      ref={ref}
    >
      {children}
    </div>
  );
}
