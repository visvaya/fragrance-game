import { describe, it, expect, vi, beforeEach } from "vitest";

import { getDailyChallenge } from "../game-actions";

/**
 * Security Tests for Server Actions
 *
 * These tests verify that Server Actions:
 * 1. Can still access notes from perfumes table (Admin Client)
 * 2. Do NOT expose perfume_id in response
 * 3. Do NOT expose sensitive data (xsolve internals)
 */

// Mock Supabase clients
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "daily_challenges") {
        return {
          eq: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: {
                perfume_id: "test-perfume-id",
              },
              error: null,
            })),
          })),
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: {
                  perfume_id: "test-perfume-id",
                },
                error: null,
              })),
            })),
          })),
        };
      }
      if (table === "perfumes") {
        return {
          eq: vi.fn(() => ({
            single: vi.fn(async () => ({
              // Mock perfume with notes (Admin Client can read these!)
              data: {
                base_notes: ["Tobacco", "Tonka bean", "Vanilla"],
                brands: { name: "Xerjoff" },
                concentrations: { name: "EDP" },
                gender: "Unisex",
                is_linear: false,
                middle_notes: ["Honey", "Cashmere", "Cinnamon"],
                name: "Naxos",
                perfumers: ["Chris Maurice"],
                release_year: 2015,
                top_notes: ["Lavender", "Bergamot", "Lemon"],
                xsolve_score: 0.235,
              },
              error: null,
            })),
          })),
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: {
                  base_notes: ["Tobacco", "Tonka bean", "Vanilla"],
                  brands: { name: "Xerjoff" },
                  concentrations: { name: "EDP" },
                  gender: "Unisex",
                  is_linear: false,
                  middle_notes: ["Honey", "Cashmere", "Cinnamon"],
                  name: "Naxos",
                  perfumers: ["Chris Maurice"],
                  release_year: 2015,
                  top_notes: ["Lavender", "Bergamot", "Lemon"],
                  xsolve_score: 0.235,
                },
                error: null,
              })),
            })),
          })),
        };
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: null,
              error: { message: "Not found" },
            })),
          })),
        })),
      };
    }),
  })),
  createClient: vi.fn(async () => ({
    from: vi.fn((table: string) => {
      if (table === "daily_challenges_public") {
        return {
          eq: vi.fn(() => ({
            limit: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: {
                  challenge_date: "2026-02-13",
                  grace_deadline_at_utc: "2026-02-13T23:59:59Z",
                  id: "test-challenge-id",
                  mode: "standard",
                  snapshot_metadata: {},
                },
                error: null,
              })),
            })),
          })),
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              limit: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: {
                    challenge_date: "2026-02-13",
                    grace_deadline_at_utc: "2026-02-13T23:59:59Z",
                    id: "test-challenge-id",
                    mode: "standard",
                    snapshot_metadata: {},
                  },
                  error: null,
                })),
              })),
            })),
          })),
        };
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: null,
              error: { message: "Not found" },
            })),
          })),
        })),
      };
    }),
  })),
}));

