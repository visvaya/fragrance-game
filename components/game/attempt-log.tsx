"use client"

import { useEffect, useRef } from "react"
import { useGame } from "./game-provider"
import { cn } from "@/lib/utils"
import { X, ArrowUp, ArrowDown, Waves, Check } from "lucide-react"
import { GameTooltip } from "./game-tooltip"

const ROMAN_NUMERALS = ["I", "II", "III", "IV", "V", "VI"]

export function AttemptLog() {
  const { attempts, maxAttempts, dailyPerfume, gameState } = useGame()
  const prevAttemptsLength = useRef(attempts.length)

  // Scroll to new attempt
  useEffect(() => {
    if (attempts.length > prevAttemptsLength.current) {
      const lastIndex = attempts.length - 1
      const element = document.getElementById(`attempt-${lastIndex}`)
      if (element) {
        // Use timeout to ensure DOM is ready and layout is stable
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 100)
      }
    }
    prevAttemptsLength.current = attempts.length
  }, [attempts.length])

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
    <section className="border-t border-border pt-6">
      <h2 className="font-[family-name:var(--font-playfair)] text-lg italic text-foreground mb-4">Investigation Log</h2>

      <div className="grid grid-cols-[50px_1fr_minmax(140px,auto)] px-2">
        {/* Header Row - spread into grid columns */}
        <div className="flex justify-center items-center pb-2 border-b-2 border-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <GameTooltip content="Attempt Number" className="h-9 w-9 justify-center items-center">
            <span className="text-center cursor-help decoration-dotted underline decoration-muted-foreground/30 underline-offset-2">#</span>
          </GameTooltip>
        </div>

        <div className="flex items-center pb-2 border-b-2 border-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Perfume
        </div>

        <div className="grid grid-cols-5 w-full justify-items-center text-center px-1 pb-2 border-b-2 border-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <GameTooltip content="Brand" className="h-9 w-9 justify-center items-center">
            <span className="flex justify-center cursor-help decoration-dotted underline decoration-muted-foreground/30 underline-offset-2">B</span>
          </GameTooltip>

          <GameTooltip content="Perfumer" className="h-9 w-9 justify-center items-center">
            <span className="flex justify-center cursor-help decoration-dotted underline decoration-muted-foreground/30 underline-offset-2">P</span>
          </GameTooltip>

          <GameTooltip content="Year" className="h-9 w-9 justify-center items-center">
            <span className="flex justify-center cursor-help decoration-dotted underline decoration-muted-foreground/30 underline-offset-2">Y</span>
          </GameTooltip>

          <GameTooltip content="Gender" className="h-9 w-9 justify-center items-center">
            <span className="flex justify-center cursor-help decoration-dotted underline decoration-muted-foreground/30 underline-offset-2">G</span>
          </GameTooltip>

          <GameTooltip content="Notes" className="h-9 w-9 justify-center items-center">
            <span className="flex justify-center cursor-help decoration-dotted underline decoration-muted-foreground/30 underline-offset-2">N</span>
          </GameTooltip>
        </div>

        {attempts.map((attempt, index) => (
          <div key={`attempt-${index}`} className="contents group">
            <div id={`attempt-${index}`} className="flex justify-center items-center py-3 border-b border-muted/30 group-last:border-0 relative z-10">
              <span className="font-[family-name:var(--font-playfair)] text-muted-foreground text-center block">
                {ROMAN_NUMERALS[index]}
              </span>
            </div>

            <div className="min-w-0 pr-2 py-3 border-b border-muted/30 group-last:border-0 relative z-10 flex flex-col justify-center">
              {(() => {
                const concentration = attempt.concentration || '';
                let displayName = attempt.guess;
                if (concentration && displayName.toLowerCase().endsWith(concentration.toLowerCase())) {
                  displayName = displayName.substring(0, displayName.length - concentration.length).trim();
                }

                return (
                  <>
                    <span className="font-medium text-foreground text-sm sm:text-base">{displayName}</span>
                    <span className="text-muted-foreground text-xs block sm:inline sm:ml-2">
                      {(attempt.feedback.brandMatch || attempt.snapshot?.brandRevealed)
                        ? `by ${attempt.brand}`
                        : (attempt.snapshot?.guessMaskedBrand && attempt.snapshot.guessMaskedBrand !== '•••'
                          ? <span className="opacity-60 tracking-wider text-xs">by {attempt.snapshot.guessMaskedBrand}</span>
                          : <span className="opacity-30">by •••</span>)
                      }
                    </span>
                    <div className="text-xs text-muted-foreground/70 flex gap-x-2">
                      {attempt.year ? (
                        <span>
                          {(attempt.feedback.yearMatch === "correct" || attempt.snapshot?.yearRevealed)
                            ? attempt.year
                            : (attempt.snapshot?.guessMaskedYear && attempt.snapshot.guessMaskedYear !== '••••'
                              ? <span className="opacity-60 tracking-wider">{attempt.snapshot.guessMaskedYear}</span>
                              : <span className="opacity-30">••••</span>)
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

            <div className="grid grid-cols-5 w-full items-center font-[family-name:var(--font-hand)] text-xl text-primary px-1 py-3 border-b border-muted/30 group-last:border-0 relative z-10">
              {/* Brand */}
              <div className="flex justify-center items-center h-full">
                {attempt.feedback.brandMatch ? (
                  <GameTooltip content="Brand: Correct" className="h-9 w-9 justify-center items-center">
                    <div className="flex items-center justify-center w-6 h-6">
                      <Check className="w-4 h-4 text-success" />
                    </div>
                  </GameTooltip>
                ) : (
                  <GameTooltip content="Brand: Incorrect" className="h-9 w-9 justify-center items-center">
                    <span className="opacity-50 cursor-help"><X className="w-4 h-4 text-muted-foreground transform -skew-x-12" strokeWidth={1.5} /></span>
                  </GameTooltip>
                )}
              </div>

              {/* Perfumer */}
              <div className="flex justify-center items-center h-full">
                {attempt.feedback.perfumerMatch === "full" ? (
                  <GameTooltip content="Perfumer: Full Match" className="h-9 w-9 justify-center items-center">
                    <div className="flex items-center justify-center w-6 h-6">
                      <Check className="w-4 h-4 text-success" />
                    </div>
                  </GameTooltip>
                ) : attempt.feedback.perfumerMatch === "partial" ? (
                  <GameTooltip content="Perfumer: Partial match" className="h-9 w-9 justify-center items-center">
                    <span className="cursor-help"><Waves className="w-4 h-4 text-muted-foreground opacity-50 transform -skew-x-12" strokeWidth={1.5} /></span>
                  </GameTooltip>
                ) : (
                  <GameTooltip content="Perfumer: Incorrect" className="h-9 w-9 justify-center items-center">
                    <span className="opacity-50 cursor-help"><X className="w-4 h-4 text-muted-foreground transform -skew-x-12" strokeWidth={1.5} /></span>
                  </GameTooltip>
                )}
              </div>

              {/* Year */}
              <div className="flex justify-center items-center h-full">
                {attempt.feedback.yearMatch === "correct" ? (
                  <GameTooltip content="Year: Correct" className="h-9 w-9 justify-center items-center">
                    <div className="flex items-center justify-center w-6 h-6">
                      <Check className="w-4 h-4 text-success" />
                    </div>
                  </GameTooltip>
                ) : (
                  <div className="flex flex-col items-center justify-center w-full h-full">
                    <GameTooltip content={
                      attempt.feedback.yearMatch === "close"
                        ? (attempt.feedback.yearDirection === "higher" ? "Year: Close. Try a newer year (1-3 years)" : "Year: Close. Try an older year (1-3 years)")
                        : (attempt.feedback.yearDirection === "higher" ? "Year: Incorrect. Try a newer year" : "Year: Incorrect. Try an older year")
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
                      <GameTooltip content="Gender: Unknown" className="h-9 w-9 justify-center items-center">
                        <span className="text-muted-foreground opacity-50 text-base leading-none font-[family-name:var(--font-hand)] cursor-help inline-block px-1">?</span>
                      </GameTooltip>
                    )
                  }

                  if (guessGender === targetGender) {
                    return (
                      <GameTooltip content="Gender: Correct" className="h-9 w-9 justify-center items-center">
                        <div className="flex items-center justify-center w-6 h-6">
                          <Check className="w-4 h-4 text-success" />
                        </div>
                      </GameTooltip>
                    );
                  }

                  return (
                    <GameTooltip content="Gender: Incorrect" className="h-9 w-9 justify-center items-center">
                      <span className="opacity-50 cursor-help"><X className="w-4 h-4 text-muted-foreground transform -skew-x-12" strokeWidth={1.5} /></span>
                    </GameTooltip>
                  );
                })()}
              </div>

              {/* Notes */}
              <div className="flex justify-center items-center h-full">
                {attempt.feedback.notesMatch >= 1.0 ? (
                  <GameTooltip content="Notes: 100% correct" className="h-9 w-9 justify-center items-center">
                    <div className="flex items-center justify-center w-6 h-6">
                      <Check className="w-5 h-5 text-success" />
                    </div>
                  </GameTooltip>
                ) : (
                  <GameTooltip content={`Notes: ${Math.round(attempt.feedback.notesMatch * 100)}% correct`} className="h-9 w-9 justify-center items-center">
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
    </section>
  )
}
