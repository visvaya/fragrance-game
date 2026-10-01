"use client";

import type { ComponentProps } from "react";

import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "@/lib/utils";

/**
 * Popover root: owns the open state; non-modal by default.
 * @param root0 - Radix Popover.Root props.
 */
function Popover({ ...props }: ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

/**
 * Element that toggles the popover and receives focus back when it closes.
 * @param root0 - Radix Popover.Trigger props.
 */
function PopoverTrigger({
  ...props
}: ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

/**
 * Portalled panel anchored to the trigger, kept inside the viewport.
 * @param root0 - Radix Popover.Content props.
 * @param root0.className - Extra classes merged over the glass panel style.
 * @param root0.sideOffset - Gap between trigger and panel in px.
 * @param root0.collisionPadding - Minimum distance from the viewport edge in px.
 */
function PopoverContent({
  className,
  collisionPadding = 16,
  sideOffset = 6,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  const popoverClassName = cn(
    // Opaque, unlike the glass tooltip: popovers hold text meant for sustained reading.
    "z-50 rounded-md border border-border/50 bg-background px-4 py-3 text-sm text-foreground shadow-xl duration-300 animate-in outline-none fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
    className,
  );
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        className={popoverClassName}
        collisionPadding={collisionPadding}
        data-slot="popover-content"
        sideOffset={sideOffset}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverContent, PopoverTrigger };
