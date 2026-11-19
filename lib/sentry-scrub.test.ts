import { describe, expect, it } from "vitest";

import { redactSensitive, scrubEvent } from "@/lib/sentry-scrub";

import type { ErrorEvent } from "@sentry/nextjs";

const event = (overrides: Partial<ErrorEvent> = {}): ErrorEvent => ({
  type: undefined,
  ...overrides,
});

const withMessage = (value: string) =>
  event({ exception: { values: [{ type: "Error", value }] } });

describe("redactSensitive", () => {
  it("redacts sensitive keys at any depth and keeps the rest", () => {
    expect(
      redactSensitive({
        nested: { accessToken: "t", list: [{ password: "p" }, "plain"] },
        url: "/en",
        userEmail: "a@b.c",
      }),
    ).toEqual({
      nested: {
        accessToken: "[REDACTED]",
        list: [{ password: "[REDACTED]" }, "plain"],
      },
      url: "/en",
      userEmail: "[REDACTED]",
    });
  });

  it("returns values that are not objects unchanged", () => {
    expect(redactSensitive("secret")).toBe("secret");
    expect(redactSensitive(null)).toBeNull();
  });
});

describe("scrubEvent", () => {
  it("drops the errors the game throws on purpose", () => {
    expect(scrubEvent(withMessage("CONFLICT: nonce changed"))).toBeNull();
    expect(scrubEvent(withMessage("Rate limit exceeded for guess"))).toBeNull();
  });

  it("keeps other errors and redacts breadcrumb data", () => {
    const scrubbed = scrubEvent({
      ...withMessage("TypeError: x is undefined"),
      breadcrumbs: [
        { category: "fetch", data: { token: "abc", url: "/api" } },
        { category: "ui.click" },
      ],
    });
    expect(scrubbed?.breadcrumbs).toEqual([
      { category: "fetch", data: { token: "[REDACTED]", url: "/api" } },
      { category: "ui.click" },
    ]);
  });

  it("removes the user's email and IP address", () => {
    const scrubbed = scrubEvent(
      event({ user: { email: "a@b.c", id: "u1", ip_address: "1.2.3.4" } }),
    );
    expect(scrubbed?.user).toEqual({ id: "u1" });
  });

  it("leaves an event without breadcrumbs or user as it is", () => {
    const plain = withMessage("Error");
    expect(scrubEvent(plain)).toEqual(plain);
  });
});
