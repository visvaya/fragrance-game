import {
  buildRevealedClues,
  isGenderMatch,
  type ClueAnswer,
  type ClueGuess,
  type RevealedClues,
} from "@/lib/game/clue-reveal";
import {
  getYearDirection,
  getYearMatch,
  notePyramidOf,
  type AttemptFeedback,
} from "@/lib/game/guess-feedback";

/** Fallback shown for a missing brand, gender, concentration or perfumer. */
export const UNKNOWN_VALUE = "Unknown";

/** One entry of the guess history sent to the browser, with guessed-perfume details. */
export type GuessHistoryItem = {
  brandName: string;
  concentration?: string | undefined;
  feedback: AttemptFeedback;
  gender?: string | undefined;
  isCorrect: boolean;
  isSkip?: boolean;
  perfumeId: string;
  perfumeName: string;
  perfumers?: string[] | undefined;
  timestamp: string;
  year?: number | undefined;
};

/** Stored shape of one entry of game_sessions.guesses. */
export type StoredGuess = {
  feedback?: Omit<AttemptFeedback, "genderMatch"> & { genderMatch?: boolean };
  isCorrect: boolean;
  isSkip?: boolean;
  perfumeId: string | null;
  timestamp: string;
};

/** A guessed perfume row as the history reads it. */
export type GuessedPerfumeRow = {
  brands: { name: string } | null;
  concentrations: { name: string } | null;
  gender: string | null;
  id: string;
  name: string;
  perfumers: string[] | null;
  release_year: number | null;
};

/** Feedback stored for skips: nothing matched. */
export const SKIP_FEEDBACK: AttemptFeedback = {
  brandMatch: false,
  genderMatch: false,
  notesMatch: 0,
  perfumerMatch: "none",
  yearDirection: "equal",
  yearMatch: "wrong",
};

/** Fields of an answer perfume row that the clue source is built from. */
export type ClueSourceRow = {
  base_notes: string[] | null;
  brands?: { name: string } | null;
  gender?: string | null;
  is_linear?: boolean | null;
  middle_notes: string[] | null;
  perfumers: string[] | null;
  release_year: number | null;
  top_notes: string[] | null;
};

/** Maps an answer perfume row to the clue source, with "Unknown", 0 and empty-list fallbacks. */
export function toClueAnswer(perfume: ClueSourceRow): ClueAnswer {
  return {
    brand: perfume.brands?.name ?? UNKNOWN_VALUE,
    gender: perfume.gender || UNKNOWN_VALUE,
    isLinear: perfume.is_linear ?? false,
    notes: notePyramidOf(perfume),
    perfumers: perfume.perfumers ?? [],
    year: perfume.release_year ?? 0,
  };
}

/** History entry of a skipped attempt. */
export function skipHistoryItem(timestamp: string): GuessHistoryItem {
  return {
    brandName: "",
    feedback: SKIP_FEEDBACK,
    isCorrect: false,
    isSkip: true,
    perfumeId: "",
    perfumeName: "",
    timestamp,
  };
}

function resolveFeedback(
  guess: StoredGuess,
  perfume: GuessedPerfumeRow,
  answer: ClueAnswer,
): AttemptFeedback {
  const genderMatch = isGenderMatch(perfume.gender, answer.gender);
  if (guess.feedback) {
    return {
      ...guess.feedback,
      genderMatch: guess.feedback.genderMatch ?? genderMatch,
    };
  }
  // Rows stored before feedback was saved: recompute what the stored row still allows.
  const brandName = perfume.brands?.name ?? UNKNOWN_VALUE;
  const yearDiff = (perfume.release_year ?? 0) - answer.year;
  return {
    brandMatch: brandName.toLowerCase() === answer.brand.toLowerCase(),
    genderMatch,
    notesMatch: guess.isCorrect ? 1 : 0,
    perfumerMatch: guess.isCorrect ? "full" : "none",
    yearDirection: getYearDirection(yearDiff),
    yearMatch: guess.isCorrect ? "correct" : getYearMatch(yearDiff),
  };
}

/** Ids of the perfumes the stored guesses name, skips left out. */
export const guessedPerfumeIds = (
  rawGuesses: readonly StoredGuess[],
): string[] =>
  rawGuesses.flatMap((g) => (!g.isSkip && g.perfumeId ? [g.perfumeId] : []));

/**
 * The guess history sent to the browser from the stored guesses and the guessed perfumes;
 * a guess whose perfume row is missing is left out, and every entry carries feedback
 * (recomputed for rows stored without it).
 * @param rawGuesses - Entries of game_sessions.guesses.
 * @param perfumes - Guessed perfume rows by id.
 * @param answer - The clue source of the challenge.
 */
export function buildGuessHistory(
  rawGuesses: readonly StoredGuess[],
  perfumes: ReadonlyMap<string, GuessedPerfumeRow>,
  answer: ClueAnswer,
): GuessHistoryItem[] {
  return rawGuesses.flatMap((guess): GuessHistoryItem[] => {
    if (guess.isSkip) return [skipHistoryItem(guess.timestamp)];
    const p = guess.perfumeId ? perfumes.get(guess.perfumeId) : undefined;
    if (!p || !guess.perfumeId) return [];
    return [
      {
        brandName: p.brands?.name ?? UNKNOWN_VALUE,
        concentration: p.concentrations?.name,
        feedback: resolveFeedback(guess, p, answer),
        gender: p.gender ?? undefined,
        isCorrect: guess.isCorrect,
        perfumeId: guess.perfumeId,
        perfumeName: p.name,
        perfumers: p.perfumers ?? [],
        timestamp: guess.timestamp,
        year: p.release_year ?? undefined,
      },
    ];
  });
}

/** Builds the clues a session may see from its row and the answer. */
export function buildSessionClues(
  answer: ClueAnswer,
  session: { attempts_count: number; status: string },
  history: readonly GuessHistoryItem[],
): RevealedClues {
  const guesses: ClueGuess[] = history
    .filter((item) => !item.isSkip)
    .map((item) => ({
      brandMatch: item.feedback.brandMatch,
      genderMatch: item.feedback.genderMatch,
      guessedPerfumers: item.perfumers ?? [],
      notesMatch: item.feedback.notesMatch,
      perfumerMatch: item.feedback.perfumerMatch,
      yearMatch: item.feedback.yearMatch,
    }));
  return buildRevealedClues(answer, {
    guesses,
    isGameOver: session.status === "won" || session.status === "lost",
    revealLevel: session.attempts_count + 1,
  });
}

/** A concentration as PostgREST returns an embedded row: one object, an array or nothing. */
type ConcentrationData = { name: string } | { name: string }[] | null;

/**
 * Returns the concentration name from the given data.
 */
export function getArrayName(value: ConcentrationData): string | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return value[0]?.name;
  return value.name;
}

/**
 * Maps perfume database details to game state format.
 */
export function mapPerfumeDetails(perfume: {
  concentrations: ConcentrationData;
  gender?: string | null;
  release_year: number | null;
}): { concentration: string; gender: string; year: number } {
  return {
    concentration: getArrayName(perfume.concentrations) ?? UNKNOWN_VALUE,
    gender: perfume.gender ?? UNKNOWN_VALUE, // Don't default to "Unisex" - Unknown is safer
    year: perfume.release_year ?? 0,
  };
}
