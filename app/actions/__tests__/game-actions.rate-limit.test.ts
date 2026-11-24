import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  unstable_cache: vi.fn().mockImplementation((function_: unknown) => function_),
}));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn().mockReturnValue({}),
  createClient: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/lib/redis", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/client-ip", () => ({
  getClientIp: vi.fn().mockResolvedValue("203.0.113.7"),
}));
vi.mock("@/lib/analytics-server", () => ({
  identifyUser: vi.fn(),
  trackEvent: vi.fn(),
}));

import { getDailyChallenge, initializeGame } from "@/app/actions/game-actions";
import { checkRateLimit } from "@/lib/redis";
import { createClient } from "@/lib/supabase/server";

const signedIn = () =>
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
    },
  } as never);

const guest = () =>
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
  } as never);

const limitExceeded = () =>
  vi
    .mocked(checkRateLimit)
    .mockRejectedValueOnce(
      new Error(
        "Rate limit exceeded for getDailyChallenge_anon. Please try again later.",
      ),
    );

describe("getDailyChallenge rate limit", () => {
  it("counts a guest call against the client IP", async () => {
    guest();
    limitExceeded();

    await expect(getDailyChallenge()).rejects.toThrow("Rate limit exceeded");
    expect(checkRateLimit).toHaveBeenCalledWith(
      "getDailyChallenge_anon",
      "203.0.113.7",
    );
  });

  it("does not turn an exceeded guest limit into an empty board", async () => {
    guest();
    limitExceeded();

    await expect(initializeGame()).rejects.toThrow("Rate limit exceeded");
  });

  it("rejects when a signed-in player exceeds the limit", async () => {
    signedIn();
    vi.mocked(checkRateLimit).mockRejectedValueOnce(
      new Error(
        "Rate limit exceeded for getDailyChallenge. Please try again later.",
      ),
    );

    await expect(getDailyChallenge()).rejects.toThrow("Rate limit exceeded");
  });
});
