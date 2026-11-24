import "server-only";

import type { ClueAnswer } from "@/lib/game/clue-reveal";
import {
  buildGuessHistory,
  getArrayName,
  guessedPerfumeIds,
  toClueAnswer,
  type GuessedPerfumeRow,
  type GuessHistoryItem,
  type StoredGuess,
} from "@/lib/game/guess-history";
import { createAdminClient } from "@/lib/supabase/server";
import { z } from "zod";

/** Answer of a challenge: the clue source plus data used for scoring. */
export type ChallengeAnswer = {
  clue: ClueAnswer;
  perfumeId: string;
  xsolve: number | null;
};

/** Columns of the answer perfume that clues and scoring read. */
export type AnswerPerfumeRow = {
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

const namedSchema = z.object({ name: z.string() });

/** The perfume row behind an answer label; the concentration join can come back as a list. */
const answerLabelRowSchema = z
  .object({
    concentrations: z.union([namedSchema, z.array(namedSchema)]).nullish(),
    name: z.string(),
  })
  .nullable();

/** Name and concentration of the answer perfume, shown once a game is over. */
export async function fetchAnswerLabel(perfumeId: string): Promise<{
  answerConcentration?: string | undefined;
  answerName?: string | undefined;
}> {
  const { data } = await createAdminClient()
    .from("perfumes")
    .select("name, concentrations(name)")
    .eq("id", perfumeId)
    .single();
  const perfume = answerLabelRowSchema.parse(data);
  return {
    answerConcentration: perfume
      ? getArrayName(perfume.concentrations ?? null)
      : undefined,
    answerName: perfume?.name,
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

/** Enriches stored guesses with guessed-perfume details; always returns feedback (computed for legacy rows). */
export async function enrichGuessHistory(
  rawGuesses: readonly StoredGuess[],
  answer: ClueAnswer,
): Promise<GuessHistoryItem[]> {
  if (rawGuesses.length === 0) return [];
  const perfumes = await loadGuessedPerfumes(guessedPerfumeIds(rawGuesses));
  return buildGuessHistory(rawGuesses, perfumes, answer);
}
