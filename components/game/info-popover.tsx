"use client";

import type { ReactNode } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type InfoPopoverProperties = Readonly<{
  /** Visible label; becomes the text of the trigger button. */
  children: ReactNode;
  /** Classes for the trigger button (it inherits the surrounding typography). */
  className?: string;
  /** Explanation shown in the panel. */
  content: ReactNode;
}>;

/**
 * Tap-or-click explanation for a label, for text too long to read in a tooltip.
 *
 * Unlike GameTooltip it opens on press only (not hover), stays open while the user
 * reads, and closes with Escape, an outside tap or a second press. Place it inside
 * the heading it explains so the heading keeps its semantics.
 */
export function InfoPopover({
  children,
  className,
  content,
}: InfoPopoverProperties) {
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "cursor-help rounded-sm text-left [text-transform:inherit] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          className,
        )}
        type="button"
      >
        {children}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="z-[60] w-[min(20rem,calc(100vw-2rem))] leading-relaxed"
      >
        {content}
      </PopoverContent>
    </Popover>
  );
}
