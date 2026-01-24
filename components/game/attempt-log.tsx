"use client"

import { useGame } from "./game-provider"
import { MarkerCircle } from "./marker-circle"
import { cn } from "@/lib/utils"
import { X, ArrowUp, ArrowDown, Waves } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

const ROMAN_NUMERALS = ["I", "II", "III", "IV", "V", "VI"]

export function AttemptLog() {
  const { attempts, maxAttempts, isBrandRevealed, isYearRevealed, dailyPerfume } = useGame()

  if (attempts.length === 0) return null

  return (
    <section className="border-t border-border pt-6">
      <h2 className="font-[family-name:var(--font-playfair)] text-lg italic text-foreground mb-4">Investigation Log</h2>

      <div className="space-y-0">
        {/* Helper Header Row */}
        <div className="grid grid-cols-[50px_1fr_140px] items-center pb-2 border-b-2 border-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <span className="text-center">#</span>
          <span>Perfume</span>
          <div className="flex justify-between text-center w-full px-1">
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="w-[15%] flex justify-center cursor-help decoration-dotted underline decoration-muted-foreground/30 underline-offset-2">B</span>
                </TooltipTrigger>
                <TooltipContent>Brand</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="w-[15%] flex justify-center cursor-help decoration-dotted underline decoration-muted-foreground/30 underline-offset-2">P</span>
                </TooltipTrigger>
                <TooltipContent>Perfumer</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="w-[15%] flex justify-center cursor-help decoration-dotted underline decoration-muted-foreground/30 underline-offset-2">Y</span>
                </TooltipTrigger>
                <TooltipContent>Year</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="w-[15%] flex justify-center cursor-help decoration-dotted underline decoration-muted-foreground/30 underline-offset-2">G</span>
                </TooltipTrigger>
                <TooltipContent>Gender</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="w-[15%] flex justify-center cursor-help decoration-dotted underline decoration-muted-foreground/30 underline-offset-2">N</span>
                </TooltipTrigger>
                <TooltipContent>Notes</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {attempts.map((attempt, index) => (
          <div key={`attempt-${index}`} className={"grid grid-cols-[50px_1fr_140px] items-center py-3 border-b border-muted/30 last:border-0 relative z-10"}>
            <span className="font-[family-name:var(--font-playfair)] text-muted-foreground text-center block">
              {ROMAN_NUMERALS[index]}
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
                  <MarkerCircle letter="B" title="Brand: Correct" className="w-4 h-4" />
                ) : (
                  <span title="Brand: Incorrect" className="opacity-50"><X className="w-4 h-4 text-muted-foreground transform -skew-x-12" strokeWidth={1.5} /></span>
                )}
              </div>

              {/* Perfumer */}
              <div className="w-[15%] flex justify-center">
                {attempt.feedback.perfumerMatch === "full" ? (
                  <MarkerCircle letter="P" title="Perfumer: Full Match" className="w-4 h-4" />
                ) : attempt.feedback.perfumerMatch === "partial" ? (
                  <span title="Perfumer: Partial match"><Waves className="w-4 h-4 text-muted-foreground opacity-50 transform -skew-x-12" strokeWidth={1.5} /></span>
                ) : (
                  <span title="Perfumer: Incorrect" className="opacity-50"><X className="w-4 h-4 text-muted-foreground transform -skew-x-12" strokeWidth={1.5} /></span>
                )}
              </div>

              {/* Year */}
              {/* Year */}
              <div className="w-[15%] flex justify-center">
                {attempt.feedback.yearMatch === "correct" ? (
                  <MarkerCircle letter="Y" title="Year: Correct" className="w-4 h-4" />
                ) : (
                  <div className="flex flex-col items-center justify-center">
                    <span
                      title={attempt.feedback.yearMatch === "close"
                        ? (attempt.feedback.yearDirection === "higher" ? "Year: Close. Try a newer year (1-3 years)" : "Year: Close. Try an older year (1-3 years)")
                        : (attempt.feedback.yearDirection === "higher" ? "Year: Incorrect. Try a newer year" : "Year: Incorrect. Try an older year")}
                      className={cn(
                        "flex items-center justify-center h-4 w-4",
                        attempt.feedback.yearMatch === "close" ? "text-warning" : "text-muted-foreground opacity-50"
                      )}
                    >
                      {attempt.feedback.yearDirection === "higher" ? (
                        <ArrowUp className="w-4 h-4 transform -skew-x-12" strokeWidth={1.5} />
                      ) : (
                        <ArrowDown className="w-4 h-4 transform -skew-x-12" strokeWidth={1.5} />
                      )}
                    </span>
                  </div>
                )}
              </div>

              <div className="w-[15%] flex justify-center items-center">
                {(() => {
                  const guessGender = attempt.gender?.toLowerCase() || 'unknown';
                  const targetGender = dailyPerfume.gender?.toLowerCase() || 'unknown';

                  // If either is unknown (e.g. data missing or legitimately unknown), show Gray ?
                  if (guessGender === 'unknown' || targetGender === 'unknown') {
                    return <span className="text-muted-foreground opacity-50 text-base leading-none font-[family-name:var(--font-hand)]" title="Gender: Unknown">?</span>;
                  }

                  // Direct comparison - Immediate Feedback
                  if (guessGender === targetGender) {
                    return <MarkerCircle letter="G" title="Gender: Correct" className="w-4 h-4" />;
                  }

                  // Mismatch
                  return <span title="Gender: Incorrect" className="opacity-50"><X className="w-4 h-4 text-muted-foreground transform -skew-x-12" strokeWidth={1.5} /></span>;
                })()}
              </div>

              {/* Notes */}
              <div className="w-[15%] flex justify-center">
                {/* Notes feedback - show circle for 100%, percentage for others without 'correct' text just val */}
                {attempt.feedback.notesMatch >= 1.0 ? (
                  <MarkerCircle letter="N" title="Notes: 100% correct" className="w-4 h-4" />
                ) : (
                  <span
                    title={`Notes: ${Math.round(attempt.feedback.notesMatch * 100)}% correct`}
                    className={`text-base leading-none flex items-center font-[family-name:var(--font-hand)] ${attempt.feedback.notesMatch >= 0.4 ? "text-warning" : "text-muted-foreground opacity-50"}`}
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
            className="grid grid-cols-[50px_1fr] items-center py-3 border-b border-muted/30 opacity-30 last:border-0"
          >
            <span className="font-[family-name:var(--font-playfair)] text-muted-foreground text-center block">
              {ROMAN_NUMERALS[attempts.length + i]}
            </span>
            <span className="text-muted-foreground">...</span>
          </div>
        ))}
      </div>
    </section >
  )
}
