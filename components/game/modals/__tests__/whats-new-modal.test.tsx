import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import en from "@/messages/en.json";
import pl from "@/messages/pl.json";

import { WhatsNewModal } from "../whats-new-modal";

const mocks = vi.hoisted(() => ({
  entries: [] as {
    date: string;
    notes: { en: string; pl: string }[];
    version: string;
  }[],
}));

vi.mock("@/lib/changelog", () => ({
  get CHANGELOG() {
    return mocks.entries;
  },
}));

const technical = { date: "2026-11-20", notes: [], version: "0.9.1" };
const older = {
  date: "2026-11-10",
  notes: [{ en: "A quieter start screen", pl: "Spokojniejszy ekran startowy" }],
  version: "0.9.0",
};
const newest = {
  date: "2026-11-24",
  notes: [
    { en: "A new menu item", pl: "Nowa pozycja w menu" },
    { en: "Clearer hints", pl: "Czytelniejsze wskazówki" },
  ],
  version: "0.10.0",
};

const renderModal = (locale: "en" | "pl" = "en") =>
  render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "en" ? en : pl}
    >
      <WhatsNewModal onClose={vi.fn()} open />
    </NextIntlClientProvider>,
  );

describe("WhatsNewModal", () => {
  it("lists only the versions that have notes for players, newest first", () => {
    mocks.entries = [newest, technical, older];
    renderModal();

    const headings = screen
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual(["0.10.0", "0.9.0"]);
    expect(screen.queryByText("0.9.1")).toBeNull();
    expect(screen.getByText("Clearer hints")).toBeTruthy();
  });

  it("writes the notes and the date in the page language", () => {
    mocks.entries = [newest];
    renderModal("pl");

    expect(screen.getByText("Nowa pozycja w menu")).toBeTruthy();
    expect(screen.queryByText("A new menu item")).toBeNull();
    expect(screen.getByText(/24 listopada 2026/)).toBeTruthy();
  });

  it("shows the version being played, also when it has no notes", () => {
    mocks.entries = [technical, older];
    renderModal();

    expect(
      within(screen.getByRole("dialog")).getByText(/Version 0\.9\.1/),
    ).toBeTruthy();
  });

  it("says so when no version has notes yet", () => {
    mocks.entries = [technical];
    renderModal();

    expect(screen.getByText(en.WhatsNewModal.empty)).toBeTruthy();
    expect(screen.queryAllByRole("heading", { level: 3 })).toHaveLength(0);
  });

  it("describes the dialog for screen readers in the page language", () => {
    mocks.entries = [newest];
    renderModal("pl");

    expect(screen.getByRole("dialog")).toHaveAccessibleName(
      pl.WhatsNewModal.title,
    );
    expect(screen.getByRole("dialog")).toHaveAccessibleDescription(
      pl.WhatsNewModal.description,
    );
  });
});
