import { describe, expect, it } from "vitest";

import { applyLocalStack, isLocalUrl, parseStatusEnv, wouldLoseRemoteValues } from "./local-env";

const STACK = { anonKey: "anon", apiUrl: "http://127.0.0.1:54321", serviceRoleKey: "service" };

describe("parseStatusEnv", () => {
  it("reads the quoted values the CLI prints", () => {
    const text = 'API_URL="http://127.0.0.1:54321"\nANON_KEY="anon"\nSERVICE_ROLE_KEY="service"\nDB_URL="x"\n';
    expect(parseStatusEnv(text)).toEqual({ ok: true, value: STACK });
  });

  it("rejects input without the keys", () => {
    expect(parseStatusEnv('API_URL="http://127.0.0.1:54321"\n').ok).toBe(false);
  });

  it("rejects a stack that is not on this machine", () => {
    const text = 'API_URL="https://abc.supabase.co"\nANON_KEY="a"\nSERVICE_ROLE_KEY="s"\n';
    expect(parseStatusEnv(text)).toEqual({ error: "API_URL https://abc.supabase.co is not a local stack", ok: false });
  });
});

describe("applyLocalStack", () => {
  it("replaces the Supabase lines and keeps the others in place", () => {
    const before = "# comment\nNEXT_PUBLIC_SUPABASE_URL=https://abc.supabase.co\nUPSTASH_REDIS_REST_URL=u\nSUPABASE_SERVICE_ROLE_KEY=prod\n";
    expect(applyLocalStack(before, STACK)).toBe(
      "# comment\nNEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321\nUPSTASH_REDIS_REST_URL=u\nSUPABASE_SERVICE_ROLE_KEY=service\n" +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY=anon\nTEST_SUPABASE_URL=http://127.0.0.1:54321\nTEST_SUPABASE_SERVICE_ROLE_KEY=service\n",
    );
  });

  it("writes all variables into an empty file", () => {
    expect(applyLocalStack("", STACK).split("\n").filter(Boolean)).toHaveLength(5);
  });
});

describe("wouldLoseRemoteValues", () => {
  it("refuses while production values have no other copy", () => {
    expect(wouldLoseRemoteValues("NEXT_PUBLIC_SUPABASE_URL=https://abc.supabase.co\n", false)).toBe(true);
  });

  it("allows the change once the remote file exists or the file is already local", () => {
    expect(wouldLoseRemoteValues("NEXT_PUBLIC_SUPABASE_URL=https://abc.supabase.co\n", true)).toBe(false);
    expect(wouldLoseRemoteValues("NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321\n", false)).toBe(false);
  });
});

describe("isLocalUrl", () => {
  it("accepts only loopback hosts", () => {
    expect(isLocalUrl("http://localhost:54321")).toBe(true);
    expect(isLocalUrl("http://127.0.0.1.example.com")).toBe(false);
    expect(isLocalUrl("not a url")).toBe(false);
  });
});
