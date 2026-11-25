import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(),
}));

import {
  enrichGuessHistory,
  fetchAnswerLabel,
  fetchChallengeAnswer,
} from "@/lib/game/challenge-answer";
import { createAdminClient } from "@/lib/supabase/server";

import type { ClueAnswer } from "@/lib/game/clue-reveal";

/** Thenable chain that resolves when awaited or when .single() is called. */
function makeChain(value: unknown) {
  const p = Promise.resolve(value);
  const chain: Record<string, unknown> = {};
  chain["select"] = vi.fn().mockReturnValue(chain);
  chain["eq"] = vi.fn().mockReturnValue(chain);
  chain["in"] = vi.fn().mockReturnValue(chain);
  chain["limit"] = vi.fn().mockReturnValue(chain);
  chain["single"] = vi.fn().mockResolvedValue(value);
  chain["maybeSingle"] = vi.fn().mockResolvedValue(value);
  // eslint-disable-next-line unicorn/no-thenable -- necessary for Supabase chain mocking
  chain["then"] = p.then.bind(p);
  chain["catch"] = p.catch.bind(p);
  chain["finally"] = p.finally.bind(p);
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

describe("fetchAnswerLabel", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ["an object", { name: "EDP" }],
    ["a list", [{ name: "EDP" }]],
  ])("reads the concentration name from %s", async (_label, concentrations) => {
    mockAdmin({
      perfumes: { data: { concentrations, name: "Coco" }, error: null },
    });

    expect(await fetchAnswerLabel(ANSWER_ID)).toEqual({
      answerConcentration: "EDP",
      answerName: "Coco",
    });
  });

  it("returns undefined fields when the perfume is missing", async () => {
    mockAdmin({ perfumes: { data: null, error: null } });

    expect(await fetchAnswerLabel(ANSWER_ID)).toEqual({
      answerConcentration: undefined,
      answerName: undefined,
    });
  });
});

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
        },
        error: null,
      },
    });

    await expect(fetchChallengeAnswer(CHALLENGE_ID)).resolves.toEqual({
      clue: { ...ANSWER, isLinear: true },
      perfumeId: ANSWER_ID,
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
});
