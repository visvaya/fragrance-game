/** Interactions that mean the player is about to play, so waiting longer only costs them. */
const INTERACTION_EVENTS = ["pointerdown", "keydown", "focusin"] as const;

/**
 * Starts the idle wait: `requestIdleCallback` with a timeout, or only the timeout in browsers
 * without it (Safari).
 * @param run - Called once the wait ends.
 * @param timeoutMs - Longest wait.
 * @returns A function that cancels the wait.
 */
function startIdleTimer(run: () => void, timeoutMs: number): () => void {
  if (typeof globalThis.requestIdleCallback === "function") {
    const id = globalThis.requestIdleCallback(run, { timeout: timeoutMs });
    return () => globalThis.cancelIdleCallback(id);
  }
  const id = globalThis.setTimeout(run, timeoutMs);
  return () => globalThis.clearTimeout(id);
}

/**
 * Runs the callback once: at the player's first interaction, when the browser is idle, or
 * after `timeoutMs` at the latest, whichever comes first.
 * @param callback - Work that can wait until start-up rendering is done.
 * @param timeoutMs - Longest wait.
 * @returns A function that cancels the pending callback.
 */
export function whenIdle(callback: () => void, timeoutMs: number): () => void {
  const done = { current: false };

  function stop() {
    done.current = true;
    cancelTimer();
    for (const type of INTERACTION_EVENTS) {
      document.removeEventListener(type, run, { capture: true });
    }
  }

  function run() {
    if (done.current) return;
    stop();
    callback();
  }

  for (const type of INTERACTION_EVENTS) {
    document.addEventListener(type, run, { capture: true, passive: true });
  }
  const cancelTimer = startIdleTimer(run, timeoutMs);

  return stop;
}
