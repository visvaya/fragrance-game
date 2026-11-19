import { createClient } from "@supabase/supabase-js";

/** Service-role client as `createClient` types it. */
export type E2eAdminClient = ReturnType<typeof createClient>;

/** Today's answer as the game shows it in suggestions. */
export type DailyAnswer = { brand: string; name: string };

/** Service-role Supabase client for test setup and cleanup; never used by the app under test. */
export function createE2eAdminClient(config: {
  serviceRoleKey: string;
  supabaseUrl: string;
}): E2eAdminClient {
  return createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Delete a test user; the database cascade removes its player and game rows. */
export async function deleteTestUser(
  admin: E2eAdminClient,
  userId: string,
): Promise<void> {
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error && error.status !== 404) {
    throw new Error(`Failed to delete test user ${userId}`, { cause: error });
  }
}

/** Read the answer of the challenge dated `isoDate` (YYYY-MM-DD, UTC). */
export async function fetchDailyAnswer(
  admin: E2eAdminClient,
  isoDate: string,
): Promise<DailyAnswer> {
  const { data: challenge, error: challengeError } = await admin
    .from("daily_challenges")
    .select("perfume_id")
    .eq("challenge_date", isoDate)
    .single<{ perfume_id: string }>();
  if (challengeError) {
    throw new Error(`No daily challenge for ${isoDate}`, {
      cause: challengeError,
    });
  }

  const { data: perfume, error: perfumeError } = await admin
    .from("perfumes")
    .select("name, brands(name)")
    .eq("id", challenge.perfume_id)
    .single<{ brands: { name: string } | null; name: string }>();
  if (perfumeError || !perfume.brands) {
    throw new Error(`Perfume ${challenge.perfume_id} not found`, {
      cause: perfumeError,
    });
  }
  return { brand: perfume.brands.name, name: perfume.name };
}
