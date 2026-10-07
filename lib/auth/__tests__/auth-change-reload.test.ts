import { describe, expect, it } from "vitest";

import { shouldReloadOnAuthChange } from "../auth-change-reload";

const registered = (id: string) => ({ id, is_anonymous: false });

describe("shouldReloadOnAuthChange", () => {
  it("reloads when a registered user signs in over a known guest", () => {
    expect(
      shouldReloadOnAuthChange("guest-1", "SIGNED_IN", registered("user-1")),
    ).toBe(true);
  });

  it("does not reload when the same user signs in again", () => {
    expect(
      shouldReloadOnAuthChange("user-1", "SIGNED_IN", registered("user-1")),
    ).toBe(false);
  });

  it("does not reload on an anonymous sign-in", () => {
    expect(
      shouldReloadOnAuthChange("guest-1", "SIGNED_IN", {
        id: "guest-2",
        is_anonymous: true,
      }),
    ).toBe(false);
  });

  it("does not reload on sign-out", () => {
    expect(shouldReloadOnAuthChange("user-1", "SIGNED_OUT", null)).toBe(false);
  });

  it("does not reload when no user was known before", () => {
    expect(
      shouldReloadOnAuthChange(null, "SIGNED_IN", registered("user-1")),
    ).toBe(false);
  });

  it("does not reload on other events", () => {
    expect(
      shouldReloadOnAuthChange("guest-1", "TOKEN_REFRESHED", registered("x")),
    ).toBe(false);
  });
});
