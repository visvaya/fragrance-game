import { describe, it, expect } from "vitest";

import {
  calculateBaseScore,
  calculateFinalScore,
  getRevealPercentages,
  revealLetters,
} from "@/lib/game/scoring";

describe("Scoring Logic", () => {
  describe("calculateBaseScore", () => {
    it("should return correct scores for attempts 1-6", () => {
      expect(calculateBaseScore(1)).toBe(1000);
      expect(calculateBaseScore(2)).toBe(700);
      expect(calculateBaseScore(3)).toBe(490);
      expect(calculateBaseScore(4)).toBe(343);
      expect(calculateBaseScore(5)).toBe(240);
      expect(calculateBaseScore(6)).toBe(168);
    });

    it("should return 1000 for attempt < 1 (defensive)", () => {
      expect(calculateBaseScore(0)).toBe(1000);
    });

    it("should return 0 for attempt > 6 (defensive)", () => {
      expect(calculateBaseScore(7)).toBe(0);
    });
  });

  describe("calculateFinalScore", () => {
    it("should apply xSolve bonus correctly", () => {
      // base 1000, xsolve 1.0 -> 1000 * (1 + 0.3) = 1300
      expect(calculateFinalScore(1000, 1)).toBe(1300);
      expect(calculateFinalScore(1000, 0.5)).toBe(1150);
      expect(calculateFinalScore(1000, 0)).toBe(1000);
    });

    it("should round correctly", () => {
      expect(calculateFinalScore(700, 1)).toBe(910);
      expect(calculateFinalScore(343, 1)).toBe(446);
    });
  });
});

describe("Reveal Logic", () => {
  describe("getRevealPercentages", () => {
    it("should return correct reveal percentages for each attempt", () => {
      // Attempt 1
      expect(getRevealPercentages(1)).toEqual({
        blur: 10,
        brandLetters: 0,
        grain: 3,
        notes: 0,
        perfumerLetters: 0,
        radialMask: 0,
        showGender: false,
        yearMask: "____",
      });
      // Attempt 2
      expect(getRevealPercentages(2)).toEqual({
        blur: 9.5,
        brandLetters: 0,
        grain: 2.5,
        notes: 0,
        perfumerLetters: 0,
        radialMask: 5,
        showGender: false,
        yearMask: "1___",
      });
      // Attempt 3
      expect(getRevealPercentages(3)).toEqual({
        blur: 8.5,
        brandLetters: 15,
        grain: 2,
        notes: 1,
        perfumerLetters: 10,
        radialMask: 8,
        showGender: false,
        yearMask: "19__",
      });
      // Attempt 4
      expect(getRevealPercentages(4)).toEqual({
        blur: 7.5,
        brandLetters: 40,
        grain: 1.8,
        notes: 2,
        perfumerLetters: 30,
        radialMask: 11,
        showGender: false,
        yearMask: "197_",
      });
      // Attempt 5
      expect(getRevealPercentages(5)).toEqual({
        blur: 6,
        brandLetters: 70,
        grain: 1.5,
        notes: 3,
        perfumerLetters: 60,
        radialMask: 13,
        showGender: true,
        yearMask: "FULL",
      });
      // Attempt 6
      expect(getRevealPercentages(6)).toEqual({
        blur: 0,
        brandLetters: 100,
        grain: 0,
        notes: 3,
        perfumerLetters: 100,
        radialMask: 100,
        showGender: true,
        yearMask: "FULL",
      });
    });
  });

  describe("revealLetters", () => {
    it("should hide all letters at 0%", () => {
      expect(revealLetters("Dior", 0)).toBe("____");
    });

    it("should show all letters at 100%", () => {
      expect(revealLetters("Dior", 100)).toBe("Dior");
    });

    it("should reveal center letter first (15-25%)", () => {
      expect(revealLetters("Dior", 25)).toBe("__o_");
    });

    it("should reveal center outward correctly", () => {
      // "Chanel" -> 6 chars. Sub-range indices [1,2,3,4,5]. Center 3 ('n').

      // 17% (1 char) -> Center 'n'
      // 17% of 6 is 1.02. Math.ceil would be 2. Math.round is 1. Max(1, round) is 1.
      const res1 = revealLetters("Chanel", 17);
      expect(res1).toBe("___n__");

      // 34% (2.04 -> 2 chars with round)
      // Order: n(3), a(2), e(4)...
      const res2 = revealLetters("Chanel", 34);
      expect(res2).toBe("__an__");

      // 50% (3 letters)
      // Order: 3, 2, 4.
      const res3 = revealLetters("Chanel", 50);
      expect(res3).toBe("__ane_");

      // 70% (4.2 -> 4 letters)
      // Order: 3, 2, 4, 1.
      const res4 = revealLetters("Chanel", 70);
      expect(res4).toBe("_hane_");
    });

    it("should always show separators", () => {
      expect(revealLetters("Yves Saint Laurent", 0)).toBe("____ _____ _______");
    });
  });
});
