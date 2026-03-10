/* eslint-disable better-tailwindcss/no-unknown-classes -- test data values (foo, bar, baz) */
import { describe, expect, it } from "vitest";

import { cn, normalizeText } from "../utils";

describe("cn", () => {
  it("merges class names correctly", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    const isActive = false as boolean;
    expect(cn("foo", isActive && "bar", "baz")).toBe("foo baz");
  });

  it("merges Tailwind classes correctly (deduplicates)", () => {
    // tailwind-merge should keep the last declaration
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("handles arrays of classes", () => {
    expect(cn(["foo", "bar"], "baz")).toBe("foo bar baz");
  });

  it("handles empty inputs", () => {
    expect(cn()).toBe("");
    expect(cn("")).toBe("");
    expect(cn(null, undefined, false)).toBe("");
  });

  it("handles objects with boolean values", () => {
    expect(cn({ bar: false, baz: true, foo: true })).toBe("baz foo");
  });
});

describe("normalizeText", () => {
  describe("Polish diacritics", () => {
    it("removes Polish accented characters", () => {
      expect(normalizeText("Żółć")).toBe("zolc");
      expect(normalizeText("ŻÓŁĆ")).toBe("zolc");
    });

    it("removes ł (Polish l-stroke)", () => {
      expect(normalizeText("Łódź")).toBe("lodz");
      expect(normalizeText("ŁÓDŹ")).toBe("lodz");
    });

    it("removes ą and ę", () => {
      expect(normalizeText("pączek")).toBe("paczek");
      expect(normalizeText("gęsty")).toBe("gesty");
    });

    it("removes ń, ś, ź", () => {
      expect(normalizeText("końcówka")).toBe("koncowka");
      expect(normalizeText("ścieżka")).toBe("sciezka");
      expect(normalizeText("źródło")).toBe("zrodlo");
    });
  });

  describe("French diacritics", () => {
    it("removes acute accents (é)", () => {
      expect(normalizeText("Château")).toBe("chateau");
      expect(normalizeText("Crème")).toBe("creme");
      expect(normalizeText("café")).toBe("cafe");
    });

    it("removes grave accents (è, à)", () => {
      expect(normalizeText("très")).toBe("tres");
      expect(normalizeText("là")).toBe("la");
    });

    it("removes circumflex accents (ê, â, î, ô, û)", () => {
      expect(normalizeText("forêt")).toBe("foret");
      expect(normalizeText("pâte")).toBe("pate");
      expect(normalizeText("île")).toBe("ile");
      expect(normalizeText("côte")).toBe("cote");
    });

    it("removes cedilla (ç)", () => {
      expect(normalizeText("François")).toBe("francois");
      expect(normalizeText("Garçon")).toBe("garcon");
    });

    it("removes diaeresis (ë, ï, ü)", () => {
      expect(normalizeText("Noël")).toBe("noel");
      expect(normalizeText("naïf")).toBe("naif");
    });
  });

  describe("German and Scandinavian diacritics", () => {
    it("converts ß to ss", () => {
      expect(normalizeText("Straße")).toBe("strasse");
      expect(normalizeText("groß")).toBe("gross");
    });

    it("removes umlauts (ä, ö, ü)", () => {
      expect(normalizeText("Köln")).toBe("koln");
      expect(normalizeText("Müller")).toBe("muller");
      expect(normalizeText("Bär")).toBe("bar");
    });

    it("converts ø to o (Scandinavian)", () => {
      expect(normalizeText("København")).toBe("kobenhavn");
      expect(normalizeText("Røros")).toBe("roros");
    });
  });

  describe("Special ligatures", () => {
    it("converts æ to ae", () => {
      expect(normalizeText("Æther")).toBe("aether");
      expect(normalizeText("Cæsar")).toBe("caesar");
    });

    it("converts œ to oe", () => {
      expect(normalizeText("Œuvre")).toBe("oeuvre");
      expect(normalizeText("Cœur")).toBe("coeur");
    });
  });

  describe("Case conversion", () => {
    it("converts to lowercase", () => {
      expect(normalizeText("DIOR")).toBe("dior");
      expect(normalizeText("Chanel")).toBe("chanel");
      expect(normalizeText("YSL")).toBe("ysl");
    });
  });

  describe("Combined cases (realistic perfume names)", () => {
    it("normalizes complex French perfume brands", () => {
      expect(normalizeText("Yves Saint Laurent")).toBe("yves saint laurent");
      expect(normalizeText("Frédéric Malle")).toBe("frederic malle");
      expect(normalizeText("Serge Lutens")).toBe("serge lutens");
    });

    it("normalizes perfume names with accents", () => {
      expect(normalizeText("L'Eau d'Issey")).toBe("l'eau d'issey");
      expect(normalizeText("Néroli Portofino")).toBe("neroli portofino");
    });

    it("normalizes Polish brand names (edge case)", () => {
      expect(normalizeText("Świeże Perfumy")).toBe("swieze perfumy");
    });

    it("handles mixed languages", () => {
      expect(normalizeText("Café Süße Früchte")).toBe("cafe susse fruchte");
    });
  });

  describe("Edge cases", () => {
    it("handles empty string", () => {
      expect(normalizeText("")).toBe("");
    });

    it("handles string with only spaces", () => {
      expect(normalizeText("   ")).toBe("   ");
    });

    it("preserves spaces and hyphens", () => {
      expect(normalizeText("Jean-Paul Gaultier")).toBe("jean-paul gaultier");
      expect(normalizeText("Tom Ford Noir")).toBe("tom ford noir");
    });

    it("handles numbers", () => {
      expect(normalizeText("Chanel No. 5")).toBe("chanel no. 5");
      expect(normalizeText("1881 Pour Homme")).toBe("1881 pour homme");
    });

    it("handles apostrophes and punctuation", () => {
      expect(normalizeText("L'Homme")).toBe("l'homme");
      expect(normalizeText("Cool Water Wave")).toBe("cool water wave");
    });

    it("handles already normalized text (idempotent)", () => {
      const text = "chanel no 5";
      expect(normalizeText(normalizeText(text))).toBe(text);
    });
  });

  describe("Unicode normalization (NFD)", () => {
    it("normalizes composed characters to decomposed", () => {
      // é can be represented as single character (U+00E9) or as e + combining acute (U+0065 U+0301)
      const composed = "\u00E9"; // é (single character)
      const decomposed = "e\u0301"; // e + combining acute
      expect(normalizeText(composed)).toBe("e");
      expect(normalizeText(decomposed)).toBe("e");
    });

    it("handles various Unicode normalization forms consistently", () => {
      const text1 = "café"; // composed form
      const text2 = "cafe\u0301"; // decomposed form (e + combining acute)
      expect(normalizeText(text1)).toBe(normalizeText(text2));
    });
  });
});
