import { GameProvider } from "@/components/game/game-provider"
import { GameHeader } from "@/components/game/game-header"
import { GameBoard } from "@/components/game/game-board"
import { GameInput } from "@/components/game/game-input"
import { GameFooter } from "@/components/game/game-footer"
import { ResetButton } from "@/components/game/reset-button"

export default function Home() {
  return (
    <GameProvider>
      <div className="min-h-screen flex flex-col items-center">
        <GameHeader />
        <main className="w-full px-5 py-6 flex flex-col gap-8 flex-1 items-center">
          <GameBoard />
        </main>
        <GameInput />
        <GameFooter />
      </div>
    </GameProvider>
  )
}
