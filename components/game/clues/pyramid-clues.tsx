"use client"

import { useGame } from "../game-provider"

export function PyramidClues() {
  const { getVisibleNotes, dailyPerfume, revealLevel } = useGame() // isLinear is accessible via dailyPerfume.isLinear
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
    let visibleCount = 0
    if (revealLevel >= 3) {
      visibleCount = mergedNotes.length // 100%
    } else if (revealLevel === 2) {
      visibleCount = Math.ceil(mergedNotes.length * 0.5) // 50%
    } else if (revealLevel === 1) {
      visibleCount = Math.ceil(mergedNotes.length * (1 / 3)) // 33%
    }

    // Reveal from END (last notes first)
    const visibleNotes = visibleCount > 0 ? mergedNotes.slice(-visibleCount) : []

    // Always render 3 visual slots for linear perfumes
    const slots = [0, 1, 2]

    return (
      <div>
        <h2 className="font-[family-name:var(--font-playfair)] text-lg italic text-foreground mb-4">
          Olfactory Profile
        </h2>

        <div className="grid grid-cols-[70px_1fr] items-center">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Linear
          </span>
          <div className="flex flex-wrap gap-2 text-sm">
            {slots.map((i) => {
              const note = visibleNotes[i]
              return (
                <span
                  key={i}
                  className="text-foreground"
                >
                  {note ? (
                    note.split('').map((char, index) => (
                      <span key={index} className={char === '•' ? "opacity-50 text-muted-foreground" : "text-foreground"}>
                        {char}
                      </span>
                    ))
                  ) : (
                    <span className="text-muted-foreground font-caveat opacity-30">•••</span>
                  )}
                  {i < slots.length - 1 && <span className="text-muted-foreground/30 mx-1">,</span>}
                </span>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // TRADITIONAL PYRAMID LOGIC
  const levels = [
    { name: "Top", notes: notes.top },
    { name: "Heart", notes: notes.heart },
    { name: "Base", notes: notes.base },
  ]

  return (
    <div>
      <h2 className="font-[family-name:var(--font-playfair)] text-lg italic text-foreground mb-4">
        Pyramid
      </h2>

      <ul className="space-y-3">
        {levels.map((level) => (
          <li key={level.name} className="grid grid-cols-[70px_1fr] items-center">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {level.name}
            </span>
            {level.notes && level.notes.length > 0 ? (
              <span className="text-sm">
                {level.notes.map((note, noteIndex) => (
                  <span key={noteIndex}>
                    {note.split('').map((char, charIndex) => (
                      <span key={charIndex} className={char === '•' ? "opacity-50 text-muted-foreground" : "text-foreground"}>
                        {char}
                      </span>
                    ))}
                    {noteIndex < level.notes!.length - 1 && ", "}
                  </span>
                ))}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground font-caveat opacity-30">
                •••
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
