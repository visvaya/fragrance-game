"use client";

import { memo, useEffect, useRef, useState } from "react";

import {
  Calendar,
  Music,
  ScrollText,
  Store,
  User,
  Users,
  VenusAndMars,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { AttemptLogSkeleton } from "@/components/game/skeletons";
import { lenisScrollTo } from "@/components/providers/smooth-scroll-provider";
import { useScaleOnTap } from "@/hooks/use-scale-on-tap";
import { cn } from "@/lib/utils";

import { AttemptRow } from "./attempt-row";
import { useGameState, useUIPreferences } from "./contexts";
import { GameTooltip } from "./game-tooltip";

/**
 * Komponent logu prób gracza.
 */
export const AttemptLog = memo(function AttemptLog() {
  const { attempts, dailyPerfume, gameState, loading, maxAttempts } =
    useGameState();
  const { uiPreferences } = useUIPreferences();
  const t = useTranslations("AttemptLog");
  const { handlePointerDown: handleIconTap, scaled: iconScaled } =
    useScaleOnTap();
  const previousAttemptsLength = useRef(attempts.length);
  // Becomes true after the FIRST loading→false transition (= initial session restore done).
  // After that, loading cycles true→false only during guess submissions, which is exactly
  // when we want the scroll/flash to fire.
  const hasInitialized = useRef(false);
  // Tracks previous gameState to detect playing→won/lost transition in-session only.
  const previousGameStateReference = useRef<string | null>(null);
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);
  // Index of the attempt that was just submitted in this session.
  // Stays null for attempts restored from session on page load, so
  // animate-flash-error only fires on freshly submitted rows, not on reload.
  const [newAttemptIndex, setNewAttemptIndex] = useState<number | null>(null);
  const isTouchReference = useRef(false);
  const [isTouch, setIsTouch] = useState(false);

  // Scroll to new attempt and mark it as new (enables flash animation).
  // Only fires when a genuine new attempt is submitted, not on initial session restore.
  useEffect(() => {
    // First loading→false = initial restore complete. Sync attempts count and bail out
    // so we never scroll/flash for attempts that were restored from the server.
    if (!loading && !hasInitialized.current) {
      hasInitialized.current = true;
      previousAttemptsLength.current = attempts.length;
      return;
    }

    if (
      hasInitialized.current &&
      attempts.length > previousAttemptsLength.current &&
      gameState === "playing" &&
      !loading
    ) {
      const lastIndex = attempts.length - 1;
      setNewAttemptIndex(lastIndex);
      if (uiPreferences.autoScroll) {
        const element = document.querySelector(`#attempt-${lastIndex}`);
        if (element) {
          const scrollTimer = setTimeout(() => {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 100);
          return () => clearTimeout(scrollTimer);
        }
      }
    }
    previousAttemptsLength.current = attempts.length;
  }, [attempts.length, gameState, loading, uiPreferences.autoScroll]);

  // Scroll to top on game end — only when game JUST ended in this session (playing→won/lost).
  // previousGameStateReference guards against spurious scroll on page restore where gameState is
  // already "won"/"lost" from mount (previousGameStateReference.current stays null).
  useEffect(() => {
    const justEnded =
      previousGameStateReference.current === "playing" &&
      (gameState === "won" || gameState === "lost");
    previousGameStateReference.current = gameState;
    if (justEnded && uiPreferences.autoScroll) {
      const endTimer = setTimeout(() => {
        lenisScrollTo(0);
      }, 300);
      return () => clearTimeout(endTimer);
    }
  }, [gameState, uiPreferences.autoScroll]);

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

  if (dailyPerfume.id === "skeleton") {
    return <AttemptLogSkeleton t={t} />;
  }

  return (
    <section className="panel-standard">
      <div className="mb-4 flex w-fit cursor-default items-center">
        <GameTooltip content={t("titleTooltip")} sideOffset={6}>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex transition-transform duration-300 hover:scale-[1.15]",
                iconScaled && "scale-[1.15]",
              )}
              onPointerDown={handleIconTap}
            >
              <ScrollText className="size-4 text-muted-foreground" />
            </span>
            <h2 className="font-[family-name:var(--font-playfair)] text-lg text-foreground lowercase">
              {t("title")}
            </h2>
          </div>
        </GameTooltip>
      </div>

      <div className="grid grid-cols-[32px_1fr_minmax(105px,auto)]">
        {/* Header Row - spread into grid columns */}
        <div className="flex items-center justify-center border-b-2 border-muted/50 pb-2 text-sm font-semibold tracking-widest text-muted-foreground/70 lowercase transition-colors">
          <GameTooltip
            className="size-8 items-center justify-center rounded-sm transition-colors hover:bg-muted/50 hover:text-foreground active:bg-muted/50 active:text-foreground"
            content={t("columns.attemptTooltip")}
          >
            <span className="w-full cursor-help text-center underline decoration-muted-foreground/30 decoration-dotted underline-offset-2">
              {t("columns.attempt")}
            </span>
          </GameTooltip>
        </div>

        <div className="flex items-center border-b-2 border-muted/50 pb-2 pl-2 text-sm font-semibold tracking-widest text-muted-foreground/70 lowercase">
          {t("columns.perfume")}
        </div>

        <div className="grid w-full grid-cols-5 justify-items-center border-b-2 border-muted/50 px-1 pb-2 text-center text-sm font-semibold tracking-widest text-muted-foreground/70 lowercase">
          <GameTooltip
            className="size-8 items-center justify-center rounded-sm transition-colors hover:bg-muted/50 hover:text-foreground active:bg-muted/50 active:text-foreground"
            content={t("columns.brandTooltip")}
          >
            <span className="flex cursor-help justify-center underline decoration-muted-foreground/30 decoration-dotted underline-offset-2">
              <Store className="size-4" />
            </span>
          </GameTooltip>

          <GameTooltip
            className="size-8 items-center justify-center rounded-sm transition-colors hover:bg-muted/50 hover:text-foreground active:bg-muted/50 active:text-foreground"
            content={
              attempts.length > 0 && dailyPerfume.perfumer.includes(",")
                ? t("columns.perfumersTooltip")
                : t("columns.perfumerTooltip")
            }
          >
            <span className="flex cursor-help justify-center underline decoration-muted-foreground/30 decoration-dotted underline-offset-2">
              {attempts.length > 0 && dailyPerfume.perfumer.includes(",") ? (
                <Users className="size-4" />
              ) : (
                <User className="size-4" />
              )}
            </span>
          </GameTooltip>

          <GameTooltip
            className="size-8 items-center justify-center rounded-sm transition-colors hover:bg-muted/50 hover:text-foreground active:bg-muted/50 active:text-foreground"
            content={t("columns.yearTooltip")}
          >
            <span className="flex cursor-help justify-center underline decoration-muted-foreground/30 decoration-dotted underline-offset-2">
              <Calendar className="size-4" />
            </span>
          </GameTooltip>

          <GameTooltip
            className="size-8 items-center justify-center rounded-sm transition-colors hover:bg-muted/50 hover:text-foreground active:bg-muted/50 active:text-foreground"
            content={t("columns.genderTooltip")}
          >
            <span className="flex cursor-help justify-center underline decoration-muted-foreground/30 decoration-dotted underline-offset-2">
              <VenusAndMars className="size-4" />
            </span>
          </GameTooltip>

          <GameTooltip
            className="size-8 items-center justify-center rounded-sm transition-colors hover:bg-muted/50 hover:text-foreground active:bg-muted/50 active:text-foreground"
            content={t("columns.notesTooltip")}
          >
            <span className="flex cursor-help justify-center underline decoration-muted-foreground/30 decoration-dotted underline-offset-2">
              <Music className="size-4" />
            </span>
          </GameTooltip>
        </div>

        {attempts.map((attempt, index) => {
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
              isNew={index === newAttemptIndex}
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
              <div
                className="contents"
                key={`empty-attempt-${attempts.length + i}`}
              >
                <div
                  className={`flex items-center justify-center py-3 ${borderClass} min-h-[4rem]`}
                >
                  <span className="block w-full pr-1 text-center text-[0.8125rem] font-normal text-muted-foreground opacity-30">
                    {attempts.length + i + 1}
                  </span>
                </div>
                <div className={`py-3 ${borderClass} min-h-[4rem] px-2`}>
                  <span className="text-sm font-medium text-muted-foreground opacity-30">
                    ...
                  </span>
                </div>
                <div className={`py-3 ${borderClass} min-h-[4rem]`} />
              </div>
            );
          },
        )}
      </div>
    </section>
  );
});
