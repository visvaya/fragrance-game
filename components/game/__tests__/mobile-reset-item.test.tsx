import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MobileResetItem } from "../mobile-reset-item";

const { mockEnv } = vi.hoisted(() => {
  const env: { NEXT_PUBLIC_GAME_RESET_ENABLED: string | undefined } = {
    NEXT_PUBLIC_GAME_RESET_ENABLED: undefined,
  };
  return { mockEnv: env };
});

vi.mock("@/lib/public-env", () => ({ publicEnv: mockEnv }));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock("../contexts", () => ({
  useGameActions: () => ({ resetGame: vi.fn() }),
}));

describe("MobileResetItem", () => {
  it.each([undefined, "false"])(
    "renders nothing when the reset flag is %s",
    (flag) => {
      mockEnv.NEXT_PUBLIC_GAME_RESET_ENABLED = flag;
      render(<MobileResetItem />);

      expect(
        screen.queryByRole("button", { name: "confirm" }),
      ).not.toBeInTheDocument();
    },
  );

  it("shows the reset item when the reset flag is on", () => {
    mockEnv.NEXT_PUBLIC_GAME_RESET_ENABLED = "true";
    render(<MobileResetItem />);

    expect(screen.getByRole("button", { name: "confirm" })).toBeInTheDocument();
  });
});
