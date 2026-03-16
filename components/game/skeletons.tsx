import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { DotFiller } from "./dot-filler";

// Optional t() prop allows rendering translations. When t is absent (loading.tsx),
// text labels degrade to pulsing bars while all layout/spacing stays identical.

/**
 * Skeleton for the RevealImage section (image and guide lines).
 * @param props - Component properties.
 * @param props.t - Optional translation function (used outside of loading.tsx).
 */
export function RevealImageSkeleton({
  t,
}: Readonly<{ t?: (key: string) => string }>) {
  return (
    <div className="flex size-full flex-col">
      {/* Title row — placeholder ikony + tytuł, jak we wszystkich innych skeleton boxach */}
      <div className="mb-4 flex w-fit cursor-default items-center">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-4 rounded bg-muted/30" />
          {t ? (
            <h2 className="font-[family-name:var(--font-playfair)] text-lg tracking-wide text-foreground lowercase opacity-40">
              {t("visualEvidence")}
            </h2>
          ) : (
            <div className="h-7 w-32 animate-pulse rounded bg-muted/40" />
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-row items-center gap-2">
        {/* Left vertical dot filler — identical to real component */}
        <span
          aria-hidden="true"
          className="flex flex-1 justify-center self-stretch py-2"
        >
          <span className="h-full border-l border-dotted border-muted-foreground/25" />
        </span>

        <RevealImageSquareSkeleton />

        {/* Right vertical dot filler */}
        <span
          aria-hidden="true"
          className="flex flex-1 justify-center self-stretch py-2"
        >
          <span className="h-full border-l border-dotted border-muted-foreground/25" />
        </span>
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
 * @param props.t - Optional translation function.
 */
export function MetaCluesSkeleton({
  t,
}: Readonly<{ t?: (key: string) => string }>) {
  return (
    <div className="flex h-full flex-col p-0">
      {/* Title row — matches real MetaClues title structure */}
      <div className="mb-4 flex w-fit cursor-default items-center">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-4 rounded bg-muted/30" />
          {t ? (
            <h2 className="font-[family-name:var(--font-playfair)] text-lg tracking-wide text-foreground lowercase opacity-40">
              {t("identity")}
            </h2>
          ) : (
            <div className="h-7 w-24 animate-pulse rounded bg-muted/40" />
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-5">
        {/* Brand row — same structure as real: label + flex wrapper with badge + DotFiller */}
        <div className="flex w-full flex-col items-start gap-0.5">
          {t ? (
            <span className="w-full text-xs font-semibold tracking-widest text-muted-foreground/70 lowercase">
              {t("brand")}
            </span>
          ) : (
            <div className="h-[1.125rem] w-12 rounded bg-muted/30" />
          )}
          <div className="flex w-full flex-wrap items-center gap-2">
            <div className="flex min-w-0 flex-[1_1_0px] items-center gap-2">
              <Skeleton className="h-7 w-9 rounded-md" />
              <DotFiller className="pr-2" />
            </div>
          </div>
        </div>

        {/* Perfumer row */}
        <div className="flex w-full flex-col items-start gap-0.5">
          {t ? (
            <span className="w-full text-xs font-semibold tracking-widest text-muted-foreground/70 lowercase">
              {t("perfumer")}
            </span>
          ) : (
            <div className="h-[1.125rem] w-16 rounded bg-muted/30" />
          )}
          <div className="flex w-full flex-wrap items-center gap-2">
            <div className="flex min-w-0 flex-[1_1_0px] items-center gap-2">
              <Skeleton className="h-7 w-9 rounded-md" />
              <DotFiller className="pr-2" />
            </div>
          </div>
        </div>

        {/* Year + Gender — 2-column grid, same as real component */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col items-start gap-0.5">
            {t ? (
              <span className="w-full text-xs font-semibold tracking-widest text-muted-foreground/70 lowercase">
                {t("year")}
              </span>
            ) : (
              <div className="h-[1.125rem] w-8 rounded bg-muted/30" />
            )}
            <div className="flex w-full flex-wrap items-center gap-2">
              <div className="flex min-w-0 flex-[1_1_0px] items-center gap-2">
                <Skeleton className="h-7 w-9 rounded-md" />
                <DotFiller className="pr-2" />
              </div>
            </div>
          </div>
          <div className="flex flex-col items-start gap-0.5">
            {t ? (
              <span className="w-full text-xs font-semibold tracking-widest text-muted-foreground/70 lowercase">
                {t("gender")}
              </span>
            ) : (
              <div className="h-[1.125rem] w-12 rounded bg-muted/30" />
            )}
            <div className="flex w-full flex-wrap items-center gap-2">
              <div className="flex min-w-0 flex-[1_1_0px] items-center gap-2">
                <Skeleton className="h-7 w-9 rounded-md" />
                <DotFiller className="pr-2" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for the PyramidClues section (top, heart, and base notes).
 * @param props - Component properties.
 * @param props.t - Optional translation function.
 */
export function PyramidCluesSkeleton({
  t,
}: Readonly<{ t?: (key: string) => string }>) {
  const skeletonLevels = t
    ? [
        { count: 3, label: t("top") },
        { count: 3, label: t("heart") },
        { count: 3, label: t("base") },
      ]
    : [
        { count: 3, label: "" },
        { count: 3, label: "" },
        { count: 3, label: "" },
      ];

  return (
    <div className="panel-standard">
      {/* Title row */}
      <div className="mb-4 flex w-fit cursor-default items-center">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-4 rounded bg-muted/30" />
          {t ? (
            <h2 className="font-[family-name:var(--font-playfair)] text-lg text-foreground lowercase opacity-40">
              {t("pyramid")}
            </h2>
          ) : (
            <div className="h-7 w-20 animate-pulse rounded bg-muted/40" />
          )}
        </div>
      </div>

      <ul className="flex flex-col">
        {skeletonLevels.map((level, idx) => (
          <li
            className="flex flex-col gap-2 border-b border-border/60 py-4 first:pt-0 last:border-b-0 last:pb-0"
            key={level.label || `skel-level-${idx}`}
          >
            {/* Level header: neutral dot + label — matches real level row structure */}
            <div className="flex items-center gap-2">
              <span className="size-2 shrink-0 rounded-full bg-muted-foreground/30" />
              {level.label ? (
                <span className="text-xs font-semibold tracking-widest text-muted-foreground/70 lowercase">
                  {level.label}
                </span>
              ) : (
                <div className="h-[1.125rem] w-28 rounded bg-muted/30" />
              )}
            </div>

            {/*
              Badges row — mirrors real layout exactly:
              - non-last badges are plain
              - last badge is wrapped in flex-[1_1_0px] with DotFiller
            */}
            <div className="flex flex-wrap items-center gap-1.5">
              {Array.from({ length: level.count - 1 }).map((_, i) => (
                <Skeleton
                  className="h-7 w-9 rounded-md"
                  key={`skel-${level.label}-${i}`}
                />
              ))}
              <div className="flex min-w-0 flex-[1_1_0px] items-center gap-2">
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
 * @param props.t - Optional translation function.
 */
export function AttemptLogSkeleton({
  t,
}: Readonly<{ t?: (key: string) => string }>) {
  return (
    <section className="panel-standard">
      {/* Title row — matches real AttemptLog title structure */}
      <div className="mb-4 flex w-fit cursor-default items-center">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-4 rounded bg-muted/30" />
          {t ? (
            <h2 className="font-[family-name:var(--font-playfair)] text-lg text-foreground lowercase opacity-40">
              {t("title")}
            </h2>
          ) : (
            <div className="h-7 w-28 animate-pulse rounded bg-muted/40" />
          )}
        </div>
      </div>

      {/* Table — same grid as real: 32px | 1fr | minmax(105px,auto) */}
      <div className="grid grid-cols-[32px_1fr_minmax(105px,auto)]">
        {/* Header: "#" column — real has size-8 GameTooltip placeholder, we replicate 32px height */}
        <div className="flex items-center justify-center border-b-2 border-muted/50 pb-2 text-sm font-semibold tracking-widest text-muted-foreground/70 lowercase">
          {t ? (
            <span className="w-full text-center underline decoration-muted-foreground/30 decoration-dotted underline-offset-2 opacity-40">
              {t("columns.attempt")}
            </span>
          ) : (
            <div className="size-3.5 rounded bg-muted/40" />
          )}
        </div>

        {/* Header: "perfume" column */}
        <div className="flex items-center border-b-2 border-muted/50 pb-2 pl-2 text-sm font-semibold tracking-widest text-muted-foreground/70 lowercase opacity-40">
          {t ? (
            t("columns.perfume")
          ) : (
            <div className="h-3.5 w-16 rounded bg-muted/40" />
          )}
        </div>

        {/* Header: 5 attribute columns — neutral squares instead of icons */}
        <div className="grid w-full grid-cols-5 justify-items-center border-b-2 border-muted/50 px-1 pb-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div className="flex size-8 items-center justify-center" key={i}>
              <div className="size-4 rounded bg-muted/40 opacity-40" />
            </div>
          ))}
        </div>

        {/* 6 empty content rows — identical classes to real empty rows */}
        {[1, 2, 3, 4, 5, 6].map((rowNumber, index) => (
          <div className="contents" key={rowNumber}>
            <div
              className={`flex min-h-[4rem] items-center justify-center py-3 ${index < 5 ? "border-b border-muted/30" : ""}`}
            >
              <span className="block w-full pr-1 text-center text-[0.8125rem] font-normal text-muted-foreground opacity-30">
                {rowNumber}
              </span>
            </div>
            <div
              className={`min-h-[4rem] px-2 py-3 ${index < 5 ? "border-b border-muted/30" : ""}`}
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
      <div className="relative z-20 border-x-0 border-t panel-border bg-background/70 px-5 py-1.5 panel-shadow backdrop-blur-md sm:rounded-t-md sm:border-x">
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
