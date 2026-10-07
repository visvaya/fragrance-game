import { describe, expect, it, vi } from "vitest";

import { rankingForResult } from "@/lib/game/ranking";

vi.mock("server-only", () => ({}));

const NOW = new Date("2026-10-03T12:00:00Z");
const LATER = "2026-10-04T00:00:00Z";
const EARLIER = "2026-10-03T00:00:00Z";

describe("rankingForResult", () => {
  it("ranks a game finished before the grace deadline", () => {
    expect(
      rankingForResult({ graceDeadline: LATER, metadata: null, now: NOW }),
    ).toEqual({ is_ranked: true });
  });

  it("does not rank a game finished after the grace deadline", () => {
    expect(
      rankingForResult({ graceDeadline: EARLIER, metadata: null, now: NOW }),
    ).toEqual({ is_ranked: false });
  });

  it("ignores other metadata keys", () => {
    expect(
      rankingForResult({
        graceDeadline: LATER,
        metadata: { other: true },
        now: NOW,
      }),
    ).toEqual({ is_ranked: true });
  });

  it("keeps a game started as a guest out of the ranking", () => {
    expect(
      rankingForResult({
        graceDeadline: LATER,
        metadata: { started_as_guest: true },
        now: NOW,
      }),
    ).toEqual({ is_ranked: false, ranked_reason: "started_as_guest" });
  });

  it("does not treat a string flag as started as a guest", () => {
    expect(
      rankingForResult({
        graceDeadline: LATER,
        metadata: { started_as_guest: "true" },
        now: NOW,
      }),
    ).toEqual({ is_ranked: true });
  });

  it("ignores metadata that is not an object", () => {
    expect(
      rankingForResult({ graceDeadline: LATER, metadata: [true], now: NOW }),
    ).toEqual({ is_ranked: true });
    expect(
      rankingForResult({ graceDeadline: LATER, metadata: "x", now: NOW }),
    ).toEqual({ is_ranked: true });
  });
});
