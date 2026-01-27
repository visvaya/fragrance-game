"use client"

import * as React from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import { useTranslations } from "next-intl"

interface GameTooltipProps {
    content: React.ReactNode
    children: React.ReactNode
    /**
     * If true, the tooltip logic is disabled and keys are passed through.
     */
    disabled?: boolean
    className?: string
    sideOffset?: number
    /**
     * If true, the tooltip will not open on mobile (touch) tap.
     * Useful for elements that have their own click action (like buttons/links).
     */
    disableOnMobile?: boolean
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
export function GameTooltip({ content, children, disabled = false, className, sideOffset = 1, disableOnMobile = false }: GameTooltipProps) {
    const [open, setOpen] = React.useState(false)
    const t = useTranslations('GameTooltip')
    // Ref to track if the interaction is touch-based.
    // This prevents the onFocus handler from overriding the onClick toggle on mobile.
    const isTouchRef = React.useRef(false)

    if (disabled) {
        return <>{children}</>
    }

    return (
        <Tooltip
            open={open}
            onOpenChange={(newValue) => {
                if (isTouchRef.current) return
                setOpen(newValue)
            }}
        >
            <TooltipTrigger asChild>
                <div
                    // Use 'div' wrapper to capture events even if child is disabled or prevents propagation
                    // Also acts as Hit Area buffer if needed
                    className={cn("inline-flex cursor-help touch-manipulation", className)}
                    onClick={(e) => {
                        // If disableOnMobile is true and it's a touch interaction,
                        // we do NOT want to toggle the tooltip. We want the event to bubble
                        // so the child element (e.g. button) can handle the click.
                        if (disableOnMobile && isTouchRef.current) {
                            return
                        }

                        // Mobile Interaction: Tap to toggle
                        // We prevent default to avoid issues with nested buttons if any
                        e.preventDefault()
                        e.stopPropagation()
                        setOpen((prev) => !prev)
                    }}
                    onPointerDown={(e) => {
                        if (e.pointerType === 'touch') {
                            isTouchRef.current = true
                        }
                    }}
                    onPointerEnter={(e) => {
                        if (e.pointerType === 'touch') return
                        isTouchRef.current = false
                        setOpen(true)
                    }}
                    onPointerLeave={(e) => {
                        if (e.pointerType === 'touch') return
                        setOpen(false)
                    }}
                    onFocus={() => {
                        if (isTouchRef.current) return
                        setOpen(true)
                    }}
                    onBlur={() => {
                        // Reset touch flag on blur to allow keyboard focus later
                        isTouchRef.current = false
                        setOpen(false)
                    }}
                    // Ensure it's focusable for keyboard users if the child isn't naturally
                    tabIndex={0}
                    role="button"
                    aria-label={t('ariaLabel')}
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
