import { normalizeText } from "@/lib/utils";
import { maskYear } from "@/lib/utils/brand-masking";

import type { PerfumeSuggestion } from "@/lib/types/game";

/** A row of the perfume search, before masking and ranking. */
export type FragranceRow = {
  brand_name: string;
  concentration: string | null;
  id: string;
  name: string;
  year: number | null;
};

const DEFAULT_LIMIT = 10;
const EXACT_MATCH_LIMIT = 30;

/**
 * Perfumes that differ only by year share this key; their years stay visible to tell them
 * apart. The concentration joins the name, so "Dior Homme" (Parfum) and "Dior Homme Parfum"
 * count as one name.
 */
const variantKey = ({
  brand_norm,
  concentration,
  name,
}: Pick<PerfumeSuggestion, "brand_norm" | "concentration" | "name">): string =>
  `${brand_norm}|${normalizeText([name, concentration].filter(Boolean).join(" "))}`;

function countVariants(keys: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  return counts;
}

/** The year shown for a suggestion: plain for same-name variants, otherwise masked by attempt. */
function shownYear(
  year: number | null | undefined,
  hasVariants: boolean,
  attemptsCount: number,
): string | null {
  return hasVariants
    ? (year?.toString() ?? null)
    : maskYear(year ?? null, attemptsCount);
}

/**
 * Whether the brand is shown next to the name: not when the name is the brand or starts
 * with it as a word ("Dior Homme" by Dior), which would repeat it.
 * @param suggestion - Suggestion with normalized brand and name.
 */
export const showsBrand = (
  suggestion: Pick<PerfumeSuggestion, "brand_norm" | "name_norm">,
): boolean =>
  suggestion.name_norm !== suggestion.brand_norm &&
  !suggestion.name_norm.startsWith(`${suggestion.brand_norm} `);

function displayName(item: PerfumeSuggestion, year: string | null): string {
  const brandPrefix = showsBrand(item) ? `${item.brand_masked} - ` : "";
  const concentrationSuffix = item.concentration
    ? ` ${item.concentration}`
    : "";
  const yearSuffix = year ? ` (${year})` : "";
  return `${brandPrefix}${item.name}${concentrationSuffix}${yearSuffix}`;
}

/**
 * Scores a suggestion by how well its brand/name matches the query.
 * Phonetic-only DB matches (false positives like "L'Oriental" for "laurent") score 0.
 * Word-boundary check ensures "ford" in "Tom Ford" (score 3) ranks above
 * "ford" embedded in "Oxford" (score 2).
 * @param suggestion - Suggestion with normalized brand and name.
 * @param normalizedQuery - Query after `normalizeText`.
 */
export function relevanceScore(
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

/**
 * Turns search rows into suggestions with the year masked for the attempt.
 * @param rows - Rows of the perfume search.
 * @param attemptsCount - Attempts the player has made.
 */
export function toSuggestions(
  rows: FragranceRow[],
  attemptsCount: number,
): PerfumeSuggestion[] {
  // Year and display name are decided in one place, remaskSuggestions.
  const unmasked = rows.map((row) => ({
    brand_masked: row.brand_name,
    brand_norm: normalizeText(row.brand_name),
    concentration: row.concentration ?? null,
    display_name: "",
    name: row.name,
    name_norm: normalizeText(row.name),
    perfume_id: row.id,
    raw_year: row.year ?? null,
    year: null,
  }));
  return remaskSuggestions(unmasked, attemptsCount);
}

/**
 * Re-masks year and display name of cached suggestions for the current attempt count.
 * @param cached - Suggestions read from the cache.
 * @param attemptsCount - Attempts the player has made.
 */
export function remaskSuggestions(
  cached: PerfumeSuggestion[],
  attemptsCount: number,
): PerfumeSuggestion[] {
  const variants = countVariants(cached.map((item) => variantKey(item)));
  return cached.map((item) => {
    const hasVariants = (variants.get(variantKey(item)) ?? 0) > 1;
    const year = shownYear(item.raw_year, hasVariants, attemptsCount);
    return {
      ...item,
      display_name: displayName(item, year),
      year,
    };
  });
}

/** Sort position of a year: unknown years go last. */
const yearOrder = (year: number | null): number =>
  year ?? Number.MAX_SAFE_INTEGER;

/**
 * Sorts suggestions by relevance to the query, best first; equal scores keep their order.
 * Variants of one name then stand together at the place of the best of them, ordered by
 * year (unknown last), so the player sees that there is more than one.
 * @param suggestions - Suggestions to sort.
 * @param normalizedQuery - Query after `normalizeText`.
 */
export function rankSuggestions(
  suggestions: PerfumeSuggestion[],
  normalizedQuery: string,
): PerfumeSuggestion[] {
  const byRelevance = suggestions.toSorted(
    (a, b) =>
      relevanceScore(b, normalizedQuery) - relevanceScore(a, normalizedQuery),
  );
  const groups = Map.groupBy(byRelevance, (item) => variantKey(item));
  return [...groups.values()].flatMap((group) =>
    group.toSorted((a, b) => yearOrder(a.raw_year) - yearOrder(b.raw_year)),
  );
}

/**
 * The suggestions shown to the player: the relevant ones (all ranked ones when none is
 * relevant), cut to 10, or up to 30 exact name matches, and never splitting a group of
 * same-name variants at the cut. On the last attempt everything is shown.
 * @param ranked - Suggestions sorted by {@link rankSuggestions}.
 * @param normalizedQuery - Query after `normalizeText`.
 * @param query - The validated query as typed.
 * @param isLastAttempt - Whether the player is on the last attempt.
 */
export function selectSuggestions(
  ranked: PerfumeSuggestion[],
  normalizedQuery: string,
  query: string,
  isLastAttempt: boolean,
): PerfumeSuggestion[] {
  const relevant = ranked.filter(
    (item) => relevanceScore(item, normalizedQuery) > 0,
  );
  const candidates = relevant.length > 0 ? relevant : ranked;
  if (isLastAttempt || candidates.length <= DEFAULT_LIMIT) return candidates;

  const queryLower = query.toLowerCase();
  const exactMatches = candidates.filter(
    (item) => item.name.toLowerCase() === queryLower,
  );
  if (exactMatches.length >= DEFAULT_LIMIT) {
    return exactMatches.slice(0, EXACT_MATCH_LIMIT);
  }

  // Extend the cut to the end of the group of the last included suggestion.
  const lastIncluded = candidates[DEFAULT_LIMIT - 1];
  if (!lastIncluded) return candidates;
  const lastKey = variantKey(lastIncluded);
  const firstMismatchIndex = candidates
    .slice(DEFAULT_LIMIT)
    .findIndex((candidate) => variantKey(candidate) !== lastKey);
  return candidates.slice(
    0,
    firstMismatchIndex === -1
      ? candidates.length
      : DEFAULT_LIMIT + firstMismatchIndex,
  );
}
