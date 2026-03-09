"use server";

import { revalidatePath } from "next/cache";

import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { checkRateLimit } from "@/lib/redis";
import { createAdminClient, createClient } from "@/lib/supabase/server";

/**
 * Revokes all sessions for the current authenticated user.
 * This requires the SERVICE_ROLE key permissions if using admin.signOut(uid),
 * but for the current user we can just use regular signOut with global scope if supported,
 * or we might need elevated privileges if we want to be 100% sure we kill all tokens.
/**
 * Revokes all sessions for user.
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function revokeAllSessions() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Not authenticated" };
  }

  await checkRateLimit("revokeAllSessions", user.id);
  const { error } = await supabase.auth.signOut({ scope: "global" });
  if (error) return { error: error.message };
  revalidatePath("/");
  return { success: true };
}

/**
 * Fetches active sessions for the user.
 * Filters out "node" sessions (technical server-side sessions) to show only real devices.
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function getSessions() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data: sessions } = await supabase
    .from("user_sessions")
    .select(
      "id, created_at, last_active_at, device_info, ip_address, revoked_at, user_id",
    )
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .order("last_active_at", { ascending: false });

  return sessions ?? [];
}

/**
 * Revokes a specific session by ID.
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function revokeSession(sessionId: string) {
  z.uuid().parse(sessionId);
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (!currentUser) {
    return { error: "Unauthorized", success: false };
  }

  await checkRateLimit("revokeSession", currentUser.id);

  // 1. Get the auth session ID (stored in session_token_hash)
  // Verify ownership: session must belong to current user
  const { data: sessionData, error: fetchError } = await supabase
    .from("user_sessions")
    .select("session_token_hash")
    .eq("id", sessionId)
    .eq("user_id", currentUser.id)
    .single();

  if (fetchError) {
    Sentry.captureException(new Error("Revoke: Session not found"), {
      extra: { sessionId },
    });
    return { error: "Session not found", success: false };
  }

  // 2. Delete from auth.sessions using RPC function (security definer)
  // This bypasses the need for restricted schema access from the client
  const { error } = await adminSupabase.rpc("delete_auth_session", {
    session_id: String(sessionData.session_token_hash),
  });

  if (error) {
    Sentry.captureException(new Error("Revoke failed (RPC)"), {
      extra: { rpcError: error.message },
    });
    // Fallback: manually mark revoked if RPC fails
    await supabase
      .from("user_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", sessionId);

    return { error: error.message, success: false };
  }

  revalidatePath("/");
  return { success: true };
}

/**
 * Migrates data from an anonymous player to the currently authenticated user.
 * MOVES: game_sessions, game_results
 * MERGES: player_streaks (takes best)
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function migrateAnonymousPlayer(anonPlayerId: string) {
  // Validate anonPlayerId is a valid UUID before any DB operations
  const uuidValidation = z.string().safeParse(anonPlayerId);
  if (!uuidValidation.success) {
    return { error: "Invalid anonymous player ID" };
  }
  const validatedAnonPlayerId = uuidValidation.data;

  const supabase = await createClient();

  // 1. Get current authenticated user (Target)
  // Rate limit before expensive admin operations
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Not authenticated" };
  }

  await checkRateLimit("migrateAnonymousPlayer", user.id);

  if (user.id === validatedAnonPlayerId) {
    return { error: "Cannot migrate to same account" };
  }

  // 2. Use Admin Client for Cross-User Operations
  const adminSupabase = createAdminClient();

  // 3. Move Game Sessions & Results
  // 3. Move Game Sessions & Results (with conflict handling)
  // Fetch existing sessions/results for the authenticated user to avoid duplicates/cheating
  const { data: userSessions } = await adminSupabase
    .from("game_sessions")
    .select("challenge_id")
    .eq("player_id", user.id);

  const userChallengeIds = new Set(
    userSessions?.map((s) => String(s.challenge_id)),
  );

  // Delete anonymous sessions for challenges the user already played (anti-cheat: prevent re-roll)
  if (userChallengeIds.size > 0) {
    await adminSupabase
      .from("game_sessions")
      .delete()
      .eq("player_id", validatedAnonPlayerId)
      .in("challenge_id", [...userChallengeIds]);

    await adminSupabase
      .from("game_results")
      .delete()
      .eq("player_id", validatedAnonPlayerId)
      .in("challenge_id", [...userChallengeIds]);
  }

  // Now safely migrate the rest
  const { error: sessionsError } = await adminSupabase
    .from("game_sessions")
    .update({ player_id: user.id })
    .eq("player_id", validatedAnonPlayerId);

  if (sessionsError) {
    Sentry.captureException(new Error("Migration: Session move failed"), {
      extra: { dbError: sessionsError.message },
    });
    return { error: "Failed to migrate sessions" };
  }

  const { error: resultsError } = await adminSupabase
    .from("game_results")
    .update({ player_id: user.id })
    .eq("player_id", validatedAnonPlayerId);

  if (resultsError) {
    Sentry.captureException(new Error("Migration: Results move failed"), {
      extra: { dbError: resultsError.message },
    });
    return { error: "Failed to migrate results" };
  }

  type PlayerStreak = {
    best_streak: number;
    current_streak: number;
    joker_used_date: string | null;
    jokers_remaining: number;
    last_played_date: string | null;
    player_id: string;
    updated_at: string;
  };

  // 4. Handle Streaks (Merge Logic)
  const { data: anonStreak } = await adminSupabase
    .from("player_streaks")
    .select(
      "player_id, current_streak, best_streak, last_played_date, jokers_remaining, joker_used_date, updated_at",
    )
    .eq("player_id", validatedAnonPlayerId)
    .single<PlayerStreak>();

  const { data: userStreak } = await adminSupabase
    .from("player_streaks")
    .select(
      "player_id, current_streak, best_streak, last_played_date, jokers_remaining, joker_used_date, updated_at",
    )
    .eq("player_id", user.id)
    .single<PlayerStreak>();

  if (anonStreak) {
    if (userStreak) {
      const betterCurrent =
        anonStreak.current_streak > userStreak.current_streak
          ? anonStreak
          : userStreak;

      const newBest = Math.max(anonStreak.best_streak, userStreak.best_streak);

      await adminSupabase
        .from("player_streaks")
        .update({
          best_streak: newBest,
          current_streak: betterCurrent.current_streak,
          jokers_remaining: betterCurrent.jokers_remaining,
          last_played_date: betterCurrent.last_played_date,
        })
        .eq("player_id", user.id);

      // Delete old anon streak
      await adminSupabase
        .from("player_streaks")
        .delete()
        .eq("player_id", validatedAnonPlayerId);
    } else {
      await adminSupabase
        .from("player_streaks")
        .update({ player_id: user.id })
        .eq("player_id", validatedAnonPlayerId);
    }
  }

  revalidatePath("/");
  return { success: true };
}

/**
 * Returns the attempt count from an anonymous player's game session.
 * Called when a player declines migration — their attempt count is inherited
 * by the new authenticated session so they cannot start fresh after previewing clues.
 * @param anonPlayerId - The anonymous player UUID (from localStorage).
 * @param anonSessionId - The anonymous session UUID (from GameProvider state).
 * @returns The attempt count (0 if not found or on any error).
 */
export async function getAnonSessionAttemptCount(
  anonPlayerId: string,
  anonSessionId: string,
): Promise<{ attemptCount: number }> {
  const anonPlayerIdResult = z.string().safeParse(anonPlayerId);
  const anonSessionIdResult = z.string().safeParse(anonSessionId);

  if (!anonPlayerIdResult.success || !anonSessionIdResult.success) {
    return { attemptCount: 0 };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Only callable by an authenticated non-anonymous user
  if (!user || user.is_anonymous) {
    return { attemptCount: 0 };
  }

  const adminSupabase = createAdminClient();
  const { data } = await adminSupabase
    .from("game_sessions")
    .select("attempts_count")
    .eq("id", anonSessionIdResult.data)
    .eq("player_id", anonPlayerIdResult.data)
    .limit(1)
    .maybeSingle();

  return { attemptCount: Number(data?.attempts_count ?? 0) };
}
