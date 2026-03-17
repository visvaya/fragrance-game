import {
  getDailyChallengeSSR,
  getDailyStep1ImageUrl,
  getPlayerDailySession,
} from "@/app/actions/game-actions";
import { GameBoard } from "@/components/game/game-board";
import { GameFooter } from "@/components/game/game-footer";
import { GameHeader } from "@/components/game/game-header";
import { GameInput } from "@/components/game/game-input";
import { GameProvider } from "@/components/game/game-provider";

// Challenge data is served from Next.js cache (updated daily via revalidate tag).
// Player session (initialSession) is dynamic per-request — no ISR compatible.
// This route is now fully dynamic, but challenge queries are still cached via
// unstable_cache inside getDailyChallengeSSR / getDailyStep1ImageUrl.

/** Root page — renders the daily fragrance game. Challenge data is SSR-cached; player session is per-request. */
export default async function Home({
  params: _params,
}: {
  readonly params: Promise<{ locale: string }>;
}) {
  // Fetch challenge data (cached 24h) and player session (per-request) in parallel
  // Date is passed as an argument so Next.js cache key is scoped to the day,
  // preventing stale SSR data after midnight.
  const today = new Date().toISOString().split("T")[0];
  const [initialImageUrl, initialChallenge] = await Promise.all([
    getDailyStep1ImageUrl(today),
    getDailyChallengeSSR(today),
  ]);

  // Pre-fetch the player's existing game session server-side.
  // Only works if player has an auth cookie (returning users).
  // Returns null for new/unauthenticated visitors — GameProvider falls back to client-side init.
  const initialSession = initialChallenge
    ? await getPlayerDailySession(initialChallenge.id)
    : null;

  // Preload the LCP image. Next.js image optimizer serves /_next/image?url=...&w=750&q=90
  // for mobile (375px viewport × 2x DPR = 750px). This hint fires before hydration.
  const preloadUrl = initialImageUrl
    ? `/_next/image?url=${encodeURIComponent(initialImageUrl)}&w=750&q=90`
    : null;

  return (
    <>
      {preloadUrl ? (
        <link as="image" fetchPriority="high" href={preloadUrl} rel="preload" />
      ) : null}
      <GameProvider
        initialChallenge={initialChallenge}
        initialImageUrl={initialImageUrl}
        initialSession={initialSession}
      >
        <div className="flex min-h-[100dvh] w-full flex-col items-center">
          <GameHeader />
          <main className="flex w-full flex-1 flex-col items-center px-0 pt-6 pb-0">
            <div className="flex w-full flex-1 flex-col items-center px-0 pb-6">
              <GameBoard />
            </div>
            <GameInput />
          </main>
          <GameFooter />
        </div>
      </GameProvider>
    </>
  );
}
