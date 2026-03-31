"use client";

// eslint-disable-next-line no-restricted-imports -- scroll: auto-scroll to new attempt and on game end (dep effects)
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

import { ScrollableRow } from "@/components/game/scrollable-row";
import { AttemptLogSkeleton } from "@/components/game/skeletons";
import { lenisScrollTo } from "@/components/providers/smooth-scroll-provider";
import { useIsOverflowing } from "@/hooks/use-is-overflowing";
import { useScaleOnTap } from "@/hooks/use-scale-on-tap";
import { useMountEffect } from "@/lib/hooks/use-mount-effect";
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
  const { canScrollLeft, canScrollRight, ref } =
    useIsOverflowing<HTMLDivElement>();

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
  useMountEffect(() => {
    // eslint-disable-next-line unicorn/consistent-function-scoping -- closes over isTouchReference and setActiveRowIndex from component scope
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
  });

  if (dailyPerfume.id === "skeleton") {
    return <AttemptLogSkeleton t={t} />;
  }

  const maskClass = (() => {
    if (canScrollLeft && canScrollRight) {
      return "[mask-image:linear-gradient(to_right,transparent_0,black_20px,black_calc(100%-20px),transparent_100%)]";
    }
    if (canScrollLeft) {
      return "[mask-image:linear-gradient(to_right,transparent_0,black_20px,black_100%)]";
    }
    if (canScrollRight) {
      return "[mask-image:linear-gradient(to_right,black_calc(100%-20px),transparent_100%)]";
    }
    return "";
  })();

  return (
    <section className="panel-standard">
      {/* Scrollable Box for attempts title */}
      <div className="mb-1 flex w-fit max-w-full min-w-0 cursor-default items-center">
        <ScrollableRow className="flex w-full items-center gap-2 pr-1 pb-1">
          <span
            className={cn(
              "inline-flex transition-transform duration-300 hover:scale-[1.15]",
              iconScaled && "scale-[1.15]",
            )}
            onPointerDown={handleIconTap}
          >
            <ScrollText className="size-4 shrink-0 text-muted-foreground" />
          </span>
          <GameTooltip
            className="max-w-full min-w-0"
            content={t("titleTooltip")}
            sideOffset={6}
          >
            <h2 className="font-[family-name:var(--font-playfair)] text-base whitespace-nowrap text-foreground lowercase">
              {t("title")}
            </h2>
          </GameTooltip>
        </ScrollableRow>
      </div>

      <div
        className={cn(
          "-mb-3 grid grid-cols-[1.5rem_1fr_minmax(6.5625rem,auto)] overflow-x-auto [scrollbar-width:none] sm:grid-cols-[2rem_1fr_minmax(6.5625rem,auto)] [&::-webkit-scrollbar]:hidden",
          maskClass,
        )}
        ref={ref}
      >
        {/* Header Row - spread into grid columns */}
        <div className="flex items-center justify-center border-b-2 border-muted/50 pb-[0.1875rem] text-[0.8125rem] font-semibold tracking-widest text-muted-foreground lowercase transition-colors">
          <GameTooltip
            className="size-8 items-center justify-center rounded-sm transition-colors hover:bg-muted/50 hover:text-foreground active:bg-muted/50 active:text-foreground"
            content={t("columns.attemptTooltip")}
          >
            <span className="w-full cursor-help text-center underline decoration-muted-foreground/30 decoration-dotted underline-offset-2">
              {t("columns.attempt")}
            </span>
          </GameTooltip>
        </div>

        <div className="flex items-center border-b-2 border-muted/50 pb-[0.1875rem] pl-1 text-[0.8125rem] font-semibold tracking-widest text-muted-foreground lowercase sm:pl-2">
          {t("columns.perfume")}
        </div>

        <div className="grid w-full grid-cols-5 justify-items-center border-b-2 border-muted/50 px-0 pb-1 text-center text-[0.8125rem] font-semibold tracking-widest text-muted-foreground lowercase sm:px-1">
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
                  <span className="block w-full text-center text-[0.8125rem] font-normal text-muted-foreground opacity-30 sm:pr-1">
                    {attempts.length + i + 1}
                  </span>
                </div>
                <div
                  className={`py-3 ${borderClass} min-h-[4rem] px-1 sm:px-2`}
                >
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
