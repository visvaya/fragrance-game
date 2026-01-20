"use client"

import { useGame } from "../game-provider"

export function AccordsClues() {
  const { getVisibleAccords, revealLevel } = useGame()
  const { visible, hidden } = getVisibleAccords()

  const percentages = [25, 50, 75, 100, 100]
  const currentPercent = percentages[revealLevel - 1]

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-[family-name:var(--font-playfair)] text-lg italic text-foreground">Main Accords</h2>
        <span className="text-[10px] uppercase tracking-wide bg-muted px-2 py-1 text-muted-foreground">
          {currentPercent}% visible
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {visible.map((accord) => (
          <span
            key={accord}
            className="px-4 py-1.5 border border-foreground text-sm bg-transparent text-foreground rounded-full"
          >
            {accord}
          </span>
        ))}

        {/* Hidden placeholders */}
        {Array.from({ length: hidden }).map((_, i) => (
          <span
            key={`hidden-${i}`}
            className="px-4 py-1.5 border border-dashed border-muted-foreground/40 text-sm bg-transparent text-transparent rounded-full w-16 relative"
          >
            <span className="absolute inset-0 flex items-center justify-center text-muted-foreground/40">?</span>
          </span>
        ))}
      </div>
    </div>
  )
}
