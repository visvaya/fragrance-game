import { revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";

import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";
import { DailyChallengesInsert } from "@/lib/validations/supabase.schema";

// One challenge per date: the exclusion windows (30 and 7 days) plus pre-generated days stay far
// below this.
const RECENT_CHALLENGES_LIMIT = 100;
// The whole candidate pool is fetched and one perfume picked at random. PostgREST caps a response
// at 1000 rows anyway; a larger pool needs the random pick in SQL, or some perfumes never come up.
const CANDIDATE_POOL_LIMIT = 1000;

/**
 * Vercel Cron Job: Generate Daily Challenge
 *
 * Schedule: 0 0 * * * (Daily at midnight UTC)
 *
 * Security: Requires Authorization header with CRON_SECRET
 *
 * Logic:
 * 1. Verify authorization
 * 2. Self-Healing: Check if TODAY's challenge exists. If not, generate it.
 * 3. Future-Proofing: Check if TOMORROW's challenge exists. If not, generate it.
 * @param request
 */
export async function GET(request: NextRequest): Promise<Response> {
  // 1. Security Check: Verify CRON_SECRET
  const authHeader = request.headers.get("authorization");
  const cronSecret = env.CRON_SECRET;

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.error("[CRON] Unauthorized access attempt");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const adminSupabase = createAdminClient();
    // Check TODAY (Self-Healing) + TOMORROW (Standard) sequentially
    const todayString = new Date().toISOString().split("T")[0];
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const tomorrowString = tomorrow.toISOString().split("T")[0];
    const results = [
      await ensureChallenge(adminSupabase, todayString),
      await ensureChallenge(adminSupabase, tomorrowString),
    ];

    return NextResponse.json({
      results,
      status: "success",
    });
  } catch (error) {
    // Caught errors never reach onRequestError, and tomorrow's puzzle is the only buffer: two
    // failed nights in a row leave a day without a puzzle.
    Sentry.captureException(error, { tags: { cron: "generate-daily" } });
    console.error("[CRON] Unexpected error:", error);
    return NextResponse.json(
      {
        details: error instanceof Error ? error.message : String(error),
        error: "Internal server error",
      },
      { status: 500 },
    );
  } finally {
    // Also after a failure: today's puzzle may be committed before tomorrow's step throws, and
    // the SSR loader caches a missing puzzle under this tag.
    revalidateTag("daily-challenge", {});
  }
}

