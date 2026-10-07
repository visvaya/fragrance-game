import { revalidatePath } from "next/cache";

import * as Sentry from "@sentry/nextjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearGuestTicket,
  readGuestTicket,
} from "@/lib/auth/guest-ticket-cookie";
import { checkRateLimit } from "@/lib/redis";
import { createAdminClient, createClient } from "@/lib/supabase/server";

import {
  declineGuestMerge,
  getPendingGuestMerge,
  mergeGuestGames,
} from "../guest-merge-actions";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/redis", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/auth/guest-ticket-cookie", () => ({
  clearGuestTicket: vi.fn(),
  readGuestTicket: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
}));

const ACCOUNT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const GUEST_ID = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const TICKET = { guestId: GUEST_ID, issuedAtMs: 1_700_000_000_000 };

const rpc = vi.fn();

function signInAs(user: { id: string; is_anonymous: boolean } | null): void {
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockReset();
  vi.mocked(createAdminClient).mockReturnValue({ rpc } as never);
  vi.mocked(checkRateLimit).mockResolvedValue();
  vi.mocked(readGuestTicket).mockResolvedValue(TICKET);
  signInAs({ id: ACCOUNT_ID, is_anonymous: false });
});

describe.each([
  ["no user", null],
  ["an anonymous user", { id: GUEST_ID, is_anonymous: true }],
])("with %s", (_label, user) => {
  beforeEach(() => {
    signInAs(user);
  });

  it("getPendingGuestMerge reports nothing pending", async () => {
    await expect(getPendingGuestMerge()).resolves.toEqual({ pending: false });
    expect(rpc).not.toHaveBeenCalled();
    expect(clearGuestTicket).not.toHaveBeenCalled();
  });

  it.each([
    ["mergeGuestGames", mergeGuestGames],
    ["declineGuestMerge", declineGuestMerge],
  ])("%s refuses", async (_name, action) => {
    await expect(action()).resolves.toEqual({ error: "Not signed in" });
    expect(rpc).not.toHaveBeenCalled();
    expect(clearGuestTicket).not.toHaveBeenCalled();
  });
});

describe("getPendingGuestMerge", () => {
  it("returns nothing pending without a valid ticket and clears the stale hint", async () => {
    vi.mocked(readGuestTicket).mockResolvedValue(null);
    await expect(getPendingGuestMerge()).resolves.toEqual({ pending: false });
    expect(rpc).not.toHaveBeenCalled();
    expect(clearGuestTicket).toHaveBeenCalledTimes(1);
  });

  it("clears the ticket when the guest has no games", async () => {
    rpc.mockResolvedValue({
      data: { guest_games: 0, today_moves: false },
      error: null,
    });
    await expect(getPendingGuestMerge()).resolves.toEqual({ pending: false });
    expect(rpc).toHaveBeenCalledWith("guest_merge_preview", {
      p_account_id: ACCOUNT_ID,
      p_guest_id: GUEST_ID,
    });
    expect(clearGuestTicket).toHaveBeenCalledTimes(1);
  });

  it("reports a pending merge with the today flag", async () => {
    rpc.mockResolvedValue({
      data: { guest_games: 2, today_moves: true },
      error: null,
    });
    await expect(getPendingGuestMerge()).resolves.toEqual({
      pending: true,
      todayMoves: true,
    });
    expect(clearGuestTicket).not.toHaveBeenCalled();
  });

  it("reports an RPC error to Sentry and keeps the ticket", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "XX000", message: "boom" },
    });
    await expect(getPendingGuestMerge()).resolves.toEqual({ pending: false });
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(clearGuestTicket).not.toHaveBeenCalled();
  });

  it("treats a malformed payload like an RPC error", async () => {
    rpc.mockResolvedValue({ data: { guest_games: "2" }, error: null });
    await expect(getPendingGuestMerge()).resolves.toEqual({ pending: false });
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(clearGuestTicket).not.toHaveBeenCalled();
  });
});

describe.each([
  ["mergeGuestGames", mergeGuestGames, "merge", "guestMerge"],
  ["declineGuestMerge", declineGuestMerge, "today_only", "guestDecline"],
] as const)("%s", (_name, action, mode, limiter) => {
  it("transfers with the ticket's guest id and clears the ticket", async () => {
    rpc.mockResolvedValue({ data: { moved_sessions: 3 }, error: null });
    await expect(action()).resolves.toEqual({ success: true });
    expect(checkRateLimit).toHaveBeenCalledWith(limiter, ACCOUNT_ID);
    expect(rpc).toHaveBeenCalledWith("transfer_guest_games", {
      p_account_id: ACCOUNT_ID,
      p_guest_id: GUEST_ID,
      p_mode: mode,
    });
    expect(clearGuestTicket).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("keeps the ticket and returns an error when the RPC fails", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate" },
    });
    await expect(action()).resolves.toEqual({ error: "Transfer failed" });
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(clearGuestTicket).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("clears the ticket when the transfer rejects its input", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "22023", message: "source is not a guest account" },
    });
    await expect(action()).resolves.toEqual({ error: "Transfer failed" });
    expect(clearGuestTicket).toHaveBeenCalledTimes(1);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns an error without a valid ticket", async () => {
    vi.mocked(readGuestTicket).mockResolvedValue(null);
    await expect(action()).resolves.toEqual({ error: "No guest games" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("propagates a rate limit rejection before any RPC", async () => {
    vi.mocked(checkRateLimit).mockRejectedValue(new Error("Too many requests"));
    await expect(action()).rejects.toThrow("Too many requests");
    expect(rpc).not.toHaveBeenCalled();
  });
});
