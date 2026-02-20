/**
 * Redis-based caching layer for autocomplete results
 *
 * OPTIMIZATION: Phase 3
 * Expected gain: ~50-100ms on cache hits (40-60% hit rate)
 *
 * Cache key format: autocomplete:v2:{query}:{limit}
 * TTL: 10 seconds (balances freshness vs performance)
 *
 * Usage:
 * 1. Try cache first with getCachedAutocomplete()
 * 2. On miss, query database
 * 3. Store result with setCachedAutocomplete()
 */

import { redis } from "@/lib/redis";

import type { PerfumeSuggestion } from "@/app/actions/autocomplete";

const CACHE_PREFIX = "autocomplete:v2";
const CACHE_TTL = 30; // seconds (increased from 10 for better hit rate)

/**
 * Generates cache key for autocomplete query
 * @param query - Search query (normalized to lowercase for consistency)
 * @param limit - Result limit
 * @returns Cache key string
 */
function getCacheKey(query: string, limit: number): string {
  // Normalize query to lowercase for consistent cache hits
  const normalizedQuery = query.toLowerCase().trim();
  return `${CACHE_PREFIX}:${normalizedQuery}:${limit}`;
}

/**
 * Retrieves cached autocomplete results
 * @param query - Search query
 * @param limit - Number of results requested
 * @returns Cached results or null if not found/error
 */
export async function getCachedAutocomplete(
  query: string,
  limit: number,
): Promise<PerfumeSuggestion[] | null> {
  try {
    const key = getCacheKey(query, limit);
    console.log("[CACHE GET]", { key, limit, query });
    const cached = await redis.get<PerfumeSuggestion[]>(key);

    if (cached) {
      console.log("[CACHE HIT]", { items: cached.length, key });
      return cached;
    }

    console.log("[CACHE MISS]", { key });
    return null;
  } catch (error) {
    // Graceful degradation: if Redis fails, log and return null
    console.error("[CACHE ERROR - GET]", error);
    return null;
  }
}

/**
 * Stores autocomplete results in cache
 * @param query - Search query
 * @param limit - Number of results
 * @param results - Results to cache
 */
export async function setCachedAutocomplete(
  query: string,
  limit: number,
  results: PerfumeSuggestion[],
): Promise<void> {
  try {
    const key = getCacheKey(query, limit);
    console.log("[CACHE SET]", {
      items: results.length,
      key,
      limit,
      query,
      sample: results[0],
    });

    // Store with TTL
    await redis.set(key, results, { ex: CACHE_TTL });
    console.log("[CACHE SET SUCCESS]", { key });

    // Verify the data was actually stored
    const verify = await redis.get<PerfumeSuggestion[]>(key);
    if (verify) {
      console.log("[CACHE VERIFY SUCCESS]", {
        key,
        stored_items: verify.length,
      });
    } else {
      console.error("[CACHE VERIFY FAILED]", { key, reason: "Data not found" });
    }
  } catch (error) {
    // Graceful degradation: log but don't throw
    console.error("[CACHE ERROR - SET]", error);
  }
}
