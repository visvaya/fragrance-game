"use client";

import { useEffect, useRef, useState } from "react";

import { X, ArrowUp, ArrowDown, Waves, Check, ScrollText } from "lucide-react";

import { cn } from "@/lib/utils";

import { useGameState } from "./contexts";
import { GameTooltip } from "./game-tooltip";

const ROMAN_NUMERALS = ["I", "II", "III", "IV", "V", "VI"];

import { useTranslations } from "next-intl";

/**
 *
 */
export function AttemptLog() {
  const { attempts, dailyPerfume, gameState, maxAttempts } = useGameState();
  const t = useTranslations("AttemptLog");
  const previousAttemptsLength = useRef(attempts.length);
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);
  const isTouchReference = useRef(false);

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
            <div
              className="group contents"
              data-attempt-row
              key={`attempt-${index}`}
            >
              <div
                className={cn(
                  "relative z-10 flex items-center justify-center border-b border-muted/30 py-3 transition-all duration-300 group-last:border-0",
                  isTouchReference.current && isActive
                    ? "bg-muted/40"
                    : "group-hover:bg-muted/40",
                )}
                id={`attempt-${index}`}
                onClick={handleClick}
                onPointerDown={handlePointerDown}
              >
                {index === attempts.length - 1 && !attempt.isCorrect && (
                  <div className="animate-flash-error pointer-events-none absolute inset-0 rounded-sm" />
                )}
                <span className="block w-full px-1 text-center font-[family-name:var(--font-playfair)] text-sm text-muted-foreground">
                  {ROMAN_NUMERALS[index]}
                </span>
              </div>

              <div
                className={cn(
                  "relative z-10 flex min-w-0 flex-col justify-center border-b border-muted/30 py-3 pr-2 pl-2 transition-all duration-300 group-last:border-0",
                  isTouchReference.current && isActive
                    ? "bg-muted/40"
                    : "group-hover:bg-muted/40",
                )}
                onClick={handleClick}
                onPointerDown={handlePointerDown}
              >
                {index === attempts.length - 1 && !attempt.isCorrect && (
                  <div className="animate-flash-error pointer-events-none absolute inset-0 rounded-sm" />
                )}
                {(() => {
                  const concentration = attempt.concentration || "";
                  let displayName = attempt.guess;
                  if (
                    concentration &&
                    displayName
                      .toLowerCase()
                      .endsWith(concentration.toLowerCase())
                  ) {
                    displayName = displayName
                      .slice(
                        0,
                        Math.max(0, displayName.length - concentration.length),
                      )
                      .trim();
                  }

                  return (
                    <div className="flex flex-col gap-y-0.5 text-left">
                      {/* Row 1: Name & Concentration */}
                      <div className="flex w-full min-w-0 flex-col gap-y-0.5 lg:flex-row lg:items-baseline lg:gap-x-1.5 lg:gap-y-0">
                        <TruncatedCell
                          className="min-w-0 shrink"
                          content={displayName}
                        />
                        {concentration && concentration !== "Unknown" ? (
                          <div className="flex items-baseline lg:gap-1.5">
                            <span className="hidden shrink-0 text-xs text-muted-foreground/30 lg:inline">
                              •
                            </span>
                            <TruncatedCell
                              className="min-w-0 shrink-[5]"
                              content={concentration}
                              textClassName="text-muted-foreground/80 text-xs font-normal truncate tracking-normal"
                            />
                          </div>
                        ) : null}
                      </div>

                      {/* Row 2: Brand & Year */}
                      <div className="flex min-w-0 flex-col gap-y-0.5 text-muted-foreground/80 lg:flex-row lg:items-baseline lg:gap-x-1.5 lg:gap-y-0">
                        {/* Brand */}
                        <TruncatedCell
                          className="min-w-[30px] shrink"
                          content={attempt.brand}
                          textClassName="text-xs font-normal truncate tracking-normal"
                        />

                        {/* Year */}
                        {attempt.year ? (
                          <div className="flex items-baseline lg:gap-1.5">
                            <span className="hidden shrink-0 text-xs text-muted-foreground/30 lg:inline">
                              •
                            </span>
                            <TruncatedCell
                              className="shrink-0"
                              content={String(attempt.year)}
                              textClassName="text-xs font-normal whitespace-nowrap tracking-normal"
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div
                className={cn(
                  "relative z-10 grid w-full grid-cols-5 items-center border-b border-muted/30 py-3 pr-2 pl-1 font-[family-name:var(--font-hand)] text-xl text-primary transition-all duration-300 group-last:border-0",
                  isTouchReference.current && isActive
                    ? "bg-muted/40"
                    : "group-hover:bg-muted/40",
                )}
                onClick={handleClick}
                onPointerDown={handlePointerDown}
              >
                {index === attempts.length - 1 && !attempt.isCorrect && (
                  <div className="animate-flash-error pointer-events-none absolute inset-0 rounded-sm" />
                )}
                {/* Brand */}
                <div className="flex h-full items-center justify-center">
                  {(() => {
                    const isMissing =
                      !dailyPerfume.brand || dailyPerfume.brand === "Unknown";
                    if (isMissing) {
                      return (
                        <GameTooltip
                          className="h-7 w-7 items-center justify-center sm:h-8 sm:w-8"
                          content={t("tooltips.brandMissing")}
                        >
                          <span className="inline-block cursor-help px-1 font-[family-name:var(--font-hand)] text-base leading-none text-muted-foreground opacity-50">
                            ?
                          </span>
                        </GameTooltip>
                      );
                    }

                    if (attempt.feedback.brandMatch) {
                      return (
                        <GameTooltip
                          className="h-7 w-7 items-center justify-center sm:h-8 sm:w-8"
                          content={t("tooltips.brandCorrect")}
                        >
                          <div className="flex h-6 w-6 items-center justify-center">
                            <Check className="h-4 w-4 text-success" />
                          </div>
                        </GameTooltip>
                      );
                    }

                    return (
                      <GameTooltip
                        className="h-7 w-7 items-center justify-center sm:h-8 sm:w-8"
                        content={t("tooltips.brandIncorrect")}
                      >
                        <span className="cursor-help opacity-50">
                          <X
                            className="h-4 w-4 -skew-x-12 transform text-muted-foreground"
                            strokeWidth={1.5}
                          />
                        </span>
                      </GameTooltip>
                    );
                  })()}
                </div>

                {/* Perfumer */}
                <div className="flex h-full items-center justify-center">
                  {(() => {
                    const targetMissing =
                      !dailyPerfume.perfumer ||
                      dailyPerfume.perfumer === "Unknown";
                    const guessMissing =
                      !attempt.perfumers || attempt.perfumers.length === 0;
                    if (targetMissing || guessMissing) {
                      return (
                        <GameTooltip
                          className="h-7 w-7 items-center justify-center sm:h-8 sm:w-8"
                          content={t("tooltips.perfumerMissing")}
                        >
                          <span className="inline-block cursor-help px-1 font-[family-name:var(--font-hand)] text-base leading-none text-muted-foreground opacity-50">
                            ?
                          </span>
                        </GameTooltip>
                      );
                    }

                    if (attempt.feedback.perfumerMatch === "full") {
                      return (
                        <GameTooltip
                          className="h-7 w-7 items-center justify-center sm:h-8 sm:w-8"
                          content={t("tooltips.perfumerFull")}
                        >
                          <div className="flex h-6 w-6 items-center justify-center">
                            <Check className="h-4 w-4 text-success" />
                          </div>
                        </GameTooltip>
                      );
                    } else if (attempt.feedback.perfumerMatch === "partial") {
                      return (
                        <GameTooltip
                          className="h-7 w-7 items-center justify-center sm:h-8 sm:w-8"
                          content={t("tooltips.perfumerPartial")}
                        >
                          <span className="cursor-help">
                            <Waves
                              className="h-4 w-4 -skew-x-12 transform text-muted-foreground opacity-50"
                              strokeWidth={1.5}
                            />
                          </span>
                        </GameTooltip>
                      );
                    } else {
                      return (
                        <GameTooltip
                          className="h-7 w-7 items-center justify-center sm:h-8 sm:w-8"
                          content={t("tooltips.perfumerIncorrect")}
                        >
                          <span className="cursor-help opacity-50">
                            <X
                              className="h-4 w-4 -skew-x-12 transform text-muted-foreground"
                              strokeWidth={1.5}
                            />
                          </span>
                        </GameTooltip>
                      );
                    }
                  })()}
                </div>

                {/* Year */}
                <div className="flex h-full items-center justify-center">
                  {(() => {
                    const targetMissing =
                      !dailyPerfume.year || dailyPerfume.year === 0;
                    const guessMissing = !attempt.year || attempt.year === 0;
                    if (targetMissing || guessMissing) {
                      return (
                        <GameTooltip
                          className="h-7 w-7 items-center justify-center sm:h-8 sm:w-8"
                          content={t("tooltips.yearMissing")}
                        >
                          <span className="inline-block cursor-help px-1 font-[family-name:var(--font-hand)] text-base leading-none text-muted-foreground opacity-50">
                            ?
                          </span>
                        </GameTooltip>
                      );
                    }

                    return attempt.feedback.yearMatch === "correct" ? (
                      <GameTooltip
                        className="h-7 w-7 items-center justify-center sm:h-8 sm:w-8"
                        content={t("tooltips.yearCorrect")}
                      >
                        <div className="flex h-6 w-6 items-center justify-center">
                          <Check className="h-4 w-4 text-success" />
                        </div>
                      </GameTooltip>
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center">
                        <GameTooltip
                          className="h-7 w-7 items-center justify-center sm:h-8 sm:w-8"
                          content={
                            attempt.feedback.yearMatch === "close"
                              ? attempt.feedback.yearDirection === "higher"
                                ? t("tooltips.yearCloseHigher")
                                : t("tooltips.yearCloseLower")
                              : attempt.feedback.yearDirection === "higher"
                                ? t("tooltips.yearWrongHigher")
                                : t("tooltips.yearWrongLower")
                          }
                        >
                          <span
                            className={cn(
                              "flex h-4 w-4 cursor-help items-center justify-center",
                              attempt.feedback.yearMatch === "close"
                                ? "text-warning"
                                : "text-muted-foreground opacity-50",
                            )}
                          >
                            {attempt.feedback.yearDirection === "higher" ? (
                              <ArrowUp
                                className="h-4 w-4 -skew-x-12 transform"
                                strokeWidth={1.5}
                              />
                            ) : (
                              <ArrowDown
                                className="h-4 w-4 -skew-x-12 transform"
                                strokeWidth={1.5}
                              />
                            )}
                          </span>
                        </GameTooltip>
                      </div>
                    );
                  })()}
                </div>

                {/* Gender */}
                <div className="flex h-full items-center justify-center">
                  {(() => {
                    const guessGender =
                      attempt.gender?.toLowerCase() || "unknown";
                    const targetGender =
                      dailyPerfume.gender?.toLowerCase() || "unknown";

                    const targetMissing =
                      targetGender === "unknown" || !dailyPerfume.gender;
                    const guessMissing =
                      guessGender === "unknown" || !attempt.gender;

                    if (targetMissing || guessMissing) {
                      return (
                        <GameTooltip
                          className="h-7 w-7 items-center justify-center sm:h-8 sm:w-8"
                          content={t("tooltips.genderMissing")}
                        >
                          <span className="inline-block cursor-help px-1 font-[family-name:var(--font-hand)] text-base leading-none text-muted-foreground opacity-50">
                            ?
                          </span>
                        </GameTooltip>
                      );
                    }

                    if (guessGender === targetGender) {
                      return (
                        <GameTooltip
                          className="h-7 w-7 items-center justify-center sm:h-8 sm:w-8"
                          content={t("tooltips.genderCorrect")}
                        >
                          <div className="flex h-6 w-6 items-center justify-center">
                            <Check className="h-4 w-4 text-success" />
                          </div>
                        </GameTooltip>
                      );
                    }

                    return (
                      <GameTooltip
                        className="h-7 w-7 items-center justify-center sm:h-8 sm:w-8"
                        content={t("tooltips.genderIncorrect")}
                      >
                        <span className="cursor-help opacity-50">
                          <X
                            className="h-4 w-4 -skew-x-12 transform text-muted-foreground"
                            strokeWidth={1.5}
                          />
                        </span>
                      </GameTooltip>
                    );
                  })()}
                </div>

                {/* Notes */}
                <div className="flex h-full items-center justify-center">
                  {(() => {
                    const isMissing =
                      !dailyPerfume.notes ||
                      ((dailyPerfume.notes.top?.length || 0) === 0 &&
                        (dailyPerfume.notes.heart?.length || 0) === 0 &&
                        (dailyPerfume.notes.base?.length || 0) === 0);

                    if (isMissing) {
                      return (
                        <GameTooltip
                          className="h-7 w-7 items-center justify-center sm:h-8 sm:w-8"
                          content={t("tooltips.notesMissing")}
                        >
                          <span className="inline-block cursor-help px-1 font-[family-name:var(--font-hand)] text-base leading-none text-muted-foreground opacity-50">
                            ?
                          </span>
                        </GameTooltip>
                      );
                    }

                    return attempt.feedback.notesMatch >= 1 ? (
                      <GameTooltip
                        className="h-7 w-7 items-center justify-center sm:h-8 sm:w-8"
                        content={t("tooltips.notesCorrect")}
                      >
                        <div className="flex h-6 w-6 items-center justify-center">
                          <Check className="h-5 w-5 text-success" />
                        </div>
                      </GameTooltip>
                    ) : (
                      <GameTooltip
                        className="h-7 w-7 items-center justify-center sm:h-8 sm:w-8"
                        content={t("tooltips.notesPercentage", {
                          percent: Math.round(
                            attempt.feedback.notesMatch * 100,
                          ),
                        })}
                      >
                        <span
                          className={`flex cursor-help items-center font-[family-name:var(--font-hand)] text-sm leading-none sm:text-base ${attempt.feedback.notesMatch >= 0.4 ? "text-warning" : "text-muted-foreground opacity-50"}`}
                        >
                          {Math.round(attempt.feedback.notesMatch * 100)}%
                        </span>
                      </GameTooltip>
                    );
                  })()}
                </div>
              </div>
            </div>
          );
        })}

        {Array.from({ length: maxAttempts - attempts.length }).map(
          (_, i, array) => {
            const isLast = i === array.length - 1;
            const borderClass = isLast ? "" : "border-b border-muted/30";

            return (
              <div className="contents" key={`empty-${i}`}>
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

function TruncatedCell({
  children,
  className,
  content,
  textClassName = "font-medium text-foreground text-sm line-clamp-1 break-words max-w-full tracking-normal",
}: {
  children?: React.ReactNode;
  className?: string;
  content: string;
  textClassName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  // Use IntersectionObserver for more efficient truncation detection
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Check truncation only once after mount and on resize (debounced)
    const checkTruncation = () => {
      const hasHorizontalOverflow = element.scrollWidth > element.offsetWidth;
      const hasVerticalOverflow = element.scrollHeight > element.clientHeight;
      setIsTruncated(hasHorizontalOverflow || hasVerticalOverflow);
    };

    // Initial check with slight delay to ensure layout is complete
    const timeoutId = setTimeout(checkTruncation, 0);

    // Debounced resize handler
    let resizeTimeoutId: number;
    const handleResize = () => {
      clearTimeout(resizeTimeoutId);
      resizeTimeoutId = window.setTimeout(checkTruncation, 150);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(resizeTimeoutId);
      window.removeEventListener("resize", handleResize);
    };
  }, [content, children]);

  const inner = (
    <div className={cn(textClassName, "w-full")} ref={ref}>
      {children || content}
    </div>
  );

  if (isTruncated) {
    return (
      <GameTooltip className={className} content={content}>
        {inner}
      </GameTooltip>
    );
  }

  return <div className={className}>{inner}</div>;
}