async function ensureChallenge(
  supabase: ReturnType<typeof createAdminClient>,
  dateString: string,
) {
  // 1. Check if exists. A failed lookup must not read as "missing": the insert would then hit the
  // unique date or, worse, a later step would run on partial data.
  const queryResult1 = await supabase
    .from("daily_challenges")
    .select("id, challenge_number, perfume_id")
    .eq("challenge_date", dateString)
    .limit(1)
    .maybeSingle();
  const { data: existing, error: existingError } = queryResult1 as {
    data: { challenge_number: number; id: string; perfume_id: string } | null;
    error: { message: string } | null;
  };

  if (existingError) {
    throw new Error(
      `Challenge lookup failed for ${dateString}: ${existingError.message}`,
    );
  }
  if (existing) {
    return { date: dateString, id: existing.id, status: "exists" };
  }

  console.warn(`[CRON] Generating missing challenge for ${dateString}...`);

  // 2-3. Candidates outside the last 30 days; if the pool is exhausted, outside the last 7.
  const primary = await fetchCandidates(
    supabase,
    await fetchRecentPerfumeIds(supabase, 30),
  );
  if (primary.length === 0) {
    console.warn(
      `[CRON] Pool exhausted for ${dateString}. Retrying with 7-day exclusion.`,
    );
  }
  const candidates =
    primary.length > 0
      ? primary
      : await fetchCandidates(
          supabase,
          await fetchRecentPerfumeIds(supabase, 7),
        );

  if (candidates.length === 0) {
    throw new Error(`No eligible perfumes found for ${dateString}.`);
  }

  // 4. Random Selection
  const randomBuffer = new Uint32Array(1);
  crypto.getRandomValues(randomBuffer);
  const selected = candidates[randomBuffer[0] % candidates.length];

  // 5. Get Next Challenge Number
  const queryResult4 = await supabase
    .from("daily_challenges")
    .select("challenge_number")
    .order("challenge_number", { ascending: false })
    .limit(1)
    .single();
  const { data: maxChallenge } = queryResult4 as {
    data: { challenge_number: number } | null;
  };

  const nextNumber = (maxChallenge?.challenge_number ?? 0) + 1;

  // 6. Insert & Validate
  const deadline = new Date(dateString);
  deadline.setUTCHours(23, 59, 59, 999);

  const newChallengePayload = {
    challenge_date: dateString,
    challenge_number: nextNumber,
    grace_deadline_at_utc: deadline.toISOString(),
    mode: "standard",
    perfume_id: selected.perfume_id,
    seed_hash: `auto-${Date.now()}`,
    snapshot_metadata: {},
  };

  // Validate payload before insertion
  try {
    DailyChallengesInsert.parse(newChallengePayload);
  } catch (validationError) {
    if (validationError instanceof z.ZodError) {
      console.error(
        `[CRON] Validation failed for ${dateString}:`,
        validationError.issues,
      );
      throw new Error(
        `Validation failed for ${dateString}: ${validationError.message}`,
        { cause: validationError },
      );
    }
    throw validationError;
  }

  const queryResult5 = await supabase
    .from("daily_challenges")
    .insert(newChallengePayload)
    .select()
    .single();
  const { data: newChallenge, error: insertError } = queryResult5 as {
    data: { id: string } | null;
    error: { message: string } | null;
  };

  if (insertError || !newChallenge) {
    throw new Error(
      `Failed to insert challenge for ${dateString}: ${insertError?.message}`,
    );
  }

  console.warn(`[CRON] Created challenge #${nextNumber} for ${dateString}`);
  return {
    date: dateString,
    id: newChallenge.id,
    perfume_id: selected.perfume_id,
    status: "created",
  };
}

const PerfumeIdRows = z.array(z.object({ perfume_id: z.string() }));

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Perfumes used by challenges dated within the last `days` days (future dates included). */
async function fetchRecentPerfumeIds(
  supabase: ReturnType<typeof createAdminClient>,
  days: number,
): Promise<string[]> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const result = (await supabase
    .from("daily_challenges")
    .select("perfume_id")
    .gte("challenge_date", since.toISOString().split("T")[0])
    .limit(RECENT_CHALLENGES_LIMIT)) as {
    data: unknown;
    error: { message: string } | null;
  };
  // An unreadable exclusion list would silently allow a recent repeat.
  if (result.error) {
    throw new Error(`Recent challenges lookup failed: ${result.error.message}`);
  }
  // Defense-in-depth: only UUIDs go into the filter string below.
  return PerfumeIdRows.parse(result.data ?? [])
    .map((challenge) => challenge.perfume_id)
    .filter((id) => UUID_PATTERN.test(id));
}

/**
 * Perfumes eligible for a puzzle: published images, verified, active, with a difficulty score
 * (the game cannot load a puzzle without it) and with notes (only `top_notes` needs checking:
 * linear perfumes keep their flat list there, and no perfume has middle or base notes alone).
 */
async function fetchCandidates(
  supabase: ReturnType<typeof createAdminClient>,
  excludeIds: string[],
): Promise<{ perfume_id: string }[]> {
  const baseQuery = supabase
    .from("perfume_assets")
    .select("perfume_id, perfumes!inner(is_uncertain)")
    .not("image_key_step_1", "is", null)
    .eq("perfumes.is_uncertain", false)
    .eq("perfumes.is_active", true)
    .not("perfumes.xsolve_score", "is", null)
    .filter("perfumes.top_notes", "neq", "{}")
    .limit(CANDIDATE_POOL_LIMIT);
  const query =
    excludeIds.length > 0
      ? baseQuery.not("perfume_id", "in", `(${excludeIds.join(",")})`)
      : baseQuery;
  const result = (await query) as {
    data: unknown;
    error: { message: string } | null;
  };
  if (result.error) {
    throw new Error(`Candidate lookup failed: ${result.error.message}`);
  }
  return PerfumeIdRows.parse(result.data ?? []);
}
