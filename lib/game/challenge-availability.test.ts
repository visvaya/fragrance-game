import { describe, expect, it } from "vitest";

import {
  isChallengeAvailable,
  toUtcDateString,
} from "./challenge-availability";

describe("toUtcDateString", () => {
  it("returns the UTC calendar date, not the local one", () => {
    expect(toUtcDateString(new Date("2026-10-03T23:59:59Z"))).toBe(
      "2026-10-03",
    );
    expect(toUtcDateString(new Date("2026-10-04T00:00:00Z"))).toBe(
      "2026-10-04",
    );
  });
});

describe("isChallengeAvailable", () => {
  const now = new Date("2026-10-04T12:00:00Z");

  it("allows today's challenge", () => {
    expect(isChallengeAvailable("2026-10-04", now)).toBe(true);
  });

  it("allows a challenge from an earlier day", () => {
    expect(isChallengeAvailable("2026-10-03", now)).toBe(true);
  });

  it("refuses tomorrow's challenge", () => {
    expect(isChallengeAvailable("2026-10-05", now)).toBe(false);
  });

  it("opens the challenge exactly at UTC midnight", () => {
    expect(
      isChallengeAvailable("2026-10-04", new Date("2026-10-03T23:59:59Z")),
    ).toBe(false);
    expect(
      isChallengeAvailable("2026-10-04", new Date("2026-10-04T00:00:00Z")),
    ).toBe(true);
  });
});
