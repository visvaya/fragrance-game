"use client";

import { Store, Feather, Hourglass, Sparkles, Droplets } from "lucide-react";
import { useTranslations } from "next-intl";

import { useGame } from "../game-provider";
import { GameTooltip } from "../game-tooltip";

/**
 *
 */
export function MetaClues() {
  const {
    currentAttempt,
    dailyPerfume,
    gameState,
    getRevealedBrand,
    getRevealedPerfumer,
    getRevealedYear,
    isGenderRevealed,
    revealLevel,
  } = useGame();
  const t = useTranslations("MetaClues");

  const clues = [
    { key: "brand", value: getRevealedBrand() },
    { key: "perfumer", value: getRevealedPerfumer() },
    { key: "year", value: getRevealedYear() },
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
    <div className="flex h-full flex-col bg-background p-0">
      <div className="mb-4 flex items-center gap-2">
        <Store className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-[family-name:var(--font-playfair)] text-lg tracking-wide text-foreground">
          {t("identity")}
        </h2>
      </div>

      <div className="grid flex-1 grid-cols-1 content-start justify-center gap-5">
        {clues.map((clue) => (
          <div
            className="flex w-full flex-col items-start gap-0.5"
            key={clue.key}
          >
            {/* Label */}
            <span className="w-full text-[10px] font-semibold tracking-[0.2em] text-muted-foreground/70 uppercase">
              {t(clue.key)}
            </span>

            {/* Value (Slots or Text) */}
            <div className="flex w-full flex-wrap gap-2">
              {clue.key === "perfumer" && clue.value !== "?????" ? (
                // Split multi-perfumer values into separate badges
                clue.value
                  .split(", ")
                  .map((perfumer, itemIndex) => (
                    <MetaBadge
                      clueKey={clue.key}
                      currentAttempt={currentAttempt}
                      key={itemIndex}
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
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
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
  const words = value === "?????" ? ["?????"] : value.split(" ");

  return (
    <div className="inline-flex min-h-[30px] cursor-default flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-border bg-secondary/50 px-3 py-1 text-sm font-medium text-muted-foreground transition-colors duration-300 hover:bg-secondary">
      {words.map((word, wordIndex) => {
        const isGenericPlaceholder = word === "?????";

        if (isGenericPlaceholder) {
          let tooltipContent = t("hiddenAttempt", { attempt: currentAttempt });
          if (clueKey === "year") {
            tooltipContent = t("fullyHidden", { attempt: currentAttempt });
          } else if (clueKey === "concentration" || clueKey === "gender") {
            tooltipContent = t("hiddenUntil");
          }

          return (
            <GameTooltip content={tooltipContent} key={wordIndex}>
              <div className="flex cursor-help">
                {[1, 2, 3, 4, 5].map((_, i) => (
                  <div
                    aria-hidden="true"
                    className="mx-[0.5px] h-5 w-2.5 border-b border-muted-foreground/30"
                    key={i}
                  />
                ))}
              </div>
            </GameTooltip>
          );
        }

        const isWordMasked = word.includes("_");
        let tooltipContent = t("letters", { count: word.length });

        if (clueKey === "year") {
          const isFullHidden = /^_+$/.test(word);
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
          <div className="flex flex-wrap">
            {word.split("").map((char, charIndex) => {
              const isSlot = char === "_";
              if (isSlot) {
                return (
                  <div
                    aria-hidden="true"
                    className="mx-[0.5px] h-5 w-2.5 border-b border-muted-foreground/30 transition-all duration-300"
                    key={charIndex}
                  />
                );
              }
              return (
                <div
                  className="mx-[0.5px] flex h-5 w-2.5 items-center justify-center border-b border-transparent font-mono text-sm leading-none text-foreground"
                  key={charIndex}
                >
                  {char}
                </div>
              );
            })}
          </div>
        );

        if (showTooltip) {
          return (
            <GameTooltip content={tooltipContent} key={wordIndex}>
              {({ isHovered }: { isHovered?: boolean }) => (
                <div className="flex flex-wrap">
                  {word.split("").map((char, charIndex) => {
                    const isSlot = char === "_";
                    if (isSlot) {
                      return (
                        <div
                          aria-hidden="true"
                          className={`mx-[0.5px] h-5 w-2.5 transition-all duration-300 ${isHovered
                            ? "border-b border-[oklch(0.75_0.15_60)]"
                            : "border-b border-muted-foreground/30"
                            }`}
                          key={charIndex}
                        />
                      );
                    }
                    return (
                      <div
                        className="mx-[0.5px] flex h-5 w-2.5 items-center justify-center border-b border-transparent font-mono text-sm leading-none text-foreground"
                        key={charIndex}
                      >
                        {char}
                      </div>
                    );
                  })}
                </div>
              )}
            </GameTooltip>
          );
        }

        return <div key={wordIndex}>{content}</div>;
      })}
    </div>
  );
}
