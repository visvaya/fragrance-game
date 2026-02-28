"use client";

import { memo } from "react";

import { Store, Lock } from "lucide-react";
import { useTranslations } from "next-intl";

import { MASK_CHAR } from "@/lib/constants";
import { cn } from "@/lib/utils";

import { useGameState } from "../contexts";
import { GameTooltip } from "../game-tooltip";

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
  const t = useTranslations("MetaClues");

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
          : "?????",
    },
  ];

  return (
    <div className="flex h-full flex-col p-0">
      <div className="group mb-4 flex w-fit cursor-default items-center gap-2">
        <Store className="h-4 w-4 text-muted-foreground transition-transform duration-300 group-hover:scale-[1.15]" />
        <h2 className="font-[family-name:var(--font-playfair)] text-lg tracking-wide text-foreground lowercase">
          {t("identity")}
        </h2>
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
              {t(clue.key)}
            </span>

            {/* Value (Slots or Text) */}
            <div className="flex w-full flex-wrap items-center gap-2">
              {clue.key === "perfumer" && clue.value !== "?????" ? (
                // Split multi-perfumer values into separate badges
                clue.value
                  .split(", ")
                  .map((perfumer, itemIndex) => (
                    <MetaBadge
                      clueKey={clue.key}
                      currentAttempt={currentAttempt}
                      key={`${clue.key}-${perfumer}-${itemIndex}`}
                      t={t}
                      value={perfumer}
                    />
                  ))
              ) : (
                // Single badge for other clues
                <MetaBadge
                  clueKey={clue.key}
                  currentAttempt={currentAttempt}
                  t={t}
                  value={clue.value}
                />
              )}
              <DotFiller />
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
                <MetaBadge
                  clueKey={clue.key}
                  currentAttempt={currentAttempt}
                  t={t}
                  value={clue.value}
                />
                <DotFiller />
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
}: {
  clueKey: string;
  currentAttempt: number;
  t: any;
  value: string;
}) {
  // Translate "Unknown" for i18n support
  const translatedValue = value === "Unknown" ? t("unknown") : value;
  const words =
    translatedValue === "?????" ? ["?????"] : translatedValue.split(" ");
  const isFullyRevealed =
    value !== "Unknown" &&
    !translatedValue.includes(MASK_CHAR) &&
    translatedValue !== "?????";

  return (
    <div className="inline-flex min-h-[22px] max-w-full cursor-default flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 rounded-md border border-border bg-secondary/50 px-2.5 py-1 text-sm font-normal text-muted-foreground transition-colors duration-300 hover:bg-secondary">
      {isFullyRevealed ? (
        <span className="font-sans text-sm text-foreground">{translatedValue}</span>
      ) : words.map((word: string, wordIndex: number) => {
        const isGenericPlaceholder = word === "?????";

        if (isGenericPlaceholder) {
          let tooltipContent = t("hiddenAttempt", { attempt: currentAttempt });
          if (clueKey === "year") {
            tooltipContent = t("fullyHidden", { attempt: currentAttempt });
          } else if (clueKey === "concentration" || clueKey === "gender") {
            tooltipContent = t("hiddenUntil");
          }

          return (
            <GameTooltip
              content={tooltipContent}
              key={`meta-${clueKey}-placeholder-${wordIndex}`}
            >
              <div className="group flex cursor-help items-center justify-center px-2.5 py-1 opacity-80 transition-colors duration-300 hover:opacity-100">
                <Lock className="h-3 w-3 text-muted-foreground transition-colors group-hover:text-[oklch(0.75_0.15_60)]" />
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
              <span className="cursor-help opacity-70">{translatedValue}</span>
            </GameTooltip>
          );
        }

        const isWordMasked = word.includes(MASK_CHAR);
        const isFullHidden =
          word === "?????" ||
          (clueKey === "year" &&
            new RegExp(`^${MASK_CHAR}+$`).test(word));
        let tooltipContent = t("letters", { count: word.length });

        if (clueKey === "year") {
          tooltipContent = isFullHidden
            ? t("fullyHidden", { attempt: currentAttempt })
            : t("partiallyHidden", { attempt: currentAttempt });
        }

        const showTooltip =
          (clueKey === "brand" ||
            clueKey === "perfumer" ||
            clueKey === "year") &&
          isWordMasked;

        const content = (
          <div
            className="flex flex-nowrap"
            key={`meta-content-${clueKey}-${word}-${wordIndex}`}
          >
            {isFullHidden ? (
              <div className="group flex items-center justify-center px-2 py-1 opacity-80 transition-colors duration-300 hover:opacity-100">
                <Lock className="h-3 w-3 text-muted-foreground transition-colors group-hover:text-[oklch(0.75_0.15_60)]" />
              </div>
            ) : !isWordMasked ? (
              <span className="font-sans text-sm text-foreground">{word}</span>
            ) : (
              word.split("").map((char, charIndex) => {
                const isSlot = char === MASK_CHAR;
                if (isSlot) {
                  return (
                    <div
                      aria-hidden="true"
                      className="mx-px flex h-4 w-2 items-center justify-center font-mono text-sm leading-none opacity-40 text-muted-foreground transition-all duration-300"
                      key={`meta-slot-${clueKey}-${wordIndex}-${charIndex}`}
                    >
                      <span className="inline-block -translate-y-0.5">{char}</span>
                    </div>
                  );
                }
                return (
                  <div
                    className="mx-px flex h-4 w-2 items-center justify-center border-b border-transparent font-mono text-sm leading-none text-foreground"
                    key={`meta-char-${clueKey}-${wordIndex}-${charIndex}`}
                  >
                    {char}
                  </div>
                );
              })
            )}
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
                    <div className="flex items-center justify-center px-2.5 py-1 opacity-80 transition-colors duration-300 hover:opacity-100">
                      <Lock
                        className={cn(
                          "h-3 w-3 transition-colors duration-300",
                          isHovered
                            ? "text-[oklch(0.75_0.15_60)]"
                            : "text-muted-foreground",
                        )}
                      />
                    </div>
                  ) : (
                    word.split("").map((char, charIndex) => {
                      const isSlot = char === MASK_CHAR;
                      if (isSlot) {
                        return (
                          <div
                            aria-hidden="true"
                            className={`mx-px flex h-4 w-2 items-center justify-center font-mono text-sm leading-none transition-all duration-300 ${isHovered
                              ? "text-[oklch(0.75_0.15_60)]"
                              : `text-muted-foreground ${isFullHidden ? "opacity-30" : "opacity-40"}`
                              }`}
                            key={`meta-tt-slot-${clueKey}-${wordIndex}-${charIndex}`}
                          >
                            <span className="inline-block -translate-y-0.5">{char}</span>
                          </div>
                        );
                      }
                      return (
                        <div
                          className={cn(
                            "mx-px flex h-4 w-2 items-center justify-center border-b border-transparent font-mono text-sm leading-none transition-colors duration-300",
                            isHovered
                              ? "text-[oklch(0.75_0.15_60)]"
                              : "text-foreground",
                          )}
                          key={`meta-tt-char-${clueKey}-${wordIndex}-${charIndex}`}
                        >
                          {char}
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
          <div key={`meta-span-${clueKey}-${word}-${wordIndex}`}>{content}</div>
        );
      })}
    </div>
  );
}

function DotFiller() {
  return (
    <span
      aria-hidden="true"
      className="flex h-[22px] min-w-[1rem] flex-1 items-center"
    >
      <span className="w-full border-b border-dotted border-muted-foreground/25" />
    </span>
  );
}
