"use client";

import { MASK_CHAR } from "@/lib/constants";
import { cn } from "@/lib/utils";

import { MaskSlot } from "./mask-slot";

type MaskedWordProperties = Readonly<{
  /**
   * When true, revealed characters also change colour on hover (meta-clues tooltips).
   * Defaults to false (pyramid-clues and non-tooltip contexts).
   */
  hoverColorChars?: boolean;
  /**
   * Hover state passed from a GameTooltip render prop.
   * When provided, MaskSlots receive it for their styling.
   */
  isHovered?: boolean;
  /**
   * Unique prefix used to generate stable React keys across multiple MaskedWord instances.
   */
  keyPrefix: string;
  /**
   * Word string that may contain MASK_CHAR characters to render as slots.
   */
  word: string;
}>;

function getCharClass(isHovered: boolean | undefined, hoverColorChars: boolean): string {
  if (!hoverColorChars || isHovered == null) return "text-foreground";
  if (isHovered) return "text-[oklch(0.75_0.15_60)]";
  return "text-foreground";
}

/**
 * Renders a partially-masked word character by character.
 * MASK_CHAR characters become MaskSlot elements; others render inline.
 */
export function MaskedWord({
  hoverColorChars = false,
  isHovered,
  keyPrefix,
  word,
}: MaskedWordProperties): React.ReactNode[] {
  // eslint-disable-next-line unicorn/prefer-spread -- split("") vs [...str] conflicts with no-misused-spread
  return word.split("").map((char, index) => {
    if (char === MASK_CHAR) {
      return (
        <MaskSlot
          char={char}
          isHovered={isHovered}
          key={`${keyPrefix}-slot-${index}`}
        />
      );
    }

    return (
      <div
        className={cn(
          "mx-px flex h-5 w-2 items-center justify-center border-b border-transparent font-mono text-sm leading-none transition-colors duration-300",
          getCharClass(isHovered, hoverColorChars),
        )}
        key={`${keyPrefix}-char-${index}`}
      >
        <span className="inline-block translate-y-px">{char}</span>
      </div>
    );
  });
}
