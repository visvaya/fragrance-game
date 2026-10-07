/**
 * Game state is written only with the service role: the player's own client may read
 * its session rows but never writes them, and every write names the signed-in player.
 */
import * as Sentry from "@sentry/nextjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "@/lib/supabase/server";

import {
  initializeAndGuess,
  skipAttempt,
  startGame,
  submitGuess,
} from "../game-actions";

import {
  ANSWER_ID,
  CHALLENGE_ID,
  FUTURE_DATE,
  GUESS_ID,
  makeClient,
  makeSession,
  NONCE,
  NOW,
  OWNER_AND_NONCE,
  PAST_DATE,
  SESSION_ID,
  USER_ID,
  useClients,
} from "./helpers/game-db-double";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  unstable_cache: vi.fn().mockImplementation((function_: unknown) => function_),
}));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
}));
vi.mock("@/lib/redis", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/analytics-server", () => ({
  identifyUser: vi.fn(),
  trackEvent: vi.fn(),
}));
vi.mock("@/lib/env", () => ({
  env: { NEXT_PUBLIC_ASSETS_HOST: "assets.test.com", NODE_ENV: "test" },
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  setUser: vi.fn(),
}));

describe("game state writes go through the service role", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates a new session for the signed-in player", async () => {
    const writes = useClients({ session: makeSession(0) });

    await startGame(CHALLENGE_ID);

    expect(writes).toEqual([
      expect.objectContaining({
        op: "insert",
        table: "game_sessions",
        values: expect.objectContaining({
          attempts_count: 0,
          challenge_id: CHALLENGE_ID,
          player_id: USER_ID,
          status: "active",
        }),
      }),
    ]);
  });

  it("applies a winning guess and records the result", async () => {
    const writes = useClients({ session: makeSession(2) });

    const result = await submitGuess(SESSION_ID, ANSWER_ID, NONCE);

    expect(result.gameStatus).toBe("won");
    expect(writes).toEqual([
      expect.objectContaining({
        eqs: OWNER_AND_NONCE,
        op: "update",
        table: "game_sessions",
        values: expect.objectContaining({ attempts_count: 3, status: "won" }),
      }),
      expect.objectContaining({
        op: "insert",
        table: "game_results",
        values: expect.objectContaining({
          attempts: 3,
          player_id: USER_ID,
          session_id: SESSION_ID,
          status: "won",
        }),
      }),
    ]);
  });

  it("records the loss after the final skip", async () => {
    const writes = useClients({ session: makeSession(5) });

    const result = await skipAttempt(SESSION_ID, NONCE);

    expect(result.gameStatus).toBe("lost");
    expect(writes).toEqual([
      expect.objectContaining({
        eqs: OWNER_AND_NONCE,
        op: "update",
        table: "game_sessions",
        values: expect.objectContaining({ attempts_count: 6, status: "lost" }),
      }),
      expect.objectContaining({
        op: "insert",
        table: "game_results",
        values: expect.objectContaining({
          attempts: 6,
          player_id: USER_ID,
          score: 0,
          status: "lost",
        }),
      }),
    ]);
  });

  it("reports a conflict when the nonce changed before the skip was written", async () => {
    useClients({
      admin: { updateMatchesNoRow: true },
      session: makeSession(1),
    });

    await expect(skipAttempt(SESSION_ID, NONCE)).rejects.toThrow(
      `CONFLICT:${NONCE}`,
    );
  });

  it("reports a conflict when the nonce changed before the guess was written", async () => {
    useClients({
      admin: { updateMatchesNoRow: true },
      session: makeSession(1),
    });

    await expect(submitGuess(SESSION_ID, GUESS_ID, NONCE)).rejects.toThrow(
      `CONFLICT:${NONCE}`,
    );
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("reports a failed guess write to Sentry instead of a conflict", async () => {
    useClients({ admin: { updateFails: true }, session: makeSession(1) });

    const move = submitGuess(SESSION_ID, GUESS_ID, NONCE);

    await expect(move).rejects.toThrow("Game session update failed");
    await expect(move).rejects.not.toThrow("CONFLICT:");
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error), {
      extra: expect.objectContaining({ dbCode: "57014" }),
    });
  });

  it("reports a failed skip write to Sentry instead of a conflict", async () => {
    useClients({ admin: { updateFails: true }, session: makeSession(1) });

    const move = skipAttempt(SESSION_ID, NONCE);

    await expect(move).rejects.toThrow("Game session update failed");
    await expect(move).rejects.not.toThrow("CONFLICT:");
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error), {
      extra: expect.objectContaining({ dbCode: "57014" }),
    });
  });

  it("returns the move and reports to Sentry when the result insert fails", async () => {
    useClients({
      admin: { failResultInsert: true },
      session: makeSession(5),
    });

    const result = await submitGuess(SESSION_ID, GUESS_ID, NONCE);

    expect(result.gameStatus).toBe("lost");
    expect(result.newNonce).not.toBe(NONCE);
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it("creates the session and applies the first guess without client writes", async () => {
    const writes = useClients({ session: makeSession(0) });

    await initializeAndGuess(CHALLENGE_ID, GUESS_ID);

    expect(writes.map(({ op, table }) => `${op} ${table}`)).toEqual([
      "insert game_sessions",
      "update game_sessions",
    ]);
    expect(writes[1]?.eqs).toEqual({
      id: SESSION_ID,
      last_nonce: writes[0]?.values.last_nonce,
      player_id: USER_ID,
    });
  });

  it("refuses to start tomorrow's challenge and writes nothing", async () => {
    const writes = useClients({
      admin: { challengeDate: FUTURE_DATE },
      session: makeSession(0),
    });

    await expect(startGame(CHALLENGE_ID)).rejects.toThrow(
      "Challenge not available yet",
    );
    expect(writes).toEqual([]);
  });

  it("refuses to start an unknown challenge and writes nothing", async () => {
    const writes = useClients({
      admin: { challengeDate: null },
      session: makeSession(0),
    });

    await expect(startGame(CHALLENGE_ID)).rejects.toThrow(
      "Challenge not found",
    );
    expect(writes).toEqual([]);
  });

  it("refuses the first guess on tomorrow's challenge before any write", async () => {
    const writes = useClients({
      admin: { challengeDate: FUTURE_DATE },
      session: makeSession(0),
    });

    await expect(initializeAndGuess(CHALLENGE_ID, GUESS_ID)).rejects.toThrow(
      "Challenge not available yet",
    );
    expect(writes).toEqual([]);
  });

  it("still starts a challenge from an earlier day", async () => {
    const writes = useClients({
      admin: { challengeDate: PAST_DATE },
      session: makeSession(0),
    });

    await startGame(CHALLENGE_ID);

    expect(writes.map(({ op, table }) => `${op} ${table}`)).toEqual([
      "insert game_sessions",
    ]);
  });

  it("reads the only stored session without ordering or limiting", async () => {
    const existing = makeSession(2);
    useClients({ existing, session: existing });

    const result = await startGame(CHALLENGE_ID);

    expect(result.sessionId).toBe(SESSION_ID);
  });

  it("reports a failed session lookup to Sentry and starts a new session", async () => {
    const writes = useClients({ session: makeSession(0) });
    const lookupError = { code: "57014", message: "statement timeout" };
    vi.mocked(createClient).mockResolvedValue(
      makeClient(
        ({ eqs }) =>
          "player_id" in eqs
            ? { data: null, error: lookupError }
            : { data: makeSession(0), error: null },
        null,
      ) as never,
    );

    await startGame(CHALLENGE_ID);

    expect(Sentry.captureException).toHaveBeenCalledWith(
      new Error("Session lookup failed"),
      { extra: { dbCode: "57014", dbError: "statement timeout" } },
    );
    expect(writes.map(({ op, table }) => `${op} ${table}`)).toEqual([
      "insert game_sessions",
    ]);
  });

  it("resumes an existing session without checking the challenge date", async () => {
    const existing = makeSession(1);
    const writes = useClients({
      admin: { challengeDate: FUTURE_DATE },
      existing,
      session: existing,
    });

    const result = await startGame(CHALLENGE_ID);

    expect(result.sessionId).toBe(SESSION_ID);
    expect(writes).toEqual([]);
  });

  it("reports a failed challenge read instead of a missing challenge", async () => {
    const writes = useClients({
      admin: { challengeReadFails: true },
      session: makeSession(0),
    });

    await expect(startGame(CHALLENGE_ID)).rejects.toThrow(
      "Failed to load challenge",
    );
    expect(writes).toEqual([]);
  });

  describe("a parallel start already created the session", () => {
    const UNIQUE_VIOLATION = {
      code: "23505",
      message: "duplicate key value violates unique constraint",
    };
    const parallelSession = (status: string) => ({
      attempts_count: 1,
      guesses: [],
      id: SESSION_ID,
      last_nonce: "n1",
      status,
    });

    it("resumes the stored active session instead of failing", async () => {
      const writes = useClients({
        admin: {
          insertError: UNIQUE_VIOLATION,
          storedByParallelStart: parallelSession("active"),
        },
        session: makeSession(0),
      });

      const result = await startGame(CHALLENGE_ID);

      expect(result.sessionId).toBe(SESSION_ID);
      expect(result.nonce).toBe("n1");
      expect(result.answerName).toBeUndefined();
      expect(writes.filter(({ op }) => op === "insert")).toHaveLength(1);
    });

    it("resumes a stored finished game with the answer", async () => {
      useClients({
        admin: {
          insertError: UNIQUE_VIOLATION,
          storedByParallelStart: parallelSession("won"),
        },
        session: makeSession(0),
      });

      const result = await startGame(CHALLENGE_ID);

      expect(result.sessionId).toBe(SESSION_ID);
      expect(result.answerName).toBe("Coco");
    });

    it("fails when the conflicting session cannot be read back", async () => {
      useClients({
        admin: { insertError: UNIQUE_VIOLATION, storedByParallelStart: null },
        session: makeSession(0),
      });

      await expect(startGame(CHALLENGE_ID)).rejects.toThrow(
        "Failed to create session",
      );
    });

    it("keeps failing on other insert errors", async () => {
      useClients({
        admin: {
          insertError: { code: "XX000", message: "internal error" },
          storedByParallelStart: parallelSession("active"),
        },
        session: makeSession(0),
      });

      await expect(startGame(CHALLENGE_ID)).rejects.toThrow(
        "Failed to create session",
      );
    });
  });
});
