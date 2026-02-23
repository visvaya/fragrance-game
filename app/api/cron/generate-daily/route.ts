import { type NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/server";
import { DailyChallengesInsert } from "@/lib/validations/supabase.schema";

import type { Database } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

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
export async function GET(request: NextRequest) {
  // 1. Security Check: Verify CRON_SECRET
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("[CRON] CRON_SECRET not configured");
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 },
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.error("[CRON] Unauthorized access attempt");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const adminSupabase = createAdminClient();
    const results = [];

    // Check TODAY (Self-Healing)
    const todayString = new Date().toISOString().split("T")[0];
    results.push(await ensureChallenge(adminSupabase, todayString));

    // Check TOMORROW (Standard)
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const tomorrowString = tomorrow.toISOString().split("T")[0];
    results.push(await ensureChallenge(adminSupabase, tomorrowString));

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

async function ensureChallenge(
  supabase: SupabaseClient<any, "public", any>,
  dateString: string,
) {
  // 1. Check if exists
  const { data: existing } = await supabase
    .from("daily_challenges")
    .select("id, challenge_number, perfume_id")
    .eq("challenge_date", dateString)
    .limit(1)
    .single();

  if (existing) {
    return { date: dateString, id: existing.id, status: "exists" };
  }

  console.warn(`[CRON] Generating missing challenge for ${dateString}...`);

  // 2. Fetch exclusion list (Last 30 days is sufficient to avoid recent repeats, keeping pool healthy)
  const exclusionDate = new Date();
  exclusionDate.setUTCDate(exclusionDate.getUTCDate() - 30);

  const { data: recentChallenges } = await supabase
    .from("daily_challenges")
    .select("perfume_id")
    .gte("challenge_date", exclusionDate.toISOString().split("T")[0]);

  const rawExcludeIds = recentChallenges?.map((c) => c.perfume_id) ?? [];
  // Defense-in-depth: validate that all IDs are valid UUIDs before using in query
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const excludeIds = rawExcludeIds.filter(
    (id) => typeof id === "string" && uuidRegex.test(id),
  );

  // 3. Fetch Candidates
  let query = supabase
    .from("perfume_assets")
    .select("perfume_id, perfumes!inner(is_uncertain)")
    .not("image_key_step_1", "is", null) // Must have assets
    .eq("perfumes.is_uncertain", false); // Must be verified

  if (excludeIds.length > 0) {
    query = query.not("perfume_id", "in", `(${excludeIds.join(",")})`);
  }

  let { data: candidates, error } = await query;

  // Fallback: If pool exhausted (unlikely), try excluding only last 7 days
  if (error || !candidates || candidates.length === 0) {
    console.warn(
      `[CRON] Pool exhausted for ${dateString}. Retrying with 7-day exclusion.`,
    );

    const shortExclusionDate = new Date();
    shortExclusionDate.setUTCDate(shortExclusionDate.getUTCDate() - 7);
    const { data: recent7 } = await supabase
      .from("daily_challenges")
      .select("perfume_id")
      .gte("challenge_date", shortExclusionDate.toISOString().split("T")[0]);

    const excludeIds7 = (recent7?.map((c) => c.perfume_id) ?? []).filter(
      (id) => typeof id === "string" && uuidRegex.test(id),
    );

    let retryQuery = supabase
      .from("perfume_assets")
      .select("perfume_id, perfumes!inner(is_uncertain)")
      .not("image_key_step_1", "is", null)
      .eq("perfumes.is_uncertain", false);

    if (excludeIds7.length > 0) {
      retryQuery = retryQuery.not(
        "perfume_id",
        "in",
        `(${excludeIds7.join(",")})`,
      );
    }

    const retryResult = await retryQuery;
    candidates = retryResult.data;
    error = retryResult.error;
  }

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
  const { data: maxChallenge } = await supabase
    .from("daily_challenges")
    .select("challenge_number")
    .order("challenge_number", { ascending: false })
    .limit(1)
    .single();

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

  const { data: newChallenge, error: insertError } = await supabase
    .from("daily_challenges")
    .insert(newChallengePayload)
    .select()
    .single();

  if (insertError) {
    throw new Error(
      `Failed to insert challenge for ${dateString}: ${insertError.message}`,
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
