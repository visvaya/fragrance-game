import { cn } from "@/lib/utils";

type MaskSlotProperties = Readonly<{
  /** Tooltip variant: pass isHovered from GameTooltip render prop. Omit to use group-hover CSS. */
  isHovered?: boolean;
}>;

/**
 * Single masked letter slot — shows a diagonal-stripe background on hover.
 * Used in both pyramid-clues and meta-clues wherever MASK_CHAR is rendered.
 */
export function MaskSlot({ isHovered }: MaskSlotProperties) {
  const innerClass = (() => {
    if (isHovered === undefined) {
      return "text-muted-foreground/40 group-hover:bg-slot-mask-amber group-hover:text-[oklch(0.75_0.15_60)]";
    }
    if (isHovered) {
      return "bg-slot-mask-amber text-[oklch(0.75_0.15_60)]";
    }
    return "text-muted-foreground/40";
  })();

  // The slot mark is drawn with borders rather than the MASK_CHAR glyph: no UI font has
  // that glyph, and fallback fonts place it at different heights on each platform.
  return (
    <div
      aria-hidden="true"
      className="mx-px flex h-5 w-2.5 items-center justify-center"
    >
      <div
        className={cn(
          "flex h-3.5 w-full items-end justify-center rounded-t bg-clip-content px-px transition-all duration-300",
          innerClass,
        )}
      >
        <span className="mb-px block h-1 w-full border-x border-b border-current" />
      </div>
    </div>
  );
}
