"use client";

import { useEffect, useRef, useState } from "react";

import { X, ArrowUp, ArrowDown, Waves, Check, ScrollText } from "lucide-react";

import { cn } from "@/lib/utils";

import { useGameState } from "./contexts";
import { GameTooltip } from "./game-tooltip";

const ROMAN_NUMERALS = ["I", "II", "III", "IV", "V", "VI"];

import { useTranslations } from "next-intl";

import { AttemptRow } from "./attempt-row";

/**
 *
 */
export function AttemptLog() {
  const { attempts, dailyPerfume, gameState, maxAttempts } = useGameState();
  const t = useTranslations("AttemptLog");
  const previousAttemptsLength = useRef(attempts.length);
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);
  const isTouchReference = useRef(false);
  const [isTouch, setIsTouch] = useState(false);

  // Scroll to new attempt
  useEffect(() => {
    if (
      attempts.length > previousAttemptsLength.current && // Only scroll to the new attempt if the game is still playing.
      // If the game ended (won/lost), the "Game Over" scroll effect (below) takes precedence.
      gameState === "playing"
    ) {
      const lastIndex = attempts.length - 1;
      const element = document.getElementById(`attempt-${lastIndex}`);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100);
      }
    }
    previousAttemptsLength.current = attempts.length;
  }, [attempts.length, gameState]);

  // Scroll to top on game end
  useEffect(() => {
    if (gameState === "won" || gameState === "lost") {
      // Small delay to ensure any end-game UI updates have triggered
      setTimeout(() => {
        window.scrollTo({ behavior: "smooth", top: 0 });
      }, 300);
    }
  }, [gameState]);

  // Reset active row when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Only handle touch interactions
      if (!isTouchReference.current) return;

      // Check if click is outside all attempt rows
      const target = e.target as HTMLElement;
      const attemptRow = target.closest("[data-attempt-row]");

      if (!attemptRow) {
        setActiveRowIndex(null);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  return (
    <section className="rounded-md border border-border/50 bg-background p-4">
      <div className="mb-4 flex items-center gap-2">
        <ScrollText className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-[family-name:var(--font-playfair)] text-lg text-foreground">
          {t("title")}
        </h2>
      </div>

      <div className="grid grid-cols-[32px_1fr_minmax(105px,auto)]">
        {/* Header Row - spread into grid columns */}
        <div className="flex items-center justify-center border-b-2 border-muted/50 pb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <GameTooltip
            className="h-7 w-7 items-center justify-center sm:h-8 sm:w-8"
            content={t("columns.attemptTooltip")}
          >
            <span className="w-full cursor-help text-center underline decoration-muted-foreground/30 decoration-dotted underline-offset-2">
              {t("columns.attempt")}
            </span>
          </GameTooltip>
        </div>

        <div className="flex items-center border-b-2 border-muted/50 pb-2 pl-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {t("columns.perfume")}
        </div>

        <div className="grid w-full grid-cols-5 justify-items-center border-b-2 border-muted/50 px-1 pb-2 text-center text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <GameTooltip
            className="h-7 w-7 items-center justify-center sm:h-8 sm:w-8"
            content={t("columns.brandTooltip")}
          >
            <span className="flex min-w-8 cursor-help justify-center underline decoration-muted-foreground/30 decoration-dotted underline-offset-2">
              {t("columns.brand")}
            </span>
          </GameTooltip>

          <GameTooltip
            className="h-7 w-7 items-center justify-center sm:h-8 sm:w-8"
            content={t("columns.perfumerTooltip")}
          >
            <span className="flex min-w-8 cursor-help justify-center underline decoration-muted-foreground/30 decoration-dotted underline-offset-2">
              {t("columns.perfumer")}
            </span>
          </GameTooltip>

          <GameTooltip
            className="h-7 w-7 items-center justify-center sm:h-8 sm:w-8"
            content={t("columns.yearTooltip")}
          >
            <span className="flex min-w-8 cursor-help justify-center underline decoration-muted-foreground/30 decoration-dotted underline-offset-2">
              {t("columns.year")}
            </span>
          </GameTooltip>

          <GameTooltip
            className="h-7 w-7 items-center justify-center sm:h-8 sm:w-8"
            content={t("columns.genderTooltip")}
          >
            <span className="flex min-w-8 cursor-help justify-center underline decoration-muted-foreground/30 decoration-dotted underline-offset-2">
              {t("columns.gender")}
            </span>
          </GameTooltip>

          <GameTooltip
            className="h-7 w-7 items-center justify-center sm:h-8 sm:w-8"
            content={t("columns.notesTooltip")}
          >
            <span className="flex min-w-8 cursor-help justify-center underline decoration-muted-foreground/30 decoration-dotted underline-offset-2">
              {t("columns.notes")}
            </span>
          </GameTooltip>
        </div>

        {attempts.map((attempt, index) => {
          const isActive = activeRowIndex === index;

          const handlePointerDown = (e: React.PointerEvent) => {
            if (e.pointerType === "touch") {
              isTouchReference.current = true;
              if (!isTouch) setIsTouch(true);
            }
          };

          const handleClick = (e: React.MouseEvent) => {
            if (!isTouchReference.current) return;
            e.preventDefault();
            setActiveRowIndex((previous) =>
              previous === index ? null : index,
            );
          };

          return (
            <AttemptRow
              activeRowIndex={activeRowIndex}
              attempt={attempt}
              dailyPerfume={dailyPerfume}
              handleClick={handleClick}
              handlePointerDown={handlePointerDown}
              index={index}
              isTouch={isTouch}
              key={`attempt-${attempt.perfumeId || attempt.guess || index}`}
              totalAttempts={attempts.length}
            />
          );
        })}

        {Array.from({ length: maxAttempts - attempts.length }).map(
          (_, i, array) => {
            const isLast = i === array.length - 1;
            const borderClass = isLast ? "" : "border-b border-muted/30";

            return (
              <div className="contents" key={`empty-attempt-${attempts.length + i}`}>
                <div
                  className={`flex items-center justify-center py-3 ${borderClass} min-h-[48px]`}
                >
                  <span className="block text-center font-[family-name:var(--font-playfair)] text-muted-foreground opacity-30">
                    {ROMAN_NUMERALS[attempts.length + i]}
                  </span>
                </div>
                <div className={`py-3 ${borderClass} min-h-[48px] pr-2 pl-2`}>
                  <span className="text-muted-foreground opacity-30">...</span>
                </div>
                <div className={`py-3 ${borderClass} min-h-[48px]`} />
              </div>
            );
          },
        )}
      </div>
    </section>
  );
}
