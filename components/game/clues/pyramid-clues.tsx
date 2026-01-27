"use client"

import { useGame } from "../game-provider"
import { GameTooltip } from "../game-tooltip"
import { Circle, Layers } from "lucide-react"

import { useTranslations } from "next-intl"

export function PyramidClues() {
  const t = useTranslations('PyramidClues')
  const { getVisibleNotes, dailyPerfume, revealLevel, currentAttempt, gameState } = useGame() // isLinear is accessible via dailyPerfume.isLinear
  const notes = getVisibleNotes()
  const isLinear = dailyPerfume.isLinear

  // LINEAR PERFUME LOGIC
  if (isLinear) {
    const mergedNotes = [
      ...(dailyPerfume.notes.top || []),
      ...(dailyPerfume.notes.heart || []),
      ...(dailyPerfume.notes.base || [])
    ].filter(Boolean)

    // Progressive reveal logic
    // Level 1: Generic placeholders (•••, •••, •••)
    // Level 2: Masked notes (all notes, but masked e.g. •••••)
    // Level 3: 1/3 notes revealed (from end)
    // Level 4: 2/3 notes revealed (from end)
    // Level 5+: All notes revealed

    let displayNotes: string[] = []


    const isGameOver = gameState === 'won' || gameState === 'lost';

    if (isGameOver || revealLevel >= 5) {
      // Level 5+ or Game Over -> All
      displayNotes = mergedNotes
    } else if (revealLevel === 1) {
      // 3 generic dots -> now 3 generic scores/slots
      displayNotes = ["?????", "?????", "?????"]
    } else if (revealLevel === 2) {
      // All notes masked (0% reveal)
      displayNotes = mergedNotes.map(n => n.replace(/[a-zA-Z0-9]/g, '_'))
    } else if (revealLevel === 3) {
      // 1/3 revealed from end, rest masked
      const count = Math.ceil(mergedNotes.length * (1 / 3))
      displayNotes = mergedNotes.map((n, i) => {
        // if index is in the last 'count', show it. Else mask it.
        if (i >= mergedNotes.length - count) return n
        return n.replace(/[a-zA-Z0-9]/g, '_')
      })
    } else if (revealLevel === 4) {
      // 2/3 revealed from end
      const count = Math.ceil(mergedNotes.length * (2 / 3))
      displayNotes = mergedNotes.map((n, i) => {
        if (i >= mergedNotes.length - count) return n
        return n.replace(/[a-zA-Z0-9]/g, '_')
      })
    }

    return (
      <div className="bg-background p-4 rounded-md border border-border/50">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-[family-name:var(--font-playfair)] text-lg text-foreground">
            {t('olfactoryProfile')}
          </h2>
        </div>

        <ul className="space-y-4">
          <li className="relative flex flex-col gap-2 rounded-sm border border-border/60 p-4 overflow-hidden">
            {/* Colored Strip for Linear (Cyberpunk/Mixed -> maybe primary color or purple?) */}
            {/* Using primary for consistency with Heart level or specific Linear color */}
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />

            <div className="flex items-center gap-2 pl-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                {t('linearProfile')} {displayNotes.length > 0 && `(${displayNotes.length})`}
              </span>
            </div>

            <div className="pl-2">
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm justify-start">
                {displayNotes.map((note, i) => {
                  const isFullHidden = /^_+$|^\?\?\?\?\?$/.test(note) // Check for full underscores or sentinel
                  const words = note.split(' ');

                  // Generic placeholder case (Level 1)
                  // Note: In linear logic above we normalized to ___, but verify whatever comes in.
                  // If it's a generic placeholder for "hidden note"
                  if (revealLevel === 1 && (note === "?????")) {
                    return (
                      <span key={i} className="inline-flex items-center rounded-md border border-border bg-secondary/50 px-2.5 py-0.5 text-sm font-medium text-muted-foreground transition-colors duration-300 hover:bg-secondary gap-1.5 cursor-default">
                        <GameTooltip content={t('hiddenNote', { attempt: currentAttempt })}>
                          <div className="flex gap-1 cursor-help">
                            {/* Render 5 generic slots */}
                            {[1, 2, 3, 4, 5].map((_, idx) => (
                              <div
                                key={idx}
                                className="w-2.5 h-4 border-b border-muted-foreground/30 mx-[1px]"
                                aria-hidden="true"
                              />
                            ))}
                          </div>
                        </GameTooltip>
                      </span>
                    )
                  }

                  return (
                    <span key={i} className={`inline-flex items-center rounded-md border border-border bg-secondary/50 px-3 py-1 text-sm font-medium text-muted-foreground transition-colors duration-300 hover:bg-secondary gap-1.5 cursor-default`}>
                      {words.map((word, wIndex) => {
                        // Check if word contains masking chars
                        const hasMasking = word.includes('_');
                        const showTooltip = hasMasking;

                        const content = (
                          <div className="flex flex-wrap gap-0.5">
                            {word.split('').map((char, index) => {
                              const isSlot = char === '_';
                              if (isSlot) {
                                return (
                                  <div
                                    key={index}
                                    className={`w-2 h-4 border-b border-muted-foreground/30 mx-[0.5px] transition-all duration-300 ${isFullHidden ? "opacity-50" : "opacity-70"}`}
                                    aria-hidden="true"
                                  />
                                );
                              }
                              return (
                                <div
                                  key={index}
                                  className="w-2 h-4 flex items-end justify-center font-mono text-sm text-foreground border-b border-transparent mx-[0.5px]"
                                >
                                  {char}
                                </div>
                              );
                            })}
                          </div>
                        );

                        if (showTooltip) {
                          return <GameTooltip key={wIndex} content={t('letters', { count: word.length })}>
                            <div className="cursor-help">{content}</div>
                          </GameTooltip>
                        }
                        return <span key={wIndex}>{content}</span>
                      })}
                    </span>
                  )
                })}
              </div>
            </div>
          </li>
        </ul>
      </div>
    )
  }

  // TRADITIONAL PYRAMID LOGIC
  const levels = [
    { name: "Top", notes: notes.top, color: "text-[#fcd34d]" }, // Yellow (Valid Tailwind class for bg- replacement)
    { name: "Heart", notes: notes.heart, color: "text-primary" }, // Amber
    { name: "Base", notes: notes.base, color: "text-foreground" }, // Dark
  ]

  return (
    <div className="bg-background p-4 rounded-md border border-border/50">
      <div className="flex items-center gap-2 mb-4">
        <Layers className="w-4 h-4 text-muted-foreground" />
        <h2 className="font-[family-name:var(--font-playfair)] text-lg text-foreground">
          {t('pyramid')}
        </h2>
      </div>

      <ul className="space-y-4">
        {levels.map((level) => (
          <li key={level.name} className="relative flex flex-col gap-2 rounded-sm border border-border/60 p-4 overflow-hidden">
            {/* Colored Strip */}
            {/* Direct style color injection for yellow to be safe, or use bg-yellow-400 */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${level.name === 'Top' ? 'bg-[#fcd34d]' : level.color.replace('text-', 'bg-')}`} />

            <div className="flex items-center gap-2 pl-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                {t(level.name.toLowerCase())}{level.notes && level.notes.length > 0 && ` (${level.notes.length})`}
              </span>
            </div>

            <div className="pl-2">
              {level.notes && level.notes.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {level.notes.map((note, noteIndex) => {
                    const isFullHidden = /^_+$|^\?\?\?\?\?$/.test(note)
                    const words = note.split(' ');

                    // Check if it's the generic placeholder "??????" passed from GameProvider?
                    if (note === "?????") {
                      return (
                        <span key={noteIndex} className="inline-flex items-center rounded-md border border-border bg-secondary/50 px-2.5 py-0.5 text-sm font-medium text-muted-foreground transition-colors duration-300 hover:bg-secondary gap-1.5 cursor-default">
                          <GameTooltip content={t('hiddenNote', { attempt: currentAttempt })}>
                            <div className="flex gap-1 cursor-help">
                              {/* Render 5 generic slots */}
                              {[1, 2, 3, 4, 5].map((_, idx) => (
                                <div
                                  key={idx}
                                  className="w-2.5 h-4 border-b border-muted-foreground/30 mx-[1px]"
                                  aria-hidden="true"
                                />
                              ))}
                            </div>
                          </GameTooltip>
                        </span>
                      )
                    }
                    // GameProvider usually returns real notes. If masked, they contain '•' or '_' if we updated logic.
                    // But wait, getVisibleNotes in provider usually reveals words or hides them?
                    // Let's assume standard logic: characters are masked.

                    return (
                      <span key={noteIndex} className={`inline-flex items-center rounded-md border border-border bg-secondary/50 px-3 py-1 text-sm font-medium text-muted-foreground transition-colors duration-300 hover:bg-secondary gap-1.5 cursor-default`}>
                        {words.map((word, wIndex) => {
                          const hasMasking = word.includes('_');
                          const showTooltip = hasMasking;

                          const content = (
                            <div className="flex flex-wrap gap-0.5">
                              {word.split('').map((char, index) => {
                                const isSlot = char === '_';
                                if (isSlot) {
                                  return (
                                    <div
                                      key={index}
                                      className={`w-2 h-4 border-b border-muted-foreground/30 mx-[0.5px] transition-all duration-300 ${isFullHidden ? "opacity-50" : "opacity-70"}`}
                                      aria-hidden="true"
                                    />
                                  );
                                }
                                return (
                                  <div
                                    key={index}
                                    className="w-2 h-4 flex items-end justify-center font-mono text-sm text-foreground border-b border-transparent mx-[0.5px]"
                                  >
                                    {char}
                                  </div>
                                );
                              })}
                            </div>
                          );

                          if (showTooltip) {
                            return <GameTooltip key={wIndex} content={t('letters', { count: word.length })}>{content}</GameTooltip>;
                          }
                          return <span key={wIndex}>{content}</span>;
                        })}
                      </span>
                    )
                  })}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-md border border-border bg-secondary/50 px-2.5 py-0.5 text-sm font-medium text-foreground transition-colors duration-300 hover:bg-secondary gap-1.5 cursor-default">
                    <GameTooltip content={t('hiddenNotes', { attempt: currentAttempt })}>
                      <div className="flex gap-1 cursor-help">
                        {/* Generic placeholder for unknown notes */}
                        {[1, 2, 3].map((_, idx) => (
                          <div
                            key={idx}
                            className="w-2.5 h-4 border-b border-muted-foreground/30 mx-[1px]"
                            aria-hidden="true"
                          />
                        ))}
                      </div>
                    </GameTooltip>
                  </span>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

