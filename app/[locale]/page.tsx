import { GameBoard } from "@/components/game/game-board";
import { GameFooter } from "@/components/game/game-footer";
import { GameHeader } from "@/components/game/game-header";
import { GameInput } from "@/components/game/game-input";
import { GameProvider } from "@/components/game/game-provider";

/**
 *
 */
export default function Home({ params }: { params: Promise<{ locale: string }> }) {
  return (
    <GameProvider>
      <div className="flex min-h-screen flex-col items-center">
        <GameHeader />
        <main className="flex w-full flex-1 flex-col items-center px-0 pt-6 pb-0">
          <div className="flex w-full flex-1 flex-col items-center px-5 pb-6">
            <GameBoard />
          </div>
          <GameInput />
        </main>
        <GameFooter />
      </div>
    </GameProvider>
  );
}
