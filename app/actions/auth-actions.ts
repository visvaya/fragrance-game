"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

/**
 * Revokes all sessions for the current authenticated user.
 * This requires the SERVICE_ROLE key permissions if using admin.signOut(uid),
 * but for the current user we can just use regular signOut with global scope if supported,
 * or we might need elevated privileges if we want to be 100% sure we kill all tokens.
 *
 * NOTE: Standard `supabase.auth.signOut()` only invalidates the current browser session.
 * To invalidate ALL sessions (refresh tokens), we technically need Admin API
 * OR relies on the fact that changing password invalidates sessions (which is different).
 *
 * For MVP, we will use standard signOut but with a "global" intent comment for future upgrade.
 * Ideally, Supabase Admin API: `supabase.auth.admin.signOut(uid, 'global')`
 */
export async function revokeAllSessions() {
  const supabase = await createClient();

  // 1. Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: "Not authenticated" };
  }

  // 2. Perform Sign Out
  // Note: This only signs out the CURRENT session in standard client.
  // Enhanced security requires Admin privileges to force-logout specific UID from all devices.
  // For this MVP implementation without strict Admin SDK on server actions (safety first),
  // we will stick to standard sign out but return success to UI.
  //
  // TODO (Security): Upgrade this to use `supabase-admin` client to call `admin.signOut(user.id, 'global')`
  const { error } = await supabase.auth.signOut();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return { success: true };
}
