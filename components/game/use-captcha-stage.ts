import { useReducer } from "react";

import type { TurnstileErrorKind } from "@/lib/auth/turnstile-error";

/**
 * "none": no check; "pending": Turnstile runs invisibly; "attention": Cloudflare asked for a
 * click and the dialog waits a moment in case the check passes on its own; "waiting": the
 * check is slow and the dialog says so; "interactive": the dialog shows the widget; "failed":
 * the dialog says why and offers a reload.
 */
export type CaptchaStage =
  | "none"
  | "pending"
  | "attention"
  | "waiting"
  | "interactive"
  | "failed";

/**
 * Stages that move on by themselves after a delay, with the delay and the next stage. The
 * invisible check normally ends within seconds; if it does not, the dialog shows a loading
 * note. After Cloudflare asks for a click the check often passes on its own within a moment,
 * and a dialog shown for a blink only startles the player.
 */
export const CAPTCHA_TIMED_STAGES = {
  attention: { delayMs: 1000, next: "interactive" },
  pending: { delayMs: 8000, next: "waiting" },
} as const satisfies Partial<
  Record<CaptchaStage, { delayMs: number; next: CaptchaStage }>
>;

type CaptchaState = Readonly<{
  /** A new key remounts the widget for a fresh token after a rejected sign-in. */
  attempt: number;
  failure: TurnstileErrorKind;
  stage: CaptchaStage;
}>;

/** What can happen to the dialog. */
export type CaptchaEvent =
  | { type: "start" }
  | { type: "close" }
  /** Cloudflare wants a click: an invisible check waits a moment, a visible dialog shows the widget. */
  | { type: "attention" }
  /** A timed stage ran out; ignored when the stage has changed meanwhile. */
  | { from: keyof typeof CAPTCHA_TIMED_STAGES; type: "elapsed" }
  /** The sign-in rejected the token: show the widget again for a fresh one. */
  | { type: "ask-again" }
  | { kind: TurnstileErrorKind; type: "fail" };

/**
 * Next state of the dialog.
 * @param state - Current state.
 * @param event - What happened.
 */
export function captchaReducer(
  state: CaptchaState,
  event: CaptchaEvent,
): CaptchaState {
  switch (event.type) {
    case "start": {
      return { ...state, stage: "pending" };
    }
    case "close": {
      return { ...state, stage: "none" };
    }
    case "attention": {
      if (state.stage === "pending") return { ...state, stage: "attention" };
      return state.stage === "failed"
        ? state
        : { ...state, stage: "interactive" };
    }
    case "elapsed": {
      return state.stage === event.from
        ? { ...state, stage: CAPTCHA_TIMED_STAGES[event.from].next }
        : state;
    }
    case "ask-again": {
      return { ...state, attempt: state.attempt + 1, stage: "interactive" };
    }
    case "fail": {
      return { ...state, failure: event.kind, stage: "failed" };
    }
  }
}

const INITIAL_STATE: CaptchaState = {
  attempt: 0,
  failure: "unknown",
  stage: "none",
};

/** State of the anonymous sign-in's Turnstile dialog; the caller runs the timers. */
export const useCaptchaStage = () => useReducer(captchaReducer, INITIAL_STATE);
