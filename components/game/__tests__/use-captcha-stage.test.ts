import { describe, expect, it } from "vitest";

import {
  type CaptchaEvent,
  type CaptchaStage,
  captchaReducer,
} from "../use-captcha-stage";

const at = (stage: CaptchaStage, shownAt: number | null = null) =>
  ({
    attempt: 0,
    closingHoldMs: null,
    failure: "unknown",
    shownAt,
    stage,
  }) as const;

const run = (
  state: Parameters<typeof captchaReducer>[0],
  ...events: CaptchaEvent[]
): ReturnType<typeof captchaReducer> => {
  let next = state;
  for (const event of events) next = captchaReducer(next, event);
  return next;
};

describe("captchaReducer", () => {
  it("holds the dialog back when an invisible check asks for a click", () => {
    expect(run(at("pending"), { at: 0, type: "attention" }).stage).toBe(
      "attention",
    );
    expect(run(at("waiting", 0), { at: 5, type: "attention" }).stage).toBe(
      "interactive",
    );
    expect(run(at("failed", 0), { at: 5, type: "attention" }).stage).toBe(
      "failed",
    );
  });

  it("moves a timed stage on only while it is still current", () => {
    expect(
      run(at("attention"), { at: 0, from: "attention", type: "elapsed" }).stage,
    ).toBe("interactive");
    expect(
      run(at("pending"), { at: 0, from: "pending", type: "elapsed" }).stage,
    ).toBe("waiting");
    expect(
      run(at("none"), { at: 0, from: "attention", type: "elapsed" }).stage,
    ).toBe("none");
  });

  it("keeps the reason of a failure and counts the attempts", () => {
    const failed = run(at("pending"), { at: 7, kind: "clock", type: "fail" });
    expect(failed).toMatchObject({
      failure: "clock",
      shownAt: 7,
      stage: "failed",
    });
    const again = run(at("pending"), { at: 7, type: "ask-again" });
    expect(again).toMatchObject({ attempt: 1, stage: "interactive" });
  });

  it("closes a hidden dialog at once", () => {
    expect(run(at("pending"), { at: 100, type: "close" })).toMatchObject({
      closingHoldMs: null,
      stage: "none",
    });
  });

  it("keeps a dialog shown just before the token for the rest of its shortest time", () => {
    const shown = run(at("pending"), {
      at: 8000,
      from: "pending",
      type: "elapsed",
    });
    const closing = run(shown, { at: 8450, type: "close" });
    expect(closing).toMatchObject({ closingHoldMs: 1050, stage: "waiting" });
    expect(run(closing, { type: "closed" }).stage).toBe("none");
    // A dialog that was up long enough fades out at once.
    expect(run(shown, { at: 9600, type: "close" }).closingHoldMs).toBe(0);
  });

  it("opens again when the sign-in rejects the token while the dialog closes", () => {
    const closing = run(at("waiting", 0), { at: 200, type: "close" });
    const again = run(closing, { at: 400, type: "ask-again" });
    expect(again).toMatchObject({ closingHoldMs: null, stage: "interactive" });
    // A late "closed" from the old timer does not hide it.
    expect(run(again, { type: "closed" }).stage).toBe("interactive");
  });
});
