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
      <div data-testid="outside">outside</div>
      <SkipAttemptButton
        busy={false}
        isRateLimited={false}
        onSkip={onSkip}
        pending={false}
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

  it("asks for confirmation in place on a touch screen and skips only after it", async () => {
    setTouchScreen(true);
    const onSkip = vi.fn();
    const user = userEvent.setup();
    renderButton(onSkip);

    await user.click(screen.getByRole("button", { name: "skipTooltip" }));
    expect(onSkip).not.toHaveBeenCalled();
    // In place of the skip icon, not in a dialog.
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "skipConfirmTitle" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "skipTooltip" }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "skipConfirmConfirm" }),
    );
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "skipTooltip" }),
    ).toBeInTheDocument();
  });

  it("moves focus to cancel so a screen reader lands on the question", async () => {
    setTouchScreen(true);
    const user = userEvent.setup();
    renderButton(vi.fn());

    await user.click(screen.getByRole("button", { name: "skipTooltip" }));

    expect(
      screen.getByRole("button", { name: "skipConfirmCancel" }),
    ).toHaveFocus();
  });

  it.each([
    [
      "cancel",
      async (user: ReturnType<typeof userEvent.setup>) => {
        await user.click(
          screen.getByRole("button", { name: "skipConfirmCancel" }),
        );
      },
    ],
    [
      "a tap elsewhere",
      async (user: ReturnType<typeof userEvent.setup>) => {
        await user.click(screen.getByTestId("outside"));
      },
    ],
    [
      "Escape",
      async (user: ReturnType<typeof userEvent.setup>) => {
        await user.keyboard("{Escape}");
      },
    ],
  ])("closes the confirmation without skipping on %s", async (_name, close) => {
    setTouchScreen(true);
    const onSkip = vi.fn();
    const user = userEvent.setup();
    renderButton(onSkip);

    await user.click(screen.getByRole("button", { name: "skipTooltip" }));
    await close(user);

    expect(onSkip).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "skipTooltip" }),
    ).toBeInTheDocument();
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
