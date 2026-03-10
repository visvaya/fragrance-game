/**
 * Loading skeleton shown by Next.js Suspense while the locale layout hydrates.
 * Mirrors the visual structure of the game page to prevent layout shift.
 */
export default function Loading() {
  return (
    <div className="flex min-h-[100dvh] w-full flex-col items-center">
      {/* Header */}
      <div className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/70 px-5 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex gap-2">
            <div className="size-9 animate-pulse rounded bg-muted" />
            <div className="size-9 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-7 w-20 animate-pulse rounded bg-muted" />
          <div className="flex gap-2">
            <div className="size-9 animate-pulse rounded bg-muted" />
            <div className="size-9 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="flex w-full flex-1 flex-col items-center px-6 pt-6 pb-0">
        <div className="flex w-full max-w-[38rem] flex-col gap-6">
          {/* Image card */}
          <div className="rounded-md border border-border/50 bg-background p-4">
            <div className="aspect-square w-full animate-pulse rounded bg-muted" />
          </div>

          {/* Meta clues card */}
          <div className="rounded-md border border-border/50 bg-background p-4">
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div
                  className="h-8 w-full animate-pulse rounded bg-muted"
                  key={i}
                />
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Input bar */}
      <div className="sticky bottom-0 w-full max-w-2xl border-t border-border/50 bg-background/70 px-5 py-8 backdrop-blur-md">
        <div className="mx-auto size-6 animate-pulse rounded-full bg-muted" />
      </div>
    </div>
  );
}
