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
            <div className="inline-flex items-center rounded-md border border-border bg-secondary/50 px-3 py-1 text-sm font-medium text-muted-foreground transition-colors duration-300 hover:bg-secondary gap-x-2 cursor-default min-h-[30px]">
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {(clue.value === "?????" ? ["?????"] : clue.value.split(' ')).map((word, wordIndex) => {
                  // Logic for generic hidden placeholders vs partial masked words
                  // Note: "•••" is used as the generic placeholder for Concentration/Gender/Brand(L1)

                  const isGenericPlaceholder = word === "?????";

                  if (isGenericPlaceholder) {

                    let tooltipContent = t('hiddenAttempt', { attempt: currentAttempt });
                    if (clue.key === 'year') {
                      tooltipContent = t('fullyHidden', { attempt: currentAttempt });
                    } else if (clue.key === 'concentration' || clue.key === 'gender') {
                      tooltipContent = t('hiddenUntil');
                    }

                    return (
                      <GameTooltip key={wordIndex} content={tooltipContent}>
                        <div className="flex gap-1 cursor-help">
                          {/* Render 5 generic slots for unknown length */}
                          {[1, 2, 3, 4, 5].map((_, i) => (
                            <div
                              key={i}
                              className="w-3 h-5 border-b border-muted-foreground/30 mx-[1px]"
                              aria-hidden="true"
                            />
                          ))}
                        </div>
                      </GameTooltip>
                    )
                  }

                  // Masked word logic (using underscores from game-provider)
                  const isWordMasked = word.includes('_');
                  let tooltipContent = t('letters', { count: word.length });

                  // Special tooltip for fully/partially hidden Year
                  if (clue.key === 'year') {
                    const isFullHidden = /^_+$/.test(word);
                    tooltipContent = isFullHidden
                      ? t('fullyHidden', { attempt: currentAttempt })
                      : t('partiallyHidden', { attempt: currentAttempt });
                  }

                  const showTooltip = (clue.key === 'brand' || clue.key === 'perfumer' || clue.key === 'year') && isWordMasked;

                  const content = (
                    <div className="flex flex-wrap gap-1">
                      {word.split('').map((char, charIndex) => {
                        const isSlot = char === '_';
                        if (isSlot) {
                          return (
                            <div
                              key={charIndex}
                              className="w-3 h-5 border-b border-muted-foreground/30 mx-[1px] transition-all duration-300"
                              aria-hidden="true"
                            />
                          );
                        }
                        return (
                          <div
                            key={charIndex}
                            className="w-3 h-5 flex items-end justify-center font-mono text-sm text-foreground border-b border-transparent mx-[1px]"
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
              </div>

            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
