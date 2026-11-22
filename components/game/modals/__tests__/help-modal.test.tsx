import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import en from "@/messages/en.json";

import { HelpModal } from "../help-modal";

describe("HelpModal", () => {
  it("describes the dialog for screen readers in the page language", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <HelpModal onClose={vi.fn()} open />
      </NextIntlClientProvider>,
    );

    expect(screen.getByRole("dialog")).toHaveAccessibleDescription(
      en.HelpModal.intro,
    );
  });
});
