"use client"

import { useGame } from "./game-provider"
import { MarkerCircle } from "./marker-circle"

const ROMAN_NUMERALS = ["I", "II", "III", "IV", "V"]

export function AttemptLog() {
  const { attempts, maxAttempts } = useGame()

  if (attempts.length === 0) return null

  return (
    <section className="border-t border-border pt-6">
      <h2 className="font-[family-name:var(--font-playfair)] text-lg italic text-foreground mb-4">Investigation Log</h2>

      <div className="space-y-0">
        {attempts.map((attempt, index) => (
          <div key={index} className="grid grid-cols-[40px_1fr_auto] items-center py-3 border-b border-muted">
            <span className="font-[family-name:var(--font-playfair)] text-muted-foreground">
              {ROMAN_NUMERALS[index]}.
            </span>

            <div>
              <span className="font-medium text-foreground">{attempt.guess}</span>
              <span className="text-muted-foreground text-sm ml-2">{attempt.brand}</span>
            </div>

            <div className="flex gap-3 font-[family-name:var(--font-hand)] text-xl text-primary">
              {/* Brand feedback */}
              {attempt.feedback.brandMatch ? (
                <MarkerCircle letter="M" title="Brand: Correct" />
              ) : (
                <span title="Brand: Incorrect" className="text-muted-foreground">
                  ×
                </span>
              )}

              {/* Year feedback */}
              {attempt.feedback.yearMatch === "correct" ? (
                <MarkerCircle letter="Y" title="Year: Correct" />
              ) : attempt.feedback.yearMatch === "close" ? (
                <span title="Year: Close">~</span>
              ) : (
                <span title="Year: Incorrect" className="text-muted-foreground">
                  ×
                </span>
              )}

              {/* Notes feedback */}
              {attempt.feedback.notesMatch === "full" ? (
                <MarkerCircle letter="N" title="Notes: Full Match" />
              ) : attempt.feedback.notesMatch === "partial" ? (
                <span title="Notes: Partial">~</span>
              ) : (
                <span title="Notes: No Match" className="text-muted-foreground">
                  ×
                </span>
              )}
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
