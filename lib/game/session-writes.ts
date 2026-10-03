import "server-only";

import * as Sentry from "@sentry/nextjs";

import { createAdminClient } from "@/lib/supabase/server";

import type { Database } from "@/types/supabase";

type Tables = Database["public"]["Tables"];

/** Session columns the game reads back after creating or updating a session. */
const SESSION_COLUMNS = "attempts_count, id, last_nonce, status";

/** A game session as the game uses it right after a write. */
export type GameSessionRow = {
  attempts_count: number;
  id: string;
  last_nonce: string;
  status: string;
};

/** Outcome of a session write: the stored row, or the database error. */
export type SessionWriteResult = {
  data: GameSessionRow | null;
  error: { message: string } | null;
};

/** Values of a new session; the owner always comes from the caller's verified identity. */
export type NewSessionValues = Omit<
  Tables["game_sessions"]["Insert"],
  "id" | "player_id"
>;

/** Columns a move may change; never the owner, the puzzle or the start time. */
export type SessionMoveValues = Pick<
  Tables["game_sessions"]["Update"],
  "attempts_count" | "guesses" | "last_guess" | "last_nonce" | "status"
>;

/** Values of a finished game's result; the owner always comes from the caller's verified identity. */
export type GameResultValues = Omit<
  Tables["game_results"]["Insert"],
  "id" | "player_id"
>;

/**
 * Creates a game session with the service role. Players have no INSERT right on
 * game_sessions, so this is the only way a session comes into existence.
 * @param playerId - Id of the signed-in user from `auth.getUser()`, never client input.
 * @param values - Session columns other than the owner.
 * @returns The stored row, or the database error.
 */
export async function insertGameSession(
  playerId: string,
  values: NewSessionValues,
): Promise<SessionWriteResult> {
  return await createAdminClient()
    .from("game_sessions")
    .insert({ ...values, player_id: playerId })
    .select(SESSION_COLUMNS)
    .limit(1)
    .single();
}

/**
 * Applies a move to a session with the service role. The filter on the owner keeps
 * the service role from touching another player's row; the filter on the nonce turns
 * a concurrent move into an error (no row matched) instead of a lost update.
 * @param target - Session id, its verified owner and the nonce the caller read.
 * @param target.expectedNonce - Nonce the caller read together with the session.
 * @param target.playerId - Id of the signed-in user from `auth.getUser()`, never client input.
 * @param target.sessionId - Id of the session to update.
 * @param values - Columns the move changes.
 * @returns The stored row, or the error when no row matched or the write failed.
 */
export async function updateGameSession(
  target: { expectedNonce: string; playerId: string; sessionId: string },
  values: SessionMoveValues,
): Promise<SessionWriteResult> {
  return await createAdminClient()
    .from("game_sessions")
    .update(values)
    .eq("id", target.sessionId)
    .eq("player_id", target.playerId)
    .eq("last_nonce", target.expectedNonce)
    .select(SESSION_COLUMNS)
    .limit(1)
    .single();
}

/**
 * Records a finished game with the service role. A failure is reported to Sentry and
 * not thrown: the session update before it has already changed the nonce, so the
 * player must still receive the outcome of the move.
 * @param playerId - Id of the signed-in user from `auth.getUser()`, never client input.
 * @param values - Result columns other than the owner.
 */
export async function recordGameResult(
  playerId: string,
  values: GameResultValues,
): Promise<void> {
  const { error } = await createAdminClient()
    .from("game_results")
    .insert({ ...values, player_id: playerId });
  if (error) {
    Sentry.captureException(new Error("Game result insert failed"), {
      extra: { dbError: error.message, sessionId: values.session_id },
    });
  }
}
