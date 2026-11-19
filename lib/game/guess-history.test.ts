import { describe, expect, it } from "vitest";

import {
  buildGuessHistory,
  buildSessionClues,
  guessedPerfumeIds,
  skipHistoryItem,
  toClueAnswer,
  type GuessedPerfumeRow,
  type GuessHistoryItem,
  type StoredGuess,
} from "@/lib/game/guess-history";
import { revealLetters } from "@/lib/game/scoring";

import type { ClueAnswer } from "@/lib/game/clue-reveal";

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

const guessedRow: GuessedPerfumeRow = {
  brands: { name: "chanel" },
  concentrations: { name: "EDP" },
  gender: "feminine",
  id: GUESS_ID,
  name: "Allure",
  perfumers: ["Someone"],
  release_year: 2003,
};

const PERFUMES = new Map([[GUESS_ID, guessedRow]]);

const guess = (overrides: Partial<StoredGuess> = {}): StoredGuess => ({
  isCorrect: false,
  perfumeId: GUESS_ID,
  timestamp: "t",
  ...overrides,
});

describe("guessedPerfumeIds", () => {
  it("lists the perfumes of guesses, without skips", () => {
    expect(
      guessedPerfumeIds([
        guess({ isSkip: true, perfumeId: null }),
        guess(),
        guess({ perfumeId: null }),
      ]),
    ).toEqual([GUESS_ID]);
  });
});

describe("buildGuessHistory", () => {
  it("keeps skips and recomputes feedback for guesses stored without it", () => {
    const history = buildGuessHistory(
      [guess({ isSkip: true, perfumeId: null, timestamp: "t1" }), guess()],
      PERFUMES,
      ANSWER,
    );
    expect(history[0]).toEqual(skipHistoryItem("t1"));
    expect(history[1]).toEqual({
      brandName: "chanel",
      concentration: "EDP",
      feedback: {
        brandMatch: true,
        genderMatch: true,
        notesMatch: 0,
        perfumerMatch: "none",
        yearDirection: "lower",
        yearMatch: "close",
      },
      gender: "feminine",
      isCorrect: false,
      perfumeId: GUESS_ID,
      perfumeName: "Allure",
      perfumers: ["Someone"],
      timestamp: "t",
      year: 2003,
    });
  });

  it("marks a correct guess stored without feedback as a full match", () => {
    const [item] = buildGuessHistory(
      [guess({ isCorrect: true })],
      PERFUMES,
      ANSWER,
    );
    expect(item.feedback).toMatchObject({
      notesMatch: 1,
      perfumerMatch: "full",
      yearMatch: "correct",
    });
  });

  it("keeps stored feedback and adds a missing genderMatch", () => {
    const stored = {
      brandMatch: false,
      notesMatch: 0.5,
      perfumerMatch: "none" as const,
      yearDirection: "equal" as const,
      yearMatch: "wrong" as const,
    };
    const [item] = buildGuessHistory(
      [guess({ feedback: stored })],
      PERFUMES,
      ANSWER,
    );
    expect(item.feedback).toEqual({
      ...emptyFeedback,
      genderMatch: true,
      notesMatch: 0.5,
    });
  });

  it("drops a guess whose perfume row is missing", () => {
    expect(buildGuessHistory([guess()], new Map(), ANSWER)).toEqual([]);
  });
});

describe("toClueAnswer", () => {
  it("falls back to Unknown, 0 and empty lists", () => {
    expect(
      toClueAnswer({
        base_notes: null,
        middle_notes: null,
        perfumers: null,
        release_year: null,
        top_notes: null,
      }),
    ).toEqual({
      brand: "Unknown",
      gender: "Unknown",
      isLinear: false,
      notes: { base: [], heart: [], top: [] },
      perfumers: [],
      year: 0,
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
    const history: GuessHistoryItem[] = [skipHistoryItem("t")];
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
