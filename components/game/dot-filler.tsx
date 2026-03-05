import { cn } from "@/lib/utils";

/**
 * Horizontal dotted filler that stretches to fill remaining space in a flex row.
 * Negative margin cancels the parent's gap so it never forces a line wrap.
 * When no space remains after siblings, it collapses to 0px and becomes invisible.
 */
export function DotFiller({ className }: Readonly<{ className?: string }>) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "-ml-2 flex h-[22px] min-w-0 flex-[1_1_0px] items-center overflow-hidden pl-2",
        className,
      )}
    >
      <span className="w-full border-b border-dotted border-muted-foreground/25" />
    </span>
  );
}
