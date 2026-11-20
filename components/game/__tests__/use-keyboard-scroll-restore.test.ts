import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useKeyboardScrollRestore } from "../use-keyboard-scroll-restore";

/** Simulates the browser scrolling the page, as iOS does when the keyboard opens. */
function setScrollY(top: number) {
  vi.stubGlobal("scrollY", top);
}

describe("useKeyboardScrollRestore", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("scrolls back to the position from before the keyboard opened", () => {
    const scrollTo = vi
      .spyOn(globalThis, "scrollTo")
      .mockReturnValue(undefined);
    const { result } = renderHook(() => useKeyboardScrollRestore());

    setScrollY(120);
    result.current.onFocus();
    setScrollY(460);
    result.current.onBlur();

    expect(scrollTo).toHaveBeenCalledWith({ behavior: "instant", top: 120 });
  });

  it("keeps the position when the player scrolled while typing", () => {
    const scrollTo = vi
      .spyOn(globalThis, "scrollTo")
      .mockReturnValue(undefined);
    const { result } = renderHook(() => useKeyboardScrollRestore());

    setScrollY(120);
    result.current.onFocus();
    document.dispatchEvent(new Event("touchmove"));
    result.current.onBlur();

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("does not scroll on a blur without a preceding focus", () => {
    const scrollTo = vi
      .spyOn(globalThis, "scrollTo")
      .mockReturnValue(undefined);
    const { result } = renderHook(() => useKeyboardScrollRestore());

    result.current.onBlur();

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("stops listening for touch scrolling after unmount", () => {
    const remove = vi.spyOn(document, "removeEventListener");
    const { unmount } = renderHook(() => useKeyboardScrollRestore());

    unmount();

    expect(remove).toHaveBeenCalledWith("touchmove", expect.any(Function));
  });
});
