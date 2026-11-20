import { describe, expect, it, vi } from "vitest";

import { signInAnonymousPlayer, verifyAuthSession } from "../anonymous-auth";

/** Supabase client stub whose getSession returns the given sessions in order. */
function clientStub(
  sessions: ({ user: { id: string } } | null)[],
  signInError: { message: string } | null = null,
) {
  const getSession = vi.fn();
  for (const session of sessions) {
    getSession.mockResolvedValueOnce({ data: { session } });
  }
  const signInAnonymously = vi.fn().mockResolvedValue({ error: signInError });
  return {
    client: { auth: { getSession, signInAnonymously } } as never,
    getSession,
    signInAnonymously,
  };
}

describe("signInAnonymousPlayer", () => {
  it("sends the captcha token with the first request", async () => {
    const { client, signInAnonymously } = clientStub([{ user: { id: "u1" } }]);

    const result = await signInAnonymousPlayer(client, "token");

    expect(signInAnonymously).toHaveBeenCalledWith({
      options: { captchaToken: "token" },
    });
    expect(result).toEqual({ ok: true, user: { id: "u1" }, verified: true });
  });

  it("signs in without options when no captcha is configured", async () => {
    const { client, signInAnonymously } = clientStub([{ user: { id: "u1" } }]);

    await signInAnonymousPlayer(client, null);

    expect(signInAnonymously).toHaveBeenCalledWith(undefined);
  });

  it("returns the Supabase message when the sign-in is rejected", async () => {
    const { client, getSession } = clientStub([], {
      message: "captcha failed",
    });

    const result = await signInAnonymousPlayer(client, "token");

    expect(result).toEqual({ message: "captcha failed", ok: false });
    expect(getSession).not.toHaveBeenCalled();
  });
});

describe("verifyAuthSession", () => {
  it("retries until the session is readable", async () => {
    const { client, getSession } = clientStub([null, { user: { id: "u1" } }]);

    const result = await verifyAuthSession(client);

    expect(getSession).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ user: { id: "u1" }, verified: true });
  });

  it("gives up after three attempts", async () => {
    const { client, getSession } = clientStub([null, null, null]);

    const result = await verifyAuthSession(client);

    expect(getSession).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ user: null, verified: false });
  });
});
