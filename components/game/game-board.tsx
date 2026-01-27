"use client"

import { useGame } from "./game-provider"
import { useTranslations } from "next-intl"
import { RevealImage } from "./RevealImage"
import { MetaClues } from "./clues/meta-clues"
import { PyramidClues } from "./clues/pyramid-clues"
import { AttemptLog } from "./attempt-log"
import { DifficultyDisplay } from "./difficulty-display"
import { cn } from "@/lib/utils"

export function GameBoard() {
  const { gameState, dailyPerfume, xsolveScore, uiPreferences } = useGame()
  const isWide = uiPreferences.layoutMode === 'wide'
  const t = useTranslations('GameBoard')

  return (
    <div className={cn(
      "flex flex-col gap-6 mx-auto transition-all duration-300 w-full",
      isWide ? "max-w-5xl" : "max-w-xl"
    )}>
      {/* Game Over Cards ... */}
      {/* ... keeping game over logic same, just wrapper width changes ... */}

      {gameState !== "playing" && (
        <div className="text-center bg-background p-6 rounded-md border border-border/50 transition-all duration-500 animate-in fade-in zoom-in-95">
          {gameState === "won" ? (
            <div className="animate-in fade-in zoom-in duration-500">
              <p className="font-[family-name:var(--font-hand)] text-4xl text-success mb-3 transform -rotate-2">{t('magnifique')}</p>
              <div className="space-y-1">
                <p className="font-[family-name:var(--font-playfair)] text-2xl font-semibold">
                  {dailyPerfume.name}
                  {dailyPerfume.concentration && dailyPerfume.concentration !== 'Unknown' && (
                    <span className="text-lg not-italic text-muted-foreground ml-2">• {dailyPerfume.concentration}</span>
                  )}
                </p>
                <p className="text-muted-foreground text-sm tracking-widest uppercase">{t('by')} {dailyPerfume.brand}</p>
                <div className="flex justify-center mt-2">
                  <DifficultyDisplay score={xsolveScore} />
                </div>
              </div>
            </div>
          ) : (
            <div className="animate-in fade-in zoom-in duration-500">
              <p className="font-[family-name:var(--font-hand)] text-3xl text-destructive mb-3">{t('answerWas')}</p>
              <div className="space-y-1">
                <p className="font-[family-name:var(--font-playfair)] text-2xl font-semibold">
                  {dailyPerfume.name}
                  {dailyPerfume.concentration && dailyPerfume.concentration !== 'Unknown' && (
                    <span className="text-lg not-italic text-muted-foreground ml-2">• {dailyPerfume.concentration}</span>
                  )}
                </p>
                <p className="text-muted-foreground text-sm tracking-widest uppercase">{t('by')} {dailyPerfume.brand}</p>
                <div className="flex justify-center mt-2">
                  <DifficultyDisplay score={xsolveScore} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Game Content */}
      <div className={cn(
        "gap-6 transition-all duration-300",
        isWide ? "grid grid-cols-1 md:grid-cols-2 items-start" : "flex flex-col"
      )}>

        {/* Left Column (Wide) / Top (Stack) */}
        <div className="space-y-6">
          <div className="bg-background p-4 rounded-md border border-border/50">
            <RevealImage />
          </div>
          <div className="bg-background p-4 rounded-md border border-border/50">
            <MetaClues />
          </div>
        </div>

        {/* Right Column (Wide) / Bottom (Stack) */}
        <div className="space-y-6">
          <PyramidClues />
          <AttemptLog />
        </div>
      </div>
    </div>
  )
}


