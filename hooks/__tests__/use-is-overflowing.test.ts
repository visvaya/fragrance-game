import { describe, expect, it } from "vitest";

import { overflowMaskClass } from "../use-is-overflowing";

describe("overflowMaskClass", () => {
  it("fades both edges when the row scrolls both ways", () => {
    expect(overflowMaskClass(true, true)).toContain(
      "transparent_0,black_20px,black_calc(100%-20px),transparent_100%",
    );
  });

  it("fades only the left edge when the row can scroll back", () => {
    expect(overflowMaskClass(true, false)).toContain(
      "transparent_0,black_20px,black_100%",
    );
  });

  it("fades only the right edge when the row can scroll on", () => {
    expect(overflowMaskClass(false, true)).toContain(
      "black_calc(100%-20px),transparent_100%",
    );
  });

  it("adds no mask when the row does not overflow", () => {
    expect(overflowMaskClass(false, false)).toBe("");
  });
});
