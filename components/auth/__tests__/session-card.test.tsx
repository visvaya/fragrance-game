import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SessionCard, type Session } from "../session-card";

const { mockToast } = vi.hoisted(() => ({
  mockToast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/lib/toast", () => ({ toast: mockToast }));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => (key === "code" ? "en" : key),
}));

const session: Session = {
  created_at: "2026-11-16T08:00:00.000Z",
  device_info: { browser: "Firefox", os: "Linux" },
  id: "3f0e4f7a-8f4b-4f7e-9d43-6c2f5f1a2b3c",
  ip_address: "203.0.113.7",
  last_active_at: "2026-11-16T08:00:00.000Z",
};

const revokeButton = () => screen.getByRole("button");

describe("SessionCard revoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows an error and re-enables the button when the action reports a failure", async () => {
    const onRevoke = vi
      .fn()
      .mockResolvedValue({ error: "rpc failed", success: false });
    render(
      <SessionCard isCurrent={false} onRevoke={onRevoke} session={session} />,
    );

    await userEvent.click(revokeButton());

    await waitFor(() =>
      expect(mockToast.error).toHaveBeenCalledWith("revokeError"),
    );
    expect(revokeButton()).toBeEnabled();
  });

  it("shows an error and re-enables the button when the action throws", async () => {
    const onRevoke = vi
      .fn()
      .mockRejectedValue(new Error("Rate limit exceeded"));
    render(
      <SessionCard isCurrent={false} onRevoke={onRevoke} session={session} />,
    );

    await userEvent.click(revokeButton());

    await waitFor(() =>
      expect(mockToast.error).toHaveBeenCalledWith("revokeError"),
    );
    expect(revokeButton()).toBeEnabled();
  });

  it("shows no error when the action succeeds", async () => {
    const onRevoke = vi.fn().mockResolvedValue({ success: true });
    render(
      <SessionCard isCurrent={false} onRevoke={onRevoke} session={session} />,
    );

    await userEvent.click(revokeButton());

    await waitFor(() => expect(onRevoke).toHaveBeenCalledWith(session.id));
    expect(mockToast.error).not.toHaveBeenCalled();
  });
});
