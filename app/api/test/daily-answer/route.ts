import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/server";

/**
 *
 */
export async function GET() {
  // SECURITY: Ensure this only runs in development or test
  if (
    process.env.NODE_ENV !== "development" &&
    process.env.NODE_ENV !== "test"
   && process.env.NEXT_PUBLIC_APP_ENV !== "test") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

  try {
    const supabase = createAdminClient();
    const today = new Date().toISOString().split("T")[0];
    console.log(`[API TEST] Querying daily_challenges for date: ${today}`);

    // 1. Get today's challenge ID
    const { data: challenge, error: challengeError } = await supabase
      .from("daily_challenges")
      .select("perfume_id, challenge_date")
      .eq("challenge_date", today)
      .single();

    if (challengeError || !challenge) {
      console.error(
        "[API TEST] Challenge not found for today:",
        challengeError,
      );

      // DEBUG: Check what dates ARE available
      const { data: recentChallenges } = await supabase
        .from("daily_challenges")
        .select("challenge_date")
        .order("challenge_date", { ascending: false })
        .limit(5);

      console.log(
        "[API TEST] Recent available dates:",
        recentChallenges?.map((c) => c.challenge_date),
      );

      return NextResponse.json(
        {
          available_dates: recentChallenges?.map((c) => c.challenge_date),
          error: `No challenge found for today (${today})`,
        },
        { status: 404 },
      );
    }

    console.log(
      `[API TEST] Found challenge. Perfume ID: ${challenge.perfume_id}`,
    );

    // 2. Get the perfume details
    const { data: perfume, error: perfumeError } = await supabase
      .from("perfumes")
      .select("name, brands(name), id")
      .eq("id", challenge.perfume_id)
      .single();

    if (perfumeError || !perfume) {
      console.error("[API TEST] Perfume details not found:", perfumeError);
      return NextResponse.json(
        { error: "Perfume details not found" },
        { status: 404 },
      );
    }

    const formattedPerfume = {
      ...perfume,
      brand: (perfume.brands as any)?.name ?? "Unknown",
    };

    return NextResponse.json(formattedPerfume);
  } catch (error) {
    console.error("Error in test API:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
