/**
 * Game state is written only with the service role: the player's own client may read
 * its session rows but never writes them, and every write names the signed-in player.
 */
import * as Sentry from "@sentry/nextjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAdminClient, createClient } from "@/lib/supabase/server";

import {
  initializeAndGuess,
  skipAttempt,
  startGame,
  submitGuess,
} from "../game-actions";

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

const USER_ID = "11111111-1111-4111-8111-111111111111";
const CHALLENGE_ID = "550e8400-e29b-41d4-a716-446655440000";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";
const ANSWER_ID = "33333333-3333-4333-8333-333333333333";
const GUESS_ID = "44444444-4444-4444-8444-444444444444";
const NONCE = "12345";
const FAR_DEADLINE = "2099-01-01T00:00:00Z";
const STATEMENT_TIMEOUT = {
  code: "57014",
  message: "canceling statement due to statement timeout",
};

const PERFUME_ROW = {
  base_notes: ["Vanilla"],
  brand_id: "brand-1",
  brands: { name: "Chanel" },
  concentration_id: "c1",
  concentrations: { name: "Eau de Parfum" },
  gender: "Feminine",
  is_linear: false,
  middle_notes: ["Rose"],
  name: "Coco",
  perfumers: ["Jacques Polge"],
  release_year: 2001,
  top_notes: ["Bergamot"],
  xsolve_score: 0.5,
};

type Session = ReturnType<typeof makeSession>;
type Result = { data: unknown; error: unknown };
type Query = {
  columns: string;
  eqs: Record<string, unknown>;
  op: string;
  table: string;
  values: Record<string, unknown>;
};
type Write = Query & { op: "insert" | "update" };
type AdminOptions = {
  /** `challenge_date` of the requested challenge; `null` means no such challenge. */
  challengeDate?: string | null;
  failResultInsert?: boolean;
  updateFails?: boolean;
  updateMatchesNoRow?: boolean;
};
const DAY_MS = 24 * 60 * 60 * 1000;
const utcDate = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * DAY_MS).toISOString().slice(0, 10);

/** Rows both clients see: the session found by the resume lookup and the current one. */
type SharedRows = { existing: unknown; session: Record<string, unknown> };

function makeSession(attemptsCount: number) {
  return {
    attempts_count: attemptsCount,
    challenge_id: CHALLENGE_ID,
    guesses: [],
    id: SESSION_ID,
    last_guess: null,
    last_nonce: NONCE,
    player_id: USER_ID,
    start_time: "2026-10-03T00:00:00Z",
    status: "active",
  };
}

/**
 * Supabase client double. With `writes === null` it is the player's client and any
 * write throws; otherwise every insert and update is recorded in `writes`.
 */
function makeClient(resolve: (query: Query) => Result, writes: Write[] | null) {
  return {
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }),
    },
    from: (table: string) => {
      const eqs: Record<string, unknown> = {};
      let columns = "";
      let op = "select";
      let values: Record<string, unknown> = {};
      const chain: Record<string, unknown> = {};
      const settle = async () =>
        await Promise.resolve(resolve({ columns, eqs, op, table, values }));
      const write =
        (kind: "insert" | "update") => (payload: Record<string, unknown>) => {
          if (writes === null) {
            throw new Error(`user client must not ${kind} ${table}`);
          }
          op = kind;
          values = payload;
          writes.push({ columns, eqs, op: kind, table, values: payload });
          return chain;
        };
      const forbidden = (kind: string) => () => {
        throw new Error(`unexpected ${kind} on ${table}`);
      };
      chain.select = (selected?: string) => {
        if (op === "select") columns = selected ?? "";
        return chain;
      };
      for (const method of ["limit", "order"]) {
        chain[method] = () => chain;
      }
      chain.insert = write("insert");
      chain.update = write("update");
      chain.upsert = forbidden("upsert");
      chain.delete = forbidden("delete");
      chain.in = () => {
        if (op === "select") op = "in";
        return chain;
      };
      chain.eq = (column: string, value: unknown) => {
        eqs[column] = value;
        return chain;
      };
      chain.single = settle;
      chain.maybeSingle = settle;
      // eslint-disable-next-line unicorn/no-thenable -- the chain is awaited directly like a Supabase query
      chain.then = async (
        onFulfilled: (value: Result) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => await settle().then(onFulfilled, onRejected);
      return chain;
    },
  };
}

