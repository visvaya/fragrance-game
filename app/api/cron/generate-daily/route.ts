import { type NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";
import { DailyChallengesInsert } from "@/lib/validations/supabase.schema";

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
    console.error("[CRON] Unexpected error:", error);
    return NextResponse.json(
      {
        details: error instanceof Error ? error.message : String(error),
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}

// eslint-disable-next-line sonarjs/max-lines-per-function -- orchestrates sequential DB ops (check existing, pick perfume, insert challenge, upload image); steps share state and must remain sequential
async function ensureChallenge(
  supabase: ReturnType<typeof createAdminClient>,
  dateString: string,
) {
  // 1. Check if exists
  const queryResult1 = await supabase
    .from("daily_challenges")
    .select("id, challenge_number, perfume_id")
    .eq("challenge_date", dateString)
    .limit(1)
    .single();
  const { data: existing } = queryResult1 as {
    data: { challenge_number: number; id: string; perfume_id: string } | null;
  };

  if (existing) {
    return { date: dateString, id: existing.id, status: "exists" };
  }

  console.warn(`[CRON] Generating missing challenge for ${dateString}...`);

  // 2. Fetch exclusion list (Last 30 days is sufficient to avoid recent repeats, keeping pool healthy)
  const exclusionDate = new Date();
  exclusionDate.setUTCDate(exclusionDate.getUTCDate() - 30);

  const queryResult2 = await supabase
    .from("daily_challenges")
    .select("perfume_id")
    .gte("challenge_date", exclusionDate.toISOString().split("T")[0]);
  const { data: recentChallenges } = queryResult2 as {
    data: { perfume_id: string }[] | null;
  };

  const rawExcludeIds = recentChallenges?.map((c) => c.perfume_id) ?? [];
  // Defense-in-depth: validate that all IDs are valid UUIDs before using in query
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const excludeIds = rawExcludeIds.filter(
    (id) => typeof id === "string" && uuidRegex.test(id),
  );

  // 3. Fetch Candidates
  const baseQuery = supabase
    .from("perfume_assets")
    .select("perfume_id, perfumes!inner(is_uncertain)")
    .not("image_key_step_1", "is", null) // Must have assets
    .eq("perfumes.is_uncertain", false); // Must be verified

  const query =
    excludeIds.length > 0
      ? baseQuery.not("perfume_id", "in", `(${excludeIds.join(",")})`)
      : baseQuery;

  type CandidateResult = {
    data: { perfume_id: string }[] | null;
    error: { message: string } | null;
  };

  const primaryResult = (await query) as CandidateResult;

  // Fallback: If pool exhausted (unlikely), try excluding only last 7 days
  const { data: candidates, error } = await (async (): Promise<CandidateResult> => {
    if (!primaryResult.error && primaryResult.data && primaryResult.data.length > 0) {
      return primaryResult;
    }

    console.warn(
      `[CRON] Pool exhausted for ${dateString}. Retrying with 7-day exclusion.`,
    );

    const shortExclusionDate = new Date();
    shortExclusionDate.setUTCDate(shortExclusionDate.getUTCDate() - 7);
    const queryResult3 = await supabase
      .from("daily_challenges")
      .select("perfume_id")
      .gte("challenge_date", shortExclusionDate.toISOString().split("T")[0]);
    const { data: recent7 } = queryResult3 as {
      data: { perfume_id: string }[] | null;
    };

    const excludeIds7 = (recent7?.map((c) => c.perfume_id) ?? []).filter(
      (id) => typeof id === "string" && uuidRegex.test(id),
    );

    const baseRetryQuery = supabase
      .from("perfume_assets")
      .select("perfume_id, perfumes!inner(is_uncertain)")
      .not("image_key_step_1", "is", null)
      .eq("perfumes.is_uncertain", false);

    return (await (excludeIds7.length > 0
      ? baseRetryQuery.not("perfume_id", "in", `(${excludeIds7.join(",")})`)
      : baseRetryQuery)) as CandidateResult;
  })();

  if (error || !candidates || candidates.length === 0) {
    throw new Error(
      `No eligible perfumes found for ${dateString}. Error: ${error?.message}`,
    );
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

  console.warn(`[CRON] ✅ Created challenge #${nextNumber} for ${dateString}`);
  return {
    date: dateString,
    id: newChallenge.id,
    perfume_id: selected.perfume_id,
    status: "created",
  };
}
