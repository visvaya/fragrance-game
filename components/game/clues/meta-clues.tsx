"use client"

import { useGame } from "../game-provider"

export function MetaClues() {
  const { getRevealedBrand, getRevealedPerfumer, getRevealedYear, revealLevel, dailyPerfume } = useGame()

  const clues = [
    { label: "House / Brand", value: getRevealedBrand() },
    { label: "Nose / Perfumer", value: getRevealedPerfumer() },
    { label: "Year", value: getRevealedYear() },
    {
      label: "Gender",
      value: revealLevel >= 5 ? dailyPerfume.gender : "???",
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      {clues.map((clue) => (
        <div key={clue.label} className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{clue.label}</span>
          <span
            className="font-[family-name:var(--font-playfair)] text-lg tracking-[0.12em] leading-tight"
            style={{
              color: clue.value === "???" ? "var(--muted-foreground)" : "var(--foreground)",
            }}
          >
            {clue.value}
          </span>
        </div>
      ))}
    </div>
  )
}
