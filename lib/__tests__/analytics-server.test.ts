import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockCaptureImmediate, mockIdentifyImmediate, MockPostHog } = vi.hoisted(
  () => {
    const _mockCaptureImmediate = vi.fn().mockResolvedValue(undefined);
    const _mockIdentifyImmediate = vi.fn().mockResolvedValue(undefined);
    // Must use regular function (not arrow) so `new PostHog()` is constructable
    const _MockPostHog = vi.fn(function MockPostHogCtor(this: any) {
      this.captureImmediate = _mockCaptureImmediate;
      this.identifyImmediate = _mockIdentifyImmediate;
    });
    return {
      mockCaptureImmediate: _mockCaptureImmediate,
      mockIdentifyImmediate: _mockIdentifyImmediate,
      MockPostHog: _MockPostHog,
    };
  },
);

vi.mock("posthog-node", () => ({ PostHog: MockPostHog }));

vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_POSTHOG_HOST: "https://app.posthog.com",
    NEXT_PUBLIC_POSTHOG_KEY: "phc_test_key",
  },
}));

// Import after mocks are in place
import { identifyUser, trackEvent } from "../analytics-server";

describe("analytics-server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore default successful implementations
    mockCaptureImmediate.mockResolvedValue(undefined);
    mockIdentifyImmediate.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("trackEvent", () => {
    it("calls captureImmediate with event name and properties", async () => {
      const props = { attempt: 2, perfumeId: "abc-123" };

      await trackEvent("game_guess", props, "user-xyz");

      expect(mockCaptureImmediate).toHaveBeenCalledWith({
        distinctId: "user-xyz",
        event: "game_guess",
        properties: props,
      });
    });

    it("uses anon_user as default distinctId", async () => {
      await trackEvent("page_view");

      expect(mockCaptureImmediate).toHaveBeenCalledWith(
        expect.objectContaining({ distinctId: "anon_user" }),
      );
    });

    it("passes custom distinctId when provided", async () => {
      await trackEvent("game_won", {}, "custom-user-id");

      expect(mockCaptureImmediate).toHaveBeenCalledWith(
        expect.objectContaining({ distinctId: "custom-user-id" }),
      );
    });

    it("does not throw when captureImmediate rejects with Error", async () => {
      mockCaptureImmediate.mockRejectedValueOnce(
        new Error("PostHog network timeout"),
      );
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
        /* no-op */
      });

      await expect(trackEvent("game_lost")).resolves.toBeUndefined();

      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to track event (sanitized):",
        "PostHog network timeout",
      );
    });

    it("handles non-Error rejection with 'Unknown error' message", async () => {
      mockCaptureImmediate.mockRejectedValueOnce("string rejection");
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
        /* no-op */
      });

      await expect(trackEvent("game_start")).resolves.toBeUndefined();

      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to track event (sanitized):",
        "Unknown error",
      );
    });
  });

  describe("identifyUser", () => {
    it("calls identifyImmediate with distinctId and properties", async () => {
      const props = { email: "test@example.com", plan: "free" };

      await identifyUser("user-abc", props);

      expect(mockIdentifyImmediate).toHaveBeenCalledWith({
        distinctId: "user-abc",
        properties: props,
      });
    });

    it("passes empty object as properties when none provided", async () => {
      await identifyUser("user-abc");

      expect(mockIdentifyImmediate).toHaveBeenCalledWith({
        distinctId: "user-abc",
        properties: {},
      });
    });

    it("does not throw when identifyImmediate rejects with Error", async () => {
      mockIdentifyImmediate.mockRejectedValueOnce(
        new Error("PostHog connection refused"),
      );
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
        /* no-op */
      });

      await expect(identifyUser("user-xyz")).resolves.toBeUndefined();

      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to identify user (sanitized):",
        "PostHog connection refused",
      );
    });

    it("handles non-Error rejection with 'Unknown error' message", async () => {
      mockIdentifyImmediate.mockRejectedValueOnce(42);
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
        /* no-op */
      });

      await expect(identifyUser("user-xyz")).resolves.toBeUndefined();

      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to identify user (sanitized):",
        "Unknown error",
      );
    });
  });

  describe("singleton client", () => {
    it("reuses the same PostHog instance across multiple calls", async () => {
      // The module is already loaded — PostHog was constructed once on first call.
      // Each subsequent call must NOT construct a new instance.
      const callsBefore = MockPostHog.mock.calls.length;

      await trackEvent("event-a");
      await trackEvent("event-b");
      await identifyUser("user-1");

      // No additional constructor calls after the singleton was created
      expect(MockPostHog.mock.calls).toHaveLength(callsBefore);
    });
  });
});
