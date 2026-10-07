/**
 * Regression guard: a game response carries the image of the step the player has
 * reached and never the key of a later, less blurred step.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { skipAttempt, startGame, submitGuess } from "../game-actions";

import {
  CHALLENGE_ID,
  GUESS_ID,
  makeSession,
  NONCE,
  NOW,
  SESSION_ID,
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

const LAST_STEP = 6;

/** Asserts the serialized response shows `step` and no later step. */
function expectStep(result: unknown, step: number): void {
  const serialized = JSON.stringify(result);
  expect(serialized).toContain(`https://assets.test.com/a/${step}.avif`);
  for (let later = step + 1; later <= LAST_STEP; later += 1) {
    expect(serialized).not.toContain(`a/${later}.avif`);
  }
}

describe("game responses carry only the current image step", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("startGame for a new session shows step 1", async () => {
    useClients({ session: makeSession(0) });
    const result = await startGame(CHALLENGE_ID);
    expect(result.imageUrl).toBe("https://assets.test.com/a/1.avif");
    expectStep(result, 1);
  });

  it.each([1, 2, 3])(
    "skipAttempt after %i moves shows the next step only",
    async (moves) => {
      useClients({ session: makeSession(moves) });
      const result = await skipAttempt(SESSION_ID, NONCE);
      expect(result.gameStatus).toBe("active");
      expectStep(result, moves + 2);
    },
  );

  it("skipAttempt into the last attempt shows step 6 while the game is active", async () => {
    useClients({ session: makeSession(4) });
    const result = await skipAttempt(SESSION_ID, NONCE);
    expect(result.gameStatus).toBe("active");
    expectStep(result, LAST_STEP);
  });

  it("a wrong submitGuess after 2 moves shows step 4 only", async () => {
    useClients({ session: makeSession(2) });
    const result = await submitGuess(SESSION_ID, GUESS_ID, NONCE);
    expect(result.gameStatus).toBe("active");
    expectStep(result, 4);
  });

  it("the losing skip shows the full image", async () => {
    useClients({ session: makeSession(5) });
    const result = await skipAttempt(SESSION_ID, NONCE);
    expect(result.gameStatus).toBe("lost");
    expectStep(result, LAST_STEP);
  });

  it("resuming an active session after 3 moves shows step 4 only", async () => {
    const session = makeSession(3);
    useClients({ existing: session, session });
    const result = await startGame(CHALLENGE_ID);
    expect(result.imageUrl).toBe("https://assets.test.com/a/4.avif");
    expectStep(result, 4);
  });
});
