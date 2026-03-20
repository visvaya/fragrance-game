"use client";

// eslint-disable-next-line no-restricted-imports -- animation: triggers confetti/animateGameOver on playing→won/lost transition
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { useTranslations } from "next-intl";

import { BULLET_CHAR } from "@/lib/constants";
import { cn } from "@/lib/utils";

import { AttemptLog } from "./attempt-log";
import { MetaClues } from "./clues/meta-clues";
import { PyramidClues } from "./clues/pyramid-clues";
import { Confetti } from "./confetti";
import { useGameState } from "./contexts";
import { DifficultyDisplay } from "./difficulty-display";
import { RevealImage } from "./reveal-image";

/**
 * Main game board, integrating all sections (image, clues, log, input).
 */
export function GameBoard() {
  const { dailyPerfume, gameState, xsolveScore } = useGameState();
  const isContentReady = dailyPerfume.id !== "skeleton";

  // Animate skeleton→real transition only for non-SSR users (where skeleton was actually shown).
  // SSR users have isContentReady=true from first render — animating on page load would cause
  // compositor-layer/scroll flicker within the first 250ms. No animation needed: no skeleton was shown.
  const [shouldFadeIn, setShouldFadeIn] = useState(false);
  const previousIsContentReadyReference = useRef(isContentReady);
  useLayoutEffect(() => {
    if (!previousIsContentReadyReference.current && isContentReady) {
      setShouldFadeIn(true);
      const id = setTimeout(() => setShouldFadeIn(false), 500);
      previousIsContentReadyReference.current = true;
      return () => clearTimeout(id);
    }
    previousIsContentReadyReference.current = isContentReady;
  }, [isContentReady]);

  const t = useTranslations("GameBoard");
  const [showConfetti, setShowConfetti] = useState(false);
  // Fires animate-in only when game ends in-session (playing→won/lost), not on page restore.
  const [animateGameOver, setAnimateGameOver] = useState(false);
  const previousGameState = useRef<string | null>(null);

  useEffect(() => {
    const justEnded =
      previousGameState.current === "playing" &&
      (gameState === "won" || gameState === "lost");
    const justWon =
      previousGameState.current === "playing" && gameState === "won";
    previousGameState.current = gameState;
    if (justEnded) {
      setAnimateGameOver(true);
    }
    if (justWon) {
      setShowConfetti(true);
      const timeout = setTimeout(() => setShowConfetti(false), 2800);
      return () => clearTimeout(timeout);
    }
  }, [gameState]);

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-[38rem] flex-col gap-6 px-4 transition-[max-width] duration-300 wide:max-w-[60rem]",
      )}
      suppressHydrationWarning
    >
      {showConfetti ? <Confetti /> : null}
      {/* Game Over Cards ... */}
      {/* ... keeping game over logic same, just wrapper width changes ... */}

      {gameState !== "playing" && (
        <div className={cn("panel-standard text-center", animateGameOver && "transition-all duration-500 animate-in fade-in zoom-in-95")}>
          {gameState === "won" ? (
            <div className={cn(animateGameOver && "duration-500 animate-in fade-in zoom-in")}>
              <h2 className="mb-2 font-[family-name:var(--font-caveat)] text-4xl tracking-tight text-success">
                {t("magnifique")}
              </h2>
              <div className="space-y-1">
                <p className="font-[family-name:var(--font-playfair)] text-2xl font-semibold">
                  {dailyPerfume.name}
                  {dailyPerfume.concentration &&
                  dailyPerfume.concentration !== "Unknown" ? (
                    <span className="ml-2 text-lg text-muted-foreground not-italic">
                      {BULLET_CHAR} {dailyPerfume.concentration}
                    </span>
                  ) : null}
                </p>

                <div className="mt-2 flex justify-center">
                  <DifficultyDisplay score={xsolveScore} />
                </div>
              </div>
            </div>
          ) : (
            <div className={cn(animateGameOver && "duration-500 animate-in fade-in zoom-in")}>
              <h2 className="mb-2 font-[family-name:var(--font-caveat)] text-4xl tracking-tight text-destructive">
                {t("answerWas")}
              </h2>
              <div className="space-y-1">
                <p className="font-[family-name:var(--font-playfair)] text-2xl font-semibold">
                  {dailyPerfume.name}
                  {dailyPerfume.concentration &&
                  dailyPerfume.concentration !== "Unknown" ? (
                    <span className="ml-2 text-lg text-muted-foreground not-italic">
                      {BULLET_CHAR} {dailyPerfume.concentration}
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
          // eslint-disable-next-line better-tailwindcss/no-unknown-classes -- animate-content-fade-in is a custom CSS animation class defined in globals.css
          shouldFadeIn && "animate-content-fade-in",
        )}
      >
        {/* Left Column (Wide) / Top (Stack) */}
        <div className="space-y-6">
              <div className="panel-standard">
                <RevealImage />
              </div>
              <div className="panel-standard">
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
