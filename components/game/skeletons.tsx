import type { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { DotFiller } from "./dot-filler";

/** Label above a single clue badge placeholder, shared by the meta clue rows. */
function ClueFieldSkeleton({
  className,
  label,
}: Readonly<{ className?: string; label: string }>) {
  return (
    <div className={cn("flex flex-col items-start gap-0.5", className)}>
      <span className="w-full text-xs font-semibold tracking-widest text-muted-foreground/70 lowercase">
        {label}
      </span>
      <div className="flex w-full flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-[1_1_auto] items-center gap-2">
          <Skeleton className="h-7 w-9 rounded-md" />
          <DotFiller className="pr-2" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for the image square itself (used inside RevealImage).
 */
export function RevealImageSquareSkeleton() {
  const imageSize = "w-[15rem] large-text:w-[17.5rem]";

  return (
    <div
      className={cn(
        "relative aspect-square overflow-hidden rounded-md",
        imageSize,
      )}
    >
      <Skeleton className="size-full rounded-md" />
      {/* Corner accents copied 1:1 from real component */}
      <div className="pointer-events-none absolute top-2 left-2 size-4 border-t-2 border-l-2 border-foreground/10" />
      <div className="pointer-events-none absolute top-2 right-2 size-4 border-t-2 border-r-2 border-foreground/10" />
      <div className="pointer-events-none absolute bottom-2 left-2 size-4 border-b-2 border-l-2 border-foreground/10" />
      <div className="pointer-events-none absolute right-2 bottom-2 size-4 border-r-2 border-b-2 border-foreground/10" />
    </div>
  );
}

/**
 * Skeleton for the MetaClues section (brand, perfumer, year, and gender information).
 * @param props - Component properties.
 * @param props.t - Translation function.
 */
export function MetaCluesSkeleton({
  t,
}: Readonly<{ t: ReturnType<typeof useTranslations<"MetaClues">> }>) {
  return (
    <div className="flex h-full flex-col p-0">
      {/* Title row – matches real MetaClues title structure */}
      <div className="mb-2 flex w-fit cursor-default items-center">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-4 rounded bg-muted/30" />
          <h2 className="font-[family-name:var(--font-playfair)] text-base tracking-wide text-foreground lowercase opacity-40">
            {t("identity")}
          </h2>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-5">
        {/* Brand row – same structure as real: label + flex wrapper with badge + DotFiller */}
        <ClueFieldSkeleton className="w-full" label={t("brand")} />

        {/* Perfumer row */}
        <ClueFieldSkeleton className="w-full" label={t("perfumer")} />

        {/* Year + Gender – 2-column grid, same as real component */}
        <div className="grid grid-cols-2 gap-4">
          <ClueFieldSkeleton label={t("year")} />
          <ClueFieldSkeleton label={t("gender")} />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for the PyramidClues section (top, heart, and base notes).
 * @param props - Component properties.
 * @param props.t - Translation function.
 */
export function PyramidCluesSkeleton({
  t,
}: Readonly<{ t: ReturnType<typeof useTranslations<"PyramidClues">> }>) {
  const skeletonLevels = [
    { count: 3, label: t("top") },
    { count: 3, label: t("heart") },
    { count: 3, label: t("base") },
  ];

  return (
    <div className="panel-standard">
      {/* Title row */}
      <div className="mb-2 flex w-fit cursor-default items-center">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-4 rounded bg-muted/30" />
          <h2 className="font-[family-name:var(--font-playfair)] text-base text-foreground lowercase opacity-40">
            {t("pyramid")}
          </h2>
        </div>
      </div>

      <ul className="flex flex-col">
        {skeletonLevels.map((level) => (
          <li
            className="flex flex-col gap-2 border-b border-border/60 py-4 first:pt-0 last:border-b-0 last:pb-0"
            key={level.label}
          >
            {/* Level header: neutral dot + label – matches real level row structure */}
            <div className="flex items-center gap-2">
              <span className="size-2 shrink-0 rounded-full bg-muted-foreground/30" />
              <span className="text-xs font-semibold tracking-widest text-muted-foreground/70 lowercase">
                {level.label}
              </span>
            </div>

            {/*
              Badges row – mirrors real layout exactly:
              - non-last badges are plain
              - last badge is wrapped in flex-[1_1_0px] with DotFiller
            */}
            <div className="flex flex-wrap items-center gap-1.5">
              {Array.from({ length: level.count - 1 }).map((_, i) => (
                <Skeleton
                  className="h-7 w-9 rounded-md"
                  // eslint-disable-next-line react/no-array-index-key
                  key={`skel-${level.label}-${i}`}
                />
              ))}
              <div className="flex min-w-0 flex-[1_1_auto] items-center gap-2">
                <Skeleton
                  className="h-7 w-9 rounded-md"
                  key={`skel-${level.label}-last`}
                />
                <DotFiller className="pr-2" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Skeleton for the AttemptLog section (log of made attempts).
 * @param props - Component properties.
 * @param props.t - Translation function.
 */
export function AttemptLogSkeleton({
  t,
}: Readonly<{ t: ReturnType<typeof useTranslations<"AttemptLog">> }>) {
  return (
    <section className="panel-standard">
      {/* Title row – matches real AttemptLog title structure */}
      <div className="mb-1 flex w-fit cursor-default items-center">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-4 rounded bg-muted/30" />
          <h2 className="font-[family-name:var(--font-playfair)] text-base text-foreground lowercase opacity-40">
            {t("title")}
          </h2>
        </div>
      </div>

      {/* Table – same grid as real: 1.5rem/2rem | 1fr | minmax(105px,auto) */}
      <div className="-mb-3 grid grid-cols-[2rem_1fr_minmax(7rem,auto)]">
        {/* Header: "#" column – real has size-8 GameTooltip placeholder, we replicate 32px height */}
        <div className="flex items-center justify-center border-b-2 border-muted/50 pb-[0.1875rem] text-[0.8125rem] font-semibold tracking-widest text-muted-foreground/70 lowercase">
          <span className="w-full text-center underline decoration-muted-foreground/30 decoration-dotted underline-offset-2 opacity-40">
            {t("columns.attempt")}
          </span>
        </div>

        {/* Header: "perfume" column */}
        <div className="flex items-center border-b-2 border-muted/50 pb-[0.1875rem] pl-1 text-[0.8125rem] font-semibold tracking-widest text-muted-foreground/70 lowercase opacity-40 sm:pl-2">
          {t("columns.perfume")}
        </div>

        {/* Header: 5 attribute columns – neutral squares instead of icons */}
        <div className="grid w-full grid-cols-5 justify-items-center border-b-2 border-muted/50 pr-1.5 pb-2 pl-0 sm:pr-2 sm:pl-1">
          {["brand", "perfumer", "year", "gender", "notes"].map((col) => (
            <div className="flex size-8 items-center justify-center" key={col}>
              <div className="size-4 rounded bg-muted/40 opacity-40" />
            </div>
          ))}
        </div>

        {/* 6 empty content rows – identical classes to real empty rows */}
        {[1, 2, 3, 4, 5, 6].map((rowNumber, index) => (
          <div className="contents" key={rowNumber}>
            <div
              className={`flex min-h-[4rem] items-center justify-center py-3 ${index < 5 ? "border-b border-muted/30" : ""}`}
            >
              <span className="block w-full text-center text-[0.8125rem] font-normal text-muted-foreground opacity-30 sm:pr-1">
                {rowNumber}
              </span>
            </div>
            <div
              className={`min-h-[4rem] px-1 py-3 sm:px-2 ${index < 5 ? "border-b border-muted/30" : ""}`}
            >
              <span className="text-sm font-medium text-muted-foreground opacity-30">
                ...
              </span>
            </div>
            <div
              className={`min-h-[4rem] py-3 ${index < 5 ? "border-b border-muted/30" : ""}`}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Skeleton for the game input field (GameInput).
 */
export function GameInputSkeleton() {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-30 mx-auto w-full max-w-2xl will-change-transform wide:max-w-xl",
      )}
    >
      <div className="relative z-20 border-x-0 border-t panel-border bg-background/70 px-5 pt-1.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] panel-shadow backdrop-blur-md sm:rounded-t-md sm:border-x">
        {/* Input field skeleton */}
        <div className="relative">
          <div className="w-full border-b-2 border-border pt-2 pb-1 pl-1">
            <div className="h-7 w-48 animate-pulse rounded bg-muted/30" />
          </div>
          {/* Search icon placeholder */}
          <div className="pointer-events-none absolute top-[calc(50%+1px)] right-0.5 flex size-8 -translate-y-1/2 items-center justify-center">
            <div className="size-5 rounded bg-muted/40" />
          </div>
        </div>
        {/* Status bar: attempt / skip / score */}
        <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center">
          <div className="h-4 w-24 animate-pulse rounded bg-muted/30 pl-1" />
          <div className="flex justify-center">
            <div className="size-7 rounded-sm bg-muted/20" />
          </div>
          <div className="ml-auto h-4 w-20 animate-pulse rounded bg-muted/30 pr-1" />
        </div>
      </div>
    </div>
  );
}
