import { GENERIC_PLACEHOLDER, MASK_CHAR, MAX_GUESSES } from "@/lib/constants";
import { revealLetters } from "@/lib/game/scoring";

/** Answer fields needed to compute clues; missing values are normalised by the caller. */
export type ClueAnswer = {
  brand: string;
  gender: string;
  isLinear: boolean;
  notes: { base: string[]; heart: string[]; top: string[] };
  perfumers: string[];
  year: number;
};

/** Feedback of one real guess (skips excluded) that can unlock clues early. */
export type ClueGuess = {
  brandMatch: boolean;
  genderMatch: boolean;
  guessedPerfumers: string[];
  notesMatch: number;
  perfumerMatch: "full" | "partial" | "none";
  yearMatch: "correct" | "close" | "wrong";
};

/** Game progress that decides how much of the answer is shown. */
export type RevealProgress = {
  guesses: readonly ClueGuess[];
  isGameOver: boolean;
  /** 1-6; callers pass attempts_count + 1. */
  revealLevel: number;
};

/** Notes as shown to the player: a three-tier pyramid or one flat linear list. */
export type RevealedNotes =
  | { base: string[]; heart: string[]; kind: "pyramid"; top: string[] }
  | { kind: "linear"; notes: string[] };

/** Clues safe to send to the browser: hidden parts are already masked. */
export type RevealedClues = {
  answerHas: {
    brand: boolean;
    gender: boolean;
    notes: boolean;
    perfumer: boolean;
    year: boolean;
  };
  brand: string;
  brandRevealed: boolean;
  /** null while the gender is still hidden. */
  gender: string | null;
  /** True when a guess matched the gender. */
  genderRevealed: boolean;
  notes: RevealedNotes;
  perfumer: string;
  perfumerCount: number;
  year: string;
  yearRevealed: boolean;
};

const PLACEHOLDER = GENERIC_PLACEHOLDER.repeat(5);
const PLACEHOLDER_NOTES = [PLACEHOLDER, PLACEHOLDER, PLACEHOLDER];
const UNKNOWN = "Unknown";
const BRAND_REVEAL = [0, 0, 0.15, 0.4, 0.7, 1] as const;
const PERFUMER_REVEAL = [0, 0, 0.1, 0.3, 0.6, 1] as const;
const GENDER_VISIBLE_FROM_LEVEL = 5;
const NOTES_FULL_FROM_LEVEL = 5;
const YEAR_FULL_FROM_LEVEL = 5;
const YEAR_DIGITS = 4;

const clampLevel = (level: number): number =>
  Number.isFinite(level)
    ? Math.max(1, Math.min(MAX_GUESSES, Math.trunc(level)))
    : 1;

const normalise = (value: string): string => value.trim().toLowerCase();

const isKnown = (value: string | null | undefined): value is string =>
  typeof value === "string" &&
  value.trim() !== "" &&
  normalise(value) !== "unknown";

const maskWord = (note: string): string => revealLetters(note, 0);

const maskAllLetters = (note: string): string =>
  note.replaceAll(/[\p{L}\p{N}]/gu, MASK_CHAR);

/** True when both genders are known and equal, ignoring case and surrounding spaces. */
export function isGenderMatch(
  guessGender: string | null | undefined,
  answerGender: string | null | undefined,
): boolean {
  if (!isKnown(guessGender) || !isKnown(answerGender)) return false;
  return normalise(guessGender) === normalise(answerGender);
}

function revealBrand(
  brand: string,
  level: number,
  guesses: readonly ClueGuess[],
  isGameOver: boolean,
): string {
  if (!isKnown(brand)) return UNKNOWN;
  if (isGameOver || guesses.some((g) => g.brandMatch)) return brand;
  if (level === 1) return PLACEHOLDER;
  return revealLetters(brand, BRAND_REVEAL[level - 1] ?? 1);
}

function discoveredPerfumers(
  perfumers: readonly string[],
  guesses: readonly ClueGuess[],
): Set<string> {
  if (guesses.some((g) => g.perfumerMatch === "full")) {
    return new Set(perfumers);
  }
  const guessed = new Set(
    guesses
      .filter((g) => g.perfumerMatch === "partial")
      .flatMap((g) => g.guessedPerfumers.map((name) => normalise(name))),
  );
  return new Set(perfumers.filter((name) => guessed.has(normalise(name))));
}

function revealPerfumer(
  perfumers: readonly string[],
  level: number,
  guesses: readonly ClueGuess[],
  isGameOver: boolean,
): string {
  if (perfumers.length === 0) return UNKNOWN;
  const discovered = discoveredPerfumers(perfumers, guesses);
  if (isGameOver || perfumers.every((name) => discovered.has(name))) {
    return perfumers.join(", ");
  }
  if (level === 1) return PLACEHOLDER;
  const pct = PERFUMER_REVEAL[level - 1] ?? 1;
  return perfumers
    .map((name) => (discovered.has(name) ? name : revealLetters(name, pct)))
    .join(", ");
}

