/**
 * Runs the callback when the browser is idle, or after `timeoutMs` at the latest. Safari has
 * no `requestIdleCallback`, so there the callback runs after the timeout.
 * @param callback - Work that can wait until start-up rendering is done.
 * @param timeoutMs - Longest wait.
 * @returns A function that cancels the pending callback.
 */
export function whenIdle(callback: () => void, timeoutMs: number): () => void {
  if (typeof globalThis.requestIdleCallback === "function") {
    const id = globalThis.requestIdleCallback(callback, { timeout: timeoutMs });
    return () => globalThis.cancelIdleCallback(id);
  }
  const id = globalThis.setTimeout(callback, timeoutMs);
  return () => globalThis.clearTimeout(id);
}
