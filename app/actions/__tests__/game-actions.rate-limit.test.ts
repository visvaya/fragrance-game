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
vi.mock("@/lib/analytics-server", () => ({
  identifyUser: vi.fn(),
  trackEvent: vi.fn(),
}));

import { getDailyChallenge } from "@/app/actions/game-actions";
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

describe("getDailyChallenge rate limit", () => {
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
