"use client"

import { useGame } from "./game-provider"
import { MarkerCircle } from "./marker-circle"

const ROMAN_NUMERALS = ["I", "II", "III", "IV", "V", "VI"]

export function AttemptLog() {
  const { attempts, maxAttempts } = useGame()

  if (attempts.length === 0) return null

  return (
    <section className="border-t border-border pt-6">
      <h2 className="font-[family-name:var(--font-playfair)] text-lg italic text-foreground mb-4">Investigation Log</h2>

      <div className="space-y-0">
        {attempts.map((attempt, index) => (
          <div className="grid grid-cols-[40px_1fr_140px] items-center py-3 border-b border-muted">
            <span className="font-[family-name:var(--font-playfair)] text-muted-foreground">
              {ROMAN_NUMERALS[index]}.
            </span>

            <div>
              <span className="font-medium text-foreground">{attempt.guess}</span>
              <span className="text-muted-foreground text-sm ml-2">{attempt.brand}</span>
            </div>

            <div className="flex justify-between items-center font-[family-name:var(--font-hand)] text-xl text-primary">
              {/* Brand feedback */}
              <div className="flex justify-center items-center w-8">
                {attempt.feedback.brandMatch ? (
                  <MarkerCircle letter="M" title="Brand: Correct" />
                ) : (
                  <span title="Brand: Incorrect" className="text-muted-foreground">
                    ×
                  </span>
                )}
              </div>

              {/* Year feedback with Direction Arrows & Tooltip */}
              <div className="flex justify-center items-center w-8">
                {attempt.feedback.yearMatch === "correct" ? (
                  <MarkerCircle letter="Y" title="Year: Correct" />
                ) : (
                  <div className="flex flex-col items-center">
                    <span title={attempt.feedback.yearDirection === "higher" ? "Try a later/newer year (±3y)" : "Try an earlier/older year (±3y)"}>
                      {attempt.feedback.yearDirection === "higher" ? "↑" : "↓"}
                    </span>
                    {attempt.feedback.yearMatch === "close" && <span className="text-[10px] uppercase">Close</span>}
                  </div>
                )}
              </div>

              <div className="flex justify-center items-center w-8">
                {/* Perfumer feedback */}
                {attempt.feedback.perfumerMatch === "full" ? (
                  <MarkerCircle letter="P" title="Perfumer: Full Match" />
                ) : attempt.feedback.perfumerMatch === "partial" ? (
                  <span title="Perfumer: Partial match">~</span>
                ) : (
                  <span className="text-muted-foreground" title="Perfumer: Incorrect">×</span>
                )}
              </div>

              <div className="flex justify-center items-center w-8">
                {/* Notes feedback - show circle for 100%, percentage for others */}
                {attempt.feedback.notesMatch >= 1.0 ? (
                  <MarkerCircle letter="N" title="Notes: Full Match (100%)" />
                ) : attempt.feedback.notesMatch >= 0.7 ? (
                  <span
                    title={`Notes: ${Math.round(attempt.feedback.notesMatch * 100)}% match`}
                    className="text-sm font-semibold text-primary"
                  >
                    {Math.round(attempt.feedback.notesMatch * 100)}%
                  </span>
                ) : attempt.feedback.notesMatch >= 0.3 ? (
                  <span title={`Notes: ${Math.round(attempt.feedback.notesMatch * 100)}% match (partial)`}>
                    ~
                  </span>
                ) : (
                  <span className="text-muted-foreground">×</span>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Empty slots for remaining attempts */}
        {Array.from({ length: maxAttempts - attempts.length }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="grid grid-cols-[40px_1fr] items-center py-3 border-b border-muted opacity-30"
          >
            <span className="font-[family-name:var(--font-playfair)] text-muted-foreground">
              {ROMAN_NUMERALS[attempts.length + i]}.
            </span>
            <span className="text-muted-foreground">...</span>
          </div>
        ))}
      </div>
    </section>
  )
}
