import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateBrowserClient } = vi.hoisted(() => ({
  mockCreateBrowserClient: vi.fn().mockReturnValue({ auth: {}, from: vi.fn() }),
}));

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: mockCreateBrowserClient,
}));

vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    NEXT_PUBLIC_SUPABASE_URL: "https://testabc123.supabase.co",
  },
}));

import { createClient } from "../client";

describe("createClient (browser Supabase client)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateBrowserClient.mockReturnValue({ auth: {}, from: vi.fn() });
  });

  it("returns a Supabase client object", () => {
    const client = createClient();

    expect(client).toBeDefined();
    expect(mockCreateBrowserClient).toHaveBeenCalledTimes(1);
  });

  it("uses proxy URL (origin/api/db) in browser environment", () => {
    createClient();

    const [proxyUrl] = mockCreateBrowserClient.mock.calls[0];
    expect(proxyUrl).toBe(`${globalThis.location.origin}/api/db`);
  });

  it("passes the anon key as second argument", () => {
    createClient();

    const [, anonKey] = mockCreateBrowserClient.mock.calls[0];
    expect(anonKey).toBe("test-anon-key");
  });

  it("derives cookie name from project reference in Supabase URL", () => {
    createClient();

    const options = mockCreateBrowserClient.mock.calls[0][2];
    expect(options.cookieOptions?.name).toBe("sb-testabc123-auth-token");
  });
});
