"use server";

import { trackEvent } from "@/lib/analytics-server";
import {
  getCachedAutocomplete,
  setCachedAutocomplete,
} from "@/lib/cache/autocomplete-cache";
import { getClientIp } from "@/lib/client-ip";
import { MAX_GUESSES } from "@/lib/constants";
import { checkRateLimit } from "@/lib/redis";
import {
  type FragranceRow,
  rankSuggestions,
  remaskSuggestions,
  selectSuggestions,
  toSuggestions,
} from "@/lib/game/suggestions";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { normalizeText } from "@/lib/utils";
import { autocompleteSchema } from "@/lib/validations/game.schema";

import type { PerfumeSuggestion } from "@/lib/types/game";

/**
 * Applies per-user (authenticated) or per-IP (anonymous) rate limiting for autocomplete.
 * Anonymous requests are limited more strictly to deter scraping.
 */
async function applyRateLimit(user: { id: string } | null): Promise<void> {
  if (user) {
    await checkRateLimit("autocomplete", user.id);
    return;
  }
  await checkRateLimit("autocomplete_anon", await getClientIp());
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
    const sliced = selectSuggestions(
      rankSuggestions(remaskSuggestions(cached, attemptsCount), nq),
      nq,
      validatedQuery,
      isLastAttempt,
    );

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

  // 4. Cache miss — auth + rate limit
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await applyRateLimit(user);

  // 5. Database Query
  const startTime = performance.now();

  // The service role runs the search, so client roles need no EXECUTE on it and a direct REST
  // call cannot skip the user check and rate limit above.
  const dbResult = (await createAdminClient().rpc(
    "search_perfumes_unaccent_v2",
    {
      limit_count: dbLimit,
      search_query: validatedQuery,
    },
  )) as { data: FragranceRow[] | null; error: { message: string } | null };

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

  // 6. Transform and rank; the cache keeps the whole ranked list, re-masked per attempt on a hit.
  const ranked = rankSuggestions(toSuggestions(perfumes, attemptsCount), nq);
  if (ranked.length > 0)
    void setCachedAutocomplete(validatedQuery, dbLimit, ranked);
  return selectSuggestions(ranked, nq, validatedQuery, isLastAttempt);
}

export { type PerfumeSuggestion } from "@/lib/types/game";
