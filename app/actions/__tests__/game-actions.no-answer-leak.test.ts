/**
 * Regression guard: no game response may carry the unrevealed daily answer.
 * The answer uses distinctive strings so any leak shows up in the serialized result.
 */
import { unstable_cache } from "next/cache";

import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { GENERIC_PLACEHOLDER, MASK_CHAR } from "@/lib/constants";
import { createAdminClient, createClient } from "@/lib/supabase/server";

import {
  getDailyChallenge,
  getDailyChallengeSSR,
  skipAttempt,
  startGame,
  submitGuess,
} from "../game-actions";

/** Cache keys registered at import time, captured before mocks are cleared. */
const cacheKeys = vi.mocked(unstable_cache).mock.calls.map(([, key]) => key);

const LEAK_PATTERN =
  /Zyxwvut|Qwertyuiop|1987|Feminine|Unobtainium|Plughwood|Snorkelmusk/;

const USER_ID = "11111111-1111-4111-8111-111111111111";
const CHALLENGE_ID = "550e8400-e29b-41d4-a716-446655440000";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";
const ANSWER_ID = "33333333-3333-4333-8333-333333333333";
const GUESS_ID = "44444444-4444-4444-8444-444444444444";
const NONCE = "12345";

/** Brand clue at level 1 (placeholder) and level 2 (every letter masked, spaces kept). */
const BRAND_LEVEL_1 = GENERIC_PLACEHOLDER.repeat(5);
const BRAND_LEVEL_2 = `${MASK_CHAR.repeat(7)} ${MASK_CHAR.repeat(6)}`;

const ANSWER_ROW = {
  base_notes: ["Snorkelmusk"],
  brand_id: "brand-answer",
  brands: { name: "Zyxwvut Maison" },
  concentrations: { name: "Eau de Parfum" },
  gender: "Feminine",
  is_linear: false,
  middle_notes: ["Plughwood"],
  name: "Secret Answer",
  perfumers: ["Qwertyuiop Perfumer"],
  release_year: 1987,
  top_notes: ["Unobtainium"],
  xsolve_score: 0.5,
};

const GUESS_ROW = {
  base_notes: ["Vanilla"],
  brand_id: "brand-guess",
  brands: { name: "Other House" },
  concentration_id: "c1",
  concentrations: { name: "Eau de Toilette" },
  gender: "Masculine",
  id: GUESS_ID,
  is_linear: false,
  middle_notes: ["Rose"],
  name: "Guessed Perfume",
  perfumers: ["Someone Else"],
  release_year: 2010,
  top_notes: ["Lemon"],
};

const PUBLIC_CHALLENGE = {
  challenge_date: "2026-10-03",
  grace_deadline_at_utc: "2099-01-01T00:00:00Z",
  id: CHALLENGE_ID,
  mode: "daily",
  snapshot_metadata: {},
};

const ACTIVE_SESSION = {
  attempts_count: 0,
  challenge_id: CHALLENGE_ID,
  guesses: [],
  id: SESSION_ID,
  last_nonce: NONCE,
  player_id: USER_ID,
  start_time: "2026-10-03T00:00:00Z",
  status: "active",
};

type Result = { data: unknown; error: unknown };

/** Resolves one query from its table, operation and filters. */
function resolveQuery(
  table: string,
  op: string,
  eqs: Record<string, unknown>,
  state: { existingSession: unknown },
): Result {
  switch (table) {
    case "daily_challenges": {
      return {
        data: {
          challenge_date: PUBLIC_CHALLENGE.challenge_date,
          grace_deadline_at_utc: PUBLIC_CHALLENGE.grace_deadline_at_utc,
          perfume_id: ANSWER_ID,
        },
        error: null,
      };
    }
    case "daily_challenges_public": {
      return { data: PUBLIC_CHALLENGE, error: null };
    }
    case "game_sessions": {
      if (op === "insert" || op === "update") {
        return { data: ACTIVE_SESSION, error: null };
      }
      if ("player_id" in eqs)
        return { data: state.existingSession, error: null };
      return { data: ACTIVE_SESSION, error: null };
    }
    case "perfume_assets": {
      return {
        data: { image_key_step_1: "a.webp", image_key_step_2: "b.webp" },
        error: null,
      };
    }
    case "perfumes": {
      if (op === "in") return { data: [GUESS_ROW], error: null };
      return {
        data: eqs.id === GUESS_ID ? GUESS_ROW : ANSWER_ROW,
        error: null,
      };
    }
    default: {
      return { data: null, error: null };
    }
  }
}

