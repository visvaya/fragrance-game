import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { InfoPopover } from "../info-popover";

const EXPLANATION =
  "A long explanation that needs more room than a tooltip can give it.";

function renderPopover() {
  return render(
    <h2>
      <InfoPopover content={EXPLANATION}>Attempts</InfoPopover>
    </h2>,
  );
}

describe("InfoPopover", () => {
  it("renders the label as a collapsed button inside the heading", () => {
    renderPopover();

    const trigger = screen.getByRole("button", { name: "Attempts" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("heading", { name: "Attempts" })).toContainElement(
      trigger,
    );
    expect(screen.queryByText(EXPLANATION)).not.toBeInTheDocument();
  });

  it("opens the explanation on click and closes it with Escape", async () => {
    const user = userEvent.setup();
    renderPopover();
    const trigger = screen.getByRole("button", { name: "Attempts" });

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog", { name: "Attempts" })).toHaveTextContent(
      EXPLANATION,
    );

    await user.keyboard("{Escape}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("toggles closed when the trigger is pressed again", async () => {
    const user = userEvent.setup();
    renderPopover();
    const trigger = screen.getByRole("button", { name: "Attempts" });

    await user.click(trigger);
    await user.click(trigger);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
