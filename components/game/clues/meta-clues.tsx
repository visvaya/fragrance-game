"use client"

import { useGame } from "../game-provider"

export function MetaClues() {
  const { getRevealedBrand, getRevealedPerfumer, getRevealedYear, revealLevel, dailyPerfume, isGenderRevealed, gameState } = useGame()

  const clues = [
    { label: "Brand", value: getRevealedBrand() },
    { label: "Perfumer", value: getRevealedPerfumer() },
    { label: "Year", value: getRevealedYear() },
    {
      label: "Gender",
      value: (revealLevel >= 5 || isGenderRevealed || gameState === 'won' || gameState === 'lost') ? dailyPerfume.gender : "•••",
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      {clues.map((clue) => (
        <div key={clue.label} className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{clue.label}</span>
          <span
            className={`font-[family-name:var(--font-playfair)] text-lg tracking-[0.12em] leading-tight ${(clue.value === "•••" || clue.value === "••••") ? "opacity-30" : ""}`}
          >
            {clue.value.split('').map((char, i) => (
              <span key={i} className={char === '•' ? "opacity-50 text-muted-foreground" : "text-foreground"}>
                {char}
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  )
}
