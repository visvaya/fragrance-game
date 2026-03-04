import {
  getDailyChallengeSSR,
  getDailyStep1ImageUrl,
} from "@/app/actions/game-actions";
import { GameBoard } from "@/components/game/game-board";
import { GameFooter } from "@/components/game/game-footer";
import { GameHeader } from "@/components/game/game-header";
import { GameInput } from "@/components/game/game-input";
import { GameProvider } from "@/components/game/game-provider";

// Enable ISR (Incremental Static Regeneration) for daily challenges
// Revalidate every 24 hours (86400 seconds) to match daily challenge cadence
// This improves TTFB by serving cached pages from edge, reduces server load
export const revalidate = 86_400; // 24 hours

/**
 *
 */
export default async function Home({
  params: _params,
}: {
  readonly params: Promise<{ locale: string }>;
}) {
  // Oba wywołania równolegle — oba cached, nie blokują się nawzajem
  const [initialImageUrl, initialChallenge] = await Promise.all([
    getDailyStep1ImageUrl(),
    getDailyChallengeSSR(),
  ]);

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
