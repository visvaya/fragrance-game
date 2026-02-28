import { describe, expect, it } from "vitest";

import { maskBrand, maskYear } from "../brand-masking";

describe("maskBrand", () => {
  describe("placeholder at attempt 1", () => {
    it('shows "•••" placeholder at attempt 1', () => {
      expect(maskBrand("Chanel", 1)).toBe("•••");
      expect(maskBrand("Dior", 1)).toBe("•••");
      expect(maskBrand("Yves Saint Laurent", 1)).toBe("•••");
    });

    it('shows "•••" placeholder at attempt 0 or negative', () => {
      expect(maskBrand("Chanel", 0)).toBe("•••");
      expect(maskBrand("Dior", -1)).toBe("•••");
    });
  });

  describe("progressive reveal (attempts 2-6)", () => {
    it("shows full underscores at attempt 2 (0% reveal)", () => {
      // At 0% reveal, revealLetters returns underscores for all characters except spaces
      expect(maskBrand("Dior", 2)).toBe("⎵⎵⎵⎵");
      expect(maskBrand("Chanel", 2)).toBe("⎵⎵⎵⎵⎵⎵");
      expect(maskBrand("Tom Ford", 2)).toBe("⎵⎵⎵ ⎵⎵⎵⎵");
    });

    it("progressively reveals letters from attempt 3 (15%)", () => {
      // At 15%, some letters should be visible
      const result3 = maskBrand("Dior", 3); // 15% of 4 chars = ~1 char revealed
      expect(result3).toMatch(/[a-z]/i); // At least one letter visible
      expect(result3).toHaveLength(4);

      const result4 = maskBrand("Dior", 4); // 40% of 4 chars = ~2 chars revealed
      expect(result4).toMatch(/[a-z]/i);
      expect(result4).toHaveLength(4);

      const result5 = maskBrand("Dior", 5); // 70% of 4 chars = ~3 chars revealed
      expect(result5).toMatch(/[a-z]/i);
      expect(result5).toHaveLength(4);
    });

    it("shows full brand name at attempt 6 (100% reveal)", () => {
      expect(maskBrand("Dior", 6)).toBe("Dior");
      expect(maskBrand("Chanel", 6)).toBe("Chanel");
      expect(maskBrand("Yves Saint Laurent", 6)).toBe("Yves Saint Laurent");
    });

    it("handles attempts beyond 6 (capped at 100%)", () => {
      expect(maskBrand("Dior", 7)).toBe("Dior");
      expect(maskBrand("Chanel", 10)).toBe("Chanel");
    });
  });

  describe("multi-word brands", () => {
    it("preserves spaces in multi-word brands at attempt 2", () => {
      expect(maskBrand("Yves Saint Laurent", 2)).toBe("⎵⎵⎵⎵ ⎵⎵⎵⎵⎵ ⎵⎵⎵⎵⎵⎵⎵");
      expect(maskBrand("Jean Paul Gaultier", 2)).toBe("⎵⎵⎵⎵ ⎵⎵⎵⎵ ⎵⎵⎵⎵⎵⎵⎵⎵");
      expect(maskBrand("Tom Ford", 2)).toBe("⎵⎵⎵ ⎵⎵⎵⎵");
    });

    it("preserves spaces while revealing letters progressively", () => {
      const result3 = maskBrand("Tom Ford", 3);
      expect(result3).toMatch(/^[a-z⎵]+ [a-z⎵]+$/i); // Pattern: word space word
      expect(result3.split(" ")).toHaveLength(2);

      const result6 = maskBrand("Tom Ford", 6);
      expect(result6).toBe("Tom Ford");
    });
  });

  describe("special characters and hyphens", () => {
    it("handles brands with hyphens", () => {
      const result2 = maskBrand("Jean-Paul", 2);
      // revealLetters masks all non-space characters as underscore, including hyphens
      expect(result2).toBe("⎵⎵⎵⎵⎵⎵⎵⎵⎵"); // "Jean-Paul" = 9 chars, all masked

      const result6 = maskBrand("Jean-Paul", 6);
      expect(result6).toBe("Jean-Paul");
    });

    it("handles brands with apostrophes", () => {
      const result2 = maskBrand("L'Occitane", 2);
      expect(result2).toMatch(/^⎵+$/); // All non-space chars masked

      const result6 = maskBrand("L'Occitane", 6);
      expect(result6).toBe("L'Occitane");
    });
  });

  describe("edge cases", () => {
    it("handles empty string", () => {
      expect(maskBrand("", 1)).toBe("•••");
      expect(maskBrand("", 2)).toBe("");
      expect(maskBrand("", 6)).toBe("");
    });

    it("handles single character brand", () => {
      expect(maskBrand("X", 1)).toBe("•••");
      expect(maskBrand("X", 2)).toBe("⎵");
      expect(maskBrand("X", 6)).toBe("X");
    });

    it("handles very long brand name", () => {
      const longBrand = "Abcdefghijklmnopqrstuvwxyz";
      expect(maskBrand(longBrand, 1)).toBe("•••");
      expect(maskBrand(longBrand, 2)).toBe("⎵".repeat(26));
      expect(maskBrand(longBrand, 6)).toBe(longBrand);
    });

    it("handles brand with only spaces (edge case)", () => {
      expect(maskBrand("   ", 1)).toBe("•••");
      expect(maskBrand("   ", 2)).toBe("   "); // Spaces are always visible
      expect(maskBrand("   ", 6)).toBe("   ");
    });
  });

  describe("reveal percentages match specification", () => {
    it("uses correct reveal percentages per attempt", () => {
      // Attempt 1: •••
      expect(maskBrand("Test", 1)).toBe("•••");

      // Attempt 2: 0%
      expect(maskBrand("Test", 2)).toBe("⎵⎵⎵⎵");

      // Attempt 3: 15% (at least 1 char visible for 4-char word)
      const result3 = maskBrand("Test", 3);
      expect(result3).not.toBe("⎵⎵⎵⎵"); // Not fully masked
      expect(result3).not.toBe("Test"); // Not fully revealed

      // Attempt 4: 40% (at least 2 chars visible for 4-char word)
      const result4 = maskBrand("Test", 4);
      expect(result4).not.toBe("⎵⎵⎵⎵");
      expect(result4).not.toBe("Test");

      // Attempt 5: 70% (at least 3 chars visible for 4-char word)
      const result5 = maskBrand("Test", 5);
      expect(result5).not.toBe("⎵⎵⎵⎵");
      expect(result5).not.toBe("Test");

      // Attempt 6: 100%
      expect(maskBrand("Test", 6)).toBe("Test");
    });
  });

  describe("realistic perfume brand examples", () => {
    it("masks luxury brand names progressively", () => {
      const brands = [
        "Chanel",
        "Dior",
        "Hermès",
        "Guerlain",
        "Tom Ford",
        "Creed",
        "Amouage",
      ];

      for (const brand of brands) {
        expect(maskBrand(brand, 1)).toBe("•••");
        expect(maskBrand(brand, 2)).toMatch(/^[⎵\s]+$/); // Only underscores and spaces
        expect(maskBrand(brand, 6)).toBe(brand);
      }
    });

    it("handles niche brands with special characters", () => {
      expect(maskBrand("L'Artisan Parfumeur", 1)).toBe("•••");
      expect(maskBrand("L'Artisan Parfumeur", 6)).toBe("L'Artisan Parfumeur");

      expect(maskBrand("Maison Francis Kurkdjian", 1)).toBe("•••");
      expect(maskBrand("Maison Francis Kurkdjian", 6)).toBe(
        "Maison Francis Kurkdjian",
      );
    });
  });
});

