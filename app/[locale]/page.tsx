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

  // Responsive preload for the LCP image. Generates srcset matching all breakpoints
  // that Next.js image optimizer may request (640w for Lighthouse 412px×1x,
  // 828w for Android 414px×2x, etc.). Prevents double-download from mismatched w= param.
  const preloadSourceSet = initialImageUrl
    ? [640, 750, 828, 1080, 1200]
        .map(
          (w) =>
            `/_next/image?url=${encodeURIComponent(initialImageUrl)}&w=${w}&q=90 ${w}w`,
        )
        .join(", ")
    : null;

  return (
    <>
      {initialImageUrl && preloadSourceSet ? (
        <link
          as="image"
          fetchPriority="high"
          href={`/_next/image?url=${encodeURIComponent(initialImageUrl)}&w=640&q=90`}
          imageSizes="(max-width: 640px) 100vw, (max-width: 768px) 80vw, 400px"
          imageSrcSet={preloadSourceSet}
          rel="preload"
        />
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
