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

/**
 * Shortest time the dialog stays once shown, and how long it then fades out. The invisible
 * check often ends just after the loading note appears (2026-11: median 6.6 s against the 8 s
 * threshold), and a dialog gone within half a second reads as a glitch.
 */
export const CAPTCHA_DIALOG_TIMING = {
  fadeMs: 300,
  minVisibleMs: 1500,
} as const;

type CaptchaState = Readonly<{
  /** A new key remounts the widget for a fresh token after a rejected sign-in. */
  attempt: number;
  /** While closing: how long the dialog stays before it fades out; null otherwise. */
  closingHoldMs: number | null;
  failure: TurnstileErrorKind;
  /** When the dialog became visible (a `performance.now()` value); null while hidden. */
  shownAt: number | null;
  stage: CaptchaStage;
}>;

/** What can happen to the dialog; `at` is the time it happened (a `performance.now()` value). */
export type CaptchaEvent =
  | { type: "start" }
  /** A token came: hide the dialog, after its shortest visible time if it is showing. */
  | { at: number; type: "close" }
  /** The closing dialog has faded out. */
  | { type: "closed" }
  /** Cloudflare wants a click: an invisible check waits a moment, a visible dialog shows the widget. */
  | { at: number; type: "attention" }
  /** A timed stage ran out; ignored when the stage has changed meanwhile. */
  | { at: number; from: keyof typeof CAPTCHA_TIMED_STAGES; type: "elapsed" }
  /** The sign-in rejected the token: show the widget again for a fresh one. */
  | { at: number; type: "ask-again" }
  | { at: number; kind: TurnstileErrorKind; type: "fail" };

const isVisible = (stage: CaptchaStage) =>
  stage === "waiting" || stage === "interactive" || stage === "failed";

/** Moves to a stage, noting when the dialog became visible; a closing dialog stays open. */
function moveTo(
  state: CaptchaState,
  stage: CaptchaStage,
  at: number,
): CaptchaState {
  const shownAt = isVisible(stage) ? (state.shownAt ?? at) : null;
  return { ...state, closingHoldMs: null, shownAt, stage };
}

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
      return moveTo(state, "pending", 0);
    }
    case "close": {
      if (state.shownAt === null) return moveTo(state, "none", event.at);
      const shownFor = event.at - state.shownAt;
      return {
        ...state,
        closingHoldMs: Math.max(
          0,
          CAPTCHA_DIALOG_TIMING.minVisibleMs - shownFor,
        ),
      };
    }
    case "closed": {
      return state.closingHoldMs === null ? state : moveTo(state, "none", 0);
    }
    case "attention": {
      if (state.stage === "pending")
        return moveTo(state, "attention", event.at);
      return state.stage === "failed"
        ? state
        : moveTo(state, "interactive", event.at);
    }
    case "elapsed": {
      return state.stage === event.from
        ? moveTo(state, CAPTCHA_TIMED_STAGES[event.from].next, event.at)
        : state;
    }
    case "ask-again": {
      return {
        ...moveTo(state, "interactive", event.at),
        attempt: state.attempt + 1,
      };
    }
    case "fail": {
      return { ...moveTo(state, "failed", event.at), failure: event.kind };
    }
  }
}

const INITIAL_STATE: CaptchaState = {
  attempt: 0,
  closingHoldMs: null,
  failure: "unknown",
  shownAt: null,
  stage: "none",
};

/** State of the anonymous sign-in's Turnstile dialog; the caller runs the timers. */
export const useCaptchaStage = () => useReducer(captchaReducer, INITIAL_STATE);