function makeClient(state: { existingSession: unknown }) {
  return {
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }),
    },
    from: (table: string) => {
      const eqs: Record<string, unknown> = {};
      let op = "select";
      const settle = async () =>
        await Promise.resolve(resolveQuery(table, op, eqs, state));
      const chain: Record<string, unknown> = {};
      const passthrough = () => chain;
      chain.select = passthrough;
      chain.limit = passthrough;
      chain.order = passthrough;
      chain.insert = () => {
        op = "insert";
        return chain;
      };
      chain.update = () => {
        op = "update";
        return chain;
      };
      chain.in = () => {
        op = "in";
        return chain;
      };
      chain.eq = (column: string, value: unknown) => {
        eqs[column] = value;
        return chain;
      };
      chain.single = settle;
      chain.maybeSingle = settle;
      // eslint-disable-next-line unicorn/no-thenable -- the chain is awaited directly like a Supabase query
      chain.then = (
        onFulfilled: (value: Result) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => {
        void settle().then(onFulfilled, onRejected);
      };
      return chain;
    },
  };
}

function useClients(existingSession: unknown) {
  const client = makeClient({ existingSession });
  vi.mocked(createClient).mockResolvedValue(client as never);
  vi.mocked(createAdminClient).mockReturnValue(client as never);
}

describe("game responses never contain the unrevealed answer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getDailyChallengeSSR", async () => {
    useClients(null);
    const result = await getDailyChallengeSSR("2026-10-03");
    expect(result).not.toBeNull();
    expect(result?.revealed.brand).toBe(BRAND_LEVEL_1);
    expect(JSON.stringify(result)).not.toMatch(LEAK_PATTERN);
  });

  it("getDailyChallenge", async () => {
    useClients(null);
    const result = await getDailyChallenge();
    expect(result).not.toBeNull();
    expect(result?.revealed.brand).toBe(BRAND_LEVEL_1);
    expect(JSON.stringify(result)).not.toMatch(LEAK_PATTERN);
  });

  it("startGame with a new session", async () => {
    useClients(null);
    const result = await startGame(CHALLENGE_ID);
    expect(result.revealed.brand).toBe(BRAND_LEVEL_1);
    expect(JSON.stringify(result)).not.toMatch(LEAK_PATTERN);
  });

  it("startGame with an existing session at attempt 0", async () => {
    useClients(ACTIVE_SESSION);
    const result = await startGame(CHALLENGE_ID);
    expect(result.revealed.brand).toBe(BRAND_LEVEL_1);
    expect(JSON.stringify(result)).not.toMatch(LEAK_PATTERN);
  });

  it("submitGuess with a wrong guess on attempt 1", async () => {
    useClients(ACTIVE_SESSION);
    const result = await submitGuess(SESSION_ID, GUESS_ID, NONCE);
    expect(result.gameStatus).toBe("active");
    expect(result.revealed.brand).toBe(BRAND_LEVEL_2);
    expect(JSON.stringify(result)).not.toMatch(LEAK_PATTERN);
  });

  it("skipAttempt on attempt 1", async () => {
    useClients(ACTIVE_SESSION);
    const result = await skipAttempt(SESSION_ID, NONCE);
    expect(result.gameStatus).toBe("active");
    expect(result.revealed.brand).toBe(BRAND_LEVEL_2);
    expect(JSON.stringify(result)).not.toMatch(LEAK_PATTERN);
  });
});

describe("getDailyChallengeSSR cache key", () => {
  it("uses a key that does not reuse entries cached with the full answer", () => {
    expect(cacheKeys).toContainEqual(["daily-challenge-ssr-v2"]);
    expect(cacheKeys).not.toContainEqual(["daily-challenge-ssr"]);
  });
});
