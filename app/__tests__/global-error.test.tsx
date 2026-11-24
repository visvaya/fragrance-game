import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";
import plMessages from "@/messages/pl.json";

import GlobalError from "../global-error";

const { mockPathname, mockReport } = vi.hoisted(() => ({
  mockPathname: { value: "/en" },
  mockReport: vi.fn(),
}));

vi.mock("next/navigation", () => ({ usePathname: () => mockPathname.value }));
vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "geist" }),
  Playfair_Display: () => ({ variable: "playfair" }),
}));
vi.mock("@/lib/sentry-client", () => ({ reportClientError: mockReport }));
vi.mock("@/app/globals.css", () => ({}));

const renderError = (reset = vi.fn()) => {
  render(<GlobalError error={new Error("boom")} reset={reset} />, {
    container: document,
  });
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GlobalError page", () => {
  it("renders Polish text and lang for a Polish path", () => {
    mockPathname.value = "/pl/some/page";
    renderError();

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: plMessages.GlobalError.title,
      }),
    ).toBeTruthy();
    expect(document.documentElement.lang).toBe("pl");
    expect(
      screen
        .getByRole("link", { name: plMessages.GlobalError.backToGame })
        .getAttribute("href"),
    ).toBe("/pl");
  });

  it.each(["/en/x", "/", "/de/x"])("renders English text for %s", (path) => {
    mockPathname.value = path;
    renderError();

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: enMessages.GlobalError.title,
      }),
    ).toBeTruthy();
    expect(document.documentElement.lang).toBe("en");
    expect(
      screen
        .getByRole("link", { name: enMessages.GlobalError.backToGame })
        .getAttribute("href"),
    ).toBe("/en");
  });

  it("calls reset from the retry button", async () => {
    mockPathname.value = "/en";
    const reset = vi.fn();
    renderError(reset);

    await userEvent.click(
      screen.getByRole("button", { name: enMessages.GlobalError.retry }),
    );

    expect(reset).toHaveBeenCalledTimes(1);
  });
});
