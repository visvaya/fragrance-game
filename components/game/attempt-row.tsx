import { Check, X, ArrowUp, ArrowDown, Waves } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { TruncatedCell } from "./attempt-log-truncated-cell";
import { GameTooltip } from "./game-tooltip";

import type { Attempt, DailyPerfume } from "./contexts";

const ROMAN_NUMERALS = ["I", "II", "III", "IV", "V", "VI"];

type AttemptRowProperties = {
  activeRowIndex: number | null;
  attempt: Attempt;
  dailyPerfume: DailyPerfume;
  handleClick: (e: React.MouseEvent) => void;
  handlePointerDown: (e: React.PointerEvent) => void;
  index: number;
  isTouch: boolean;
  totalAttempts: number;
};

/**
 *
 */
export function AttemptRow({
  activeRowIndex,
  attempt,
  dailyPerfume,
  handleClick,
  handlePointerDown,
  index,
  isTouch,
  totalAttempts,
}: AttemptRowProperties) {
  const t = useTranslations("AttemptLog");
  const isActive = activeRowIndex === index;

  return (
    <div className="group contents" data-attempt-row>
      <div
        className={cn(
          "relative z-10 flex items-center justify-center border-b border-muted/30 py-3 transition-all duration-300 group-last:border-0",
          isTouch && isActive ? "bg-muted/25" : "group-hover:bg-muted/25",
        )}
        id={`attempt-${index}`}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick(e as unknown as React.MouseEvent);
          }
        }}
        onPointerDown={handlePointerDown}
        role="button"
        tabIndex={0}
      >
        {index === totalAttempts - 1 && !attempt.isCorrect && (
          <div className="animate-flash-error pointer-events-none absolute inset-0 rounded-sm" />
        )}
        <span className="block w-full px-1 text-center font-[family-name:var(--font-playfair)] text-base text-muted-foreground">
          {ROMAN_NUMERALS[index]}
        </span>
      </div>

      <div
        className={cn(
          "relative z-10 flex min-w-0 flex-col justify-center border-b border-muted/30 py-3 pr-2 pl-2 transition-all duration-300 group-last:border-0",
          isTouch && isActive ? "bg-muted/25" : "group-hover:bg-muted/25",
        )}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick(e as unknown as React.MouseEvent);
          }
        }}
        onPointerDown={handlePointerDown}
        role="button"
        tabIndex={0}
      >
        {index === totalAttempts - 1 && !attempt.isCorrect && (
          <div className="animate-flash-error pointer-events-none absolute inset-0 rounded-sm" />
        )}
        {(() => {
          const concentration = attempt.concentration || "";
          let displayName = attempt.guess;
          if (
            concentration &&
            displayName.toLowerCase().endsWith(concentration.toLowerCase())
          ) {
            displayName = displayName
              .slice(0, Math.max(0, displayName.length - concentration.length))
              .trim();
          }

          return (
            <div className="flex flex-col gap-y-0.5 text-left">
              {/* Row 1: Name & Concentration */}
              {/* Mobile: stacked (each piece on its own line) */}
              <div className="flex flex-col gap-y-0.5 lg:hidden">
                <TruncatedCell
                  className="min-w-0 shrink"
                  content={displayName}
                />
                {concentration && concentration !== "Unknown" ? (
                  <TruncatedCell
                    className="min-w-0 shrink-[5]"
                    content={concentration}
                    textClassName="text-muted-foreground/80 text-xs font-normal truncate tracking-normal"
                  />
                ) : null}
              </div>
              {/* Desktop: inline with separator */}
              <TruncatedCell
                className="hidden min-w-0 lg:block"
                content={
                  concentration && concentration !== "Unknown"
                    ? `${displayName} · ${concentration}`
                    : displayName
                }
                textClassName="text-sm truncate tracking-normal"
              >
                <span className="font-semibold text-foreground">
                  {displayName}
                </span>
                {concentration && concentration !== "Unknown" ? (
                  <>
                    <span className="mx-1.5 text-xs text-muted-foreground/30">
                      ·
                    </span>
                    <span className="text-xs font-normal text-muted-foreground/80">
                      {concentration}
                    </span>
                  </>
                ) : null}
              </TruncatedCell>

              {/* Row 2: Brand & Year */}
              {/* Mobile: stacked (year always fully visible) */}
              <div className="flex flex-col gap-y-0.5 text-muted-foreground/80 lg:hidden">
                <TruncatedCell
                  className="min-w-[30px] shrink"
                  content={attempt.brand}
                  textClassName="text-xs font-medium truncate tracking-normal"
                />
                {attempt.year ? (
                  <span className="text-xs font-medium whitespace-nowrap">
                    {attempt.year}
                  </span>
                ) : null}
              </div>
              {/* Desktop: inline with separator */}
              <TruncatedCell
                className="hidden min-w-0 lg:block"
                content={
                  attempt.year
                    ? `${attempt.brand} · ${attempt.year}`
                    : attempt.brand
                }
                textClassName="text-xs font-medium truncate tracking-normal text-muted-foreground/80"
              >
                <span className="text-foreground">{attempt.brand}</span>
                {attempt.year ? (
                  <>
                    <span className="mx-1.5 font-normal text-muted-foreground/30">·</span>
                    <span className="text-foreground">{attempt.year}</span>
                  </>
                ) : null}
              </TruncatedCell>
            </div>
          );
        })()}
      </div>

      <div
        className={cn(
          "relative z-10 grid w-full grid-cols-5 items-center border-b border-muted/30 py-3 pr-2 pl-1 font-hand text-xl text-primary transition-all duration-300 group-last:border-0",
          isTouch && isActive ? "bg-muted/25" : "group-hover:bg-muted/25",
        )}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick(e as unknown as React.MouseEvent);
          }
        }}
        onPointerDown={handlePointerDown}
        role="button"
        tabIndex={0}
      >
        {index === totalAttempts - 1 && !attempt.isCorrect && (
          <div className="animate-flash-error pointer-events-none absolute inset-0 rounded-sm" />
        )}
        {/* Brand */}
        <div className="flex h-full items-center justify-center">
          {(() => {
            const targetMissing =
              !dailyPerfume.brand || dailyPerfume.brand === "Unknown";
            const guessMissing = !attempt.brand || attempt.brand === "Unknown";

            if (targetMissing || guessMissing) {
              return (
                <GameTooltip
                  className="h-7 w-7 items-center justify-center sm:h-8 sm:w-8"
                  content={t("tooltips.brandMissing")}
                >
                  <span className="inline-block cursor-help rounded-sm p-1 font-hand text-base leading-none text-muted-foreground opacity-50 transition-colors hover:bg-muted/60 active:bg-muted/60">
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
                  <div className="flex h-6 w-6 cursor-default items-center justify-center rounded-sm transition-colors hover:bg-muted/60 active:bg-muted/60">
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
                <span className="cursor-help rounded-sm p-1 opacity-50 transition-colors hover:bg-muted/60 active:bg-muted/60">
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
              !dailyPerfume.perfumer || dailyPerfume.perfumer === "Unknown";
            const guessMissing =
              !attempt.perfumers || attempt.perfumers.length === 0;
            if (targetMissing || guessMissing) {
              return (
                <GameTooltip
                  className="h-7 w-7 items-center justify-center sm:h-8 sm:w-8"
                  content={t("tooltips.perfumerMissing")}
                >
                  <span className="inline-block cursor-help rounded-sm p-1 font-hand text-base leading-none text-muted-foreground opacity-50 transition-colors hover:bg-muted/60 active:bg-muted/60">
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
                  <div className="flex h-6 w-6 cursor-default items-center justify-center rounded-sm transition-colors hover:bg-muted/60 active:bg-muted/60">
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
                  <span className="cursor-help rounded-sm p-1 transition-colors hover:bg-muted/60 active:bg-muted/60">
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
                  <span className="cursor-help rounded-sm p-1 opacity-50 transition-colors hover:bg-muted/60 active:bg-muted/60">
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
            const targetMissing = !dailyPerfume.year || dailyPerfume.year === 0;
            const guessMissing = !attempt.year || attempt.year === 0;
            if (targetMissing || guessMissing) {
              return (
                <GameTooltip
                  className="h-7 w-7 items-center justify-center sm:h-8 sm:w-8"
                  content={t("tooltips.yearMissing")}
                >
                  <span className="inline-block cursor-help rounded-sm p-1 font-hand text-base leading-none text-muted-foreground opacity-50 transition-colors hover:bg-muted/60 active:bg-muted/60">
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
                <div className="flex h-6 w-6 cursor-default items-center justify-center rounded-sm transition-colors hover:bg-muted/60 active:bg-muted/60">
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
                      "flex h-6 w-6 cursor-help items-center justify-center rounded-sm transition-colors hover:bg-muted/60 active:bg-muted/60",
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
            const guessGender = attempt.gender?.toLowerCase() || "unknown";
            const targetGender =
              dailyPerfume.gender?.toLowerCase() || "unknown";

            const targetMissing =
              targetGender === "unknown" || !dailyPerfume.gender;
            const guessMissing = guessGender === "unknown" || !attempt.gender;

            if (targetMissing || guessMissing) {
              return (
                <GameTooltip
                  className="h-7 w-7 items-center justify-center sm:h-8 sm:w-8"
                  content={t("tooltips.genderMissing")}
                >
                  <span className="inline-block cursor-help rounded-sm p-1 font-hand text-base leading-none text-muted-foreground opacity-50 transition-colors hover:bg-muted/60 active:bg-muted/60">
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
                  <div className="flex h-6 w-6 cursor-default items-center justify-center rounded-sm transition-colors hover:bg-muted/60 active:bg-muted/60">
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
                <span className="cursor-help rounded-sm p-1 opacity-50 transition-colors hover:bg-muted/60 active:bg-muted/60">
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
            const answerHasNotes =
              dailyPerfume.notes &&
              ((dailyPerfume.notes.top?.length || 0) > 0 ||
                (dailyPerfume.notes.heart?.length || 0) > 0 ||
                (dailyPerfume.notes.base?.length || 0) > 0);

            const isMissing =
              !answerHasNotes || attempt.hasGuessedNotes === false;

            if (isMissing) {
              return (
                <GameTooltip
                  className="h-7 w-7 items-center justify-center sm:h-8 sm:w-8"
                  content={t("tooltips.notesMissing")}
                >
                  <span className="inline-block cursor-help rounded-sm p-1 font-hand text-base leading-none text-muted-foreground opacity-50 transition-colors hover:bg-muted/60 active:bg-muted/60">
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
                <div className="flex h-6 w-6 cursor-default items-center justify-center rounded-sm transition-colors hover:bg-muted/60 active:bg-muted/60">
                  <Check className="h-5 w-5 text-success" />
                </div>
              </GameTooltip>
            ) : (
              <GameTooltip
                className="h-7 w-7 items-center justify-center sm:h-8 sm:w-8"
                content={t("tooltips.notesPercentage", {
                  percent: Math.round(attempt.feedback.notesMatch * 100),
                })}
              >
                <span
                  className={`flex cursor-help items-center rounded-sm px-1.5 py-1 font-hand text-sm leading-none transition-colors hover:bg-muted/60 active:bg-muted/60 sm:text-base ${attempt.feedback.notesMatch >= 0.4 ? "text-warning" : "text-muted-foreground opacity-50"}`}
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
}
