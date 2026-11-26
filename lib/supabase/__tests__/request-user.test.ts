import { describe, expect, it, vi } from "vitest";

import { getRequestUser } from "../request-user";
import { createClient } from "../server";

vi.mock("../server", () => ({ createClient: vi.fn() }));

describe("getRequestUser", () => {
  it("returns the client, the checked user and the auth error", async () => {
    const authError = new Error("expired");
    const getUser = vi
      .fn()
      .mockResolvedValueOnce({ data: { user: { id: "u1" } }, error: null })
      .mockResolvedValueOnce({ data: { user: null }, error: authError });
    const client = { auth: { getUser } };
    vi.mocked(createClient).mockResolvedValue(client as never);

    expect(await getRequestUser()).toEqual({
      error: null,
      supabase: client,
      user: { id: "u1" },
    });
    expect(await getRequestUser()).toEqual({
      error: authError,
      supabase: client,
      user: null,
    });
  });
});
