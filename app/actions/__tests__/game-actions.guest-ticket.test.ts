/**
 * A guest proves its play with a signed ticket: every accepted move by an anonymous
 * player issues one, a signed-in account never gets one, and the client cannot
 * choose how many attempts a new session starts with.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { issueGuestTicket } from "@/lib/auth/guest-ticket-cookie";
import { checkRateLimit } from "@/lib/redis";

import { initializeAndGuess, skipAttempt, submitGuess } from "../game-actions";

import {
  CHALLENGE_ID,
  GUESS_ID,
  makeSession,
  NONCE,
  NOW,
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
vi.mock("@/lib/auth/guest-ticket-cookie", () => ({
  issueGuestTicket: vi.fn().mockResolvedValue(undefined),
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

const GUEST = { id: USER_ID, is_anonymous: true };
const ACCOUNT = { id: USER_ID, is_anonymous: false };

describe("guest ticket on moves", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("issues a ticket when a guest submits a guess", async () => {
    useClients({ session: makeSession(0), user: GUEST });

    await submitGuess(SESSION_ID, GUESS_ID, NONCE);

    expect(issueGuestTicket).toHaveBeenCalledTimes(1);
    expect(issueGuestTicket).toHaveBeenCalledWith(USER_ID);
  });

  it("issues no ticket when an account submits a guess", async () => {
    useClients({ session: makeSession(0), user: ACCOUNT });

    await submitGuess(SESSION_ID, GUESS_ID, NONCE);

    expect(issueGuestTicket).not.toHaveBeenCalled();
  });

  it("issues a ticket when a guest skips", async () => {
    useClients({ session: makeSession(0), user: GUEST });

    await skipAttempt(SESSION_ID, NONCE);

    expect(issueGuestTicket).toHaveBeenCalledTimes(1);
    expect(issueGuestTicket).toHaveBeenCalledWith(USER_ID);
  });

  it("issues no ticket when an account skips", async () => {
    useClients({ session: makeSession(0), user: ACCOUNT });

    await skipAttempt(SESSION_ID, NONCE);

    expect(issueGuestTicket).not.toHaveBeenCalled();
  });

  it("issues no ticket when the rate limiter rejects the guess", async () => {
    useClients({ session: makeSession(0), user: GUEST });
    vi.mocked(checkRateLimit).mockRejectedValueOnce(
      new Error("Rate limit exceeded"),
    );

    await expect(submitGuess(SESSION_ID, GUESS_ID, NONCE)).rejects.toThrow(
      "Rate limit exceeded",
    );
    expect(issueGuestTicket).not.toHaveBeenCalled();
  });

  it("starts a new session at zero attempts when an old client sends a count", async () => {
    const writes = useClients({ session: makeSession(0), user: GUEST });

    await (
      initializeAndGuess as (...arguments_: unknown[]) => Promise<unknown>
    )(CHALLENGE_ID, GUESS_ID, 3);

    expect(writes[0]).toEqual(
      expect.objectContaining({
        op: "insert",
        table: "game_sessions",
        values: expect.objectContaining({ attempts_count: 0 }),
      }),
    );
  });
});
