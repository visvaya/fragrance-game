"use client"

import { useGame } from "./game-provider"
import { RevealImage } from "./RevealImage"
import { MetaClues } from "./clues/meta-clues"
import { PyramidClues } from "./clues/pyramid-clues"
import { AttemptLog } from "./attempt-log"
import { DifficultyDisplay } from "./difficulty-display"

export function GameBoard() {
  const { gameState, dailyPerfume, xsolveScore } = useGame()

  return (
    <div className="flex flex-col gap-8">
      {/* Mystery Section - Image + Meta */}
      <section className="grid grid-cols-[1fr_1.6fr] gap-6 items-center">
        {/* Force remount on session change/reset to clear image cache state */}
        <div className="aspect-square w-full relative flex items-center justify-center">
          <RevealImage key={useGame().sessionId || 'no-session'} />
        </div>
        <MetaClues />
      </section>

      {/* Clues Section */}
      <section className="border-t border-border pt-6 flex flex-col gap-8">
        {/* Game Over State - Positioned ABOVE Clues */}
        {gameState !== "playing" && (
          <div className="text-center py-6 border-b border-border/70 mb-6">
            {gameState === "won" ? (
              <div className="animate-in fade-in zoom-in duration-500">
                <p className="font-[family-name:var(--font-hand)] text-4xl text-emerald-600 mb-3 transform -rotate-2">Magnifique!</p>
                <div className="space-y-1">
                  <p className="font-[family-name:var(--font-playfair)] text-2xl italic font-semibold">
                    {dailyPerfume.name}
                    {dailyPerfume.concentration && dailyPerfume.concentration !== 'Unknown' && (
                      <span className="text-lg not-italic text-muted-foreground ml-2">• {dailyPerfume.concentration}</span>
                    )}
                  </p>
                  <p className="text-muted-foreground text-sm tracking-widest uppercase">by {dailyPerfume.brand}</p>
                </div>
                <div className="mt-6 flex justify-center">
                  <DifficultyDisplay score={xsolveScore} />
                </div>
              </div>
            ) : (
              <div className="animate-in fade-in zoom-in duration-500">
                <p className="font-[family-name:var(--font-hand)] text-3xl text-destructive mb-3">The answer was...</p>
                <div className="space-y-1">
                  <p className="font-[family-name:var(--font-playfair)] text-2xl italic font-semibold">
                    {dailyPerfume.name}
                    {dailyPerfume.concentration && dailyPerfume.concentration !== 'Unknown' && (
                      <span className="text-lg not-italic text-muted-foreground ml-2">• {dailyPerfume.concentration}</span>
                    )}
                  </p>
                  <p className="text-muted-foreground text-sm tracking-widest uppercase">by {dailyPerfume.brand}</p>
                </div>
                <div className="mt-6 flex justify-center">
                  <DifficultyDisplay score={xsolveScore} />
                </div>
              </div>
            )}
          </div>
        )}

        <PyramidClues />
      </section>

      {/* Attempt Log */}
      <AttemptLog />
    </div>
  )
}
