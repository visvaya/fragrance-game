import { describe, expect, it } from "vitest";

import { type CaptchaStage, captchaReducer } from "../use-captcha-stage";

const at = (stage: CaptchaStage) =>
  ({ attempt: 0, failure: "unknown", stage }) as const;

describe("captchaReducer", () => {
  it("holds the dialog back when an invisible check asks for a click", () => {
    expect(captchaReducer(at("pending"), { type: "attention" }).stage).toBe(
      "attention",
    );
    expect(captchaReducer(at("waiting"), { type: "attention" }).stage).toBe(
      "interactive",
    );
    expect(captchaReducer(at("failed"), { type: "attention" }).stage).toBe(
      "failed",
    );
  });

  it("moves a timed stage on only while it is still current", () => {
    expect(
      captchaReducer(at("attention"), { from: "attention", type: "elapsed" })
        .stage,
    ).toBe("interactive");
    expect(
      captchaReducer(at("pending"), { from: "pending", type: "elapsed" }).stage,
    ).toBe("waiting");
    expect(
      captchaReducer(at("none"), { from: "attention", type: "elapsed" }).stage,
    ).toBe("none");
  });

  it("keeps the reason of a failure and counts the attempts", () => {
    expect(
      captchaReducer(at("pending"), { kind: "clock", type: "fail" }),
    ).toEqual({ attempt: 0, failure: "clock", stage: "failed" });
    expect(captchaReducer(at("pending"), { type: "ask-again" })).toEqual({
      attempt: 1,
      failure: "unknown",
      stage: "interactive",
    });
  });
});
