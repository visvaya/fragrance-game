"use client";

import { GameTooltip } from "./game-tooltip";

type MaskedWordProperties = {
  /**
   * Additional className for the wrapper
   */
  className?: string;
  /**
   * If true, the word is fully hidden (affects opacity)
   */
  isFullyHidden?: boolean;
  /**
   * Tooltip content to display on hover
   */
  tooltipContent?: string;
  /**
   * Word to render, may contain underscore masks (e.g., "R_se")
   */
  word: string;
};

/**
 * MaskedWord - Reusable component for rendering masked words with hover color highlight.
 *
 * Features:
 * - Renders letters and underscore masks
 * - Bursztynowy (amber) color on hover for masks only (odkryte litery bez zmiany koloru)
 * - Optional tooltip integration
 * - Smooth animations
 * @param root0
 * @param root0.word
 * @param root0.tooltipContent
 * @param root0.isFullyHidden
 * @param root0.className
 * @example
 * <MaskedWord word="R_se" tooltipContent="Liczba liter: 4" />
 * <MaskedWord word="?????" tooltipContent="Ukryte w próbie 1" />
 */
export function MaskedWord({
  className = "",
  isFullyHidden = false,
  tooltipContent,
  word,
}: MaskedWordProperties) {
  const hasMasking = word.includes("_");
  const showTooltip = hasMasking && tooltipContent;

  const content = (
    <div className={`flex flex-wrap ${className}`}>
      {word.split("").map((char, index) => {
        const isSlot = char === "_";

        if (isSlot) {
          return (
            <div
              aria-hidden="true"
              className={`mx-[0.5px] h-5 w-2.5 border-b border-muted-foreground/30 transition-all duration-300 ${
                isFullyHidden ? "opacity-50" : "opacity-70"
              }`}
              key={index}
            />
          );
        }

        return (
          <div
            className="mx-[0.5px] flex h-5 w-2.5 items-center justify-center border-b border-transparent font-mono text-sm leading-none text-foreground"
            key={index}
          >
            {char}
          </div>
        );
      })}
    </div>
  );

  if (showTooltip) {
    return (
      <GameTooltip content={tooltipContent}>
        {({ isHovered }: { isHovered?: boolean }) => (
          <div className="flex flex-wrap">
            {word.split("").map((char, index) => {
              const isSlot = char === "_";

              if (isSlot) {
                return (
                  <div
                    aria-hidden="true"
                    className={`mx-[0.5px] h-5 w-2.5 transition-all duration-300 ${
                      isHovered
                        ? "border-b border-[oklch(0.75_0.15_60)]"
                        : `border-b border-muted-foreground/30 ${isFullyHidden ? "opacity-50" : "opacity-70"}`
                    }`}
                    key={index}
                  />
                );
              }

              return (
                <div
                  className="mx-[0.5px] flex h-5 w-2.5 items-center justify-center border-b border-transparent font-mono text-sm leading-none text-foreground"
                  key={index}
                >
                  {char}
                </div>
              );
            })}
          </div>
        )}
      </GameTooltip>
    );
  }

  return content;
}