/** The player's client reads only game_sessions: by player (resume lookup) or by id. */
function userResolver(db: SharedRows) {
  return ({ eqs, table }: Query): Result => {
    if (table !== "game_sessions") {
      return { data: null, error: { message: `unexpected read of ${table}` } };
    }
    if ("player_id" in eqs) return { data: db.existing, error: null };
    return { data: db.session, error: null };
  };
}

/**
 * The public challenge view: the availability check reads only `challenge_date`
 * (today unless overridden), every other read gets the deadline and mode.
 */
function readPublicChallenge(columns: string, options: AdminOptions): Result {
  if (columns !== "challenge_date") {
    return {
      data: { grace_deadline_at_utc: FAR_DEADLINE, mode: "daily" },
      error: null,
    };
  }
  const challengeDate =
    options.challengeDate === undefined ? utcDate(0) : options.challengeDate;
  return {
    data: challengeDate === null ? null : { challenge_date: challengeDate },
    error: null,
  };
}

/** The service role reads the catalog and applies session writes to the shared rows. */
function adminResolver(db: SharedRows, options: AdminOptions) {
  return ({ columns, op, table, values }: Query): Result => {
    switch (table) {
      case "daily_challenges": {
        return {
          data: { grace_deadline_at_utc: FAR_DEADLINE, perfume_id: ANSWER_ID },
          error: null,
        };
      }
      case "daily_challenges_public": {
        return readPublicChallenge(columns, options);
      }
      case "game_results": {
        return options.failResultInsert === true
          ? { data: null, error: { message: "insert failed" } }
          : { data: null, error: null };
      }
      case "game_sessions": {
        if (op === "update" && options.updateMatchesNoRow === true) {
          return { data: null, error: { code: "PGRST116", message: "0 rows" } };
        }
        if (op === "update" && options.updateFails === true) {
          return { data: null, error: STATEMENT_TIMEOUT };
        }
        db.session = { ...db.session, ...values };
        if (op === "insert") db.existing = db.session;
        return { data: db.session, error: null };
      }
      case "perfume_assets": {
        return {
          data: Object.fromEntries(
            [1, 2, 3, 4, 5, 6].map((step) => [
              `image_key_step_${step}`,
              `a/${step}.avif`,
            ]),
          ),
          error: null,
        };
      }
      case "perfumes": {
        return op === "in"
          ? { data: [{ ...PERFUME_ROW, id: GUESS_ID }], error: null }
          : { data: PERFUME_ROW, error: null };
      }
      default: {
        return {
          data: null,
          error: { message: `unexpected read of ${table}` },
        };
      }
    }
  };
}

/**
 * Wires both client doubles to one in-memory session. A new session (`existing`
 * omitted) starts from `session` and takes the inserted values, nonce included.
 */
function useClients(setup: {
  admin?: AdminOptions;
  existing?: Session;
  session: Session;
}): Write[] {
  const db: SharedRows = {
    existing: setup.existing ?? null,
    session: setup.session,
  };
  const writes: Write[] = [];
  vi.mocked(createClient).mockResolvedValue(
    makeClient(userResolver(db), null) as never,
  );
  vi.mocked(createAdminClient).mockReturnValue(
    makeClient(adminResolver(db, setup.admin ?? {}), writes) as never,
  );
  return writes;
}

const OWNER_AND_NONCE = {
  id: SESSION_ID,
  last_nonce: NONCE,
  player_id: USER_ID,
};

describe("game state writes go through the service role", () => {
  beforeEach(() => vi.clearAllMocks());

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

    await initializeAndGuess(CHALLENGE_ID, GUESS_ID, 0);

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
      admin: { challengeDate: utcDate(1) },
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
      admin: { challengeDate: utcDate(1) },
      session: makeSession(0),
    });

    await expect(initializeAndGuess(CHALLENGE_ID, GUESS_ID, 0)).rejects.toThrow(
      "Challenge not available yet",
    );
    expect(writes).toEqual([]);
  });

  it("still starts a challenge from an earlier day", async () => {
    const writes = useClients({
      admin: { challengeDate: utcDate(-1) },
      session: makeSession(0),
    });

    await startGame(CHALLENGE_ID);

    expect(writes.map(({ op, table }) => `${op} ${table}`)).toEqual([
      "insert game_sessions",
    ]);
  });

  it("resumes an existing session without checking the challenge date", async () => {
    const existing = makeSession(1);
    const writes = useClients({
      admin: { challengeDate: utcDate(1) },
      existing,
      session: existing,
    });

    const result = await startGame(CHALLENGE_ID);

    expect(result.sessionId).toBe(SESSION_ID);
    expect(writes).toEqual([]);
  });
});
