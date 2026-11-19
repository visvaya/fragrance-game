import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import { SkipAttemptButton } from "../skip-attempt-button";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

/** Renders the button inside the tooltip provider that the app layout supplies. */
function renderButton(onSkip: () => void) {
  return render(
    <TooltipProvider>
      <SkipAttemptButton
        busy={false}
        isRateLimited={false}
        onSkip={onSkip}
        sessionReady
      />
    </TooltipProvider>,
  );
}

/** Makes the button behave as on a phone (coarse pointer, no hover) or on a desktop. */
function setTouchScreen(isTouch: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    addEventListener: vi.fn(),
    matches: isTouch && query.includes("pointer: coarse"),
    media: query,
    removeEventListener: vi.fn(),
  }));
}

describe("SkipAttemptButton", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks for confirmation on a touch screen and skips only after it", async () => {
    setTouchScreen(true);
    const onSkip = vi.fn();
    const user = userEvent.setup();
    renderButton(onSkip);

    await user.click(screen.getByRole("button", { name: "skipTooltip" }));
    expect(onSkip).not.toHaveBeenCalled();

    await user.click(
      await screen.findByRole("button", { name: "skipConfirmConfirm" }),
    );
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("does not skip when the confirmation is cancelled", async () => {
    setTouchScreen(true);
    const onSkip = vi.fn();
    const user = userEvent.setup();
    renderButton(onSkip);

    await user.click(screen.getByRole("button", { name: "skipTooltip" }));
    await user.click(
      await screen.findByRole("button", { name: "skipConfirmCancel" }),
    );

    expect(onSkip).not.toHaveBeenCalled();
  });

  it("skips at once on a desktop", async () => {
    setTouchScreen(false);
    const onSkip = vi.fn();
    const user = userEvent.setup();
    renderButton(onSkip);

    await user.click(screen.getByRole("button", { name: "skipTooltip" }));

    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
