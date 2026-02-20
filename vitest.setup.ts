import "@testing-library/jest-dom";
import { vi } from "vitest";

// ==================== Mock Factories ====================

/**
 * Creates a mock Supabase client for testing.
 * Provides default implementations that can be overridden via the overrides parameter.
 * @example
 * const mockClient = createMockSupabaseClient({
 *   from: vi.fn().mockReturnValue({
 *     select: vi.fn().mockResolvedValue({ data: [mockData], error: null })
 *   })
 * });
 */
export function createMockSupabaseClient(
  overrides: Record<string, unknown> = {},
) {
  const mockClient = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "test-user-123" } },
        error: null,
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    storage: {
      from: vi.fn().mockReturnThis(),
      getPublicUrl: vi.fn().mockReturnValue({
        data: { publicUrl: "https://example.com/test-image.jpg" },
      }),
      upload: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
    update: vi.fn().mockReturnThis(),
    ...overrides,
  };

  return mockClient;
}

/**
 * Creates a mock game session for testing.
 * Represents a user's active game session with guesses and state.
 * @example
 * const session = createMockGameSession({
 *   guesses: [{ brandName: "Chanel", isCorrect: false, ... }],
 *   imageUrl: "/custom-image.jpg"
 * });
 */
export function createMockGameSession(overrides: Record<string, unknown> = {}) {
  return {
    graceDeadline: "2026-02-13T00:00:00Z",
    guesses: [],
    imageUrl: "https://example.com/perfume-image.jpg",
    nonce: "nonce-test-abc",
    revealState: {
      brandReveal: 0,
      currentAttempt: 1,
      imageBlur: 60,
      imageReveal: 20,
      notesReveal: {
        base: 0,
        heart: 0,
        top: 0,
      },
      perfumerReveal: 0,
      showConcentration: false,
      showGender: false,
      yearReveal: 0,
    },
    sessionId: "session-test-123",
    ...overrides,
  };
}

/**
 * Creates a mock daily challenge for testing.
 * Represents the daily perfume guessing challenge with all clues.
 * @example
 * const challenge = createMockChallenge({
 *   clues: {
 *     brand: "Dior",
 *     year: 1985,
 *     notes: { top: ["Bergamot"], heart: ["Jasmine"], base: ["Vanilla"] }
 *   }
 * });
 */
export function createMockChallenge(overrides: Record<string, unknown> = {}) {
  return {
    challenge_date: "2026-02-12",
    clues: {
      brand: "Chanel",
      concentration: "Parfum",
      gender: "Female",
      isLinear: false,
      notes: {
        base: ["Vanilla", "Sandalwood", "Vetiver"],
        heart: ["Jasmine", "Rose", "Lily of the Valley"],
        top: ["Aldehydes", "Neroli", "Ylang-Ylang"],
      },
      perfumer: "Ernest Beaux",
      xsolve: 100,
      year: 1921,
    },
    grace_deadline_at_utc: "2026-02-13T00:00:00Z",
    id: "challenge-test-123",
    mode: "daily",
    snapshot_metadata: {},
    ...overrides,
  };
}

/**
 * Creates a mock guess history item for testing.
 * Represents a single guess attempt with feedback.
 * @example
 * const guess = createMockGuessHistoryItem({
 *   brandName: "Dior",
 *   isCorrect: false,
 *   feedback: { brandMatch: false, yearDirection: "higher", ... }
 * });
 */
export function createMockGuessHistoryItem(
  overrides: Record<string, unknown> = {},
) {
  return {
    brandName: "Test Brand",
    feedback: {
      brandMatch: false,
      notesMatch: 0.3,
      perfumerMatch: "none" as const,
      yearDirection: "higher" as const,
      yearMatch: "wrong" as const,
    },
    isCorrect: false,
    perfumeId: "perfume-test-456",
    perfumeName: "Test Perfume",
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Creates a mock perfume for testing autocomplete/search.
 * Represents a perfume entity from the database.
 * @example
 * const perfume = createMockPerfume({
 *   name: "Sauvage",
 *   brand: "Dior",
 *   year: 2015
 * });
 */
export function createMockPerfume(overrides: Record<string, unknown> = {}) {
  return {
    brand: "Chanel",
    concentration: "Parfum",
    gender: "Female",
    id: "perfume-test-789",
    name: "No. 5",
    notes_base: ["Vanilla", "Sandalwood"],
    notes_heart: ["Jasmine", "Rose"],
    notes_top: ["Aldehydes", "Neroli"],
    perfumer: "Ernest Beaux",
    year: 1921,
    ...overrides,
  };
}
