import { useState } from "react";

import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { captureAnalyticsEvent, PostHogProvider } from "../posthog-provider";

const { capture, init } = vi.hoisted(() => ({
  capture: vi.fn(),
  init: vi.fn(),
}));

vi.mock("posthog-js", () => ({ default: { capture, init } }));

const mountCount = { current: 0 };

/** Child with local state; remounting it would reset the counter to zero. */
function StatefulChild() {
  const [count, setCount] = useState(() => {
    mountCount.current += 1;
    return 0;
  });
  return (
    <button onClick={() => setCount((previous) => previous + 1)} type="button">
      count {count}
    </button>
  );
}

describe("PostHogProvider", () => {
  beforeEach(() => {
    mountCount.current = 0;
    capture.mockClear();
    init.mockClear();
  });

  it("keeps the subtree mounted when PostHog loads after the first interaction", async () => {
    const user = userEvent.setup();
    render(
      <PostHogProvider>
        <StatefulChild />
      </PostHogProvider>,
    );

    // The first click both changes child state and triggers the lazy PostHog load.
    await user.click(screen.getByRole("button", { name: "count 0" }));
    await waitFor(() => expect(init).toHaveBeenCalledTimes(1));
    // Let the provider finish its post-load state updates.
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole("button", { name: "count 1" })).toBeInTheDocument();
    expect(mountCount.current).toBe(1);
  });

  it("forwards events to PostHog once it has loaded", async () => {
    const user = userEvent.setup();
    render(
      <PostHogProvider>
        <StatefulChild />
      </PostHogProvider>,
    );

    await user.click(screen.getByRole("button", { name: "count 0" }));
    await waitFor(() => expect(init).toHaveBeenCalledTimes(1));
    captureAnalyticsEvent("test_event", { a: 1 });

    expect(capture).toHaveBeenCalledWith("test_event", { a: 1 });
  });
});
