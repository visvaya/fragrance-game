import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useMountEffect } from "../use-mount-effect";

describe("useMountEffect", () => {
  it("runs the effect once on mount", () => {
    const effect = vi.fn();

    renderHook(() => useMountEffect(effect));

    expect(effect).toHaveBeenCalledTimes(1);
  });

  it("does not run the effect again on re-render", () => {
    const effect = vi.fn();

    const { rerender } = renderHook(() => useMountEffect(effect));
    rerender();
    rerender();

    expect(effect).toHaveBeenCalledTimes(1);
  });

  it("executes the provided function body", () => {
    let executed = false;

    renderHook(() =>
      useMountEffect(() => {
        executed = true;
      }),
    );

    expect(executed).toBe(true);
  });

  it("independent instances each run their own effect once", () => {
    const effectA = vi.fn();
    const effectB = vi.fn();

    renderHook(() => useMountEffect(effectA));
    renderHook(() => useMountEffect(effectB));

    expect(effectA).toHaveBeenCalledTimes(1);
    expect(effectB).toHaveBeenCalledTimes(1);
  });
});
