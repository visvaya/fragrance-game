import { describe, expect, it } from "vitest";
import { cloneCountProblem } from "./check-duplication";

describe("cloneCountProblem", () => {
  it("accepts a count equal to the limit", () => {
    expect(cloneCountProblem(31, 31)).toBeUndefined();
  });

  it("rejects a new clone", () => {
    expect(cloneCountProblem(32, 31)).toMatch(/32 clones, limit 31/);
  });

  it("asks to lower the limit after a clone is removed", () => {
    expect(cloneCountProblem(30, 31)).toMatch(/lower MAX_CLONES to 30/);
  });
});