describe("maskYear", () => {
  describe("null handling", () => {
    it("returns null for null year", () => {
      expect(maskYear(null, 1)).toBeNull();
      expect(maskYear(null, 3)).toBeNull();
      expect(maskYear(null, 6)).toBeNull();
    });
  });

  describe("digit-by-digit reveal", () => {
    it('shows "⎵⎵⎵⎵" at attempt 1', () => {
      expect(maskYear(1979, 1)).toBe("⎵⎵⎵⎵");
      expect(maskYear(2015, 1)).toBe("⎵⎵⎵⎵");
      expect(maskYear(1921, 1)).toBe("⎵⎵⎵⎵");
    });

    it("reveals first digit at attempt 2", () => {
      expect(maskYear(1979, 2)).toBe("1⎵⎵⎵");
      expect(maskYear(2015, 2)).toBe("2⎵⎵⎵");
      expect(maskYear(1921, 2)).toBe("1⎵⎵⎵");
    });

    it("reveals two digits at attempt 3", () => {
      expect(maskYear(1979, 3)).toBe("19⎵⎵");
      expect(maskYear(2015, 3)).toBe("20⎵⎵");
      expect(maskYear(1921, 3)).toBe("19⎵⎵");
    });

    it("reveals three digits at attempt 4", () => {
      expect(maskYear(1979, 4)).toBe("197⎵");
      expect(maskYear(2015, 4)).toBe("201⎵");
      expect(maskYear(1921, 4)).toBe("192⎵");
    });

    it("reveals full year at attempt 5", () => {
      expect(maskYear(1979, 5)).toBe("1979");
      expect(maskYear(2015, 5)).toBe("2015");
      expect(maskYear(1921, 5)).toBe("1921");
    });

    it("reveals full year at attempt 6 and beyond", () => {
      expect(maskYear(1979, 6)).toBe("1979");
      expect(maskYear(2015, 7)).toBe("2015");
      expect(maskYear(1921, 10)).toBe("1921");
    });
  });

  describe("edge cases", () => {
    it("handles 3-digit years (edge case, unlikely but possible)", () => {
      // Although perfumes are unlikely to have 3-digit years, test robustness
      expect(maskYear(999, 1)).toBe("⎵⎵⎵⎵");
      expect(maskYear(999, 2)).toBe("9⎵⎵⎵");
      expect(maskYear(999, 3)).toBe("99⎵⎵");
      expect(maskYear(999, 4)).toBe("999⎵");
      expect(maskYear(999, 5)).toBe("999");
    });

    it("handles 5-digit years (edge case, unlikely)", () => {
      expect(maskYear(12_345, 1)).toBe("⎵⎵⎵⎵");
      expect(maskYear(12_345, 2)).toBe("1⎵⎵⎵");
      expect(maskYear(12_345, 3)).toBe("12⎵⎵");
      expect(maskYear(12_345, 4)).toBe("123⎵");
      expect(maskYear(12_345, 5)).toBe("12345");
    });

    it("handles attempt 0 or negative (shows full mask)", () => {
      expect(maskYear(1979, 0)).toBe("⎵⎵⎵⎵");
      expect(maskYear(2015, -1)).toBe("⎵⎵⎵⎵");
    });
  });

  describe("realistic perfume year examples", () => {
    it("masks classic perfume years (1900s)", () => {
      const classicYears = [
        { name: "Chanel No. 5", year: 1921 },
        { name: "Shalimar", year: 1925 },
        { name: "Miss Dior", year: 1947 },
        { name: "Eau Sauvage", year: 1966 },
      ];

      for (const { year } of classicYears) {
        expect(maskYear(year, 1)).toBe("⎵⎵⎵⎵");
        expect(maskYear(year, 2)).toBe("1⎵⎵⎵");
        expect(maskYear(year, 3)).toBe("19⎵⎵");
        expect(maskYear(year, 5)).toBe(year.toString());
      }
    });

    it("masks modern perfume years (2000s)", () => {
      const modernYears = [
        { name: "La Vie Est Belle", year: 2010 },
        { name: "Sauvage", year: 2015 },
        { name: "Contemporary Release", year: 2021 },
      ];

      for (const { year } of modernYears) {
        expect(maskYear(year, 1)).toBe("⎵⎵⎵⎵");
        expect(maskYear(year, 2)).toBe("2⎵⎵⎵");
        expect(maskYear(year, 3)).toBe("20⎵⎵");
        expect(maskYear(year, 5)).toBe(year.toString());
      }
    });
  });

  describe("consistency between attempts", () => {
    it("never reveals fewer digits on later attempts", () => {
      const year = 1979;

      const mask1 = maskYear(year, 1);
      const mask2 = maskYear(year, 2);
      const mask3 = maskYear(year, 3);
      const mask4 = maskYear(year, 4);
      const mask5 = maskYear(year, 5);

      // Count visible digits (non-underscore characters)
      const countDigits = (string_: string) =>
        string_.split("").filter((c) => c !== "⎵").length;

      expect(countDigits(mask1!)).toBeLessThanOrEqual(countDigits(mask2!));
      expect(countDigits(mask2!)).toBeLessThanOrEqual(countDigits(mask3!));
      expect(countDigits(mask3!)).toBeLessThanOrEqual(countDigits(mask4!));
      expect(countDigits(mask4!)).toBeLessThanOrEqual(countDigits(mask5!));
    });

    it("preserves revealed digits from previous attempts", () => {
      const year = 1979;

      // Digit revealed at attempt 2 should still be there at attempt 3
      const mask2 = maskYear(year, 2); // "1⎵⎵⎵"
      const mask3 = maskYear(year, 3); // "19⎵⎵"

      expect(mask3?.startsWith("1")).toBe(true);
      expect(mask3?.startsWith(mask2![0])).toBe(true); // First char preserved
    });
  });
});
