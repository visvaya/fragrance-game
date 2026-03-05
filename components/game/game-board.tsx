"use client";

import { useState, useEffect } from "react";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { AttemptLog } from "./attempt-log";
import { MetaClues } from "./clues/meta-clues";
import { PyramidClues } from "./clues/pyramid-clues";
import { Confetti } from "./confetti";
import { useGameState } from "./contexts";
import { DifficultyDisplay } from "./difficulty-display";
import { RevealImage } from "./reveal-image";

/**
 *
 */
export function GameBoard() {
  const { dailyPerfume, gameState, xsolveScore } = useGameState();

  const t = useTranslations("GameBoard");
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (gameState === "won") {
      setShowConfetti(true);
      const timeout = setTimeout(() => setShowConfetti(false), 2800);
      return () => clearTimeout(timeout);
    }
  }, [gameState]);

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-[38rem] flex-col gap-6 px-6 transition-[max-width] duration-300 sm:px-0 wide:max-w-[60rem]",
      )}
      suppressHydrationWarning
    >
      {showConfetti ? <Confetti /> : null}
      {/* Game Over Cards ... */}
      {/* ... keeping game over logic same, just wrapper width changes ... */}

      {gameState !== "playing" && (
        <div className="panel-standard p-6 text-center transition-all duration-500 animate-in fade-in zoom-in-95">
          {gameState === "won" ? (
            <div className="duration-500 animate-in fade-in zoom-in">
              <p className="mb-2 -rotate-2 transform font-hand text-4xl text-success">
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
              <p className="font-hand text-3xl text-destructive">
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
          "flex flex-col gap-6 wide:grid wide:grid-cols-1 wide:items-start wide:md:grid-cols-[9fr_11fr]",
        )}
      >
        {/* Left Column (Wide) / Top (Stack) */}
        <div className="space-y-6">
          <div className="panel-standard p-4">
            <RevealImage />
          </div>
          <div className="panel-standard p-4">
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
