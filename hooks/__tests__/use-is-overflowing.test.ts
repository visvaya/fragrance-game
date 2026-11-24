import { describe, expect, it } from "vitest";

import { edgeMaskClass, OVERFLOW_MASKS } from "../use-is-overflowing";

describe("edgeMaskClass", () => {
  it("fades both edges when the row scrolls both ways", () => {
    expect(edgeMaskClass(OVERFLOW_MASKS, true, true)).toContain(
      "transparent_0,black_20px,black_calc(100%-20px),transparent_100%",
    );
  });

  it("fades only the left edge when the row can scroll back", () => {
    expect(edgeMaskClass(OVERFLOW_MASKS, true, false)).toContain(
      "transparent_0,black_20px,black_100%",
    );
  });

  it("fades only the right edge when the row can scroll on", () => {
    expect(edgeMaskClass(OVERFLOW_MASKS, false, true)).toContain(
      "black_calc(100%-20px),transparent_100%",
    );
  });

  it("adds no mask when the row does not overflow", () => {
    expect(edgeMaskClass(OVERFLOW_MASKS, false, false)).toBe("");
  });
});
