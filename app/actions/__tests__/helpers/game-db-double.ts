/**
 * In-memory Supabase doubles for the game server actions: the player's client reads
 * its own session rows, the service-role client records every insert and update.
 * Test files still declare their own `vi.mock` calls for `@/lib/supabase/server`.
 */
import { vi } from "vitest";

import { createAdminClient, createClient } from "@/lib/supabase/server";

export const USER_ID = "11111111-1111-4111-8111-111111111111";
export const CHALLENGE_ID = "550e8400-e29b-41d4-a716-446655440000";
export const SESSION_ID = "22222222-2222-4222-8222-222222222222";
export const ANSWER_ID = "33333333-3333-4333-8333-333333333333";
export const GUESS_ID = "44444444-4444-4444-8444-444444444444";
export const NONCE = "12345";
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

/** A `game_sessions` row as both clients see it. */
export type Session = {
  attempts_count: number;
  challenge_id: string;
  guesses: unknown[];
  id: string;
  last_guess: null;
  last_nonce: string;
  metadata?: unknown;
  player_id: string;
  start_time: string;
  status: string;
};
type Result = { data: unknown; error: unknown };
type Query = {
  columns: string;
  eqs: Record<string, unknown>;
  op: string;
  table: string;
  values: Record<string, unknown>;
};
/** The user `auth.getUser()` returns; `is_anonymous` marks a guest. */
export type SignedInUser = { id: string; is_anonymous?: boolean };
export type Write = Query & { op: "insert" | "update" };
type AdminOptions = {
  /** `challenge_date` of the requested challenge; `null` means no such challenge. */
  challengeDate?: string | null;
  /** The `challenge_date` read fails with a database error. */
  challengeReadFails?: boolean;
  failResultInsert?: boolean;
  /** The session insert fails with this error and writes no row. */
  insertError?: { code: string; message: string };
  /** Row a parallel start stored before the failed insert; the resume lookup then finds it. */
  storedByParallelStart?: Record<string, unknown> | null;
  updateFails?: boolean;
  updateMatchesNoRow?: boolean;
};
/** The tests pin the clock to midday UTC of TODAY, so no date crosses a day boundary. */
export const NOW = new Date("2026-10-04T12:00:00Z");
const TODAY = "2026-10-04";
export const FUTURE_DATE = "2999-01-01";
export const PAST_DATE = "2000-01-01";

/** Rows both clients see: the session found by the resume lookup and the current one. */
type SharedRows = { existing: unknown; session: Record<string, unknown> };

/** An active session of the signed-in player with `attemptsCount` moves made. */
export const makeSession = (attemptsCount: number): Session => ({
  attempts_count: attemptsCount,
  challenge_id: CHALLENGE_ID,
  guesses: [],
  id: SESSION_ID,
  last_guess: null,
  last_nonce: NONCE,
  player_id: USER_ID,
  start_time: "2026-10-03T00:00:00Z",
  status: "active",
});

/** What the actions use from a Supabase client. */
type ClientDouble = {
  auth: { getUser: () => Promise<unknown> };
  from: (table: string) => Record<string, unknown>;
};

/**
 * Supabase client double. With `writes === null` it is the player's client and any
 * write throws; otherwise every insert and update is recorded in `writes`.
 */
export const makeClient = (
  resolve: (query: Query) => Result,
  writes: Write[] | null,
  user?: SignedInUser,
): ClientDouble => {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: user ?? { id: USER_ID } },
        error: null,
      }),
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
      // One session per player and challenge: the player's lookup by player id takes the
      // only row, so it neither orders nor limits.
      const playerLookup = () =>
        writes === null && table === "game_sessions" && "player_id" in eqs;
      for (const method of ["limit", "order"]) {
        chain[method] = () => {
          if (playerLookup()) forbidden(method)();
          return chain;
        };
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
};

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
 * The availability check reads `challenge_date` from the base table (today unless
 * overridden). The public view never answers that read, so a check that went back
 * to the view would see no challenge.
 */
function readChallengeDate(options: AdminOptions): Result {
  if (options.challengeReadFails === true) {
    return { data: null, error: STATEMENT_TIMEOUT };
  }
  const challengeDate =
    options.challengeDate === undefined ? TODAY : options.challengeDate;
  return {
    data: challengeDate === null ? null : { challenge_date: challengeDate },
    error: null,
  };
}

/** The public view: no row for a `challenge_date` read, else deadline and mode. */
function readPublicChallenge(columns: string): Result {
  if (columns === "challenge_date") return { data: null, error: null };
  return {
    data: { grace_deadline_at_utc: FAR_DEADLINE, mode: "daily" },
    error: null,
  };
}

/** Applies a session insert or update to the shared rows, or returns the configured error. */
function writeSession(
  db: SharedRows,
  options: AdminOptions,
  op: string,
  values: Record<string, unknown>,
): Result {
  if (op === "update" && options.updateMatchesNoRow === true) {
    return { data: null, error: { code: "PGRST116", message: "0 rows" } };
  }
  if (op === "update" && options.updateFails === true) {
    return { data: null, error: STATEMENT_TIMEOUT };
  }
  if (op === "insert" && options.insertError !== undefined) {
    db.existing = options.storedByParallelStart ?? null;
    return { data: null, error: options.insertError };
  }
  db.session = { ...db.session, ...values };
  if (op === "insert") db.existing = db.session;
  return { data: db.session, error: null };
}

/** The service role reads the catalog and applies session writes to the shared rows. */
function adminResolver(db: SharedRows, options: AdminOptions) {
  return ({ columns, op, table, values }: Query): Result => {
    switch (table) {
      case "daily_challenges": {
        if (columns === "challenge_date") return readChallengeDate(options);
        return {
          data: { grace_deadline_at_utc: FAR_DEADLINE, perfume_id: ANSWER_ID },
          error: null,
        };
      }
      case "daily_challenges_public": {
        return readPublicChallenge(columns);
      }
      case "game_results": {
        return options.failResultInsert === true
          ? { data: null, error: { message: "insert failed" } }
          : { data: null, error: null };
      }
      case "game_sessions": {
        return writeSession(db, options, op, values);
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
export const useClients = (setup: {
  admin?: AdminOptions;
  existing?: Session;
  session: Session;
  user?: SignedInUser;
}): Write[] => {
  const db: SharedRows = {
    existing: setup.existing ?? null,
    session: setup.session,
  };
  const writes: Write[] = [];
  vi.mocked(createClient).mockResolvedValue(
    makeClient(userResolver(db), null, setup.user) as never,
  );
  vi.mocked(createAdminClient).mockReturnValue(
    makeClient(adminResolver(db, setup.admin ?? {}), writes) as never,
  );
  return writes;
};

/** The guard every session update carries: owner, row id and the expected nonce. */
export const OWNER_AND_NONCE = {
  id: SESSION_ID,
  last_nonce: NONCE,
  player_id: USER_ID,
};
