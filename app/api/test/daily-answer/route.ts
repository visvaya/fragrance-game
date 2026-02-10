import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 *
 */
export async function GET() {
  // SECURITY: Ensure this only runs in development or test
  if (
    process.env.NODE_ENV !== "development" &&
    process.env.NODE_ENV !== "test" &&
    process.env.NEXT_PUBLIC_APP_ENV !== "test" &&
    !process.env.CI
  ) {
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
      console.log("[API TEST] No challenge in DB for today, using fallback perfume");

      // Fallback: Return ANY perfume from database (for testing purposes)
      const { data: randomPerfume, error: randomError } = await supabase
        .from("perfumes")
        .select("name, brands(name), id")
        .limit(1)
        .single();

      if (randomError || !randomPerfume) {
        return NextResponse.json(
          { error: "No perfumes available in database" },
          { status: 500 },
        );
      }

      const formattedPerfume = {
        name: randomPerfume.name,
        id: randomPerfume.id,
        brand: (randomPerfume.brands as any)?.name ?? "Unknown",
      };

      return NextResponse.json({ perfume: formattedPerfume });
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

    return NextResponse.json({ perfume: formattedPerfume });
  } catch (error) {
    console.error("Error in test API:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
