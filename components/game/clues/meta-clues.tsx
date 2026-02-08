"use client"

import { useGame } from "../game-provider"

import { Store, Feather, Hourglass, Sparkles, Droplets } from "lucide-react"
import { GameTooltip } from "../game-tooltip"

import { useTranslations } from "next-intl"

export function MetaClues() {
  const { getRevealedBrand, getRevealedPerfumer, getRevealedYear, revealLevel, dailyPerfume, isGenderRevealed, gameState, currentAttempt } = useGame()
  const t = useTranslations('MetaClues')

  const clues = [
    { key: "brand", value: getRevealedBrand() },
    { key: "perfumer", value: getRevealedPerfumer() },
    { key: "year", value: getRevealedYear() },
    {
      key: "gender",
      value: (revealLevel >= 5 || isGenderRevealed || gameState === 'won' || gameState === 'lost') ? dailyPerfume.gender : "?????",
    },
  ]

  return (
    <div className="flex flex-col h-full bg-background p-0">
      <div className="flex items-center gap-2 mb-4">
        <Store className="w-4 h-4 text-muted-foreground" />
        <h2 className="font-[family-name:var(--font-playfair)] text-lg text-foreground tracking-wide">
          {t('identity')}
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-5 justify-center flex-1 content-start">
        {clues.map((clue) => (
          <div key={clue.key} className="flex flex-col gap-0.5 items-start w-full">
            {/* Label */}
            <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-muted-foreground/70 w-full">
              {t(clue.key)}
            </span>

            {/* Value (Slots or Text) */}
            <div className="flex flex-wrap gap-2 w-full">
              {(clue.key === "perfumer" && clue.value !== "?????") ? (
                // Split multi-perfumer values into separate badges
                clue.value.split(', ').map((perfumer, itemIndex) => (
                  <MetaBadge key={itemIndex} value={perfumer} clueKey={clue.key} currentAttempt={currentAttempt} t={t} />
                ))
              ) : (
                // Single badge for other clues
                <MetaBadge value={clue.value} clueKey={clue.key} currentAttempt={currentAttempt} t={t} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
function MetaBadge({ value, clueKey, currentAttempt, t }: { value: string, clueKey: string, currentAttempt: number, t: any }) {
  const words = value === "?????" ? ["?????"] : value.split(' ');

  return (
    <div className="inline-flex flex-wrap items-center rounded-md border border-border bg-secondary/50 px-3 py-1 text-sm font-medium text-muted-foreground transition-colors duration-300 hover:bg-secondary gap-x-2 gap-y-1 cursor-default min-h-[30px]">
      {words.map((word, wordIndex) => {
        const isGenericPlaceholder = word === "?????";

        if (isGenericPlaceholder) {
          let tooltipContent = t('hiddenAttempt', { attempt: currentAttempt });
          if (clueKey === 'year') {
            tooltipContent = t('fullyHidden', { attempt: currentAttempt });
          } else if (clueKey === 'concentration' || clueKey === 'gender') {
            tooltipContent = t('hiddenUntil');
          }

          return (
            <GameTooltip key={wordIndex} content={tooltipContent}>
              <div className="flex cursor-help">
                {[1, 2, 3, 4, 5].map((_, i) => (
                  <div
                    key={i}
                    className="w-2.5 h-5 border-b border-muted-foreground/30 mx-[0.5px]"
                    aria-hidden="true"
                  />
                ))}
              </div>
            </GameTooltip>
          );
        }

        const isWordMasked = word.includes('_');
        let tooltipContent = t('letters', { count: word.length });

        if (clueKey === 'year') {
          const isFullHidden = /^_+$/.test(word);
          tooltipContent = isFullHidden
            ? t('fullyHidden', { attempt: currentAttempt })
            : t('partiallyHidden', { attempt: currentAttempt });
        }

        const showTooltip = (clueKey === 'brand' || clueKey === 'perfumer' || clueKey === 'year') && isWordMasked;

        const content = (
          <div className="flex flex-wrap">
            {word.split('').map((char, charIndex) => {
              const isSlot = char === '_';
              if (isSlot) {
                return (
                  <div
                    key={charIndex}
                    className="w-2.5 h-5 border-b border-muted-foreground/30 mx-[0.5px] transition-all duration-300"
                    aria-hidden="true"
                  />
                );
              }
              return (
                <div
                  key={charIndex}
                  className="w-2.5 h-5 flex items-center justify-center font-mono text-sm leading-none text-foreground border-b border-transparent mx-[0.5px]"
                >
                  {char}
                </div>
              );
            })}
          </div>
        );

        if (showTooltip) {
          return (
            <GameTooltip key={wordIndex} content={tooltipContent}>
              <div className="cursor-help">{content}</div>
            </GameTooltip>
          );
        }

        return <div key={wordIndex}>{content}</div>
      })}
    </div >
  );
}
