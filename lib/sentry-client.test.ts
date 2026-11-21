import { beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({
  captureException: vi.fn(),
  getClient: vi.fn(),
  init: vi.fn(),
  setUser: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => sentry);

import { scrubEvent } from "./sentry-scrub";
import {
  reportClientError,
  setClientUser,
  startSentryClient,
} from "./sentry-client";

describe("startSentryClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts the SDK with the scrubber when no client exists", () => {
    sentry.getClient.mockReturnValue(undefined);

    startSentryClient();

    expect(sentry.init).toHaveBeenCalledTimes(1);
    expect(sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        beforeSend: scrubEvent,
        dataCollection: expect.objectContaining({
          cookies: false,
          httpBodies: [],
          userInfo: false,
        }),
      }),
    );
  });

  it("does not start the SDK twice", () => {
    sentry.getClient.mockReturnValue({});

    startSentryClient();

    expect(sentry.init).not.toHaveBeenCalled();
  });
});

describe("reportClientError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts the SDK before reporting an error from the first seconds", () => {
    sentry.getClient.mockReturnValue(undefined);
    const error = new Error("boom");

    reportClientError(error);

    expect(sentry.init).toHaveBeenCalledTimes(1);
    expect(sentry.captureException).toHaveBeenCalledWith(error);
    expect(sentry.init.mock.invocationCallOrder[0]).toBeLessThan(
      sentry.captureException.mock.invocationCallOrder[0] ?? 0,
    );
  });
});

describe("setClientUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts the SDK before setting the player's id", () => {
    sentry.getClient.mockReturnValue(undefined);

    setClientUser({ id: "player-1" });

    expect(sentry.setUser).toHaveBeenCalledWith({ id: "player-1" });
    expect(sentry.init.mock.invocationCallOrder[0]).toBeLessThan(
      sentry.setUser.mock.invocationCallOrder[0] ?? 0,
    );
  });
});
