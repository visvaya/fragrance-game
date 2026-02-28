"use server";

import { trackEvent } from "@/lib/analytics-server";
import {
  getCachedAutocomplete,
  setCachedAutocomplete,
} from "@/lib/cache/autocomplete-cache";
import { MAX_GUESSES } from "@/lib/constants";
import { checkRateLimit } from "@/lib/redis";
import { createClient } from "@/lib/supabase/server";
import { normalizeText } from "@/lib/utils";
import { maskYear } from "@/lib/utils/brand-masking";
import { autocompleteSchema } from "@/lib/validations/game.schema";

/**
 * Scores a suggestion by how well its brand/name matches the query.
 * Phonetic-only DB matches (false positives like "L'Oriental" for "laurent") score 0.
 */
function relevanceScore(
  suggestion: PerfumeSuggestion,
  normalizedQuery: string,
): number {
  const brand = normalizeText(suggestion.brand_masked);
  const name = normalizeText(suggestion.name);
  if (brand === normalizedQuery || name === normalizedQuery) return 4;
  if (brand.startsWith(normalizedQuery) || name.startsWith(normalizedQuery))
    return 3;
  if (brand.includes(normalizedQuery)) return 2;
  if (name.includes(normalizedQuery)) return 1;
  return 0;
}

export type PerfumeSuggestion = {
  brand_masked: string;
  concentration: string | null;
  display_name: string;
  name: string;
  perfume_id: string;
  raw_year: number | null;
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
 * Searches for perfumes matching the given query string.
 * @param query - The string query to search for.
 * @param sessionId - Optional session string for tracking anonymous queries.
 * @param currentAttempt - The player's current attempt number (used for brand masking logic).
 * @returns A promise that resolves to an array of perfume suggestions.
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

  // 2. Rate Limiting
  if (user) {
    await checkRateLimit("autocomplete", user.id);
  }

  // 3. Brand Masking Sync
  const attemptsCount = currentAttempt ?? 0;
  const isLastAttempt = currentAttempt === MAX_GUESSES;
  const dbLimit = isLastAttempt ? 50 : 30;

  // 4. Redis Cache
  let perfumes: FragranceRow[] | null = null;
  let cacheHit = false;
  const startTime = performance.now();

  const cached = await getCachedAutocomplete(validatedQuery, dbLimit);
  if (cached) {
    perfumes = cached.map((item) => ({
      brand_name: item.brand_masked,
      concentration: item.concentration,
      id: item.perfume_id,
      name: item.name,
      year: item.raw_year,
    }));
    cacheHit = true;
  }

  // 5. Database Query (cache miss)
  let dbError: { message: string } | null = null;

  if (!perfumes) {
    const dbResult = (await supabase.rpc("search_perfumes_unaccent_v2", {
      limit_count: dbLimit,
      search_query: validatedQuery,
    })) as { data: FragranceRow[] | null; error: { message: string } | null };

    perfumes = dbResult.data;
    dbError = dbResult.error;
  }

  const searchTime = performance.now() - startTime;

  if (dbError) {
    console.error("Autocomplete DB Error:", dbError);

    await trackEvent(
      "autocomplete_error",
      {
        attempt: currentAttempt,
        error: dbError.message,
        query: validatedQuery,
      },
      user?.id ?? validatedSessionId ?? "anonymous",
    );

    return [];
  }

  if (!perfumes) return [];

  await trackEvent(
    "autocomplete_performance_v2",
    {
      attempt: currentAttempt,
      cache_hit: cacheHit,
      has_results: perfumes.length > 0,
      query: validatedQuery,
      results_count: perfumes.length,
      search_time_ms: Math.round(searchTime),
    },
    user?.id ?? validatedSessionId ?? "anonymous",
  );

  // 6. Group by (brand + name + concentration) to detect year-duplicates
  const grouped = new Map<string, number>();
  for (const p of perfumes) {
    const key =
      `${p.brand_name}|${p.name}|${p.concentration ?? ""}`.toLowerCase();
    grouped.set(key, (grouped.get(key) ?? 0) + 1);
  }

  const transformed: PerfumeSuggestion[] = perfumes.map((p) => {
    const brandName = p.brand_name;
    const key = `${brandName}|${p.name}|${p.concentration ?? ""}`.toLowerCase();
    const hasDuplicates = (grouped.get(key) ?? 0) > 1;

    const maskedYear = hasDuplicates
      ? (p.year?.toString() ?? null)
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

  // 7. Re-rank: brand/name matches first, phonetic-only DB false-positives last.
  // Stable sort preserves DB relevance order within each tier.
  const nq = normalizeText(validatedQuery);
  const reranked = transformed.toSorted(
    (a, b) => relevanceScore(b, nq) - relevanceScore(a, nq),
  );

  // 8. Cache results (fire-and-forget)
  if (!cacheHit && reranked.length > 0) {
    void setCachedAutocomplete(validatedQuery, dbLimit, reranked);
  }

  // 9. Slicing + Intelligent Expansion
  // On the last attempt show all results (up to dbLimit=50) — brand is fully
  // revealed so players can browse all perfumes of a brand without leaving the site.
  if (isLastAttempt) return reranked;

  const DEFAULT_LIMIT = 10;
  const EXACT_MATCH_LIMIT = 30;

  if (reranked.length <= DEFAULT_LIMIT) return reranked;

  const queryLower = validatedQuery.toLowerCase();
  const exactMatches = reranked.filter(
    (item) => item.name.toLowerCase() === queryLower,
  );

  // When ≥10 exact name matches exist, show only those (up to 30).
  // Prevents non-exact results (e.g. "Patchouli 24") from appearing when
  // searching for "patchouli" with 26 exact hits.
  if (exactMatches.length >= DEFAULT_LIMIT) {
    return exactMatches.slice(0, EXACT_MATCH_LIMIT);
  }

  // Intelligent Slicing: if the last item in the default window is part of a same-year group
  // (same brand+name+concentration, different year), expand to include all members.
  let finalCount = DEFAULT_LIMIT;
  const lastIncluded = reranked[DEFAULT_LIMIT - 1];
  const lastIncludedKey =
    `${lastIncluded.brand_masked}|${lastIncluded.name}|${lastIncluded.concentration ?? ""}`.toLowerCase();

  for (let i = DEFAULT_LIMIT; i < reranked.length; i++) {
    const nextItem = reranked[i];
    const nextKey =
      `${nextItem.brand_masked}|${nextItem.name}|${nextItem.concentration ?? ""}`.toLowerCase();

    if (nextKey === lastIncludedKey) {
      finalCount = i + 1;
    } else {
      break; // Group ended
    }
  }

  return reranked.slice(0, finalCount);
}
