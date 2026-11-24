import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useScrollLock } from "../use-scroll-lock";

afterEach(() => {
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
});

describe("useScrollLock", () => {
  it("locks the html scroll container as well as body, and restores both", () => {
    // globals.css makes html the scroll container (overflow-y: auto), so a lock on body alone
    // leaves the page scrollable when the smooth scroll provider is not running.
    document.documentElement.style.overflow = "auto";
    const { rerender } = renderHook(({ active }) => useScrollLock(active), {
      initialProps: { active: true },
    });

    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(document.body.style.overflow).toBe("hidden");

    rerender({ active: false });

    expect(document.documentElement.style.overflow).toBe("auto");
    expect(document.body.style.overflow).toBe("");
  });
});
