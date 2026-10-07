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
export async function revokeAllSessions(): Promise<
  { error: string } | { success: true }
> {
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
export async function getSessions(): Promise<
  {
    created_at: string | null;
    device_info: unknown;
    id: string;
    ip_address: unknown;
    last_active_at: string | null;
    revoked_at: string | null;
    user_id: string;
  }[]
> {
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
export async function revokeSession(
  sessionId: string,
): Promise<{ error: string; success: false } | { success: true }> {
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
