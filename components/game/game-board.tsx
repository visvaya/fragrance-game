"use client"

import { useGame } from "./game-provider"
import { RevealImage } from "./RevealImage"
import { MetaClues } from "./clues/meta-clues"
import { AccordsClues } from "./clues/accords-clues"
import { PyramidClues } from "./clues/pyramid-clues"
import { AttemptLog } from "./attempt-log"

export function GameBoard() {
  const { gameState, dailyPerfume } = useGame()

  return (
    <div className="flex flex-col gap-8">
      {/* Mystery Section - Image + Meta */}
      <section className="grid grid-cols-[1fr_1.6fr] gap-6 items-start">
        <RevealImage />
        <MetaClues />
      </section>

      {/* Clues Section */}
      <section className="border-t border-border pt-6 flex flex-col gap-8">
        <AccordsClues />
        <PyramidClues />
      </section>

      {/* Attempt Log */}
      <AttemptLog />

      {/* Game Over State */}
      {gameState !== "playing" && (
        <div className="text-center py-8 border-t border-border">
          {gameState === "won" ? (
            <div>
              <p className="font-[family-name:var(--font-hand)] text-3xl text-primary mb-2">Magnifique!</p>
              <p className="font-[family-name:var(--font-playfair)] text-xl italic">{dailyPerfume.name}</p>
              <p className="text-muted-foreground text-sm mt-1">by {dailyPerfume.brand}</p>
            </div>
          ) : (
            <div>
              <p className="font-[family-name:var(--font-hand)] text-3xl text-destructive mb-2">The answer was...</p>
              <p className="font-[family-name:var(--font-playfair)] text-xl italic">{dailyPerfume.name}</p>
              <p className="text-muted-foreground text-sm mt-1">by {dailyPerfume.brand}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
