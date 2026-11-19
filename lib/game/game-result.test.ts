import { describe, expect, it, vi } from "vitest";

import { gameResultValues } from "@/lib/game/game-result";

vi.mock("server-only", () => ({}));

const base = {
  attempts: 3,
  challengeId: "challenge-1",
  graceDeadline: "2026-11-19T23:59:59.999Z",
  metadata: {},
  now: new Date("2026-11-19T12:00:10.900Z"),
  score: 700,
  scoreRaw: 700,
  sessionId: "session-1",
  startTime: "2026-11-19T12:00:00.000Z",
  status: "won" as const,
};

describe("gameResultValues", () => {
  it("builds the stored result with ranking and whole seconds of play", () => {
    expect(gameResultValues(base)).toEqual({
      attempts: 3,
      challenge_id: "challenge-1",
      is_ranked: true,
      score: 700,
      score_raw: 700,
      scoring_version: 1,
      session_id: "session-1",
      status: "won",
      time_seconds: 10,
    });
  });

  it("is unranked after the grace deadline", () => {
    const result = gameResultValues({
      ...base,
      now: new Date("2026-11-20T00:00:00.000Z"),
    });
    expect(result.is_ranked).toBe(false);
    expect(result.time_seconds).toBe(43_200);
  });

  it("is unranked with the reason for a game started as a guest", () => {
    const result = gameResultValues({
      ...base,
      metadata: { started_as_guest: true },
    });
    expect(result.is_ranked).toBe(false);
    expect(result.ranked_reason).toBeDefined();
  });
});
