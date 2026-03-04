/**
 * Redis-based caching layer for autocomplete results
 *
 * Cache key format: autocomplete:v2:{query}:{limit}
 * TTL: 300 seconds (dataset changes once daily via cron)
 */

import { redis } from "@/lib/redis";

import type { PerfumeSuggestion } from "@/app/actions/autocomplete";

const CACHE_PREFIX = "autocomplete:v2";
const CACHE_TTL = 300; // seconds — perfume dataset refreshes once daily

/**
 * Generates cache key for autocomplete query
 * @param query - Search query (normalized to lowercase for consistency)
 * @param limit - Result limit
 * @returns Cache key string
 */
function getCacheKey(query: string, limit: number): string {
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
    return await redis.get<PerfumeSuggestion[]>(key);
  } catch {
    // Graceful degradation: if Redis fails, return null
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
    await redis.set(key, results, { ex: CACHE_TTL });
  } catch {
    // Graceful degradation: log but don't throw
  }
}
