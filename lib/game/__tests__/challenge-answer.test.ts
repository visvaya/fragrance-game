import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(),
}));

import {
  buildSessionClues,
  enrichGuessHistory,
  fetchChallengeAnswer,
  type GuessHistoryItem,
} from "@/lib/game/challenge-answer";
import { revealLetters } from "@/lib/game/scoring";
import { createAdminClient } from "@/lib/supabase/server";

import type { ClueAnswer } from "@/lib/game/clue-reveal";

/** Thenable chain that resolves when awaited or when .single() is called. */
function makeChain(value: unknown) {
  const p = Promise.resolve(value);
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(value);
  chain.maybeSingle = vi.fn().mockResolvedValue(value);
  // eslint-disable-next-line unicorn/no-thenable -- necessary for Supabase chain mocking
  chain.then = p.then.bind(p);
  chain.catch = p.catch.bind(p);
  chain.finally = p.finally.bind(p);
  return chain;
}

function mockAdmin(tables: Record<string, unknown>) {
  vi.mocked(createAdminClient).mockReturnValue({
    from: vi.fn((table: string) => makeChain(tables[table])),
  } as never);
}

const CHALLENGE_ID = "550e8400-e29b-41d4-a716-446655440000";
const ANSWER_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const GUESS_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d471";

const ANSWER: ClueAnswer = {
  brand: "Chanel",
  gender: "Feminine",
  isLinear: false,
  notes: { base: ["Vanilla"], heart: ["Rose"], top: ["Bergamot"] },
  perfumers: ["Jacques Polge"],
  year: 2001,
};

const emptyFeedback = {
  brandMatch: false,
  genderMatch: false,
  notesMatch: 0,
  perfumerMatch: "none" as const,
  yearDirection: "equal" as const,
  yearMatch: "wrong" as const,
};

describe("fetchChallengeAnswer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps a full row", async () => {
    mockAdmin({
      daily_challenges: { data: { perfume_id: ANSWER_ID }, error: null },
      perfumes: {
        data: {
          base_notes: ["Vanilla"],
          brands: { name: "Chanel" },
          gender: "Feminine",
          is_linear: true,
          middle_notes: ["Rose"],
          name: "Coco",
          perfumers: ["Jacques Polge"],
          release_year: 2001,
          top_notes: ["Bergamot"],
          xsolve_score: 0.4,
        },
        error: null,
      },
    });

    await expect(fetchChallengeAnswer(CHALLENGE_ID)).resolves.toEqual({
      clue: { ...ANSWER, isLinear: true },
      perfumeId: ANSWER_ID,
      xsolve: 0.4,
    });
  });

  it("maps nulls to Unknown, 0 and empty lists", async () => {
    mockAdmin({
      daily_challenges: { data: { perfume_id: ANSWER_ID }, error: null },
      perfumes: {
        data: {
          base_notes: null,
          brands: null,
          gender: null,
          is_linear: null,
          middle_notes: null,
          name: "X",
          perfumers: null,
          release_year: null,
          top_notes: null,
          xsolve_score: null,
        },
        error: null,
      },
    });

    await expect(fetchChallengeAnswer(CHALLENGE_ID)).resolves.toEqual({
      clue: {
        brand: "Unknown",
        gender: "Unknown",
        isLinear: false,
        notes: { base: [], heart: [], top: [] },
        perfumers: [],
        year: 0,
      },
      perfumeId: ANSWER_ID,
      xsolve: null,
    });
  });

  it("returns null when the challenge is missing", async () => {
    mockAdmin({ daily_challenges: { data: null, error: null } });
    await expect(fetchChallengeAnswer(CHALLENGE_ID)).resolves.toBeNull();
  });
});

