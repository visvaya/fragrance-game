import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useScrollLock } from "@/lib/hooks/use-scroll-lock";

import { lenisScrollTo, SmoothScrollProvider } from "../smooth-scroll-provider";

const { construct, destroy, raf, scrollTo, start, stop } = vi.hoisted(() => ({
  construct: vi.fn(),
  destroy: vi.fn(),
  raf: vi.fn(),
  scrollTo: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
}));

vi.mock("lenis", () => ({
  default: function FakeLenis(options: unknown) {
    construct(options);
    return { destroy, raf, scrollTo, start, stop };
  },
}));

const DESKTOP_WIDTH_PX = 1280;
const PHONE_WIDTH_PX = 412;

/** Sets the viewport width and the reduced-motion preference seen by the provider. */
function setViewport(widthPx: number, reducedMotion = false) {
  vi.stubGlobal("innerWidth", widthPx);
  vi.stubGlobal("matchMedia", (query: string) => ({
    addEventListener: vi.fn(),
    matches: reducedMotion && query.includes("prefers-reduced-motion"),
    media: query,
    removeEventListener: vi.fn(),
  }));
}

/** Collects animation frame callbacks so a test can run them one frame at a time. */
function stubAnimationFrames() {
  const pending = new Map<number, FrameRequestCallback>();
  const ids = { current: 0 };
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    ids.current += 1;
    pending.set(ids.current, callback);
    return ids.current;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    pending.delete(id);
  });
  return {
    pendingCount: () => pending.size,
    runFrame: () => {
      const callbacks = [...pending.values()];
      pending.clear();
      for (const callback of callbacks) callback(16);
    },
  };
}

/** Locks the page scroll while `locked`, like the verification dialog does. */
function ScrollLockProbe({ locked }: Readonly<{ locked: boolean }>) {
  useScrollLock(locked);
  return null;
}

describe("SmoothScrollProvider", () => {
  beforeEach(() => {
    construct.mockClear();
    destroy.mockClear();
    raf.mockClear();
    scrollTo.mockClear();
    start.mockClear();
    stop.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not load Lenis on a phone-sized viewport", async () => {
    setViewport(PHONE_WIDTH_PX);
    stubAnimationFrames();
    render(<SmoothScrollProvider>content</SmoothScrollProvider>);

    await Promise.resolve();
    expect(construct).not.toHaveBeenCalled();
  });

  it("does not load Lenis when the user prefers reduced motion", async () => {
    setViewport(DESKTOP_WIDTH_PX, true);
    stubAnimationFrames();
    render(<SmoothScrollProvider>content</SmoothScrollProvider>);

    await Promise.resolve();
    expect(construct).not.toHaveBeenCalled();
  });

  it("starts Lenis on a desktop viewport and scrolls through it", async () => {
    setViewport(DESKTOP_WIDTH_PX);
    const frames = stubAnimationFrames();
    const { unmount } = render(
      <SmoothScrollProvider>content</SmoothScrollProvider>,
    );

    await waitFor(() => expect(construct).toHaveBeenCalledTimes(1));
    frames.runFrame();
    expect(raf).toHaveBeenCalledTimes(1);

    lenisScrollTo(0);
    expect(scrollTo).toHaveBeenCalledWith(0);
    unmount();
  });

  it("stops the animation frame loop and destroys Lenis on unmount", async () => {
    setViewport(DESKTOP_WIDTH_PX);
    const frames = stubAnimationFrames();
    const { unmount } = render(
      <SmoothScrollProvider>content</SmoothScrollProvider>,
    );
    await waitFor(() => expect(construct).toHaveBeenCalledTimes(1));
    frames.runFrame();

    unmount();

    expect(destroy).toHaveBeenCalledTimes(1);
    expect(frames.pendingCount()).toBe(0);
  });

  it("does not start Lenis when unmounted before the module has loaded", async () => {
    setViewport(DESKTOP_WIDTH_PX);
    const frames = stubAnimationFrames();
    const { unmount } = render(
      <SmoothScrollProvider>content</SmoothScrollProvider>,
    );

    unmount();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(construct).not.toHaveBeenCalled();
    expect(frames.pendingCount()).toBe(0);
  });

  it("pauses Lenis while a dialog locks the page scroll and resumes it after", async () => {
    setViewport(DESKTOP_WIDTH_PX);
    stubAnimationFrames();
    const { rerender, unmount } = render(
      <SmoothScrollProvider>
        <ScrollLockProbe locked={false} />
      </SmoothScrollProvider>,
    );
    await waitFor(() => expect(construct).toHaveBeenCalledTimes(1));

    rerender(
      <SmoothScrollProvider>
        <ScrollLockProbe locked />
      </SmoothScrollProvider>,
    );
    await waitFor(() => expect(stop).toHaveBeenCalled());

    rerender(
      <SmoothScrollProvider>
        <ScrollLockProbe locked={false} />
      </SmoothScrollProvider>,
    );
    await waitFor(() => expect(start).toHaveBeenCalled());
    unmount();
  });
});