describe("Server Actions Security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getDailyChallenge() - Data Exposure", () => {
    it("CRITICAL: response does NOT contain perfume_id", async () => {
      const challenge = await getDailyChallenge();

      expect(challenge).toBeDefined();
      expect(challenge).not.toBeNull();

      // CRITICAL: perfume_id should NEVER be in response
      expect(challenge).not.toHaveProperty("perfume_id");

      // Deep check - ensure perfume_id is nowhere in response
      const responseJson = JSON.stringify(challenge);
      expect(responseJson).not.toContain("perfume_id");
      expect(responseJson).not.toContain("test-perfume-id");
    });

    it("CRITICAL: response does NOT contain xsolve_score internal value", async () => {
      const challenge = await getDailyChallenge();

      expect(challenge).toBeDefined();

      // xsolve is exposed as difficulty (public API)
      expect(challenge?.clues.xsolve).toBeDefined();

      // But NOT as raw score (internal calculation)
      expect(challenge).not.toHaveProperty("xsolve_score");

      // Check clues object doesn't leak internal data
      const cluesJson = JSON.stringify(challenge?.clues);
      expect(cluesJson).not.toContain("xsolve_score");
    });

    it("response DOES contain notes (from perfumes table via Admin Client)", async () => {
      const challenge = await getDailyChallenge();

      expect(challenge).toBeDefined();
      expect(challenge?.clues).toBeDefined();
      expect(challenge?.clues.notes).toBeDefined();

      // Notes should be present (fetched from perfumes table)
      expect(challenge?.clues.notes.top).toBeDefined();
      expect(challenge?.clues.notes.heart).toBeDefined();
      expect(challenge?.clues.notes.base).toBeDefined();

      // Verify notes are arrays with data
      expect(Array.isArray(challenge?.clues.notes.top)).toBe(true);
      expect(challenge?.clues.notes.top.length).toBeGreaterThan(0);
    });

    it("response contains only safe public clues", async () => {
      const challenge = await getDailyChallenge();

      expect(challenge).toBeDefined();
      expect(challenge?.clues).toBeDefined();

      // Safe public clues (progressively revealed during game)
      expect(challenge?.clues.brand).toBeDefined();
      expect(challenge?.clues.year).toBeDefined();
      expect(challenge?.clues.gender).toBeDefined();
      expect(challenge?.clues.concentration).toBeDefined();
      expect(challenge?.clues.notes).toBeDefined();
      expect(challenge?.clues.perfumer).toBeDefined();
      expect(challenge?.clues.xsolve).toBeDefined(); // Difficulty (public)
      expect(challenge?.clues.isLinear).toBeDefined();

      // Dangerous data should NOT be present
      expect(challenge).not.toHaveProperty("perfume_id");
      expect(challenge).not.toHaveProperty("seed_hash");
      expect(challenge?.clues).not.toHaveProperty("xsolve_score");
      expect(challenge?.clues).not.toHaveProperty("fingerprint_strict");
      expect(challenge?.clues).not.toHaveProperty("fingerprint_loose");
    });
  });

  describe("Server Actions - Admin Client Usage", () => {
    it("Server Action uses Admin Client to read perfumes table", async () => {
      // This test verifies that Server Actions CAN read from perfumes table
      // (not perfumes_public VIEW) using Admin Client

      const challenge = await getDailyChallenge();

      expect(challenge).toBeDefined();
      expect(challenge?.clues.notes).toBeDefined();

      // If we got notes, it means Admin Client successfully read from perfumes table
      // (perfumes_public doesn't have notes anymore after security fix)
      expect(challenge?.clues.notes.top).toEqual([
        "Lavender",
        "Bergamot",
        "Lemon",
      ]);
      expect(challenge?.clues.notes.heart).toEqual([
        "Honey",
        "Cashmere",
        "Cinnamon",
      ]);
      expect(challenge?.clues.notes.base).toEqual([
        "Tobacco",
        "Tonka bean",
        "Vanilla",
      ]);
    });

    it("Server Action can read xsolve_score from perfumes table", async () => {
      const challenge = await getDailyChallenge();

      expect(challenge).toBeDefined();
      expect(challenge?.clues.xsolve).toBeDefined();

      // xsolve is exposed as difficulty multiplier (public API)
      expect(typeof challenge?.clues.xsolve).toBe("number");
      expect(challenge?.clues.xsolve).toBeGreaterThan(0);
    });
  });
});

describe("Security - Defense in Depth", () => {
  it("CRITICAL: multiple layers protect against data leaks", async () => {
    const challenge = await getDailyChallenge();

    // Layer 1: VIEW doesn't expose perfume_id
    // (daily_challenges_public has no perfume_id column)

    // Layer 2: Response doesn't include perfume_id
    expect(challenge).not.toHaveProperty("perfume_id");

    // Layer 3: Response doesn't include internal metadata
    expect(challenge).not.toHaveProperty("seed_hash");
    expect(challenge).not.toHaveProperty("xsolve_score");

    // Layer 4: Clues object doesn't leak internals
    expect(challenge?.clues).not.toHaveProperty("fingerprint_strict");
    expect(challenge?.clues).not.toHaveProperty("fingerprint_loose");

    // RESULT: Even if one layer fails, others protect data
  });

  it("response is safe to send to client (no sensitive data)", async () => {
    const challenge = await getDailyChallenge();

    // Simulate sending to client
    const clientResponse = JSON.parse(JSON.stringify(challenge));

    // Safe data
    expect(clientResponse.clues.brand).toBeDefined();
    expect(clientResponse.clues.notes).toBeDefined();

    // Dangerous data should not exist
    expect(clientResponse.perfume_id).toBeUndefined();
    expect(clientResponse.seed_hash).toBeUndefined();

    // No way to reverse-engineer answer from clues
    // (notes are progressively masked, brand is masked, year is masked)
  });
});
