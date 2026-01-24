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
    // Progressive reveal logic (Linear)
    // Level 1: Generic placeholders (•••, •••, •••)
    // Level 2: Masked notes (all notes, but masked e.g. •••••)
    // Level 3: 1/3 notes revealed (from end)
    // Level 4: 2/3 notes revealed (from end)
    // Level 5+: All notes revealed

    let displayNotes: string[] = []

    if (revealLevel === 1) {
      // 3 generic dots
      displayNotes = ["•••", "•••", "•••"]
    } else if (revealLevel === 2) {
      // All notes masked (0% reveal)
      displayNotes = mergedNotes.map(n => n.replace(/[a-zA-Z0-9]/g, '•'))
    } else if (revealLevel === 3) {
      // 1/3 revealed from end, rest masked
      const count = Math.ceil(mergedNotes.length * (1 / 3))
      displayNotes = mergedNotes.map((n, i) => {
        // if index is in the last 'count', show it. Else mask it.
        if (i >= mergedNotes.length - count) return n
        return n.replace(/[a-zA-Z0-9]/g, '•')
      })
    } else if (revealLevel === 4) {
      // 2/3 revealed from end
      const count = Math.ceil(mergedNotes.length * (2 / 3))
      displayNotes = mergedNotes.map((n, i) => {
        if (i >= mergedNotes.length - count) return n
        return n.replace(/[a-zA-Z0-9]/g, '•')
      })
    } else {
      // Level 5+ -> All
      displayNotes = mergedNotes
    }

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
            {displayNotes.map((note, i) => (
              <span key={i} className="text-foreground">
                {note.split('').map((char, index) => (
                  <span key={index} className={char === '•' ? "opacity-30 text-muted-foreground" : "text-foreground"}>
                    {char}
                  </span>
                ))}
                {i < displayNotes.length - 1 && <span className="text-muted-foreground/30 mx-1">,</span>}
              </span>
            ))}
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
