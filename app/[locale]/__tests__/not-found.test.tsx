import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import NotFound from "../not-found";

vi.mock("next-intl/server", () => ({
  getLocale: vi.fn().mockResolvedValue("pl"),
  getTranslations: vi
    .fn()
    .mockResolvedValue((key: string) => `NotFound.${key}`),
}));

describe("NotFound page", () => {
  it("shows the translated heading as the only h1", async () => {
    render(await NotFound());

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { name: "NotFound.title" }),
    ).toBeTruthy();
    expect(screen.getByText("NotFound.description")).toBeTruthy();
  });

  it("links back to today's game in the current locale", async () => {
    render(await NotFound());

    const link = screen.getByRole("link", { name: "NotFound.backToGame" });
    expect(link.getAttribute("href")).toBe("/pl");
  });
});
