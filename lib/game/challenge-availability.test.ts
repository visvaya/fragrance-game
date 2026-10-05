import { describe, expect, it } from "vitest";

import {
  isChallengeAvailable,
  isRankedStart,
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

describe("isRankedStart", () => {
  const deadline = new Date("2026-10-05T00:00:00Z");

  it("ranks a session started before the deadline", () => {
    expect(isRankedStart(new Date("2026-10-04T23:59:59Z"), deadline)).toBe(
      true,
    );
  });

  it("ranks a session started exactly at the deadline", () => {
    expect(isRankedStart(new Date("2026-10-05T00:00:00Z"), deadline)).toBe(
      true,
    );
  });

  it("does not rank a session started after the deadline", () => {
    expect(isRankedStart(new Date("2026-10-05T00:00:01Z"), deadline)).toBe(
      false,
    );
  });

  it("does not rank when either date is invalid", () => {
    expect(isRankedStart(new Date("not a date"), deadline)).toBe(false);
    expect(
      isRankedStart(new Date("2026-10-04T12:00:00Z"), new Date("not a date")),
    ).toBe(false);
  });
});
