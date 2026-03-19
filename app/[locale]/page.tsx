import { preload } from "react-dom";

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

  // Inject a high-priority preload for the LCP image into <head>.
  // next/image with `priority` auto-generates a preload link but omits fetchpriority="high"
  // (Next.js 16 bug), causing the browser to fetch at Medium priority instead of High.
  // Calling ReactDOM.preload() here fixes this — it hoists a <link rel="preload"
  // fetchpriority="high" imagesrcset="..." imagesizes="..."> into the SSR <head>.
  // The imageSizes must match the `sizes` prop on the <Image> in reveal-image.tsx.
  if (initialImageUrl) {
    const sizes = "(max-width: 640px) 100vw, (max-width: 768px) 80vw, 400px";
    const imageSourceSet = [640, 750, 828, 1080, 1200]
      .map(
        (w) =>
          `/_next/image?url=${encodeURIComponent(initialImageUrl)}&w=${w}&q=90 ${w}w`,
      )
      .join(", ");
    preload(
      `/_next/image?url=${encodeURIComponent(initialImageUrl)}&w=828&q=90`,
      {
        as: "image",
        fetchPriority: "high",
        imageSizes: sizes,
        imageSrcSet: imageSourceSet,
      },
    );
  }

  return (
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
  );
}
