"use client";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { AttemptLog } from "./attempt-log";
import { MetaClues } from "./clues/meta-clues";
import { PyramidClues } from "./clues/pyramid-clues";
import { DifficultyDisplay } from "./difficulty-display";
import { useGameState, useUIPreferences } from "./contexts";
import { RevealImage } from "./RevealImage";

/**
 *
 */
export function GameBoard() {
  const { dailyPerfume, gameState, xsolveScore } = useGameState();
  const { uiPreferences } = useUIPreferences();
  const isWide = uiPreferences.layoutMode === "wide";
  const t = useTranslations("GameBoard");

  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-col gap-6 transition-all duration-300",
        isWide ? "max-w-5xl" : "max-w-xl",
      )}
    >
      {/* Game Over Cards ... */}
      {/* ... keeping game over logic same, just wrapper width changes ... */}

      {gameState !== "playing" && (
        <div className="rounded-md border border-border/50 bg-background p-6 text-center transition-all duration-500 animate-in fade-in zoom-in-95">
          {gameState === "won" ? (
            <div className="duration-500 animate-in fade-in zoom-in">
              <p className="mb-2 -rotate-2 transform font-[family-name:var(--font-hand)] text-4xl text-success">
                {t("magnifique")}
              </p>
              <div className="space-y-1">
                <p className="font-[family-name:var(--font-playfair)] text-2xl font-semibold">
                  {dailyPerfume.name}
                  {dailyPerfume.concentration &&
                  dailyPerfume.concentration !== "Unknown" ? (
                    <span className="ml-2 text-lg text-muted-foreground not-italic">
                      • {dailyPerfume.concentration}
                    </span>
                  ) : null}
                </p>

                <div className="mt-2 flex justify-center">
                  <DifficultyDisplay score={xsolveScore} />
                </div>
              </div>
            </div>
          ) : (
            <div className="duration-500 animate-in fade-in zoom-in">
              <p className="font-[family-name:var(--font-hand)] text-3xl text-destructive">
                {t("answerWas")}
              </p>
              <div className="space-y-1">
                <p className="font-[family-name:var(--font-playfair)] text-2xl font-semibold">
                  {dailyPerfume.name}
                  {dailyPerfume.concentration &&
                  dailyPerfume.concentration !== "Unknown" ? (
                    <span className="ml-2 text-lg text-muted-foreground not-italic">
                      • {dailyPerfume.concentration}
                    </span>
                  ) : null}
                </p>

                <div className="mt-2 flex justify-center">
                  <DifficultyDisplay score={xsolveScore} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Game Content */}
      <div
        className={cn(
          "gap-6 transition-all duration-300",
          isWide
            ? "grid grid-cols-1 items-start md:grid-cols-2"
            : "flex flex-col",
        )}
      >
        {/* Left Column (Wide) / Top (Stack) */}
        <div className="space-y-6">
          <div className="rounded-md border border-border/50 bg-background p-4">
            <RevealImage />
          </div>
          <div className="rounded-md border border-border/50 bg-background p-4">
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
  );
}
