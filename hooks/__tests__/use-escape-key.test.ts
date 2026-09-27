import { renderHook } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { useEscapeKey } from "../use-escape-key";

describe("useEscapeKey", () => {
  it("calls the handler when Escape is pressed while active", async () => {
    const onEscape = vi.fn();
    renderHook(() => {
      useEscapeKey(true, onEscape);
    });

    await userEvent.keyboard("{Escape}");

    expect(onEscape).toHaveBeenCalledOnce();
  });

  it("ignores other keys", async () => {
    const onEscape = vi.fn();
    renderHook(() => {
      useEscapeKey(true, onEscape);
    });

    await userEvent.keyboard("{Enter}a");

    expect(onEscape).not.toHaveBeenCalled();
  });

  it("does not listen while inactive", async () => {
    const onEscape = vi.fn();
    renderHook(() => {
      useEscapeKey(false, onEscape);
    });

    await userEvent.keyboard("{Escape}");

    expect(onEscape).not.toHaveBeenCalled();
  });

  it("stops listening after it becomes inactive", async () => {
    const onEscape = vi.fn();
    const { rerender } = renderHook(
      ({ active }) => {
        useEscapeKey(active, onEscape);
      },
      { initialProps: { active: true } },
    );

    rerender({ active: false });
    await userEvent.keyboard("{Escape}");

    expect(onEscape).not.toHaveBeenCalled();
  });
});
