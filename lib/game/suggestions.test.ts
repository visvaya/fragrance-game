import { describe, expect, it } from "vitest";

import {
  type FragranceRow,
  rankSuggestions,
  relevanceScore,
  remaskSuggestions,
  selectSuggestions,
  toSuggestions,
} from "@/lib/game/suggestions";
import { maskYear } from "@/lib/utils/brand-masking";

const row = (overrides: Partial<FragranceRow> = {}): FragranceRow => ({
  brand_name: "Dior",
  concentration: "EDT",
  id: "p1",
  name: "Sauvage",
  year: 2015,
  ...overrides,
});

const rows = (count: number, make: (index: number) => Partial<FragranceRow>) =>
  Array.from({ length: count }, (_, index) =>
    row({ id: `p${index}`, ...make(index) }),
  );

describe("relevanceScore", () => {
  const [suggestion] = toSuggestions([row({ brand_name: "Tom Ford" })], 5);

  it("ranks exact, prefix, whole word, brand substring and name substring", () => {
    expect(relevanceScore(suggestion, "tom ford")).toBe(4);
    expect(relevanceScore(suggestion, "sauvage")).toBe(4);
    expect(relevanceScore(suggestion, "tom")).toBe(3);
    expect(relevanceScore(suggestion, "ford")).toBe(3);
    expect(relevanceScore(suggestion, "om fo")).toBe(2);
    expect(relevanceScore(suggestion, "auva")).toBe(1);
    expect(relevanceScore(suggestion, "laurent")).toBe(0);
  });
});

describe("toSuggestions", () => {
  it("masks the year by attempt and builds the display name", () => {
    const [suggestion] = toSuggestions([row()], 2);
    expect(suggestion).toEqual({
      brand_masked: "Dior",
      brand_norm: "dior",
      concentration: "EDT",
      display_name: `Dior - Sauvage EDT (${maskYear(2015, 2)})`,
      name: "Sauvage",
      name_norm: "sauvage",
      perfume_id: "p1",
      raw_year: 2015,
      year: maskYear(2015, 2),
    });
  });

  it("shows the plain year of variants that differ only by year", () => {
    const suggestions = toSuggestions(
      [row({ id: "a", year: 2015 }), row({ id: "b", year: 2018 })],
      1,
    );
    expect(suggestions.map((item) => item.year)).toEqual(["2015", "2018"]);
  });

  it("leaves out a missing concentration and year", () => {
    const [suggestion] = toSuggestions(
      [row({ concentration: null, year: null })],
      5,
    );
    expect(suggestion.display_name).toBe("Dior - Sauvage");
    expect(suggestion.year).toBeNull();
  });
});

describe("remaskSuggestions", () => {
  it("re-masks cached suggestions for the current attempt", () => {
    const cached = toSuggestions([row()], 1);
    const [remasked] = remaskSuggestions(cached, 5);
    expect(remasked.year).toBe("2015");
    expect(remasked.display_name).toBe("Dior - Sauvage EDT (2015)");
  });

  it("matches toSuggestions for the same attempt", () => {
    const input = [
      row({ id: "a" }),
      row({ id: "b", year: 2018 }),
      row({ id: "c", name: "Fahrenheit" }),
    ];
    expect(remaskSuggestions(toSuggestions(input, 1), 3)).toEqual(
      toSuggestions(input, 3),
    );
  });
});

describe("rankSuggestions and selectSuggestions", () => {
  it("puts the best match first and keeps the order of equal scores", () => {
    const suggestions = toSuggestions(
      [
        row({ brand_name: "Oxford Lab", id: "a", name: "Blue" }),
        row({ brand_name: "Tom Ford", id: "b", name: "Oud" }),
        row({ brand_name: "Ford Co", id: "c", name: "Red" }),
      ],
      5,
    );
    expect(
      rankSuggestions(suggestions, "ford").map((item) => item.perfume_id),
    ).toEqual(["b", "c", "a"]);
  });

  it("drops irrelevant suggestions, or keeps all when none is relevant", () => {
    const suggestions = toSuggestions(
      [row({ id: "a" }), row({ brand_name: "Chanel", id: "b", name: "Bleu" })],
      5,
    );
    const ranked = rankSuggestions(suggestions, "sauvage");
    expect(
      selectSuggestions(ranked, "sauvage", "sauvage", false).map(
        (item) => item.perfume_id,
      ),
    ).toEqual(["a"]);
    expect(selectSuggestions(ranked, "zzz", "zzz", false)).toHaveLength(2);
  });

  it("cuts at 10 but never inside a group of same-name variants", () => {
    const list = toSuggestions(
      [
        ...rows(9, (index) => ({ name: `Sauvage ${index}` })),
        ...rows(3, (index) => ({
          id: `v${index}`,
          name: "Sauvage X",
          year: 2000 + index,
        })),
        row({ id: "last", name: "Sauvage Z" }),
      ],
      5,
    );
    const shown = selectSuggestions(list, "sauvage", "sauvage", false);
    expect(shown.map((item) => item.perfume_id)).toEqual([
      ...Array.from({ length: 9 }, (_, index) => `p${index}`),
      "v0",
      "v1",
      "v2",
    ]);
  });

  it("shows up to 30 exact name matches when there are at least 10", () => {
    const list = toSuggestions(
      [
        ...rows(35, (index) => ({ brand_name: `Brand ${index}`, name: "Oud" })),
        row({ id: "other", name: "Oud Wood" }),
      ],
      5,
    );
    const shown = selectSuggestions(list, "oud", "Oud", false);
    expect(shown).toHaveLength(30);
    expect(shown.every((item) => item.name === "Oud")).toBe(true);
  });

  it("shows everything on the last attempt", () => {
    const list = toSuggestions(
      rows(40, (index) => ({ name: `Sauvage ${index}` })),
      6,
    );
    expect(selectSuggestions(list, "sauvage", "sauvage", true)).toHaveLength(
      40,
    );
  });
});
