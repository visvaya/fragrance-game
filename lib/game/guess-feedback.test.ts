import { describe, expect, it } from "vitest";

import {
  calculateFeedback,
  calculateNotesMatch,
  calculatePerfumerMatch,
  cleanNote,
  getYearDirection,
  getYearMatch,
  type PerfumeForFeedback,
} from "@/lib/game/guess-feedback";

const NO_NOTES = { base: [], heart: [], top: [] };

const perfume = (
  overrides: Partial<PerfumeForFeedback> = {},
): PerfumeForFeedback => ({
  base_notes: ["Vanilla"],
  brand_id: "brand-a",
  gender: "Male",
  middle_notes: ["Rose"],
  perfumers: ["Jacques Cavallier"],
  release_year: 2010,
  top_notes: ["Bergamot"],
  ...overrides,
});

describe("cleanNote", () => {
  it("drops trademark signs, material qualifiers, remarks and case", () => {
    expect(cleanNote("  Ambroxan™ ")).toBe("ambroxan");
    expect(cleanNote("Jasmine Absolute")).toBe("jasmine");
    expect(cleanNote("Vanilla CO2 (Madagascar)")).toBe("vanilla");
    expect(cleanNote("Vetiver La Réunion")).toBe("vetiver");
    expect(cleanNote("Rose Otto,")).toBe("rose");
  });

  it("keeps a qualifier that is part of a longer word", () => {
    expect(cleanNote("Ottoman Spice")).toBe("ottoman spice");
  });

  it("returns an empty string for a missing note", () => {
    expect(cleanNote(null)).toBe("");
    expect(cleanNote(undefined)).toBe("");
  });
});

describe("calculateNotesMatch", () => {
  it("is the Jaccard similarity over all pyramid levels together", () => {
    const guess = { base: ["Musk"], heart: ["Rose"], top: ["Bergamot"] };
    const answer = { base: ["Rose"], heart: ["Iris"], top: ["Bergamot"] };
    // shared: bergamot, rose; union: bergamot, rose, musk, iris
    expect(calculateNotesMatch(guess, answer)).toBe(0.5);
  });

  it("compares the cleaned names", () => {
    expect(
      calculateNotesMatch(
        { ...NO_NOTES, top: ["Jasmine Absolute"] },
        { ...NO_NOTES, base: ["jasmine"] },
      ),
    ).toBe(1);
  });

  it("is 0 when neither perfume has notes", () => {
    expect(calculateNotesMatch(NO_NOTES, NO_NOTES)).toBe(0);
  });
});

describe("calculatePerfumerMatch", () => {
  it("is full for the same perfumers in any case and order", () => {
    expect(calculatePerfumerMatch(["B", " a "], ["a", "b"])).toBe("full");
  });

  it("is partial when some perfumers are shared", () => {
    expect(calculatePerfumerMatch(["A"], ["A", "B"])).toBe("partial");
    expect(calculatePerfumerMatch(["A", "C"], ["A"])).toBe("partial");
  });

  it("is none without a shared perfumer or without data", () => {
    expect(calculatePerfumerMatch(["A"], ["B"])).toBe("none");
    expect(calculatePerfumerMatch(null, ["A"])).toBe("none");
    expect(calculatePerfumerMatch(["", null], ["A"])).toBe("none");
  });
});

describe("year feedback", () => {
  it("is correct for the same year and close within three years", () => {
    expect(getYearMatch(0)).toBe("correct");
    expect(getYearMatch(3)).toBe("close");
    expect(getYearMatch(-3)).toBe("close");
    expect(getYearMatch(4)).toBe("wrong");
    expect(getYearMatch(-4)).toBe("wrong");
  });

  it("points from the guess towards the answer", () => {
    expect(getYearDirection(2)).toBe("lower");
    expect(getYearDirection(-2)).toBe("higher");
    expect(getYearDirection(0)).toBe("equal");
  });
});

describe("calculateFeedback", () => {
  it("compares every clue of the guess with the answer", () => {
    const answer = perfume();
    const guess = perfume({
      brand_id: "brand-b",
      gender: "Female",
      middle_notes: ["Iris"],
      perfumers: ["Jacques Cavallier", "Other"],
      release_year: 2012,
    });
    expect(calculateFeedback(guess, answer)).toEqual({
      brandMatch: false,
      genderMatch: false,
      notesMatch: 0.5,
      perfumerMatch: "partial",
      yearDirection: "lower",
      yearMatch: "close",
    });
  });

  it("matches everything for the answer itself", () => {
    const answer = perfume();
    expect(calculateFeedback(answer, answer)).toEqual({
      brandMatch: true,
      genderMatch: true,
      notesMatch: 1,
      perfumerMatch: "full",
      yearDirection: "equal",
      yearMatch: "correct",
    });
  });

  it("counts a missing release year as 0", () => {
    const feedback = calculateFeedback(
      perfume({ release_year: 2010 }),
      perfume({ release_year: null }),
    );
    expect(feedback.yearMatch).toBe("wrong");
    expect(feedback.yearDirection).toBe("lower");
  });
});
