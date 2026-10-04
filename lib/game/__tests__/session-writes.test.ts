import * as Sentry from "@sentry/nextjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  insertGameSession,
  isNoRowMatched,
  recordGameResult,
  updateGameSession,
} from "@/lib/game/session-writes";
import { createAdminClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

const PLAYER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_PLAYER_ID = "99999999-9999-4999-8999-999999999999";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";
const CHALLENGE_ID = "550e8400-e29b-41d4-a716-446655440000";

type Call = { args: unknown[]; method: string };
type Result = { data: unknown; error: unknown };

/** Records every builder call and the table name; resolves with `result` when awaited. */
function mockAdmin(result: Result) {
  const calls: Call[] = [];
  const tables: string[] = [];
  const chain: Record<string, unknown> = {};
  for (const method of ["insert", "update", "eq", "select", "limit"]) {
    chain[method] = (...args: unknown[]) => {
      calls.push({ args, method });
      return chain;
    };
  }
  chain.single = async () => await Promise.resolve(result);
  // eslint-disable-next-line unicorn/no-thenable -- the insert chain is awaited directly like a Supabase query
  chain.then = async (
    onFulfilled: (value: Result) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => await Promise.resolve(result).then(onFulfilled, onRejected);
  vi.mocked(createAdminClient).mockReturnValue({
    from: (table: string) => {
      tables.push(table);
      return chain;
    },
  } as never);
  return { calls, tables };
}

const RESULT_VALUES = {
  attempts: 3,
  challenge_id: CHALLENGE_ID,
  is_ranked: true,
  score: 700,
  score_raw: 490,
  scoring_version: 1,
  session_id: SESSION_ID,
  status: "won",
  time_seconds: 42,
};

describe("session-writes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("insertGameSession writes the verified player even when values carry another one", async () => {
    const { calls, tables } = mockAdmin({
      data: {
        attempts_count: 0,
        id: SESSION_ID,
        last_nonce: "1",
        status: "active",
      },
      error: null,
    });

    const result = await insertGameSession(PLAYER_ID, {
      attempts_count: 0,
      challenge_id: CHALLENGE_ID,
      player_id: OTHER_PLAYER_ID,
      status: "active",
    } as never);

    expect(tables).toEqual(["game_sessions"]);
    expect(calls[0]).toEqual({
      args: [expect.objectContaining({ player_id: PLAYER_ID })],
      method: "insert",
    });
    expect(result.data?.id).toBe(SESSION_ID);
  });

  it("updateGameSession filters by session, owner and expected nonce", async () => {
    const { calls, tables } = mockAdmin({
      data: {
        attempts_count: 1,
        id: SESSION_ID,
        last_nonce: "456",
        status: "active",
      },
      error: null,
    });

    await updateGameSession(
      { expectedNonce: "123", playerId: PLAYER_ID, sessionId: SESSION_ID },
      { attempts_count: 1, last_nonce: "456" },
    );

    expect(tables).toEqual(["game_sessions"]);
    expect(calls[0]).toEqual({
      args: [{ attempts_count: 1, last_nonce: "456" }],
      method: "update",
    });
    expect(
      calls.filter((call) => call.method === "eq").map((call) => call.args),
    ).toEqual([
      ["id", SESSION_ID],
      ["player_id", PLAYER_ID],
      ["last_nonce", "123"],
    ]);
  });

  it("updateGameSession returns the error when no row matched", async () => {
    mockAdmin({ data: null, error: { code: "PGRST116", message: "0 rows" } });

    const result = await updateGameSession(
      { expectedNonce: "123", playerId: PLAYER_ID, sessionId: SESSION_ID },
      { last_nonce: "456" },
    );

    expect(result.data).toBeNull();
    expect(result.error).not.toBeNull();
  });

  it("recordGameResult inserts the result for the verified player", async () => {
    const { calls, tables } = mockAdmin({ data: null, error: null });

    await recordGameResult(PLAYER_ID, RESULT_VALUES);

    expect(tables).toEqual(["game_results"]);
    expect(calls[0]).toEqual({
      args: [{ ...RESULT_VALUES, player_id: PLAYER_ID }],
      method: "insert",
    });
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("recordGameResult reports a failure without throwing", async () => {
    mockAdmin({
      data: null,
      error: { code: "23514", message: "insert failed" },
    });

    await expect(
      recordGameResult(PLAYER_ID, RESULT_VALUES),
    ).resolves.toBeUndefined();
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Game result insert failed" }),
      {
        extra: {
          dbCode: "23514",
          dbError: "insert failed",
          sessionId: SESSION_ID,
        },
      },
    );
  });

  it("isNoRowMatched recognises only the no-row-matched code", () => {
    expect(isNoRowMatched({ code: "PGRST116" })).toBe(true);
    expect(isNoRowMatched({ code: "57014" })).toBe(false);
    expect(isNoRowMatched({})).toBe(false);
    expect(isNoRowMatched(null)).toBe(false);
  });
});
