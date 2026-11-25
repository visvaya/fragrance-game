import { describe, expect, it } from "vitest";

import { challengeXsolve } from "@/lib/game/challenge-snapshot";

describe("challengeXsolve", () => {
  it("prefers the difficulty stored when the challenge was published", () => {
    expect(challengeXsolve({ xsolve: 0.3 }, 0.8)).toBe(0.3);
    expect(challengeXsolve({ xsolve: 0 }, 0.8)).toBe(0);
    expect(challengeXsolve({ xsolve: 0.3 }, null)).toBe(0.3);
  });

  it("falls back to the live score for challenges published without a snapshot", () => {
    expect(challengeXsolve({}, 0.8)).toBe(0.8);
    expect(challengeXsolve(null, 0.8)).toBe(0.8);
    expect(challengeXsolve(undefined, null)).toBeNull();
  });

  it("ignores a malformed snapshot instead of scoring with it", () => {
    expect(challengeXsolve({ xsolve: "0.3" }, 0.8)).toBe(0.8);
    expect(challengeXsolve({ xsolve: null }, 0.8)).toBe(0.8);
    expect(challengeXsolve([0.3], 0.8)).toBe(0.8);
  });
});
