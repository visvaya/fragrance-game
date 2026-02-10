"use server";

import { checkRateLimit } from "@/lib/redis";
import { createClient } from "@/lib/supabase/server";
import { maskYear } from "@/lib/utils/brand-masking";
import { autocompleteSchema } from "@/lib/validations/game.schema";

import { trackEvent } from "../../lib/posthog/server";

export type PerfumeSuggestion = {
  brand_masked: string;
  concentration: string | null;
  display_name: string;
  name: string;
  perfume_id: string;
  raw_year: number | null; // Added to help frontend grouping if needed
  year: string | null;
};

type FragranceRow = {
  brand_name: string;
  concentration: string | null;
  id: string;
  name: string;
  year: number | null;
};

/**
 *
 * @param query
 * @param sessionId
 * @param currentAttempt
 */
export async function searchPerfumes(
  query: string,
  sessionId?: string,
  currentAttempt?: number,
): Promise<PerfumeSuggestion[]> {
  // 1. Input Validation
  const result = autocompleteSchema.safeParse({ query, sessionId });

  if (!result.success) {
    return [];
  }

  const { query: validatedQuery, sessionId: validatedSessionId } = result.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 2. Rate Limiting (Server Actions Tier)
  if (user) {
    await checkRateLimit("autocomplete", user.id);
  }

  // 3. Brand Masking Sync
  // Use currentAttempt from client instead of querying DB
  const attemptsCount = currentAttempt ?? 0;

  // 4. Database Query using RPC with unaccent support
  const startTime = performance.now();
  const { data: perfumes, error: dbError } = await supabase.rpc(
    "search_perfumes_unaccent",
    {
      limit_count: 30, // Reduced from 60 for better performance
      search_query: validatedQuery,
    },
  ) as { data: FragranceRow[] | null; error: { message: string } | null; };
  const searchTime = performance.now() - startTime;

  if (dbError) {
    console.error("Autocomplete DB Error:", dbError);

    // Track failed search
    await trackEvent({
      distinctId: user?.id ?? validatedSessionId ?? "anonymous",
      event: "autocomplete_error",
      properties: {
        attempt: currentAttempt,
        error: dbError.message,
        query: validatedQuery,
      },
    });

    return [];
  }

  if (!perfumes) return [];

  // Track successful search for analytics
  await trackEvent({
    distinctId: user?.id ?? validatedSessionId ?? "anonymous",
    event: "autocomplete_search",
    properties: {
      attempt: currentAttempt,
      has_results: perfumes.length > 0,
      query: validatedQuery,
      results_count: perfumes.length,
      search_time_ms: Math.round(searchTime),
    },
  });

  // 5. Group by (brand + name + concentration) to see if we have duplicates
  const grouped = new Map<string, number>();
  if (perfumes) {
    for (const p of perfumes) {
      const key = `${p.brand_name}|${p.name}|${p.concentration ?? ""}`.toLowerCase();
      grouped.set(key, (grouped.get(key) ?? 0) + 1);
    }
  }

  const transformed: PerfumeSuggestion[] = (perfumes ?? []).map((p) => {
    const brandName = p.brand_name;
    const key = `${brandName}|${p.name}|${p.concentration ?? ""}`.toLowerCase();
    const hasDuplicates = (grouped.get(key) ?? 0) > 1;

    // USER WANT: If more than 1 perfume has same brand/name/concentration, reveal full year
    const maskedYear = hasDuplicates
      ? p.year?.toString() ?? null
      : maskYear(p.year, attemptsCount);

    const concentration = p.concentration ?? null;
    const { name } = p;

    const yearSuffix = maskedYear ? ` (${maskedYear})` : "";
    const displayName = `${brandName} - ${name}${concentration ? " " + concentration : ""}${yearSuffix}`;

    return {
      brand_masked: brandName,
      concentration,
      display_name: displayName,
      name,
      perfume_id: p.id,
      raw_year: p.year ?? null,
      year: maskedYear,
    };
  });

  // 6. Intelligent Slicing
  // Standard limit is 10, but we allow expansion if the 10th and 11th items share the same identity
  const DEFAULT_LIMIT = 10;
  if (transformed.length <= DEFAULT_LIMIT) return transformed;

  let finalCount = DEFAULT_LIMIT;
  const lastIncluded = transformed[DEFAULT_LIMIT - 1];
  const lastIncludedKey = `${lastIncluded.brand_masked}|${lastIncluded.name}|${lastIncluded.concentration ?? ""}`.toLowerCase();

  // If the last item in the default window is part of a duplicate group, 
  // we must check if there are more members of that group immediately following it.
  for (let i = DEFAULT_LIMIT; i < transformed.length; i++) {
    const nextItem = transformed[i];
    const nextKey = `${nextItem.brand_masked}|${nextItem.name}|${nextItem.concentration ?? ""}`.toLowerCase();

    if (nextKey === lastIncludedKey) {
      finalCount = i + 1;
    } else {
      break; // Group ended
    }
  }

  return transformed.slice(0, finalCount);
}
