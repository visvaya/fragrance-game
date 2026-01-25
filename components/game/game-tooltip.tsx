"use client"

import * as React from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface GameTooltipProps {
    content: React.ReactNode
    children: React.ReactNode
    /**
     * If true, the tooltip logic is disabled and keys are passed through.
     */
    disabled?: boolean
    className?: string
    sideOffset?: number
}

/**
 * GameTooltip - Specialized wrapper for mobile-friendly tooltips.
 * 
 * Features:
 * - Tap to View on Mobile (via onClick toggle)
 * - Accessibility (Focus/Blur support)
 * - Hit Area management (min 44px on mobile via children wrapping)
 * - Design System compliance (Glassmorphism, Animations)
 */
export function GameTooltip({ content, children, disabled = false, className, sideOffset = 1 }: GameTooltipProps) {
    const [open, setOpen] = React.useState(false)

    if (disabled) {
        return <>{children}</>
    }

    return (
        <Tooltip open={open} onOpenChange={setOpen}>
            <TooltipTrigger asChild>
                <div
                    // Use 'div' wrapper to capture events even if child is disabled or prevents propagation
                    // Also acts as Hit Area buffer if needed
                    className={cn("inline-flex cursor-help touch-manipulation", className)}
                    onClick={(e) => {
                        // Mobile Interaction: Tap to toggle
                        // We prevent default to avoid issues with nested buttons if any
                        e.preventDefault()
                        e.stopPropagation()
                        setOpen((prev) => !prev)
                    }}
                    onMouseEnter={() => setOpen(true)}
                    onMouseLeave={() => setOpen(false)}
                    onFocus={() => setOpen(true)}
                    onBlur={() => setOpen(false)}
                    // Ensure it's focusable for keyboard users if the child isn't naturally
                    tabIndex={0}
                    role="button"
                    aria-label="Show info"
                >
                    {children}
                </div>
            </TooltipTrigger>
            <TooltipContent
                sideOffset={sideOffset}
                // Ensure z-index is correct (Dropdown layer)
                className="z-30 text-center pointer-events-none select-none max-w-[200px]"
                // Prevent tooltip from closing on tap inside (if user taps it by mistake)
                onPointerDownOutside={(e) => {
                    // Close on tap outside
                    setOpen(false)
                }}
            >
                {content}
            </TooltipContent>
        </Tooltip>
    )
}
