import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => {
  const values = new Map<string, string>();
  return {
    delete: vi.fn((name: string) => {
      values.delete(name);
    }),
    get: vi.fn((name: string) => {
      const value = values.get(name);
      return value === undefined ? undefined : { name, value };
    }),
    set: vi.fn((name: string, value: string) => {
      values.set(name, value);
    }),
    values,
  };
});

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => {
    await Promise.resolve();
    return store;
  }),
}));

vi.mock("@/lib/env", () => ({
  env: { NODE_ENV: "test", SUPABASE_SERVICE_ROLE_KEY: "test-secret" },
}));

import {
  clearGuestTicket,
  ensureGuestTicket,
  issueGuestTicket,
  readGuestTicket,
} from "../guest-ticket-cookie";

const GUEST = "6f1c1d2e-3b4a-4c5d-8e9f-0a1b2c3d4e5f";
const OTHER_GUEST = "7a2d3e4f-5b6c-4d7e-9f80-1a2b3c4d5e6f";

describe("guest ticket cookie", () => {
  beforeEach(() => {
    store.values.clear();
    vi.clearAllMocks();
  });

  it("sets an httpOnly ticket and a readable hint", async () => {
    await issueGuestTicket(GUEST);
    const base = {
      maxAge: 2_592_000,
      path: "/",
      sameSite: "lax",
      secure: false,
    };
    expect(store.set).toHaveBeenCalledWith(
      "eauxle_guest_ticket",
      expect.any(String),
      {
        ...base,
        httpOnly: true,
      },
    );
    expect(store.set).toHaveBeenCalledWith("eauxle_guest_hint", "1", {
      ...base,
      httpOnly: false,
    });
  });

  it("reads back an issued ticket", async () => {
    const before = Date.now();
    await issueGuestTicket(GUEST);
    const ticket = await readGuestTicket();
    expect(ticket?.guestId).toBe(GUEST);
    expect(ticket?.issuedAtMs).toBeGreaterThanOrEqual(before);
    expect(ticket?.issuedAtMs).toBeLessThanOrEqual(Date.now());
  });

  it("returns null without a cookie", async () => {
    await expect(readGuestTicket()).resolves.toBeNull();
  });

  it("returns null for a garbage cookie", async () => {
    store.values.set("eauxle_guest_ticket", "garbage");
    await expect(readGuestTicket()).resolves.toBeNull();
  });

  it("clears both cookies", async () => {
    await issueGuestTicket(GUEST);
    await clearGuestTicket();
    expect(store.delete).toHaveBeenCalledWith("eauxle_guest_ticket");
    expect(store.delete).toHaveBeenCalledWith("eauxle_guest_hint");
    expect(store.values.size).toBe(0);
  });

  it("issues a ticket when none exists", async () => {
    await ensureGuestTicket(GUEST);
    const ticket = await readGuestTicket();
    expect(ticket?.guestId).toBe(GUEST);
  });

  it("leaves a valid ticket for the same guest alone", async () => {
    await issueGuestTicket(GUEST);
    store.set.mockClear();
    await ensureGuestTicket(GUEST);
    expect(store.set).not.toHaveBeenCalled();
  });

  it("replaces a ticket that names another guest", async () => {
    await issueGuestTicket(OTHER_GUEST);
    store.set.mockClear();
    await ensureGuestTicket(GUEST);
    expect(store.set).toHaveBeenCalledTimes(2);
    const ticket = await readGuestTicket();
    expect(ticket?.guestId).toBe(GUEST);
  });

  it("replaces an invalid ticket", async () => {
    store.values.set("eauxle_guest_ticket", "garbage");
    await ensureGuestTicket(GUEST);
    const ticket = await readGuestTicket();
    expect(ticket?.guestId).toBe(GUEST);
  });
});
