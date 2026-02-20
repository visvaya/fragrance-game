import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("@/lib/redis", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({} as any),
}));

vi.mock("@/lib/utils/brand-masking", () => ({
  maskYear: vi.fn((year, attempt) => {
    if (!year) return null;
    if (attempt <= 1) return "____";
    if (attempt === 2) return year.toString()[0] + "___";
    if (attempt === 3) return year.toString().slice(0, 2) + "__";
    if (attempt === 4) return year.toString().slice(0, 3) + "_";
    return year.toString();
  }),
}));

vi.mock("@/lib/validations/game.schema", () => ({
  autocompleteSchema: {
    safeParse: vi.fn((data) => {
      if (typeof data.query !== "string") {
        return { success: false };
      }
      if (data.query.length < 3) {
        return { success: false };
      }
      if (data.query.length > 100) {
        return { success: false };
      }
      return {
        data: {
          query: data.query,
          sessionId: data.sessionId || "default-session",
        },
        success: true,
      };
    }),
  },
}));

vi.mock("@/lib/analytics-server", () => ({
  trackEvent: vi.fn().mockResolvedValue(undefined),
}));

// Import after mocks
import { trackEvent } from "@/lib/analytics-server";
import { checkRateLimit } from "@/lib/redis";
import { createClient } from "@/lib/supabase/server";
import { maskYear } from "@/lib/utils/brand-masking";

import { searchPerfumes, type PerfumeSuggestion } from "../autocomplete";

