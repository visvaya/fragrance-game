import { GameBoard } from "@/components/game/game-board";
import { GameFooter } from "@/components/game/game-footer";
import { GameHeader } from "@/components/game/game-header";
import { GameInput } from "@/components/game/game-input";
import { GameProvider } from "@/components/game/game-provider";

/**
 *
 */
export default function Home() {
  return (
    <GameProvider>
      <div className="flex min-h-screen flex-col items-center">
        <GameHeader />
        <main className="flex w-full flex-1 flex-col items-center gap-8 px-5 py-6">
          <GameBoard />
        </main>
        <GameInput />
        <GameFooter />
      </div>
    </GameProvider>
  );
}
