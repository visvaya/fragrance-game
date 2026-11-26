import { describe, expect, it } from "vitest";

import { turnstileErrorKind } from "./turnstile-error";

describe("turnstileErrorKind", () => {
  it.each([
    ["600010", "challenge"],
    ["300030", "challenge"],
    ["200500", "blocked"],
    ["110600", "clock"],
    ["200100", "clock"],
    ["110620", "timeout"],
    ["110100", "config"],
    ["110110", "config"],
    ["110200", "config"],
    ["400020", "config"],
    ["400070", "config"],
    ["999999", "unknown"],
    ["", "unknown"],
    [undefined, "unknown"],
  ] as const)("reads %s as %s", (code, kind) => {
    expect(turnstileErrorKind(code)).toBe(kind);
  });
});
