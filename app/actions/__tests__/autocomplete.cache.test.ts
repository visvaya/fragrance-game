/**
 * Tests for autocomplete cache-hit path and remaskCachedSuggestions.
 * Kept separate to allow getCachedAutocomplete to return non-null values
 * without affecting the existing cache-miss test suite.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mock refs — must exist before vi.mock() factories run
// ---------------------------------------------------------------------------
const { mockGetCached, mockTrackEvent } = vi.hoisted(() => {
  const getCached = vi.fn().mockResolvedValue(null);
  const trackEvent = vi.fn().mockResolvedValue(undefined);
  return { mockGetCached: getCached, mockTrackEvent: trackEvent };
});

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Map()),
}));

vi.mock("@/lib/redis", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/utils/brand-masking", () => ({
  maskYear: vi.fn((year: number | null, attempt: number) => {
    if (!year) return null;
    const s = String(year);
    if (attempt <= 1) return "⎵⎵⎵⎵";
    if (attempt === 2) return `${s[0]}⎵⎵⎵`;
    if (attempt === 3) return `${s.slice(0, 2)}⎵⎵`;
    if (attempt === 4) return `${s.slice(0, 3)}⎵`;
    return s;
  }),
}));

vi.mock("@/lib/validations/game.schema", () => ({
  autocompleteSchema: {
    safeParse: vi.fn((data) => {
      if (
        typeof data.query !== "string" ||
        data.query.length < 3 ||
        data.query.length > 100
      ) {
        return { success: false };
      }
      return {
        data: { query: data.query, sessionId: data.sessionId },
        success: true,
      };
    }),
  },
}));

vi.mock("@/lib/analytics-server", () => ({
  trackEvent: mockTrackEvent,
}));

vi.mock("@/lib/cache/autocomplete-cache", () => ({
  getCachedAutocomplete: mockGetCached,
  setCachedAutocomplete: vi.fn().mockResolvedValue(undefined),
}));

import { searchPerfumes } from "../autocomplete";

// ---------------------------------------------------------------------------
// Shared cached data fixture
// ---------------------------------------------------------------------------

const CACHED_SAUVAGE = [
  {
    brand_masked: "Dior",
    brand_norm: "dior",
    concentration: "EDP",
    display_name: "Dior - Sauvage EDP (⎵⎵⎵⎵)",
    name: "Sauvage",
    name_norm: "sauvage",
    perfume_id: "perfume-1",
    raw_year: 2015,
    year: "⎵⎵⎵⎵",
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("searchPerfumes — cache-hit path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCached.mockResolvedValue(null);
  });

  it("returns re-masked results from cache without hitting DB", async () => {
    mockGetCached.mockResolvedValueOnce(CACHED_SAUVAGE);

    const result = await searchPerfumes("Sauvage", "session-123", 3);

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    // Year should be re-masked for attempt 3: "20⎵⎵"
    expect(result[0].year).toBe("20⎵⎵");
  });

  it("tracks analytics with cache_hit: true when cache is hit", async () => {
    mockGetCached.mockResolvedValueOnce(CACHED_SAUVAGE);

    await searchPerfumes("Sauvage", "session-abc", 4);

    expect(mockTrackEvent).toHaveBeenCalledWith(
      "autocomplete_performance_v2",
      expect.objectContaining({ cache_hit: true }),
      expect.any(String),
    );
  });

  it("includes results_count and query in cache-hit analytics", async () => {
    mockGetCached.mockResolvedValueOnce(CACHED_SAUVAGE);

    await searchPerfumes("Sauvage", "session-xyz", 2);

    expect(mockTrackEvent).toHaveBeenCalledWith(
      "autocomplete_performance_v2",
      expect.objectContaining({
        cache_hit: true,
        query: "Sauvage",
        results_count: expect.any(Number),
        search_time_ms: 0,
      }),
      expect.any(String),
    );
  });

  it("re-masks year=null gracefully on cache hit", async () => {
    const cachedNullYear = [
      {
        brand_masked: "Unknown",
        brand_norm: "unknown",
        concentration: null,
        display_name: "Unknown - Mystery",
        name: "Mystery",
        name_norm: "mystery",
        perfume_id: "perfume-null",
        raw_year: null,
        year: null,
      },
    ];
    mockGetCached.mockResolvedValueOnce(cachedNullYear);

    const result = await searchPerfumes("Mystery", "session-123", 3);

    expect(result[0].year).toBeNull();
  });

  it("reveals full year for duplicate-name perfumes in cache hit", async () => {
    const cachedDupes = [
      {
        brand_masked: "Chanel",
        brand_norm: "chanel",
        concentration: "EDT",
        display_name: "Chanel - No. 5 EDT (⎵⎵⎵⎵)",
        name: "No. 5",
        name_norm: "no. 5",
        perfume_id: "p-1",
        raw_year: 1921,
        year: "⎵⎵⎵⎵",
      },
      {
        brand_masked: "Chanel",
        brand_norm: "chanel",
        concentration: "EDT",
        display_name: "Chanel - No. 5 EDT (⎵⎵⎵⎵)",
        name: "No. 5",
        name_norm: "no. 5",
        perfume_id: "p-2",
        raw_year: 2016,
        year: "⎵⎵⎵⎵",
      },
    ];
    mockGetCached.mockResolvedValueOnce(cachedDupes);

    const result = await searchPerfumes("No. 5", "session-123", 1);

    // Duplicates (same brand+name+concentration) should reveal full year
    expect(result[0].year).toBe("1921");
    expect(result[1].year).toBe("2016");
  });
});

// ---------------------------------------------------------------------------
// sliceCandidates — exact-match path (≥10 exact name matches)
// ---------------------------------------------------------------------------

describe("searchPerfumes — sliceCandidates exact-match shortcut", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCached.mockResolvedValue(null);
  });

  it("returns only exact-name matches (up to 30) when >=10 exact matches exist", async () => {
    // 12 items named exactly "Rose" (exact match) + 5 items with different names
    const exactMatches = Array.from({ length: 12 }, (_, i) => ({
      brand_name: `Brand ${i}`,
      concentration: "EDP",
      id: `exact-${i}`,
      name: "Rose",
      year: 2000 + i,
    }));
    const otherMatches = Array.from({ length: 5 }, (_, i) => ({
      brand_name: `Other ${i}`,
      concentration: "EDP",
      id: `other-${i}`,
      name: "Rose Garden",
      year: 2010 + i,
    }));

    const { createClient } = await vi.importMock<
      typeof import("@/lib/supabase/server")
    >("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: null }, error: null }),
      },
      rpc: vi.fn().mockResolvedValue({
        data: [...exactMatches, ...otherMatches],
        error: null,
      }),
    } as never);

    // Query exactly "Rose" (query length ≥3, matches 12 items exactly)
    const result = await searchPerfumes("Rose", "session-123", 5);

    // Should include only the 12 exact "Rose" matches (not "Rose Garden")
    expect(result.every((r) => r.name === "Rose")).toBe(true);
    expect(result).toHaveLength(12);
  });
});
