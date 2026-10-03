import { describe, expect, it } from "vitest";

import { MASK_CHAR } from "@/lib/constants";

import {
  buildRevealedClues,
  HIDDEN_CLUES,
  isGenderMatch,
  type ClueAnswer,
  type ClueGuess,
} from "./clue-reveal";

const ANSWER: ClueAnswer = {
  brand: "Chanel",
  gender: "Feminine",
  isLinear: false,
  notes: { base: ["Vanilla"], heart: ["Rose"], top: ["Bergamot"] },
  perfumers: ["Jacques Polge", "Olivier Polge"],
  year: 1987,
};

const MISS: ClueGuess = {
  brandMatch: false,
  genderMatch: false,
  guessedPerfumers: [],
  notesMatch: 0,
  perfumerMatch: "none",
  yearMatch: "wrong",
};

const at = (
  revealLevel: number,
  guesses: ClueGuess[] = [],
  isGameOver = false,
) => buildRevealedClues(ANSWER, { guesses, isGameOver, revealLevel });

describe("buildRevealedClues", () => {
  it("hides everything at level 1", () => {
    const c = at(1);
    expect(c.brand).toBe("?????");
    expect(c.perfumer).toBe("?????");
    expect(c.year).toBe(MASK_CHAR.repeat(4));
    expect(c.gender).toBeNull();
    expect(c.notes).toEqual({
      base: ["?????", "?????", "?????"],
      heart: ["?????", "?????", "?????"],
      kind: "pyramid",
      top: ["?????", "?????", "?????"],
    });
    expect(c.brandRevealed).toBe(false);
    expect(c.yearRevealed).toBe(false);
    expect(c.perfumerCount).toBe(2);
    expect(JSON.stringify(c)).not.toMatch(
      /Chanel|Polge|1987|Vanilla|Rose|Bergamot|Feminine/,
    );
  });

  it("follows the per-level year and brand masks", () => {
    expect(at(2).year).toBe(`1${MASK_CHAR.repeat(3)}`);
    expect(at(3).year).toBe(`19${MASK_CHAR.repeat(2)}`);
    expect(at(4).year).toBe(`198${MASK_CHAR}`);
    expect(at(5).year).toBe("1987");
    expect(at(2).brand).toBe(MASK_CHAR.repeat(6));
    expect(at(6).brand).toBe("Chanel");
    expect(at(6).brandRevealed).toBe(true);
  });

  it("reveals notes tier by tier and masks hidden tiers", () => {
    const l3 = at(3).notes;
    expect(l3).toEqual({
      base: [MASK_CHAR.repeat(7)],
      heart: [MASK_CHAR.repeat(4)],
      kind: "pyramid",
      top: ["Bergamot"],
    });
    expect(at(5).notes).toEqual({ ...ANSWER.notes, kind: "pyramid" });
  });

  it("reveals matched clues regardless of level", () => {
    const hit: ClueGuess = {
      ...MISS,
      brandMatch: true,
      genderMatch: true,
      notesMatch: 1,
      perfumerMatch: "full",
      yearMatch: "correct",
    };
    const c = at(2, [hit]);
    expect(c.brand).toBe("Chanel");
    expect(c.perfumer).toBe("Jacques Polge, Olivier Polge");
    expect(c.year).toBe("1987");
    expect(c.gender).toBe("Feminine");
    expect(c.genderRevealed).toBe(true);
    expect(c.notes).toEqual({ ...ANSWER.notes, kind: "pyramid" });
  });

  it("reveals only the perfumers a partial match found, in original casing", () => {
    const partial: ClueGuess = {
      ...MISS,
      guessedPerfumers: ["olivier polge ", "Someone Else"],
      perfumerMatch: "partial",
    };
    const c = at(2, [partial]);
    expect(c.perfumer.split(", ")[1]).toBe("Olivier Polge");
    expect(c.perfumer).not.toContain("Jacques");
  });

  it("reveals everything when the game is over", () => {
    const c = at(1, [], true);
    expect(c.brand).toBe("Chanel");
    expect(c.gender).toBe("Feminine");
    expect(c.year).toBe("1987");
  });

  it("shows gender from level 5", () => {
    expect(at(4).gender).toBeNull();
    expect(at(5).gender).toBe("Feminine");
  });

  it("handles an answer with every field missing", () => {
    const empty: ClueAnswer = {
      brand: "Unknown",
      gender: "Unknown",
      isLinear: false,
      notes: { base: [], heart: [], top: [] },
      perfumers: [],
      year: 0,
    };
    for (const level of [1, 3, 6]) {
      const c = buildRevealedClues(empty, {
        guesses: [],
        isGameOver: false,
        revealLevel: level,
      });
      expect(c.brand).toBe("Unknown");
      expect(c.perfumer).toBe("Unknown");
      expect(c.year).toBe("Unknown");
      expect(c.gender).toBe("Unknown");
      expect(c.answerHas).toEqual({
        brand: false,
        gender: false,
        notes: false,
        perfumer: false,
        year: false,
      });
    }
  });

  it("masks multi-word and accented names per word", () => {
    const c = buildRevealedClues(
      { ...ANSWER, brand: "Maison Francis Kurkdjian" },
      { guesses: [], isGameOver: false, revealLevel: 2 },
    );
    expect(c.brand).toBe(
      `${MASK_CHAR.repeat(6)} ${MASK_CHAR.repeat(7)} ${MASK_CHAR.repeat(9)}`,
    );
  });

  describe("linear perfumes", () => {
    const linear: ClueAnswer = {
      ...ANSWER,
      isLinear: true,
      notes: { base: ["Musk"], heart: ["Pétales de rose"], top: ["Iris"] },
    };
    const lin = (revealLevel: number, guesses: ClueGuess[] = []) =>
      buildRevealedClues(linear, { guesses, isGameOver: false, revealLevel });

    it("uses placeholders at level 1 and masks every letter at level 2", () => {
      expect(lin(1).notes).toEqual({
        kind: "linear",
        notes: ["?????", "?????", "?????"],
      });
      const l2 = lin(2).notes;
      expect(l2.kind).toBe("linear");
      const l2Notes = l2.kind === "linear" ? l2.notes : [];
      expect(l2Notes).toHaveLength(3);
      expect(l2Notes.join("")).not.toMatch(/[\p{L}\p{N}]/u);
      expect(l2Notes[1]).toBe(
        `${MASK_CHAR.repeat(7)} ${MASK_CHAR.repeat(2)} ${MASK_CHAR.repeat(4)}`,
      );
    });

    it("masks decomposed letters and combining marks at level 2", () => {
      const decomposed = buildRevealedClues(
        { ...linear, notes: { base: [], heart: ["Pe\u0301tales"], top: [] } },
        { guesses: [], isGameOver: false, revealLevel: 2 },
      ).notes;
      const masked = decomposed.kind === "linear" ? decomposed.notes : [];
      expect(masked.join("")).not.toMatch(/[\p{L}\p{M}\p{N}]/u);
      expect(masked).toEqual([MASK_CHAR.repeat(7)]);
    });

    it("reveals notes from the end: a third at level 3, two thirds at level 4", () => {
      const l3 = lin(3).notes;
      const l4 = lin(4).notes;
      if (l3.kind !== "linear" || l4.kind !== "linear")
        throw new Error("expected linear");
      expect(l3.notes[2]).toBe("Musk");
      expect(l3.notes[1]).not.toContain("P");
      expect(l4.notes.slice(1)).toEqual(["Pétales de rose", "Musk"]);
      expect(lin(5).notes).toEqual({
        kind: "linear",
        notes: ["Iris", "Pétales de rose", "Musk"],
      });
    });

    it("reveals all notes after a perfect notes match", () => {
      expect(lin(2, [{ ...MISS, notesMatch: 1 }]).notes).toEqual({
        kind: "linear",
        notes: ["Iris", "Pétales de rose", "Musk"],
      });
    });
  });
});

describe("isGenderMatch", () => {
  it("compares case-insensitively and never matches unknown values", () => {
    expect(isGenderMatch("Unisex", "unisex")).toBe(true);
    expect(isGenderMatch("Unknown", "Unknown")).toBe(false);
    expect(isGenderMatch(null, "Feminine")).toBe(false);
    expect(isGenderMatch("Masculine", "Feminine")).toBe(false);
  });
});

describe("HIDDEN_CLUES", () => {
  it("matches the level-1 placeholders", () => {
    expect(HIDDEN_CLUES.brand).toBe("?????");
    expect(HIDDEN_CLUES.gender).toBeNull();
  });
});
