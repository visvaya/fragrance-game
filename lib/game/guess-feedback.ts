import { isGenderMatch } from "@/lib/game/clue-reveal";

/** Feedback of one guess compared with the answer. */
export type AttemptFeedback = {
  brandMatch: boolean;
  genderMatch: boolean;
  /** Jaccard similarity of the notes, 0-1. */
  notesMatch: number;
  perfumerMatch: "full" | "partial" | "none";
  yearDirection: "higher" | "lower" | "equal";
  yearMatch: "correct" | "close" | "wrong";
};

/**
 * Normalizes a note name for comparison: drops trademark signs, material qualifiers
 * (absolute, CO2, resinoid and similar), parenthesised remarks and case.
 */
export function cleanNote(note: string | null | undefined): string {
  if (typeof note !== "string") return "";
  const removeWords = [
    "absolute",
    "scenttrek",
    "orpur",
    "co2",
    "concrete",
    "otto",
    "nectar",
    "material",
    "resinoid",
    "oxide",
  ];
  // eslint-disable-next-line unicorn/no-array-reduce -- reduce is appropriate here for building a cleaned string immutably
  const cleanedNote = removeWords.reduce(
    (cleanedAccumulator, word) =>
      cleanedAccumulator.replaceAll(
        new RegExp(String.raw`\b${word}\b`, "gi"), // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp -- word comes from a hardcoded internal array, not user input
        "",
      ),
    note
      .trim()
      .replaceAll(/[™®]/g, "")
      .replaceAll(/\bLa Réunion\b/gi, ""),
  );
  const t = cleanedNote
    .replaceAll(/\([^)]*\)/g, "")
    .replaceAll(/\s+/g, " ")
    .trim()
    .replace(/[,-]$/, "")
    .trim();
  return t.toLowerCase();
}

type NotePyramid = { base: string[]; heart: string[]; top: string[] };

/** The cleaned note names of all pyramid levels together. */
const noteSet = (notes: NotePyramid) =>
  new Set(
    [...notes.top, ...notes.heart, ...notes.base].map((n) => cleanNote(n)),
  );

/** The lowercased, trimmed perfumer names without empty or missing entries. */
const perfumerSet = (perfumers: (string | null | undefined)[]) =>
  new Set(
    perfumers
      .filter((p): p is string => typeof p === "string" && p.length > 0)
      .map((p) => p.toLowerCase().trim()),
  );

/**
 * Jaccard similarity of the guessed and the answer notes, all pyramid levels together,
 * after {@link cleanNote}; 0 when both have no notes.
 */
export function calculateNotesMatch(
  guessNotes: NotePyramid,
  answerNotes: NotePyramid,
): number {
  const guessSet = noteSet(guessNotes);
  const answerSet = noteSet(answerNotes);

  const intersection = new Set(
    [...guessSet].filter((note) => answerSet.has(note)),
  );
  const union = new Set([...guessSet, ...answerSet]);

  return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * Compares perfumer lists case-insensitively: "full" when both name the same perfumers,
 * "partial" when at least one is shared, otherwise "none" (also when either list is empty).
 */
export function calculatePerfumerMatch(
  guessPerfumers: (string | null | undefined)[] | null,
  answerPerfumers: (string | null | undefined)[] | null,
): "full" | "partial" | "none" {
  if (!guessPerfumers || !answerPerfumers) return "none";

  const guessSet = perfumerSet(guessPerfumers);
  const answerSet = perfumerSet(answerPerfumers);

  if (guessSet.size === 0 || answerSet.size === 0) return "none";

  const matchCount = [...guessSet].filter((p) => answerSet.has(p)).length;

  if (matchCount === answerSet.size && guessSet.size === answerSet.size)
    return "full";
  if (matchCount > 0) return "partial";
  return "none";
}

// jscpd:ignore-start -- columns of the same table, but this type changes with the feedback rules and ClueSourceRow with the clue source
/** The perfume columns the feedback of a guess compares. */
export type PerfumeForFeedback = {
  base_notes: string[] | null;
  brand_id: string;
  gender?: string | null;
  middle_notes: string[] | null;
  perfumers: string[] | null;
  release_year: number | null;
  top_notes: string[] | null;
};
// jscpd:ignore-end

/**
 * "correct" for the same year, "close" within three years, otherwise "wrong".
 * @param yearDiff - Guessed year minus answer year.
 */
export function getYearMatch(yearDiff: number): "correct" | "close" | "wrong" {
  if (yearDiff === 0) return "correct";
  if (Math.abs(yearDiff) <= 3) return "close";
  return "wrong";
}

/**
 * Where the answer lies from the guess: "lower" when the guess is later, "higher" when earlier.
 * @param yearDiff - Guessed year minus answer year.
 */
export function getYearDirection(
  yearDiff: number,
): "lower" | "higher" | "equal" {
  if (yearDiff > 0) return "lower";
  if (yearDiff < 0) return "higher";
  return "equal";
}

/**
 * Feedback of one guess against the answer: brand, gender, notes, perfumer and year.
 * A missing release year counts as 0.
 */
export function calculateFeedback(
  guessedPerfume: PerfumeForFeedback,
  answerPerfume: PerfumeForFeedback,
): AttemptFeedback {
  const yearDiff =
    (guessedPerfume.release_year ?? 0) - (answerPerfume.release_year ?? 0);

  return {
    brandMatch: guessedPerfume.brand_id === answerPerfume.brand_id,
    genderMatch: isGenderMatch(guessedPerfume.gender, answerPerfume.gender),
    notesMatch: calculateNotesMatch(
      {
        base: guessedPerfume.base_notes ?? [],
        heart: guessedPerfume.middle_notes ?? [],
        top: guessedPerfume.top_notes ?? [],
      },
      {
        base: answerPerfume.base_notes ?? [],
        heart: answerPerfume.middle_notes ?? [],
        top: answerPerfume.top_notes ?? [],
      },
    ),
    perfumerMatch: calculatePerfumerMatch(
      guessedPerfume.perfumers ?? null,
      answerPerfume.perfumers ?? null,
    ),
    yearDirection: getYearDirection(yearDiff),
    yearMatch: getYearMatch(yearDiff),
  };
}
