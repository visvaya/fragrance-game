import "server-only";

import {
  buildRevealedClues,
  isGenderMatch,
  type ClueAnswer,
  type ClueGuess,
  type RevealedClues,
} from "@/lib/game/clue-reveal";
import { createAdminClient } from "@/lib/supabase/server";

const UNKNOWN = "Unknown";
const CLOSE_YEAR_RANGE = 3;

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

/** One entry of the guess history sent to the browser, with guessed-perfume details. */
export type GuessHistoryItem = {
  brandName: string;
  concentration?: string;
  feedback: AttemptFeedback;
  gender?: string;
  isCorrect: boolean;
  isSkip?: boolean;
  perfumeId: string;
  perfumeName: string;
  perfumers?: string[];
  timestamp: string;
  year?: number;
};

/** Answer of a challenge: the clue source plus data used for scoring. */
export type ChallengeAnswer = {
  clue: ClueAnswer;
  perfumeId: string;
  xsolve: number | null;
};

/** Stored shape of one entry of game_sessions.guesses. */
export type StoredGuess = {
  feedback?: Omit<AttemptFeedback, "genderMatch"> & { genderMatch?: boolean };
  isCorrect: boolean;
  isSkip?: boolean;
  perfumeId: string | null;
  timestamp: string;
};

type AnswerPerfumeRow = {
  base_notes: string[] | null;
  brands: { name: string } | null;
  gender: string | null;
  is_linear: boolean | null;
  middle_notes: string[] | null;
  name: string;
  perfumers: string[] | null;
  release_year: number | null;
  top_notes: string[] | null;
  xsolve_score: number | null;
};

type GuessedPerfumeRow = {
  brands: { name: string } | null;
  concentrations: { name: string } | null;
  gender: string | null;
  id: string;
  name: string;
  perfumers: string[] | null;
  release_year: number | null;
};

/** Feedback stored for skips: nothing matched. */
const SKIP_FEEDBACK: AttemptFeedback = {
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
    brand: perfume.brands?.name ?? UNKNOWN,
    gender: perfume.gender || UNKNOWN,
    isLinear: perfume.is_linear ?? false,
    notes: {
      base: perfume.base_notes ?? [],
      heart: perfume.middle_notes ?? [],
      top: perfume.top_notes ?? [],
    },
    perfumers: perfume.perfumers ?? [],
    year: perfume.release_year ?? 0,
  };
}

/** Loads the answer of a challenge with the service-role client; null when missing. */
export async function fetchChallengeAnswer(
  challengeId: string,
): Promise<ChallengeAnswer | null> {
  const adminSupabase = createAdminClient();
  const { data: challenge } = await adminSupabase
    .from("daily_challenges")
    .select("perfume_id")
    .eq("id", challengeId)
    .limit(1)
    .single();
  if (!challenge) return null;

  const { data: perfume } = (await adminSupabase
    .from("perfumes")
    .select(
      "name, release_year, gender, is_linear, xsolve_score, top_notes, middle_notes, base_notes, perfumers, brands(name)",
    )
    .eq("id", challenge.perfume_id)
    .limit(1)
    .single()) as { data: AnswerPerfumeRow | null };
  if (!perfume) return null;

  return {
    clue: toClueAnswer(perfume),
    perfumeId: challenge.perfume_id,
    xsolve: perfume.xsolve_score,
  };
}

function legacyYearMatch(
  isCorrect: boolean,
  yearDiff: number,
): AttemptFeedback["yearMatch"] {
  if (isCorrect || yearDiff === 0) return "correct";
  if (Math.abs(yearDiff) <= CLOSE_YEAR_RANGE) return "close";
  return "wrong";
}

function legacyYearDirection(
  yearDiff: number,
): AttemptFeedback["yearDirection"] {
  if (yearDiff > 0) return "lower";
  if (yearDiff < 0) return "higher";
  return "equal";
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
  const brandName = perfume.brands?.name ?? UNKNOWN;
  const yearDiff = (perfume.release_year ?? 0) - answer.year;
  return {
    brandMatch: brandName.toLowerCase() === answer.brand.toLowerCase(),
    genderMatch,
    notesMatch: guess.isCorrect ? 1 : 0,
    perfumerMatch: guess.isCorrect ? "full" : "none",
    yearDirection: legacyYearDirection(yearDiff),
    yearMatch: legacyYearMatch(guess.isCorrect, yearDiff),
  };
}

async function loadGuessedPerfumes(
  ids: readonly string[],
): Promise<Map<string, GuessedPerfumeRow>> {
  if (ids.length === 0) return new Map();
  const { data: perfumes, error } = (await createAdminClient()
    .from("perfumes")
    .select(
      "id, name, brands(name), release_year, concentrations(name), gender, perfumers",
    )
    .in("id", ids)
    .limit(ids.length)) as {
    data: GuessedPerfumeRow[] | null;
    error: unknown;
  };
  // A failed read must not shorten the history: the client derives the game state from it.
  if (error) throw new Error("Guess history unavailable");
  return new Map((perfumes ?? []).map((p) => [p.id, p]));
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

/** Enriches stored guesses with guessed-perfume details; always returns feedback (computed for legacy rows). */
export async function enrichGuessHistory(
  rawGuesses: readonly StoredGuess[],
  answer: ClueAnswer,
): Promise<GuessHistoryItem[]> {
  if (rawGuesses.length === 0) return [];

  const ids = rawGuesses.flatMap((g) =>
    !g.isSkip && g.perfumeId ? [g.perfumeId] : [],
  );
  const perfumeMap = await loadGuessedPerfumes(ids);

  return rawGuesses.flatMap((guess): GuessHistoryItem[] => {
    if (guess.isSkip) return [skipHistoryItem(guess.timestamp)];
    const p = guess.perfumeId ? perfumeMap.get(guess.perfumeId) : undefined;
    if (!p || !guess.perfumeId) return [];
    return [
      {
        brandName: p.brands?.name ?? UNKNOWN,
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
