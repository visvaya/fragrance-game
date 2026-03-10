"use client";

import { memo } from "react";

import { Tag, Lock } from "lucide-react";
import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";
import { useScaleOnTap } from "@/hooks/use-scale-on-tap";
import { MASK_CHAR, GENERIC_PLACEHOLDER } from "@/lib/constants";
import { cn } from "@/lib/utils";

import { useGameState } from "../contexts";
import { DotFiller } from "../dot-filler";
import { GameTooltip } from "../game-tooltip";

import { MaskSlot } from "./mask-slot";

/**
 *
 */
export const MetaClues = memo(function MetaClues() {
  const {
    currentAttempt,
    dailyPerfume,
    gameState,
    isGenderRevealed,
    revealedBrand,
    revealedPerfumer,
    revealedYear,
    revealLevel,
  } = useGameState();
  const hasMultiplePerfumers = dailyPerfume.perfumer.includes(",");
  const t = useTranslations("MetaClues");
  const { handlePointerDown: handleIconTap, scaled: iconScaled } =
    useScaleOnTap();

  // Skeleton state — structure mirrors the real layout exactly.
  // Static translations shown as-is; only badge values use <Skeleton> bars.
  if (dailyPerfume.id === "skeleton") {
    return (
      <div className="flex h-full flex-col p-0">
        {/* Title row — identical structure to real header */}
        <div className="mb-4 flex w-fit cursor-default items-center">
          <div className="flex items-center gap-2">
            <span className="inline-flex">
              <Tag className="size-4  text-muted-foreground" />
            </span>
            <h2 className="font-[family-name:var(--font-playfair)] text-lg tracking-wide text-foreground lowercase opacity-40">
              {t("identity")}
            </h2>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-5">
          {/* Brand row */}
          <div className="flex flex-col items-start gap-0.5">
            <span className="text-xs font-semibold tracking-widest text-muted-foreground/40 lowercase">
              {t("brand")}
            </span>
            <Skeleton className="min-h-[1.375rem] w-[8rem] py-1" />
          </div>
          {/* Perfumer row */}
          <div className="flex flex-col items-start gap-0.5">
            <span className="text-xs font-semibold tracking-widest text-muted-foreground/40 lowercase">
              {t("perfumer")}
            </span>
            <Skeleton className="min-h-[1.375rem] w-[9rem] py-1" />
          </div>
          {/* Year + Gender row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col items-start gap-0.5">
              <span className="text-xs font-semibold tracking-widest text-muted-foreground/40 lowercase">
                {t("year")}
              </span>
              <Skeleton className="min-h-[1.375rem] w-full py-1" />
            </div>
            <div className="flex flex-col items-start gap-0.5">
              <span className="text-xs font-semibold tracking-widest text-muted-foreground/40 lowercase">
                {t("gender")}
              </span>
              <Skeleton className="min-h-[1.375rem] w-full py-1" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const clues = [
    { key: "brand", value: revealedBrand },
    { key: "perfumer", value: revealedPerfumer },
    { key: "year", value: revealedYear },
    {
      key: "gender",
      value:
        revealLevel >= 5 ||
        isGenderRevealed ||
        gameState === "won" ||
        gameState === "lost"
          ? dailyPerfume.gender
          : GENERIC_PLACEHOLDER.repeat(5),
    },
  ];

  return (
    <div className="flex h-full flex-col p-0">
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
              <Tag className="size-4  text-muted-foreground" />
            </span>
            <h2 className="font-[family-name:var(--font-playfair)] text-lg tracking-wide text-foreground lowercase">
              {t("identity")}
            </h2>
          </div>
        </GameTooltip>
      </div>

      <div className="flex flex-1 flex-col gap-5">
        {/* Marka + Perfumiarz — pełna szerokość */}
        {clues.slice(0, 2).map((clue) => (
          <div
            className="flex w-full flex-col items-start gap-0.5"
            key={clue.key}
          >
            {/* Label */}
            <span className="w-full text-xs font-semibold tracking-widest text-muted-foreground/70 lowercase">
              {clue.key === "perfumer" && hasMultiplePerfumers
                ? t("perfumers")
                : t(clue.key)}
            </span>

            {/* Value (Slots or Text) */}
            <div className="flex w-full flex-wrap items-center gap-2">
              {clue.key === "perfumer" &&
              clue.value !== GENERIC_PLACEHOLDER.repeat(5) ? (
                // Split multi-perfumer values into separate badges
                clue.value.split(", ").map((perfumer, itemIndex, array) => {
                  const isLast = itemIndex === array.length - 1;
                  const badge = (
                    <MetaBadge
                      clueKey={clue.key}
                      currentAttempt={currentAttempt}
                      key={`${clue.key}-${perfumer}-${itemIndex}`}
                      t={t}
                      value={perfumer}
                    />
                  );

                  if (isLast) {
                    return (
                      <div
                        className="flex min-w-0 flex-[1_1_0px] items-center gap-2"
                        key={`wrapper-${itemIndex}`}
                      >
                        {badge}
                        <DotFiller className="pr-2" />
                      </div>
                    );
                  }
                  return badge;
                })
              ) : (
                // Single badge for other clues
                <div
                  className="flex min-w-0 flex-[1_1_0px] items-center gap-2"
                  key="single-wrapper"
                >
                  <MetaBadge
                    clueKey={clue.key}
                    currentAttempt={currentAttempt}
                    t={t}
                    value={clue.value}
                  />
                  <DotFiller className="pr-2" />
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Rok + Płeć — siatka 2-kolumnowa */}
        <div className="grid grid-cols-2 gap-4">
          {clues.slice(2).map((clue) => (
            <div className="flex flex-col items-start gap-0.5" key={clue.key}>
              {/* Label */}
              <span className="w-full text-xs font-semibold tracking-widest text-muted-foreground/70 lowercase">
                {t(clue.key)}
              </span>

              {/* Value */}
              <div className="flex w-full flex-wrap items-center gap-2">
                <div className="flex min-w-0 flex-[1_1_0px] items-center gap-2">
                  <MetaBadge
                    clueKey={clue.key}
                    currentAttempt={currentAttempt}
                    t={t}
                    value={clue.value}
                  />
                  <DotFiller className="pr-2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
function MetaBadge({
  clueKey,
  currentAttempt,
  t,
  value,
}: Readonly<{
  clueKey: string;
  currentAttempt: number;
  t: (key: string, values?: Record<string, string | number>) => string;
  value: string;
}>) {
  // Translate "Unknown" for i18n support
  const translatedValue = value === "Unknown" ? t("unknown") : value;
  const words =
    translatedValue === GENERIC_PLACEHOLDER.repeat(5)
      ? [GENERIC_PLACEHOLDER.repeat(5)]
      : translatedValue.split(" ");
  const isFullyRevealed =
    value !== "Unknown" &&
    !translatedValue.includes(MASK_CHAR) &&
    translatedValue !== GENERIC_PLACEHOLDER.repeat(5);

  return (
    <div className="group inline-flex min-h-[1.375rem] max-w-full cursor-default flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 rounded-md border border-border bg-secondary/50 px-2.5 py-1 text-sm font-normal text-muted-foreground transition-colors duration-300 hover:bg-secondary">
      {isFullyRevealed ? (
        <span className="font-sans text-sm text-foreground">
          {translatedValue}
        </span>
      ) : (
        // eslint-disable-next-line sonarjs/max-lines-per-function
        words.map((word: string, wordIndex: number) => {
          const isGenericPlaceholder = word === GENERIC_PLACEHOLDER.repeat(5);

          if (isGenericPlaceholder) {
            const tooltipContent = (() => {
              if (clueKey === "year") {
                return t("fullyHidden", { attempt: currentAttempt });
              }
              if (clueKey === "gender") {
                return t("genderHiddenUntil");
              }
              return t("hiddenAttempt", { attempt: currentAttempt });
            })();

            return (
              <GameTooltip
                content={tooltipContent}
                key={`meta-${clueKey}-placeholder-${wordIndex}`}
              >
                <div className="group flex h-5 cursor-help items-center justify-center opacity-80 transition-colors duration-300 hover:opacity-100">
                  <Lock className="size-3  text-muted-foreground transition-colors group-hover:text-[oklch(0.75_0.15_60)]" />
                </div>
              </GameTooltip>
            );
          }

          // Check if this is "Unknown" data (not hidden, but unavailable)
          const isUnknownData = value === "Unknown";
          if (isUnknownData) {
            return (
              <GameTooltip
                content={t("dataUnavailable")}
                key={`meta-${clueKey}-unknown-${wordIndex}`}
              >
                <span className="cursor-help opacity-70">
                  {translatedValue}
                </span>
              </GameTooltip>
            );
          }

          const isWordMasked = word.includes(MASK_CHAR);
          const isFullHidden =
            word === GENERIC_PLACEHOLDER.repeat(5) ||
            (clueKey === "year" && new RegExp(`^${MASK_CHAR}+$`).test(word));
          const tooltipContent = (() => {
            if (clueKey === "year") {
              return isFullHidden
                ? t("fullyHidden", { attempt: currentAttempt })
                : t("partiallyHidden", { attempt: currentAttempt });
            }
            return t("letters", { count: word.length });
          })();

          const showTooltip =
            (clueKey === "brand" ||
              clueKey === "perfumer" ||
              clueKey === "year") &&
            isWordMasked;

          // eslint-disable-next-line sonarjs/function-return-type -- IIFE returns React.ReactNode; multiple branches declared above
          const innerContent: React.ReactNode = (() => {
            if (isFullHidden) {
              return (
                <div className="group flex h-5 items-center justify-center opacity-80 transition-colors duration-300 hover:opacity-100">
                  <Lock className="size-3  text-muted-foreground transition-colors group-hover:text-[oklch(0.75_0.15_60)]" />
                </div>
              );
            }
            if (isWordMasked) {
              // eslint-disable-next-line unicorn/prefer-spread -- string character iteration; split("") vs [...str] conflict with no-misused-spread
              return word.split("").map((char, charIndex) => {
                const isSlot = char === MASK_CHAR;
                if (isSlot) {
                  return (
                    <MaskSlot
                      char={char}
                      key={`meta-slot-${clueKey}-${wordIndex}-${charIndex}`}
                    />
                  );
                }
                return (
                  <div
                    className="mx-px flex h-5 w-2 items-center justify-center border-b border-transparent font-mono text-sm leading-none text-foreground"
                    key={`meta-char-${clueKey}-${wordIndex}-${charIndex}`}
                  >
                    <span className="inline-block translate-y-px">{char}</span>
                  </div>
                );
              });
            }
            return <span className="font-sans text-sm text-foreground">{word}</span>;
          })();

          const content = (
            <div
              className="flex flex-nowrap"
              key={`meta-content-${clueKey}-${word}-${wordIndex}`}
            >
              {innerContent}
            </div>
          );

          if (showTooltip) {
            return (
              <GameTooltip
                content={tooltipContent}
                key={`meta-tt-${clueKey}-${word}-${wordIndex}`}
              >
                {({ isHovered }: { isHovered?: boolean }) => (
                  <div className="flex flex-nowrap">
                    {isFullHidden ? (
                      <div className="flex h-5 items-center justify-center opacity-80 transition-colors duration-300 hover:opacity-100">
                        <Lock
                          className={cn(
                            "size-3  transition-colors duration-300",
                            isHovered
                              ? "text-[oklch(0.75_0.15_60)]"
                              : "text-muted-foreground",
                          )}
                        />
                      </div>
                    ) : (
                      // eslint-disable-next-line unicorn/prefer-spread -- string character iteration; split("") vs [...str] conflict with no-misused-spread
                      word.split("").map((char, charIndex) => {
                        const isSlot = char === MASK_CHAR;
                        if (isSlot) {
                          return (
                            <MaskSlot
                              char={char}
                              isHovered={isHovered}
                              key={`meta-tt-slot-${clueKey}-${wordIndex}-${charIndex}`}
                            />
                          );
                        }
                        return (
                          <div
                            className={cn(
                              "mx-px flex h-5 w-2 items-center justify-center border-b border-transparent font-mono text-sm leading-none transition-colors duration-300",
                              isHovered
                                ? "text-[oklch(0.75_0.15_60)]"
                                : "text-foreground",
                            )}
                            key={`meta-tt-char-${clueKey}-${wordIndex}-${charIndex}`}
                          >
                            <span className="inline-block translate-y-px">
                              {char}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </GameTooltip>
            );
          }

          return (
            <div key={`meta-span-${clueKey}-${word}-${wordIndex}`}>
              {content}
            </div>
          );
        })
      )}
    </div>
  );
}
