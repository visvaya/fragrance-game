import {
  AttemptLogSkeleton,
  GameInputSkeleton,
  MetaCluesSkeleton,
  PyramidCluesSkeleton,
  RevealImageSkeleton,
} from "@/components/game/skeletons";

/**
 * Loading skeleton shown by Next.js Suspense while the locale layout hydrates.
 * Mirrors the visual structure of the game page to prevent layout shift.
 *
 * IMPORTANT: This skeleton must use the same `wide:` variant classes as the real
 * page components (GameBoard, GameHeader, GameInput, GameFooter) so the layout
 * width matches immediately when `data-layout="wide"` is set by the blocking
 * script in layout.tsx. Without `wide:` classes here, the page jumps from narrow
 * to wide when the real content streams in.
 */
export default function Loading() {
  return (
    <div className="flex min-h-[100dvh] w-full flex-col items-center">
      {/* Header — matches GameHeader nav width classes */}
      <header className="sticky top-0 z-50 w-full">
        <nav className="relative mx-auto flex w-full max-w-2xl items-center justify-between rounded-b-none border-x-0 border-b panel-border bg-background/70 px-5 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 panel-shadow backdrop-blur-md transition-[max-width] duration-300 sm:rounded-b-md sm:border-x wide:max-w-5xl">
          <div className="flex items-center gap-2 md:gap-4">
            <div className="size-9 animate-pulse rounded bg-muted" />
            <div className="size-9 animate-pulse rounded bg-muted" />
          </div>
          {/* Logo — hardcoded brand name, no translation needed */}
          <h1 className="absolute left-1/2 -translate-x-1/2 transform font-[family-name:var(--font-playfair)] text-2xl font-semibold tracking-tight text-foreground lowercase">
            Eauxle
          </h1>
          <div className="flex items-center gap-2 md:gap-4">
            <div className="size-9 animate-pulse rounded bg-muted" />
            <div className="size-9 animate-pulse rounded bg-muted" />
          </div>
        </nav>
      </header>

      {/* Main content — matches page.tsx > GameBoard layout */}
      <main className="flex w-full flex-1 flex-col items-center px-0 pt-6 pb-0">
        <div className="flex w-full flex-1 flex-col items-center px-0 pb-6">
          <div className="mx-auto flex w-full max-w-[38rem] flex-col gap-6 px-6 transition-[max-width] duration-300 sm:px-0 wide:max-w-[60rem]">
            {/* Two-column grid on wide, single column on narrow — matches GameBoard */}
            <div className="flex flex-col gap-6 wide:grid wide:grid-cols-1 wide:items-start wide:md:grid-cols-[9fr_11fr]">
              {/* Left column: Image card + Meta clues */}
              <div className="space-y-6">
                <div className="panel-standard p-4">
                  <RevealImageSkeleton />
                </div>

                <div className="panel-standard p-4">
                  <MetaCluesSkeleton />
                </div>
              </div>

              {/* Right column: Pyramid clues + Attempt log — matches PyramidClues & AttemptLog */}
              <div className="space-y-6">
                <PyramidCluesSkeleton />
                <AttemptLogSkeleton />
              </div>
            </div>
          </div>
        </div>

        <GameInputSkeleton />
      </main>
    </div>
  );
}
