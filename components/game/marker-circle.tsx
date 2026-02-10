"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type MarkerCircleProperties = {
  className?: string;
  letter: string;
  title?: string;
};

/**
 *
 * @param root0
 * @param root0.className
 * @param root0.letter
 * @param root0.title
 */
export function MarkerCircle({ className, letter, title }: MarkerCircleProperties) {
  const content = (
    <span
      className={cn(
        "relative inline-flex h-6 w-6 items-center justify-center focus:outline-none",
        className,
      )}
      tabIndex={0}
    >
      {/* SVG hand-drawn circle */}
      <svg
        className="marker-circle absolute inset-0 h-full w-full"
        fill="none"
        viewBox="0 0 24 24"
      >
        <ellipse
          cx="12"
          cy="12"
          rx="10"
          ry="9"
          stroke="var(--success)"
          strokeDasharray="100"
          strokeDashoffset="0"
          strokeLinecap="round"
          strokeWidth="2"
          style={{
            filter: "url(#roughen)",
          }}
          transform="rotate(-5 12 12)"
        />
        <defs>
          <filter id="roughen">
            <feTurbulence
              baseFrequency="0.05"
              numOctaves="2"
              result="noise"
              type="turbulence"
            />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="1" />
          </filter>
        </defs>
      </svg>

      {/* Letter */}
      <span className="relative z-10 text-[10px] font-medium text-success dark:text-success">
        {letter}
      </span>
    </span>
  );

  if (!title) return content;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  );
}
