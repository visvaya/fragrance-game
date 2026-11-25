import { revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";

import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { env } from "@/lib/env";
import type { ChallengeSnapshot } from "@/lib/game/challenge-snapshot";
import { createAdminClient } from "@/lib/supabase/server";

import type { TablesInsert } from "@/types/supabase";

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
    const todayString = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const tomorrowString = tomorrow.toISOString().slice(0, 10);
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

  // 2-4. A perfume not used in the last 30 days; if the pool is exhausted, in the last 7.
  const primary = await pickPerfume(supabase, 30);
  if (!primary) {
    console.warn(
      `[CRON] Pool exhausted for ${dateString}. Retrying with 7-day exclusion.`,
    );
  }
  const selected = primary ?? (await pickPerfume(supabase, 7));

  if (!selected) {
    throw new Error(`No eligible perfumes found for ${dateString}.`);
  }

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
    // The difficulty the puzzle is published with, so a later catalogue import cannot rescore it.
    snapshot_metadata: {
      xsolve: selected.xsolve_score,
    } satisfies ChallengeSnapshot,
  } satisfies TablesInsert<"daily_challenges">;

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

const PickedPerfume = z
  .object({ perfume_id: z.string(), xsolve_score: z.number() })
  .nullable();

/**
 * One eligible perfume drawn at random in the database (`pick_daily_perfume`), skipping perfumes
 * used by challenges dated within the last `days` days (future dates included); null when none is
 * left. The draw runs in SQL because a PostgREST response stops at 1000 rows.
 */
async function pickPerfume(
  supabase: ReturnType<typeof createAdminClient>,
  days: number,
) {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const result = (await supabase
    .rpc("pick_daily_perfume", {
      exclude_since: z.iso.date().parse(since.toISOString().slice(0, 10)),
    })
    .maybeSingle()) as { data: unknown; error: { message: string } | null };
  // A failed draw must not fall through to the shorter exclusion window.
  if (result.error) {
    throw new Error(`Perfume pick failed: ${result.error.message}`);
  }
  return PickedPerfume.parse(result.data);
}