describe("enrichGuessHistory", () => {
  beforeEach(() => vi.clearAllMocks());

  const guessedRow = {
    brands: { name: "chanel" },
    concentrations: { name: "EDP" },
    gender: "feminine",
    id: GUESS_ID,
    name: "Allure",
    perfumers: ["Someone"],
    release_year: 2003,
  };

  it("keeps skips and computes feedback for legacy guesses", async () => {
    mockAdmin({ perfumes: { data: [guessedRow], error: null } });

    const result = await enrichGuessHistory(
      [
        { isCorrect: false, isSkip: true, perfumeId: null, timestamp: "t1" },
        { isCorrect: false, perfumeId: GUESS_ID, timestamp: "t2" },
      ],
      ANSWER,
    );

    expect(result[0]).toMatchObject({ feedback: emptyFeedback, isSkip: true });
    expect(result[1]).toMatchObject({
      brandName: "chanel",
      feedback: {
        brandMatch: true,
        genderMatch: true,
        notesMatch: 0,
        perfumerMatch: "none",
        yearDirection: "lower",
        yearMatch: "close",
      },
      perfumeName: "Allure",
    });
  });

  it("rejects when the guessed perfumes cannot be read", async () => {
    mockAdmin({
      perfumes: { data: null, error: { message: "connection reset" } },
    });

    await expect(
      enrichGuessHistory(
        [{ isCorrect: false, perfumeId: GUESS_ID, timestamp: "t" }],
        ANSWER,
      ),
    ).rejects.toThrow("Guess history unavailable");
  });

  it("drops a guess whose perfume row is missing without an error", async () => {
    mockAdmin({ perfumes: { data: [], error: null } });

    const result = await enrichGuessHistory(
      [{ isCorrect: false, perfumeId: GUESS_ID, timestamp: "t" }],
      ANSWER,
    );

    expect(result).toEqual([]);
  });

  it("marks a legacy correct guess as full match", async () => {
    mockAdmin({ perfumes: { data: [guessedRow], error: null } });

    const [item] = await enrichGuessHistory(
      [{ isCorrect: true, perfumeId: GUESS_ID, timestamp: "t" }],
      ANSWER,
    );

    expect(item.feedback).toMatchObject({
      notesMatch: 1,
      perfumerMatch: "full",
      yearMatch: "correct",
    });
  });

  it("adds genderMatch to stored feedback without it", async () => {
    mockAdmin({ perfumes: { data: [guessedRow], error: null } });
    const stored = {
      brandMatch: false,
      notesMatch: 0.5,
      perfumerMatch: "none" as const,
      yearDirection: "equal" as const,
      yearMatch: "wrong" as const,
    };

    const [item] = await enrichGuessHistory(
      [
        {
          feedback: stored,
          isCorrect: false,
          perfumeId: GUESS_ID,
          timestamp: "t",
        },
      ],
      ANSWER,
    );

    expect(item.feedback).toEqual({
      ...emptyFeedback,
      genderMatch: true,
      notesMatch: 0.5,
    });
  });
});

describe("buildSessionClues", () => {
  it("takes the level from attempts_count, not from the history", () => {
    const clues = buildSessionClues(
      ANSWER,
      { attempts_count: 3, status: "active" },
      [],
    );
    expect(clues.brand).toBe(revealLetters("Chanel", 0.4));
    expect(clues.brand).not.toBe("Chanel");
  });

  it("reveals everything when the game is lost", () => {
    const history: GuessHistoryItem[] = [
      {
        brandName: "",
        feedback: emptyFeedback,
        isCorrect: false,
        isSkip: true,
        perfumeId: "",
        perfumeName: "",
        timestamp: "t",
      },
    ];
    const clues = buildSessionClues(
      ANSWER,
      { attempts_count: 1, status: "lost" },
      history,
    );
    expect(clues).toMatchObject({
      brand: "Chanel",
      notes: {
        base: ["Vanilla"],
        heart: ["Rose"],
        kind: "pyramid",
        top: ["Bergamot"],
      },
      perfumer: "Jacques Polge",
      year: "2001",
    });
  });
});
