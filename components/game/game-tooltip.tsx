"use client";

import * as React from "react";

import { useTranslations } from "next-intl";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type GameTooltipProperties = {
  children:
    | React.ReactNode
    | ((props: { isHovered: boolean }) => React.ReactNode);
  className?: string;
  content: React.ReactNode;
  /**
   * If true, the tooltip logic is disabled and keys are passed through.
   */
  disabled?: boolean;
  /**
   * If true, the tooltip will not open on mobile (touch) tap.
   * Useful for elements that have their own click action (like buttons/links).
   */
  disableOnMobile?: boolean;
  sideOffset?: number;
};

/**
 * GameTooltip - Specialized wrapper for mobile-friendly tooltips.
 *
 * Features:
 * - Tap to View on Mobile (via onClick toggle)
 * - Accessibility (Focus/Blur support)
 * - Hit Area management (min 44px on mobile via children wrapping)
 * - Design System compliance (Glassmorphism, Animations)
 * @param root0
 * @param root0.content
 * @param root0.children
 * @param root0.disabled
 * @param root0.className
 * @param root0.sideOffset
 * @param root0.disableOnMobile
 */
export function GameTooltip({
  children,
  className,
  content,
  disabled = false,
  disableOnMobile = false,
  sideOffset = 1,
}: GameTooltipProperties) {
  const [open, setOpen] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const t = useTranslations("GameTooltip");
  // Ref to track if the interaction is touch-based.
  // This prevents the onFocus handler from overriding the onClick toggle on mobile.
  const isTouchReference = React.useRef(false);

  if (disabled) {
    return <>{children}</>;
  }

  return (
    <Tooltip
      onOpenChange={(newValue) => {
        if (isTouchReference.current) return;
        setOpen(newValue);
      }}
      open={open}
    >
      <TooltipTrigger asChild>
        <div
          aria-label={t("ariaLabel")}
          // Use 'div' wrapper to capture events even if child is disabled or prevents propagation
          // Also acts as Hit Area buffer if needed
          className={cn(
            "inline-flex cursor-help touch-manipulation",
            className,
          )}
          onBlur={() => {
            // Reset touch flag on blur to allow keyboard focus later
            isTouchReference.current = false;
            setOpen(false);
          }}
          onClick={(e) => {
            // If disableOnMobile is true and it's a touch interaction,
            // we do NOT want to toggle the tooltip. We want the event to bubble
            // so the child element (e.g. button) can handle the click.
            if (disableOnMobile && isTouchReference.current) {
              return;
            }

            // Mobile Interaction: Tap to toggle
            // We prevent default to avoid issues with nested buttons if any
            e.preventDefault();
            e.stopPropagation();
            setOpen((previous) => !previous);
          }}
          onFocus={() => {
            if (isTouchReference.current) return;
            setOpen(true);
          }}
          onPointerDown={(e) => {
            if (e.pointerType === "touch") {
              isTouchReference.current = true;
            }
          }}
          onPointerEnter={(e) => {
            if (e.pointerType === "touch") return;
            isTouchReference.current = false;
            setIsHovered(true);
            setOpen(true);
          }}
          onPointerLeave={(e) => {
            if (e.pointerType === "touch") return;
            setIsHovered(false);
            setOpen(false);
          }}
          role="button"
          // Ensure it's focusable for keyboard users if the child isn't naturally
          tabIndex={0}
        >
          {typeof children === "function"
            ? children({
                isHovered: isTouchReference.current ? open : isHovered,
              })
            : children}
        </div>
      </TooltipTrigger>
      <TooltipContent
        // Ensure z-index is correct (Dropdown layer)
        className="pointer-events-none z-30 max-w-[200px] text-center select-none"
        // Prevent tooltip from closing on tap inside (if user taps it by mistake)
        onPointerDownOutside={(e) => {
          // Close on tap outside
          setOpen(false);
        }}
        sideOffset={sideOffset}
      >
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