describe("autocomplete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("searchPerfumes", () => {
    describe("input validation", () => {
      it("returns empty array for query less than 3 characters", async () => {
        const result = await searchPerfumes("ab");

        expect(result).toEqual([]);
      });

      it("returns empty array for query exceeding 100 characters", async () => {
        const longQuery = "a".repeat(101);
        const result = await searchPerfumes(longQuery);

        expect(result).toEqual([]);
      });

      it("accepts valid query (3-100 characters)", async () => {
        const mockSupabaseClient = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: null },
              error: null,
            }),
          },
          rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
        };

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);

        const result = await searchPerfumes("Chanel");

        expect(result).toEqual([]);
        expect(mockSupabaseClient.rpc).toHaveBeenCalled();
      });

      it("handles special characters in query", async () => {
        const mockSupabaseClient = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: null },
              error: null,
            }),
          },
          rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
        };

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);

        await searchPerfumes("L'Eau d'Issey");

        expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
          "search_perfumes_unaccent",
          expect.objectContaining({
            search_query: "L'Eau d'Issey",
          }),
        );
      });
    });

    describe("rate limiting", () => {
      it("checks rate limit for authenticated user", async () => {
        const mockSupabaseClient = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: { id: "user-123" } },
              error: null,
            }),
          },
          rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
        };

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);

        await searchPerfumes("Dior");

        expect(checkRateLimit).toHaveBeenCalledWith("autocomplete", "user-123");
      });

      it("skips rate limit check for anonymous user", async () => {
        const mockSupabaseClient = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: null },
              error: null,
            }),
          },
          rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
        };

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);

        await searchPerfumes("Chanel");

        expect(checkRateLimit).not.toHaveBeenCalled();
      });

      it("throws error when rate limit exceeded", async () => {
        const mockSupabaseClient = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: { id: "user-123" } },
              error: null,
            }),
          },
          rpc: vi.fn(),
        };

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);
        vi.mocked(checkRateLimit).mockRejectedValueOnce(
          new Error("Rate limit exceeded for autocomplete"),
        );

        await expect(searchPerfumes("Dior")).rejects.toThrow(
          "Rate limit exceeded for autocomplete",
        );

        expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();
      });
    });

    describe("database query", () => {
      it("calls RPC with correct parameters", async () => {
        const mockSupabaseClient = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: null },
              error: null,
            }),
          },
          rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
        };

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);

        await searchPerfumes("Sauvage", "session-123", 3);

        expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
          "search_perfumes_unaccent",
          {
            limit_count: 30,
            search_query: "Sauvage",
          },
        );
      });

      it("returns empty array when database error occurs", async () => {
        const mockSupabaseClient = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: { id: "user-123" } },
              error: null,
            }),
          },
          rpc: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "Database connection failed" },
          }),
        };

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);

        const result = await searchPerfumes("Chanel");

        expect(result).toEqual([]);
        expect(trackEvent).toHaveBeenCalledWith(
          "autocomplete_error",
          expect.objectContaining({
            error: "Database connection failed",
          }),
          expect.any(String),
        );
      });

      it("returns empty array when no results found", async () => {
        const mockSupabaseClient = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: null },
              error: null,
            }),
          },
          rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
        };

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);

        const result = await searchPerfumes("NonexistentPerfume123");

        expect(result).toEqual([]);
      });
    });

    describe("year masking", () => {
      it("masks year based on currentAttempt", async () => {
        const mockPerfumes = [
          {
            brand_name: "Dior",
            concentration: "EDP",
            id: "perfume-1",
            name: "Sauvage",
            year: 2015,
          },
        ];

        const mockSupabaseClient = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: null },
              error: null,
            }),
          },
          rpc: vi.fn().mockResolvedValue({ data: mockPerfumes, error: null }),
        };

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);

        // Attempt 2: should show first digit
        const result = await searchPerfumes("Sauvage", "session-123", 2);

        expect(maskYear).toHaveBeenCalledWith(2015, 2);
        expect(result[0].year).toBe("2___");
      });

      it("reveals full year for duplicate perfumes", async () => {
        const mockPerfumes = [
          {
            brand_name: "Chanel",
            concentration: "EDP",
            id: "perfume-1",
            name: "No. 5",
            year: 1921,
          },
          {
            brand_name: "Chanel",
            concentration: "EDP",
            id: "perfume-2",
            name: "No. 5",
            year: 2016, // Reformulation
          },
        ];

        const mockSupabaseClient = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: null },
              error: null,
            }),
          },
          rpc: vi.fn().mockResolvedValue({ data: mockPerfumes, error: null }),
        };

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);

        const result = await searchPerfumes("Chanel No. 5", "session-123", 2);

        // Both should show full year because they're duplicates
        expect(result[0].year).toBe("1921");
        expect(result[1].year).toBe("2016");
      });

      it("handles null year gracefully", async () => {
        const mockPerfumes = [
          {
            brand_name: "Test",
            concentration: null,
            id: "perfume-1",
            name: "Unknown Year",
            year: null,
          },
        ];

        const mockSupabaseClient = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: null },
              error: null,
            }),
          },
          rpc: vi.fn().mockResolvedValue({ data: mockPerfumes, error: null }),
        };

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);

        const result = await searchPerfumes("Unknown", "session-123", 3);

        expect(result[0].year).toBeNull();
        expect(result[0].display_name).not.toContain("(");
      });
    });

    describe("result formatting", () => {
      it("formats display name correctly", async () => {
        const mockPerfumes = [
          {
            brand_name: "Dior",
            concentration: "Eau de Parfum",
            id: "perfume-1",
            name: "Sauvage",
            year: 2015,
          },
        ];

        const mockSupabaseClient = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: null },
              error: null,
            }),
          },
          rpc: vi.fn().mockResolvedValue({ data: mockPerfumes, error: null }),
        };

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);

        const result = await searchPerfumes("Sauvage", "session-123", 6);

        expect(result[0].display_name).toMatch(
          /^Dior - Sauvage Eau de Parfum \(2015\)$/,
        );
      });

      it("omits concentration if null", async () => {
        const mockPerfumes = [
          {
            brand_name: "Test Brand",
            concentration: null,
            id: "perfume-1",
            name: "Test Perfume",
            year: 2020,
          },
        ];

        const mockSupabaseClient = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: null },
              error: null,
            }),
          },
          rpc: vi.fn().mockResolvedValue({ data: mockPerfumes, error: null }),
        };

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);

        const result = await searchPerfumes("Test", "session-123", 6);

        expect(result[0].display_name).toBe("Test Brand - Test Perfume (2020)");
      });

      it("includes all required fields in result", async () => {
        const mockPerfumes = [
          {
            brand_name: "Dior",
            concentration: "EDP",
            id: "perfume-1",
            name: "Sauvage",
            year: 2015,
          },
        ];

        const mockSupabaseClient = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: null },
              error: null,
            }),
          },
          rpc: vi.fn().mockResolvedValue({ data: mockPerfumes, error: null }),
        };

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);

        const result = await searchPerfumes("Sauvage", "session-123", 3);

        expect(result[0]).toHaveProperty("perfume_id");
        expect(result[0]).toHaveProperty("name");
        expect(result[0]).toHaveProperty("brand_masked");
        expect(result[0]).toHaveProperty("concentration");
        expect(result[0]).toHaveProperty("year");
        expect(result[0]).toHaveProperty("raw_year");
        expect(result[0]).toHaveProperty("display_name");
      });
    });

    describe("intelligent slicing", () => {
      it("limits results to 10 by default", async () => {
        const mockPerfumes = Array.from({ length: 15 }, (_, i) => ({
          brand_name: `Brand ${i}`,
          concentration: "EDP",
          id: `perfume-${i}`,
          name: `Perfume ${i}`,
          year: 2020 + i,
        }));

        const mockSupabaseClient = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: null },
              error: null,
            }),
          },
          rpc: vi.fn().mockResolvedValue({ data: mockPerfumes, error: null }),
        };

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);

        const result = await searchPerfumes("Perfume", "session-123", 3);

        expect(result).toHaveLength(10);
      });

      it("extends beyond 10 if last item has duplicates", async () => {
        // 9 unique perfumes + 3 versions of the 10th perfume (different years)
        const mockPerfumes = [
          ...Array.from({ length: 9 }, (_, i) => ({
            brand_name: `Brand ${i}`,
            concentration: "EDP",
            id: `perfume-${i}`,
            name: `Perfume ${i}`,
            year: 2020 + i,
          })),
          {
            brand_name: "Duplicate Brand",
            concentration: "EDP",
            id: "perfume-10a",
            name: "Duplicate Perfume",
            year: 2020,
          },
          {
            brand_name: "Duplicate Brand",
            concentration: "EDP",
            id: "perfume-10b",
            name: "Duplicate Perfume",
            year: 2015,
          },
          {
            brand_name: "Duplicate Brand",
            concentration: "EDP",
            id: "perfume-10c",
            name: "Duplicate Perfume",
            year: 2010,
          },
        ];

        const mockSupabaseClient = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: null },
              error: null,
            }),
          },
          rpc: vi.fn().mockResolvedValue({ data: mockPerfumes, error: null }),
        };

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);

        const result = await searchPerfumes("Perfume", "session-123", 3);

        // Should include all 12 items (9 unique + 3 duplicates)
        expect(result).toHaveLength(12);
      });

      it("stops extension when duplicate group ends", async () => {
        const mockPerfumes = [
          ...Array.from({ length: 9 }, (_, i) => ({
            brand_name: `Brand ${i}`,
            concentration: "EDP",
            id: `perfume-${i}`,
            name: `Perfume ${i}`,
            year: 2020 + i,
          })),
          {
            brand_name: "Duplicate Brand",
            concentration: "EDP",
            id: "perfume-10a",
            name: "Duplicate Perfume",
            year: 2020,
          },
          {
            brand_name: "Duplicate Brand",
            concentration: "EDP",
            id: "perfume-10b",
            name: "Duplicate Perfume",
            year: 2015,
          },
          {
            brand_name: "Different Brand",
            concentration: "EDP",
            id: "perfume-11",
            name: "Different Perfume",
            year: 2022,
          },
        ];

        const mockSupabaseClient = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: null },
              error: null,
            }),
          },
          rpc: vi.fn().mockResolvedValue({ data: mockPerfumes, error: null }),
        };

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);

        const result = await searchPerfumes("Perfume", "session-123", 3);

        // Should include 11 items (9 unique + 2 duplicates, stops before Different Perfume)
        expect(result).toHaveLength(11);
      });
    });

    describe("analytics tracking", () => {
      it("tracks successful search with results", async () => {
        const mockPerfumes = [
          {
            brand_name: "Dior",
            concentration: "EDP",
            id: "perfume-1",
            name: "Sauvage",
            year: 2015,
          },
        ];

        const mockSupabaseClient = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: { id: "user-123" } },
              error: null,
            }),
          },
          rpc: vi.fn().mockResolvedValue({ data: mockPerfumes, error: null }),
        };

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);

        await searchPerfumes("Sauvage", "session-123", 3);

        expect(trackEvent).toHaveBeenCalledWith(
          "autocomplete_search",
          expect.objectContaining({
            attempt: 3,
            has_results: true,
            query: "Sauvage",
            results_count: 1,
            search_time_ms: expect.any(Number),
          }),
          "user-123",
        );
      });

      it("tracks search with no results", async () => {
        const mockSupabaseClient = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: null },
              error: null,
            }),
          },
          rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
        };

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);

        await searchPerfumes("NonexistentXYZ", "session-123", 1);

        expect(trackEvent).toHaveBeenCalledWith(
          "autocomplete_search",
          expect.objectContaining({
            has_results: false,
            query: "NonexistentXYZ",
            results_count: 0,
          }),
          expect.any(String),
        );
      });

      it("tracks database errors", async () => {
        const mockSupabaseClient = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: { id: "user-123" } },
              error: null,
            }),
          },
          rpc: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "Connection timeout" },
          }),
        };

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);

        await searchPerfumes("Test", "session-123", 2);

        expect(trackEvent).toHaveBeenCalledWith(
          "autocomplete_error",
          expect.objectContaining({
            attempt: 2,
            error: "Connection timeout",
            query: "Test",
          }),
          "user-123",
        );
      });
    });

    describe("edge cases", () => {
      it("handles empty search results", async () => {
        const mockSupabaseClient = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: null },
              error: null,
            }),
          },
          rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
        };

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);

        const result = await searchPerfumes("XYZ123NotFound", "session-123", 3);

        expect(result).toEqual([]);
      });

      it("handles missing sessionId and currentAttempt", async () => {
        const mockSupabaseClient = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: null },
              error: null,
            }),
          },
          rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
        };

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);

        const result = await searchPerfumes("Chanel");

        expect(result).toEqual([]);
        expect(mockSupabaseClient.rpc).toHaveBeenCalled();
      });

      it("handles perfumes with same name but different concentrations", async () => {
        const mockPerfumes = [
          {
            brand_name: "Dior",
            concentration: "EDT",
            id: "perfume-1",
            name: "Sauvage",
            year: 2015,
          },
          {
            brand_name: "Dior",
            concentration: "EDP",
            id: "perfume-2",
            name: "Sauvage",
            year: 2018,
          },
          {
            brand_name: "Dior",
            concentration: "Parfum",
            id: "perfume-3",
            name: "Sauvage",
            year: 2019,
          },
        ];

        const mockSupabaseClient = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: null },
              error: null,
            }),
          },
          rpc: vi.fn().mockResolvedValue({ data: mockPerfumes, error: null }),
        };

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);

        const result = await searchPerfumes("Sauvage", "session-123", 2);

        // All three should be returned (different concentrations = different perfumes)
        expect(result).toHaveLength(3);
        expect(result.map((r) => r.concentration)).toEqual([
          "EDT",
          "EDP",
          "Parfum",
        ]);
      });
    });
  });
});
