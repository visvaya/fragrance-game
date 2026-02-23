import { NextResponse } from "next/server";

import { createAdminClient, createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Test endpoint: Returns today's daily challenge answer
 * SECURITY: Requires authenticated user with app_admin role
 */
export async function GET() {
  // Authentication check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized: Authentication required" },
      { status: 401 },
    );
  }

  // Admin role check
  const adminSupabase = createAdminClient();
  const { data: adminRecord, error: adminError } = await adminSupabase
    .from("app_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .single();

  if (adminError) {
    return NextResponse.json(
      { error: "Forbidden: Admin role required" },
      { status: 403 },
    );
  }

  try {
    const supabase = createAdminClient();
    const today = new Date().toISOString().split("T")[0];
    console.warn(`[API TEST] Querying daily_challenges for date: ${today}`);

    // 1. Get today's challenge ID
    const { data: challenge, error: challengeError } = await supabase
      .from("daily_challenges")
      .select("perfume_id, challenge_date")
      .eq("challenge_date", today)
      .single();

    if (challengeError) {
      console.warn(
        "[API TEST] No challenge in DB for today, using fallback perfume",
      );

      // Fallback: Return ANY perfume from database (for testing purposes)
      const { data: randomPerfume, error: randomError } = await supabase
        .from("perfumes")
        .select("name, brands(name), id")
        .limit(1)
        .single();

      if (randomError) {
        return NextResponse.json(
          { error: "No perfumes available in database" },
          { status: 500 },
        );
      }

      const formattedPerfume = {
        brand:
          (randomPerfume.brands as unknown as { name: string } | null)?.name ??
          "Unknown",
        id: randomPerfume.id,
        name: randomPerfume.name,
      };

      return NextResponse.json({ perfume: formattedPerfume });
    }

    console.warn(
      `[API TEST] Found challenge. Perfume ID: ${challenge.perfume_id}`,
    );

    // 2. Get the perfume details
    const { data: perfume, error: perfumeError } = await supabase
      .from("perfumes")
      .select("name, brands(name), id")
      .eq("id", challenge.perfume_id)
      .single();

    if (perfumeError) {
      console.error("[API TEST] Perfume details not found:", perfumeError);
      return NextResponse.json(
        { error: "Perfume details not found" },
        { status: 404 },
      );
    }

    const formattedPerfume = {
      ...perfume,
      brand:
        (perfume.brands as unknown as { name: string } | null)?.name ??
        "Unknown",
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