function revealYear(
  year: number,
  level: number,
  guesses: readonly ClueGuess[],
  isGameOver: boolean,
): string {
  if (year === 0) return UNKNOWN;
  const full = String(year);
  if (
    isGameOver ||
    level >= YEAR_FULL_FROM_LEVEL ||
    guesses.some((g) => g.yearMatch === "correct")
  ) {
    return full;
  }
  const shown = level - 1;
  return full.slice(0, shown) + MASK_CHAR.repeat(YEAR_DIGITS - shown);
}

function revealGender(
  gender: string,
  level: number,
  guesses: readonly ClueGuess[],
  isGameOver: boolean,
): string | null {
  if (!isKnown(gender)) return UNKNOWN;
  if (
    isGameOver ||
    level >= GENDER_VISIBLE_FROM_LEVEL ||
    guesses.some((g) => g.genderMatch)
  ) {
    return gender;
  }
  return null;
}

function revealLinearNotes(merged: readonly string[], level: number): string[] {
  if (level === 1) return PLACEHOLDER_NOTES;
  const thirds = level - 2;
  const revealCount = Math.ceil((merged.length * thirds) / 3);
  return merged.map((note, i) =>
    i >= merged.length - revealCount ? note : maskAllLetters(note),
  );
}

function revealPyramidNotes(
  notes: ClueAnswer["notes"],
  level: number,
): RevealedNotes {
  if (level === 1) {
    return {
      base: PLACEHOLDER_NOTES,
      heart: PLACEHOLDER_NOTES,
      kind: "pyramid",
      top: PLACEHOLDER_NOTES,
    };
  }
  const maskTier = (tier: string[], hidden: boolean): string[] =>
    hidden ? tier.map((note) => maskWord(note)) : tier;
  return {
    base: maskTier(notes.base, true),
    heart: maskTier(notes.heart, level <= 3),
    kind: "pyramid",
    top: maskTier(notes.top, level <= 2),
  };
}

function revealNotes(
  answer: ClueAnswer,
  level: number,
  guesses: readonly ClueGuess[],
  isGameOver: boolean,
): RevealedNotes {
  const full =
    isGameOver ||
    level >= NOTES_FULL_FROM_LEVEL ||
    guesses.some((g) => g.notesMatch >= 1);
  const { base, heart, top } = answer.notes;
  if (answer.isLinear) {
    const merged = [...top, ...heart, ...base].filter(Boolean);
    return {
      kind: "linear",
      notes: full ? merged : revealLinearNotes(merged, level),
    };
  }
  if (full) return { base, heart, kind: "pyramid", top };
  return revealPyramidNotes(answer.notes, level);
}

/**
 * Computes the clues the player may see for the given progress. Hidden parts never
 * contain answer letters, so the result is safe to send to the browser.
 */
export function buildRevealedClues(
  answer: ClueAnswer,
  progress: RevealProgress,
): RevealedClues {
  const { guesses, isGameOver } = progress;
  const level = clampLevel(progress.revealLevel);
  const brand = revealBrand(answer.brand, level, guesses, isGameOver);
  const year = revealYear(answer.year, level, guesses, isGameOver);
  const { base, heart, top } = answer.notes;

  return {
    answerHas: {
      brand: isKnown(answer.brand),
      gender: isKnown(answer.gender),
      notes: base.length + heart.length + top.length > 0,
      perfumer: answer.perfumers.length > 0,
      year: answer.year !== 0,
    },
    brand,
    brandRevealed: guesses.some((g) => g.brandMatch) || brand === answer.brand,
    gender: revealGender(answer.gender, level, guesses, isGameOver),
    genderRevealed: guesses.some((g) => g.genderMatch),
    notes: revealNotes(answer, level, guesses, isGameOver),
    perfumer: revealPerfumer(answer.perfumers, level, guesses, isGameOver),
    perfumerCount: answer.perfumers.length,
    year,
    yearRevealed:
      guesses.some((g) => g.yearMatch === "correct") ||
      year === String(answer.year),
  };
}

/** Placeholder clues shown before the server has sent the real ones. */
export const HIDDEN_CLUES: RevealedClues = {
  answerHas: {
    brand: true,
    gender: true,
    notes: true,
    perfumer: true,
    year: true,
  },
  brand: PLACEHOLDER,
  brandRevealed: false,
  gender: null,
  genderRevealed: false,
  notes: {
    base: PLACEHOLDER_NOTES,
    heart: PLACEHOLDER_NOTES,
    kind: "pyramid",
    top: PLACEHOLDER_NOTES,
  },
  perfumer: PLACEHOLDER,
  perfumerCount: 1,
  year: MASK_CHAR.repeat(YEAR_DIGITS),
  yearRevealed: false,
};
