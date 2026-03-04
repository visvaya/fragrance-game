import { cn } from "@/lib/utils";

/**
 * Horizontal dotted filler that stretches to fill remaining space in a flex row.
 * Use inside a `flex flex-wrap items-center` container.
 */
export function DotFiller({ className }: Readonly<{ className?: string }>) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-[22px] min-w-[1rem] flex-1 items-center pl-2",
        className,
      )}
    >
      <span className="w-full border-b border-dotted border-muted-foreground/25" />
    </span>
  );
}
