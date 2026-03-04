import { cn } from "@/lib/utils";

type MaskSlotProperties = Readonly<{
  char: string;
  /** Tooltip variant: pass isHovered from GameTooltip render prop. Omit to use group-hover CSS. */
  isHovered?: boolean;
}>;

/**
 * Single masked letter slot — shows a diagonal-stripe background on hover.
 * Used in both pyramid-clues and meta-clues wherever MASK_CHAR is rendered.
 */
export function MaskSlot({ char, isHovered }: MaskSlotProperties) {
  let innerClass = "text-muted-foreground/40";
  if (isHovered === undefined) {
    innerClass =
      "text-muted-foreground/40 group-hover:bg-slot-mask-amber group-hover:text-[oklch(0.75_0.15_60)]";
  } else if (isHovered) {
    innerClass = "bg-slot-mask-amber text-[oklch(0.75_0.15_60)]";
  }

  return (
    <div
      aria-hidden="true"
      className="mx-px flex h-5 w-2 items-center justify-center"
    >
      <div
        className={cn(
          "flex h-3.5 w-full items-center justify-center rounded-t bg-clip-content pb-px font-mono text-sm leading-none transition-all duration-300",
          innerClass,
        )}
      >
        <span className="inline-block">{char}</span>
      </div>
    </div>
  );
}
