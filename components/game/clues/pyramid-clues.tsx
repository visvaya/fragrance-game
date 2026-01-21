"use client"

import { useGame } from "../game-provider"

export function PyramidClues() {
  const { getVisibleNotes, dailyPerfume, revealLevel } = useGame() // isLinear is accessible via dailyPerfume.isLinear
  const notes = getVisibleNotes()
  const isLinear = dailyPerfume.isLinear

  // LINEAR PERFUME LOGIC
  if (isLinear) {
    // All notes are in notes.top for linear perfumes (by convention or manual assignment? 
    // Wait, getVisibleNotes logic in provider needs check.
    // Provider implementation for getVisibleNotes relies on dailyPerfume.notes.
    // If linear, we should probably fetch all notes from 'top' or combine them?)

    // The implementation plan says: "Types: isLinear... UI: PyramidClues logic"
    // And snippet for PyramidClues: "const allNotes = notes.top || [];" 
    // This implies linear perfume notes are stored in TOP notes column in DB?
    // Let's assume for now they are in 'top'. If they are distributed, we should aggregate.
    // But DB likely puts them in 'top' or 'middle'??
    // Let's aggregate safely if notes.top is empty but others are not? 
    // No, standard linear usually means "all at once", so 'top' is a good place.
    // Actually, let's look at getVisibleNotes implementation in GameProvider...
    // It returns structured notes based on level.
    // For linear, we might want to bypass getVisibleNotes and access dailyPerfume directly?
    // Or we modify getVisibleNotes?
    // The snippet in Plan uses "const allNotes = notes.top || []".
    // I Will follow the snippet.

    const allNotes = dailyPerfume.notes.top || []; // Access raw data from dailyPerfume?
    // Or use notes struct? If linear, maybe DB has them all in top/middle/base?
    // Ideally for linear, we merge all valid notes.
    const mergedNotes = [
      ...(dailyPerfume.notes.top || []),
      ...(dailyPerfume.notes.heart || []),
      ...(dailyPerfume.notes.base || [])
    ].filter(Boolean);

    // Progressive reveal: 0% -> 33% -> 50% -> 100%
    // Levels: 1..6
    let visibleCount = 0;
    if (revealLevel >= 3) {
      visibleCount = mergedNotes.length; // 100%
    } else if (revealLevel === 2) {
      visibleCount = Math.ceil(mergedNotes.length * 0.5); // 50%
    } else if (revealLevel === 1) {
      visibleCount = Math.ceil(mergedNotes.length * (1 / 3)); // 33% (approx)
    }

    // Reveal from END (last notes first - mimicking "dry down" or just consistent reveal?)
    // Snippet says: "Reveal from END".
    const visibleNotes = visibleCount > 0 ? mergedNotes.slice(-visibleCount) : [];

    return (
      <div>
        <h2 className="font-[family-name:var(--font-playfair)] text-lg italic text-foreground mb-4">
          Olfactory Profile
        </h2>

        <div className="grid grid-cols-[70px_1fr] items-center">
          <span className="text-xs font-semibold text-amber-500 uppercase tracking-wide">
            Linear
          </span>
          {visibleNotes.length > 0 ? (
            <span className="text-sm text-foreground">
              {visibleNotes.join(", ")}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground/50 tracking-widest font-caveat">
              ? ? ? ?
            </span>
          )}
        </div>
      </div>
    );
  }

  // TRADITIONAL PYRAMID LOGIC
  const levels = [
    { name: "Top", notes: notes.top, nameEn: "Top" },
    { name: "Heart", notes: notes.heart, nameEn: "Heart" },
    { name: "Base", notes: notes.base, nameEn: "Base" },
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
              <span className="text-sm text-foreground">{level.notes.join(", ")}</span>
            ) : (
              <span className="text-sm text-muted-foreground/50 tracking-widest font-caveat">
                ? ? ? ?
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
