"use client"

import { useEffect, useRef } from "react"
import { useGame } from "./game-provider"

import { cn } from "@/lib/utils"
import { X, ArrowUp, ArrowDown, Waves, Check, ScrollText } from "lucide-react"
import { GameTooltip } from "./game-tooltip"

const ROMAN_NUMERALS = ["I", "II", "III", "IV", "V", "VI"]

import { useTranslations } from "next-intl"

export function AttemptLog() {
  const { attempts, maxAttempts, dailyPerfume, gameState } = useGame()
  const t = useTranslations('AttemptLog')
  const prevAttemptsLength = useRef(attempts.length)

  // Scroll to new attempt
  useEffect(() => {
    if (attempts.length > prevAttemptsLength.current) {
      // Only scroll to the new attempt if the game is still playing.
      // If the game ended (won/lost), the "Game Over" scroll effect (below) takes precedence.
      if (gameState === 'playing') {
        const lastIndex = attempts.length - 1
        const element = document.getElementById(`attempt-${lastIndex}`)
        if (element) {
          setTimeout(() => {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }, 100)
        }
      }
    }
    prevAttemptsLength.current = attempts.length
  }, [attempts.length, gameState])

  // Scroll to top on game end
  useEffect(() => {
    if (gameState === "won" || gameState === "lost") {
      // Small delay to ensure any end-game UI updates have triggered
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: "smooth" })
      }, 300)
    }
  }, [gameState])

  if (attempts.length === 0) return null

  return (
    <section className="bg-background p-4 rounded-md border border-border/50">
      <div className="flex items-center gap-2 mb-4">
        <ScrollText className="w-4 h-4 text-muted-foreground" />
        <h2 className="font-[family-name:var(--font-playfair)] text-lg text-foreground">{t('title')}</h2>
      </div>

      <div className="grid grid-cols-[50px_1fr_minmax(140px,auto)] px-2">
        {/* Header Row - spread into grid columns */}
        <div className="flex justify-center items-center pb-2 border-b-2 border-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <GameTooltip content={t('columns.attemptTooltip')} className="h-9 w-9 justify-center items-center">
            <span className="text-center cursor-help decoration-dotted underline decoration-muted-foreground/30 underline-offset-2">{t('columns.attempt')}</span>
          </GameTooltip>
        </div>

        <div className="flex items-center pb-2 border-b-2 border-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {t('columns.perfume')}
        </div>

        <div className="grid grid-cols-5 w-full justify-items-center text-center px-1 pb-2 border-b-2 border-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <GameTooltip content={t('columns.brandTooltip')} className="h-9 w-9 justify-center items-center">
            <span className="flex justify-center cursor-help decoration-dotted underline decoration-muted-foreground/30 underline-offset-2 min-w-8">{t('columns.brand')}</span>
          </GameTooltip>

          <GameTooltip content={t('columns.perfumerTooltip')} className="h-9 w-9 justify-center items-center">
            <span className="flex justify-center cursor-help decoration-dotted underline decoration-muted-foreground/30 underline-offset-2 min-w-8">{t('columns.perfumer')}</span>
          </GameTooltip>

          <GameTooltip content={t('columns.yearTooltip')} className="h-9 w-9 justify-center items-center">
            <span className="flex justify-center cursor-help decoration-dotted underline decoration-muted-foreground/30 underline-offset-2 min-w-8">{t('columns.year')}</span>
          </GameTooltip>

          <GameTooltip content={t('columns.genderTooltip')} className="h-9 w-9 justify-center items-center">
            <span className="flex justify-center cursor-help decoration-dotted underline decoration-muted-foreground/30 underline-offset-2 min-w-8">{t('columns.gender')}</span>
          </GameTooltip>

          <GameTooltip content={t('columns.notesTooltip')} className="h-9 w-9 justify-center items-center">
            <span className="flex justify-center cursor-help decoration-dotted underline decoration-muted-foreground/30 underline-offset-2 min-w-8">{t('columns.notes')}</span>
          </GameTooltip>
        </div>

        {attempts.map((attempt, index) => (
          <div key={`attempt-${index}`} className="contents group">
            <div
              id={`attempt-${index}`}
              className={cn(
                "flex justify-center items-center py-3 border-b border-muted/30 group-last:border-0 relative z-10 transition-colors group-hover:bg-muted/40"
              )}
            >
              {index === attempts.length - 1 && !attempt.isCorrect && (
                <div className="absolute inset-0 animate-flash-error pointer-events-none rounded-sm" />
              )}
              <span className="font-[family-name:var(--font-playfair)] text-muted-foreground text-center block">
                {ROMAN_NUMERALS[index]}
              </span>
            </div>

            <div className={cn(
              "min-w-0 pr-2 py-3 border-b border-muted/30 group-last:border-0 relative z-10 flex flex-col justify-center transition-colors group-hover:bg-muted/40"
            )}>
              {index === attempts.length - 1 && !attempt.isCorrect && (
                <div className="absolute inset-0 animate-flash-error pointer-events-none rounded-sm" />
              )}
              {(() => {
                const concentration = attempt.concentration || '';
                let displayName = attempt.guess;
                if (concentration && displayName.toLowerCase().endsWith(concentration.toLowerCase())) {
                  displayName = displayName.substring(0, displayName.length - concentration.length).trim();
                }

                return (
                  <>
                    <span className="font-medium text-foreground text-sm sm:text-base">{displayName}</span>
                    <span className="text-muted-foreground text-xs block sm:inline sm:ml-2 font-light">
                      {(attempt.feedback.brandMatch || attempt.snapshot?.brandRevealed)
                        ? `${t('by')} ${attempt.brand}`
                        : (attempt.snapshot?.guessMaskedBrand && attempt.snapshot.guessMaskedBrand !== '?????'
                          ? <span className="opacity-60 tracking-wider text-xs">{t('by')} {attempt.snapshot.guessMaskedBrand.split('').map((char, i) => (
                            <span key={i} className={char === '_' ? "font-mono opacity-40" : ""}>{char}</span>
                          ))}</span>
                          : <span className="opacity-30 font-mono tracking-widest text-xs">{t('by')} ?????</span>)
                      }
                    </span>
                    <div className="text-xs text-muted-foreground/70 flex gap-x-2">
                      {attempt.year ? (
                        <span>
                          {(attempt.feedback.yearMatch === "correct" || attempt.snapshot?.yearRevealed)
                            ? attempt.year
                            : (attempt.snapshot?.guessMaskedYear && attempt.snapshot.guessMaskedYear !== '____'
                              ? <span className="opacity-60 tracking-wider">{attempt.snapshot.guessMaskedYear.split('').map((char, i) => (
                                <span key={i} className={char === '_' ? "font-mono opacity-40" : ""}>{char}</span>
                              ))}</span>
                              : <span className="opacity-30 font-mono tracking-widest">____</span>)
                          }
                        </span>
                      ) : null}

                      {concentration && concentration !== 'Unknown' && (
                        <>
                          <span>•</span>
                          <span>{concentration}</span>
                        </>
                      )}
                    </div>
                  </>
                )
              })()}
            </div>

            <div className={cn(
              "grid grid-cols-5 w-full items-center font-[family-name:var(--font-hand)] text-xl text-primary px-1 py-3 border-b border-muted/30 group-last:border-0 relative z-10 transition-colors group-hover:bg-muted/40"
            )}>
              {index === attempts.length - 1 && !attempt.isCorrect && (
                <div className="absolute inset-0 animate-flash-error pointer-events-none rounded-sm" />
              )}
              {/* Brand */}
              <div className="flex justify-center items-center h-full">
                {attempt.feedback.brandMatch ? (
                  <GameTooltip content={t('tooltips.brandCorrect')} className="h-9 w-9 justify-center items-center">
                    <div className="flex items-center justify-center w-6 h-6">
                      <Check className="w-4 h-4 text-success" />
                    </div>
                  </GameTooltip>
                ) : (
                  <GameTooltip content={t('tooltips.brandIncorrect')} className="h-9 w-9 justify-center items-center">
                    <span className="opacity-50 cursor-help"><X className="w-4 h-4 text-muted-foreground transform -skew-x-12" strokeWidth={1.5} /></span>
                  </GameTooltip>
                )}
              </div>

              {/* Perfumer */}
              <div className="flex justify-center items-center h-full">
                {attempt.feedback.perfumerMatch === "full" ? (
                  <GameTooltip content={t('tooltips.perfumerFull')} className="h-9 w-9 justify-center items-center">
                    <div className="flex items-center justify-center w-6 h-6">
                      <Check className="w-4 h-4 text-success" />
                    </div>
                  </GameTooltip>
                ) : attempt.feedback.perfumerMatch === "partial" ? (
                  <GameTooltip content={t('tooltips.perfumerPartial')} className="h-9 w-9 justify-center items-center">
                    <span className="cursor-help"><Waves className="w-4 h-4 text-muted-foreground opacity-50 transform -skew-x-12" strokeWidth={1.5} /></span>
                  </GameTooltip>
                ) : (
                  <GameTooltip content={t('tooltips.perfumerIncorrect')} className="h-9 w-9 justify-center items-center">
                    <span className="opacity-50 cursor-help"><X className="w-4 h-4 text-muted-foreground transform -skew-x-12" strokeWidth={1.5} /></span>
                  </GameTooltip>
                )}
              </div>

              {/* Year */}
              <div className="flex justify-center items-center h-full">
                {attempt.feedback.yearMatch === "correct" ? (
                  <GameTooltip content={t('tooltips.yearCorrect')} className="h-9 w-9 justify-center items-center">
                    <div className="flex items-center justify-center w-6 h-6">
                      <Check className="w-4 h-4 text-success" />
                    </div>
                  </GameTooltip>
                ) : (
                  <div className="flex flex-col items-center justify-center w-full h-full">
                    <GameTooltip content={
                      attempt.feedback.yearMatch === "close"
                        ? (attempt.feedback.yearDirection === "higher" ? t('tooltips.yearCloseHigher') : t('tooltips.yearCloseLower'))
                        : (attempt.feedback.yearDirection === "higher" ? t('tooltips.yearWrongHigher') : t('tooltips.yearWrongLower'))
                    } className="h-9 w-9 justify-center items-center">
                      <span
                        className={cn(
                          "flex items-center justify-center h-4 w-4 cursor-help",
                          attempt.feedback.yearMatch === "close" ? "text-warning" : "text-muted-foreground opacity-50"
                        )}
                      >
                        {attempt.feedback.yearDirection === "higher" ? (
                          <ArrowUp className="w-4 h-4 transform -skew-x-12" strokeWidth={1.5} />
                        ) : (
                          <ArrowDown className="w-4 h-4 transform -skew-x-12" strokeWidth={1.5} />
                        )}
                      </span>
                    </GameTooltip>
                  </div>
                )}
              </div>

              {/* Gender */}
              <div className="flex justify-center items-center h-full">
                {(() => {
                  const guessGender = attempt.gender?.toLowerCase() || 'unknown';
                  const targetGender = dailyPerfume.gender?.toLowerCase() || 'unknown';

                  if (guessGender === 'unknown' || targetGender === 'unknown') {
                    return (
                      <GameTooltip content={t('tooltips.genderUnknown')} className="h-9 w-9 justify-center items-center">
                        <span className="text-muted-foreground opacity-50 text-base leading-none font-[family-name:var(--font-hand)] cursor-help inline-block px-1">?</span>
                      </GameTooltip>
                    )
                  }

                  if (guessGender === targetGender) {
                    return (
                      <GameTooltip content={t('tooltips.genderCorrect')} className="h-9 w-9 justify-center items-center">
                        <div className="flex items-center justify-center w-6 h-6">
                          <Check className="w-4 h-4 text-success" />
                        </div>
                      </GameTooltip>
                    );
                  }

                  return (
                    <GameTooltip content={t('tooltips.genderIncorrect')} className="h-9 w-9 justify-center items-center">
                      <span className="opacity-50 cursor-help"><X className="w-4 h-4 text-muted-foreground transform -skew-x-12" strokeWidth={1.5} /></span>
                    </GameTooltip>
                  );
                })()}
              </div>

              {/* Notes */}
              <div className="flex justify-center items-center h-full">
                {attempt.feedback.notesMatch >= 1.0 ? (
                  <GameTooltip content={t('tooltips.notesCorrect')} className="h-9 w-9 justify-center items-center">
                    <div className="flex items-center justify-center w-6 h-6">
                      <Check className="w-5 h-5 text-success" />
                    </div>
                  </GameTooltip>
                ) : (
                  <GameTooltip content={t('tooltips.notesPercentage', { percent: Math.round(attempt.feedback.notesMatch * 100) })} className="h-9 w-9 justify-center items-center">
                    <span
                      className={`text-base leading-none flex items-center font-[family-name:var(--font-hand)] cursor-help ${attempt.feedback.notesMatch >= 0.4 ? "text-warning" : "text-muted-foreground opacity-50"}`}
                    >
                      {Math.round(attempt.feedback.notesMatch * 100)}%
                    </span>
                  </GameTooltip>
                )}
              </div>
            </div>
          </div>
        ))}

        {Array.from({ length: maxAttempts - attempts.length }).map((_, i, arr) => {
          const isLast = i === arr.length - 1
          const borderClass = isLast ? "" : "border-b border-muted/30"

          return (
            <div key={`empty-${i}`} className="contents">
              <div className={`flex justify-center items-center py-3 ${borderClass} min-h-[48px]`}>
                <span className="font-[family-name:var(--font-playfair)] text-muted-foreground text-center block opacity-30">
                  {ROMAN_NUMERALS[attempts.length + i]}
                </span>
              </div>
              <div className={`py-3 ${borderClass} pl-2 min-h-[48px]`}>
                <span className="text-muted-foreground opacity-30">...</span>
              </div>
              <div className={`py-3 ${borderClass} min-h-[48px]`}></div>
            </div>
          )
        })}
      </div>
    </section >
  )
}
