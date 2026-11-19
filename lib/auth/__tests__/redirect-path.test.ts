import { describe, expect, it } from "vitest";

import { redirectPathFrom } from "../redirect-path";

const pathOf = (query: string) => redirectPathFrom(new URLSearchParams(query));

describe("redirectPathFrom", () => {
  it("keeps a same-site path", () => {
    expect(pathOf("next=/auth/reset-password")).toBe("/auth/reset-password");
  });

  it("falls back to the home page without a next parameter", () => {
    expect(pathOf("code=abc")).toBe("/");
  });

  it.each([
    ["a protocol-relative URL", "next=//evil.example"],
    ["an absolute URL", "next=https://evil.example"],
    ["a relative path", "next=auth/login"],
    ["an empty value", "next="],
  ])("rejects %s", (_, query) => {
    expect(pathOf(query)).toBe("/");
  });
});
