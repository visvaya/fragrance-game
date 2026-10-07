import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MigrationModal } from "../migration-modal";

const {
  mockDecline,
  mockGetPending,
  mockMerge,
  mockSignOut,
  mockToast,
  mockUseGameState,
} = vi.hoisted(() => ({
  mockDecline: vi.fn(),
  mockGetPending: vi.fn(),
  mockMerge: vi.fn(),
  mockSignOut: vi.fn(),
  mockToast: { error: vi.fn(), success: vi.fn() },
  mockUseGameState: vi.fn(),
}));

vi.mock("@/app/actions/guest-merge-actions", () => ({
  declineGuestMerge: mockDecline,
  getPendingGuestMerge: mockGetPending,
  mergeGuestGames: mockMerge,
}));

vi.mock("@/components/game/contexts/game-state-context", () => ({
  useGameState: mockUseGameState,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signOut: mockSignOut } }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("sonner", () => ({ toast: mockToast }));

const registered = { id: "user-1", is_anonymous: false };
const anonymous = { id: "anon-1", is_anonymous: true };

function setHintCookie(present: boolean) {
  Object.defineProperty(document, "cookie", {
    configurable: true,
    get: () => (present ? "other=x; eauxle_guest_hint=1" : "other=x"),
  });
}

async function renderModal(user: unknown, expectCheck = true) {
  mockUseGameState.mockReturnValue({ user });
  render(<MigrationModal />);
  if (expectCheck) {
    await waitFor(() => {
      expect(mockGetPending).toHaveBeenCalled();
    });
  }
}

async function openPendingModal() {
  setHintCookie(true);
  mockGetPending.mockResolvedValue({ pending: true, todayMoves: false });
  await renderModal(registered);
  await screen.findByRole("dialog");
}

describe("MigrationModal", () => {
  const reload = vi.fn();
  const confirmSpy = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("confirm", confirmSpy);
    vi.stubGlobal("location", { reload });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not ask the server without the hint cookie", async () => {
    setHintCookie(false);
    await renderModal(registered, false);
    expect(mockGetPending).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not ask the server for an anonymous user", async () => {
    setHintCookie(true);
    await renderModal(anonymous, false);
    expect(mockGetPending).not.toHaveBeenCalled();
  });

  it("stays closed when nothing is pending", async () => {
    setHintCookie(true);
    mockGetPending.mockResolvedValue({ pending: false });
    await renderModal(registered);
    expect(mockGetPending).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the today line when today's game moves", async () => {
    setHintCookie(true);
    mockGetPending.mockResolvedValue({ pending: true, todayMoves: true });
    await renderModal(registered);
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByText("title")).toBeTruthy();
    expect(screen.getByText("description")).toBeTruthy();
    expect(screen.getByText("today")).toBeTruthy();
  });

  it("hides the today line when today's game does not move", async () => {
    setHintCookie(true);
    mockGetPending.mockResolvedValue({ pending: true, todayMoves: false });
    await renderModal(registered);
    expect(await screen.findByText("title")).toBeTruthy();
    expect(screen.queryByText("today")).toBeNull();
  });

  describe("with a pending merge", () => {
    it("merges and reloads on success", async () => {
      await openPendingModal();
      mockMerge.mockResolvedValue({ success: true });
      await userEvent.click(screen.getByRole("button", { name: "confirm" }));
      expect(mockMerge).toHaveBeenCalledTimes(1);
      expect(mockToast.success).toHaveBeenCalledWith("success");
      expect(reload).toHaveBeenCalledTimes(1);
      expect(mockSignOut).not.toHaveBeenCalled();
    });

    it("keeps the dialog open when the merge fails", async () => {
      await openPendingModal();
      mockMerge.mockResolvedValue({ error: "boom" });
      await userEvent.click(screen.getByRole("button", { name: "confirm" }));
      expect(mockToast.error).toHaveBeenCalledWith("error");
      expect(reload).not.toHaveBeenCalled();
      expect(mockSignOut).not.toHaveBeenCalled();
      expect(screen.getByRole("dialog")).toBeTruthy();
      expect(
        screen
          .getByRole("button", { name: "confirm" })
          .hasAttribute("disabled"),
      ).toBe(false);
    });

    it("does not decline when the confirmation is cancelled", async () => {
      await openPendingModal();
      confirmSpy.mockReturnValue(false);
      await userEvent.click(screen.getByRole("button", { name: "cancel" }));
      expect(confirmSpy).toHaveBeenCalledWith("cancelConfirm");
      expect(mockDecline).not.toHaveBeenCalled();
      expect(screen.getByRole("dialog")).toBeTruthy();
    });

    it("asks without the today sentence when today's game does not move", async () => {
      await openPendingModal();
      confirmSpy.mockReturnValue(false);
      await userEvent.click(screen.getByRole("button", { name: "cancel" }));
      expect(confirmSpy).toHaveBeenCalledWith("cancelConfirm");
    });

    it("asks with the today sentence when today's game moves", async () => {
      setHintCookie(true);
      mockGetPending.mockResolvedValue({ pending: true, todayMoves: true });
      await renderModal(registered);
      await screen.findByRole("dialog");
      confirmSpy.mockReturnValue(false);
      await userEvent.keyboard("{Escape}");
      expect(confirmSpy).toHaveBeenCalledWith("cancelConfirmToday");
      await userEvent.click(screen.getByRole("button", { name: "cancel" }));
      expect(confirmSpy).toHaveBeenLastCalledWith("cancelConfirmToday");
    });

    it("declines and reloads when the confirmation is accepted", async () => {
      await openPendingModal();
      confirmSpy.mockReturnValue(true);
      mockDecline.mockResolvedValue({ success: true });
      await userEvent.click(screen.getByRole("button", { name: "cancel" }));
      expect(mockDecline).toHaveBeenCalledTimes(1);
      expect(reload).toHaveBeenCalledTimes(1);
      expect(mockSignOut).not.toHaveBeenCalled();
    });

    it("keeps the dialog open when the decline fails", async () => {
      await openPendingModal();
      confirmSpy.mockReturnValue(true);
      mockDecline.mockResolvedValue({ error: "boom" });
      await userEvent.click(screen.getByRole("button", { name: "cancel" }));
      expect(mockToast.error).toHaveBeenCalledWith("declineError");
      expect(reload).not.toHaveBeenCalled();
      expect(mockSignOut).not.toHaveBeenCalled();
      expect(screen.getByRole("dialog")).toBeTruthy();
    });

    it("closes on Escape after a failed decline without declining again", async () => {
      await openPendingModal();
      confirmSpy.mockReturnValue(true);
      mockDecline.mockResolvedValue({ error: "boom" });
      await userEvent.click(screen.getByRole("button", { name: "cancel" }));
      await userEvent.keyboard("{Escape}");
      expect(mockDecline).toHaveBeenCalledTimes(1);
      expect(confirmSpy).toHaveBeenCalledTimes(1);
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
    });

    it("closes on Escape after a decline that throws", async () => {
      await openPendingModal();
      confirmSpy.mockReturnValue(true);
      mockDecline.mockRejectedValue(new Error("Too many requests"));
      await userEvent.keyboard("{Escape}");
      expect(mockToast.error).toHaveBeenCalledWith("declineError");
      await userEvent.keyboard("{Escape}");
      expect(mockDecline).toHaveBeenCalledTimes(1);
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
    });

    it("treats Escape like cancel", async () => {
      await openPendingModal();
      confirmSpy.mockReturnValue(true);
      mockDecline.mockResolvedValue({ success: true });
      await userEvent.keyboard("{Escape}");
      expect(confirmSpy).toHaveBeenCalledWith("cancelConfirm");
      expect(mockDecline).toHaveBeenCalledTimes(1);
      expect(reload).toHaveBeenCalledTimes(1);
      expect(mockSignOut).not.toHaveBeenCalled();
    });
  });
});
