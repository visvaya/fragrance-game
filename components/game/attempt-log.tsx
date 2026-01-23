"use client"

import { useGame } from "./game-provider"
import { MarkerCircle } from "./marker-circle"

const ROMAN_NUMERALS = ["I", "II", "III", "IV", "V", "VI"]

export function AttemptLog() {
  const { attempts, maxAttempts, isBrandRevealed, isYearRevealed, dailyPerfume } = useGame()

  if (attempts.length === 0) return null

  return (
    <section className="border-t border-border pt-6">
      <h2 className="font-[family-name:var(--font-playfair)] text-lg italic text-foreground mb-4">Investigation Log</h2>

      <div className="space-y-0">
        {/* Helper Header Row */}
        <div className="grid grid-cols-[30px_1fr_160px] items-center pb-2 border-b-2 border-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <span className="text-center">#</span>
          <span>Perfume</span>
          <div className="flex justify-between text-center w-full px-1">
            <span title="Brand" className="w-[15%] flex justify-center">B</span>
            <span title="Perfumer" className="w-[15%] flex justify-center">P</span>
            <span title="Year" className="w-[15%] flex justify-center">Y</span>
            <span title="Gender" className="w-[15%] flex justify-center">G</span>
            <span title="Notes" className="w-[15%] flex justify-center">N</span>
          </div>
        </div>

        {attempts.map((attempt, index) => (
          <div key={`attempt-${index}`} className={"grid grid-cols-[30px_1fr_160px] items-center py-3 border-b border-muted/30 last:border-0 relative z-10"}>
            <span className="font-[family-name:var(--font-playfair)] text-muted-foreground">
              {ROMAN_NUMERALS[index]}.
            </span>

            <div>
              {(() => {
                // Logic to strip concentration from name if duplicative
                const concentration = attempt.concentration || '';
                let displayName = attempt.guess;
                if (concentration && displayName.toLowerCase().endsWith(concentration.toLowerCase())) {
                  displayName = displayName.substring(0, displayName.length - concentration.length).trim();
                }

                return (
                  <>
                    <span className="font-medium text-foreground text-sm sm:text-base">{displayName}</span>
                    <span className="text-muted-foreground text-xs block sm:inline sm:ml-2">
                      {/* Brand Masking - Show if brand matched OR global reveal */}
                      {(attempt.feedback.brandMatch || isBrandRevealed) ? `by ${attempt.brand}` : <span className="opacity-30">by •••</span>}
                    </span>
                    <div className="text-xs text-muted-foreground/70 flex gap-x-2">
                      {/* Year Masking - Only show if year exists in DB for this guess */}
                      {attempt.year ? (
                        <span>
                          {(attempt.feedback.yearMatch === "correct" || isYearRevealed)
                            ? attempt.year
                            : <span className="opacity-30">••••</span>}
                        </span>
                      ) : null}

                      {/* Concentration - Only show if exists and not 'Unknown' */}
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


            {/* Results Columns Container */}
            <div className="flex justify-between items-center font-[family-name:var(--font-hand)] text-xl text-primary px-1">
              {/* Brand */}
              <div className="w-[15%] flex justify-center">
                {attempt.feedback.brandMatch ? (
                  <MarkerCircle letter="B" title="Brand: Correct" />
                ) : (
                  <span title="Brand: Incorrect" className="text-muted-foreground opacity-50">×</span>
                )}
              </div>

              {/* Perfumer */}
              <div className="w-[15%] flex justify-center">
                {attempt.feedback.perfumerMatch === "full" ? (
                  <MarkerCircle letter="P" title="Perfumer: Full Match" />
                ) : attempt.feedback.perfumerMatch === "partial" ? (
                  <span title="Perfumer: Partial match">~</span>
                ) : (
                  <span className="text-muted-foreground opacity-50" title="Perfumer: Incorrect">×</span>
                )}
              </div>

              {/* Year */}
              <div className="w-[15%] flex justify-center">
                {attempt.feedback.yearMatch === "correct" ? (
                  <MarkerCircle letter="Y" title="Year: Correct" />
                ) : (
                  <div className="flex flex-col items-center">
                    <span title={attempt.feedback.yearMatch === "close"
                      ? (attempt.feedback.yearDirection === "higher" ? "Year: Close. Try a newer year" : "Year: Close. Try an older year")
                      : (attempt.feedback.yearDirection === "higher" ? "Year: Incorrect. Try a newer year" : "Year: Incorrect. Try an older year")}>
                      {attempt.feedback.yearDirection === "higher" ? "↑" : "↓"}
                    </span>
                    {attempt.feedback.yearMatch === "close" && <span className="text-[10px] uppercase font-sans font-bold leading-none scale-75">Close</span>}
                  </div>
                )}
              </div>

              <div className="w-[15%] flex justify-center items-center">
                {attempt.snapshot?.genderRevealed && attempt.gender ? (
                  attempt.gender.toLowerCase() === dailyPerfume.gender.toLowerCase() ? (
                    <MarkerCircle letter="G" title="Gender: Correct" />
                  ) : (
                    <span title="Gender: Incorrect" className="text-muted-foreground opacity-50 font-bold">×</span>
                  )
                ) : (
                  <span className="opacity-30">?</span>
                )}
              </div>

              {/* Notes */}
              <div className="w-[15%] flex justify-center">
                {/* Notes feedback - show circle for 100%, percentage for others without 'correct' text just val */}
                {attempt.feedback.notesMatch >= 1.0 ? (
                  <MarkerCircle letter="N" title="Notes: 100% Correct" />
                ) : (
                  <span
                    title={`Notes: ${Math.round(attempt.feedback.notesMatch * 100)}% correct`}
                    className={`text-sm font-semibold  ${attempt.feedback.notesMatch > 0 ? "text-foreground" : "text-muted-foreground opacity-50"}`}
                  >
                    {Math.round(attempt.feedback.notesMatch * 100)}%
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Empty slots for remaining attempts */}
        {Array.from({ length: maxAttempts - attempts.length }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="grid grid-cols-[30px_1fr] items-center py-3 border-b border-muted/30 opacity-30 last:border-0"
          >
            <span className="font-[family-name:var(--font-playfair)] text-muted-foreground text-center">
              {ROMAN_NUMERALS[attempts.length + i]}.
            </span>
            <span className="text-muted-foreground pl-2">...</span>
          </div>
        ))}
      </div>
    </section >
  )
}
