import { describe, it, expect } from "vitest";

import {
  calculateBaseScore,
  calculateFinalScore,
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
  describe("revealLetters", () => {
    it("should hide all letters at 0%", () => {
      expect(revealLetters("Dior", 0)).toBe("⎵⎵⎵⎵");
    });

    it("should show all letters at 100%", () => {
      expect(revealLetters("Dior", 100)).toBe("Dior");
    });

    it("should reveal center letter first (15-25%)", () => {
      expect(revealLetters("Dior", 25)).toBe("⎵⎵o⎵");
    });

    it("should reveal center outward correctly", () => {
      // "Chanel" -> 6 chars. Sub-range indices [1,2,3,4,5]. Center 3 ('n').

      // 17% (1 char) -> Center 'n'
      // 17% of 6 is 1.02. Math.ceil would be 2. Math.round is 1. Max(1, round) is 1.
      const res1 = revealLetters("Chanel", 17);
      expect(res1).toBe("⎵⎵⎵n⎵⎵");

      // 34% (2.04 -> 2 chars with round)
      // Order: n(3), a(2), e(4)...
      const res2 = revealLetters("Chanel", 34);
      expect(res2).toBe("⎵⎵an⎵⎵");

      // 50% (3 letters)
      // Order: 3, 2, 4.
      const res3 = revealLetters("Chanel", 50);
      expect(res3).toBe("⎵⎵ane⎵");

      // 70% (4.2 -> 4 letters)
      // Order: 3, 2, 4, 1.
      const res4 = revealLetters("Chanel", 70);
      expect(res4).toBe("⎵hane⎵");
    });

    it("should always show separators", () => {
      expect(revealLetters("Yves Saint Laurent", 0)).toBe("⎵⎵⎵⎵ ⎵⎵⎵⎵⎵ ⎵⎵⎵⎵⎵⎵⎵");
    });
  });
});
