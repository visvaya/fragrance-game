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
 * Word-boundary check ensures "ford" in "Tom Ford" (score 3) ranks above
 * "ford" embedded in "Oxford" (score 2).
 */
function relevanceScore(
  suggestion: PerfumeSuggestion,
  normalizedQuery: string,
): number {
  const { brand_norm: brand, name_norm: name } = suggestion;
  if (brand === normalizedQuery || name === normalizedQuery) return 4;
  if (brand.startsWith(normalizedQuery) || name.startsWith(normalizedQuery))
    return 3;
  // Word-boundary match: query is a whole space-delimited word (e.g. "ford" in "Tom Ford")
  const q = ` ${normalizedQuery} `;
  if (` ${brand} `.includes(q) || ` ${name} `.includes(q)) return 3;
  if (brand.includes(normalizedQuery)) return 2;
  if (name.includes(normalizedQuery)) return 1;
  return 0;
}

export type PerfumeSuggestion = {
  brand_masked: string;
  brand_norm: string;
  concentration: string | null;
  display_name: string;
  name: string;
  name_norm: string;
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
 * Re-masks year and display_name on cached suggestions using current attempt count.
 * Avoids full PerfumeSuggestion -> FragranceRow -> PerfumeSuggestion round-trip.
 */
function remaskCachedSuggestions(
  cached: PerfumeSuggestion[],
  attemptsCount: number,
): PerfumeSuggestion[] {
  // Group by (brand + name + concentration) to detect year-duplicates
  const grouped = new Map<string, number>();
  for (const p of cached) {
    const key =
      `${p.brand_masked}|${p.name}|${p.concentration ?? ""}`.toLowerCase();
    grouped.set(key, (grouped.get(key) ?? 0) + 1);
  }

  return cached.map((p) => {
    const key =
      `${p.brand_masked}|${p.name}|${p.concentration ?? ""}`.toLowerCase();
    const hasDuplicates = (grouped.get(key) ?? 0) > 1;

    const maskedYear = hasDuplicates
      ? (p.raw_year?.toString() ?? null)
      : maskYear(p.raw_year, attemptsCount);

    const yearSuffix = maskedYear ? ` (${maskedYear})` : "";
    const displayName = `${p.brand_masked} - ${p.name}${p.concentration ? " " + p.concentration : ""}${yearSuffix}`;

    return {
      ...p,
      display_name: displayName,
      year: maskedYear,
    };
  });
}

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

  // 2. Brand Masking Sync
  const attemptsCount = currentAttempt ?? 0;
  const isLastAttempt = currentAttempt === MAX_GUESSES;
  const dbLimit = isLastAttempt ? 50 : 30;

  // 3. Redis Cache — checked BEFORE auth (saves ~50-100ms on cache hit)
  const nq = normalizeText(validatedQuery);
  const cached = await getCachedAutocomplete(validatedQuery, dbLimit);

  if (cached) {
    // Re-mask years for current attempt, re-rank, filter, slice
    const remasked = remaskCachedSuggestions(cached, attemptsCount);
    const reranked = remasked.toSorted(
      (a, b) => relevanceScore(b, nq) - relevanceScore(a, nq),
    );

    const relevant = reranked.filter((item) => relevanceScore(item, nq) > 0);
    const candidates = relevant.length > 0 ? relevant : reranked;
    const sliced = sliceCandidates(candidates, validatedQuery, isLastAttempt);

    // Fire-and-forget analytics
    void trackEvent(
      "autocomplete_performance_v2",
      {
        attempt: currentAttempt,
        cache_hit: true,
        has_results: sliced.length > 0,
        query: validatedQuery,
        results_count: sliced.length,
        search_time_ms: 0,
      },
      sessionId ?? "anonymous",
    );

    return sliced;
  }

  // 4. Cache miss — now we need auth + rate limit
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await checkRateLimit("autocomplete", user.id);
  }

  // 5. Database Query
  const startTime = performance.now();

  const dbResult = (await supabase.rpc("search_perfumes_unaccent_v2", {
    limit_count: dbLimit,
    search_query: validatedQuery,
  })) as { data: FragranceRow[] | null; error: { message: string } | null };

  const perfumes = dbResult.data;
  const dbError = dbResult.error;
  const searchTime = performance.now() - startTime;

  if (dbError) {
    console.error("Autocomplete DB Error:", dbError);

    void trackEvent(
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

  // Fire-and-forget analytics
  void trackEvent(
    "autocomplete_performance_v2",
    {
      attempt: currentAttempt,
      cache_hit: false,
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
      brand_norm: normalizeText(brandName),
      concentration,
      display_name: displayName,
      name,
      name_norm: normalizeText(name),
      perfume_id: p.id,
      raw_year: p.year ?? null,
      year: maskedYear,
    };
  });

  // 7. Re-rank
  const reranked = transformed.toSorted(
    (a, b) => relevanceScore(b, nq) - relevanceScore(a, nq),
  );

  // 8. Cache results (fire-and-forget)
  if (reranked.length > 0) {
    void setCachedAutocomplete(validatedQuery, dbLimit, reranked);
  }

  // 9. Filter + Slice
  const relevant = reranked.filter((item) => relevanceScore(item, nq) > 0);
  const candidates = relevant.length > 0 ? relevant : reranked;

  return sliceCandidates(candidates, validatedQuery, isLastAttempt);
}

/**
 * Slicing + Intelligent Expansion logic extracted for reuse on cache hit/miss paths.
 */
function sliceCandidates(
  candidates: PerfumeSuggestion[],
  query: string,
  isLastAttempt: boolean,
): PerfumeSuggestion[] {
  // On the last attempt show all results (up to dbLimit=50)
  if (isLastAttempt) return candidates;

  const DEFAULT_LIMIT = 10;
  const EXACT_MATCH_LIMIT = 30;

  if (candidates.length <= DEFAULT_LIMIT) return candidates;

  const queryLower = query.toLowerCase();
  const exactMatches = candidates.filter(
    (item) => item.name.toLowerCase() === queryLower,
  );

  // When >=10 exact name matches exist, show only those (up to 30).
  if (exactMatches.length >= DEFAULT_LIMIT) {
    return exactMatches.slice(0, EXACT_MATCH_LIMIT);
  }

  // Intelligent Slicing: if the last item in the default window is part of a same-year group
  // (same brand+name+concentration, different year), expand to include all members.
  const lastIncluded = candidates[DEFAULT_LIMIT - 1];
  const lastIncludedKey =
    `${lastIncluded.brand_masked}|${lastIncluded.name}|${lastIncluded.concentration ?? ""}`.toLowerCase();

  // Find the index where the matching group ends
  const firstMismatchIndex = candidates
    .slice(DEFAULT_LIMIT)
    .findIndex((candidate) => {
      const candidateKey =
        `${candidate.brand_masked}|${candidate.name}|${candidate.concentration ?? ""}`.toLowerCase();
      return candidateKey !== lastIncludedKey;
    });

  // If no mismatch found in the rest, return all matching candidates
  // Otherwise, return up to the mismatch
  const finalCount =
    firstMismatchIndex === -1
      ? candidates.length
      : DEFAULT_LIMIT + firstMismatchIndex;

  return candidates.slice(0, finalCount);
}
