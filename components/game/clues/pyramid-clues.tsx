"use client"

import { useGame } from "../game-provider"

export function PyramidClues() {
  const { getVisibleNotes } = useGame()
  const notes = getVisibleNotes()

  const levels = [
    { name: "Top Notes", notes: notes.top, nameEn: "Top" },
    { name: "Heart Notes", notes: notes.heart, nameEn: "Heart" },
    { name: "Base Notes", notes: notes.base, nameEn: "Base" },
  ]

  return (
    <div>
      <h2 className="font-[family-name:var(--font-playfair)] text-lg italic text-foreground mb-4">Olfactory Pyramid</h2>

      <ul className="space-y-3">
        {levels.map((level) => (
          <li key={level.name} className="grid grid-cols-[70px_1fr] items-center">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{level.name}</span>
            {level.notes ? (
              <span className="text-sm text-foreground">{level.notes.join(", ")}</span>
            ) : (
              <span className="text-sm text-muted-foreground/50 tracking-widest">? ? ? ?</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
