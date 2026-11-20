import { afterEach, describe, expect, it, vi } from "vitest";

import { whenIdle } from "../when-idle";

describe("whenIdle", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("uses requestIdleCallback with the timeout when the browser has it", () => {
    const requestIdleCallback = vi.fn().mockReturnValue(7);
    const cancelIdleCallback = vi.fn();
    vi.stubGlobal("requestIdleCallback", requestIdleCallback);
    vi.stubGlobal("cancelIdleCallback", cancelIdleCallback);
    const callback = vi.fn();

    const cancel = whenIdle(callback, 2000);
    cancel();

    expect(requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), {
      timeout: 2000,
    });
    expect(cancelIdleCallback).toHaveBeenCalledWith(7);
  });

  it("falls back to the timeout where requestIdleCallback is missing", () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestIdleCallback", undefined);
    const callback = vi.fn();

    whenIdle(callback, 2000);
    vi.advanceTimersByTime(1999);
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("runs at the first interaction when that comes before the idle moment", () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestIdleCallback", undefined);
    const callback = vi.fn();

    whenIdle(callback, 2000);
    document.dispatchEvent(new Event("pointerdown"));
    expect(callback).toHaveBeenCalledTimes(1);

    // Neither the timeout nor a later interaction runs it again.
    vi.advanceTimersByTime(2000);
    document.dispatchEvent(new Event("keydown"));
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("does not run the callback after cancel", () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestIdleCallback", undefined);
    const callback = vi.fn();

    const cancel = whenIdle(callback, 2000);
    cancel();
    vi.advanceTimersByTime(2000);

    expect(callback).not.toHaveBeenCalled();
  });
});
