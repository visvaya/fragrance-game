import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Toaster } from "../sonner";

const { mockPreferences, mockSonner } = vi.hoisted(() => {
  const preferences: { theme: "dark" | "light" } = { theme: "light" };
  return {
    mockPreferences: preferences,
    mockSonner: vi.fn((_props: { theme?: string }) => null),
  };
});

vi.mock("sonner", () => ({ Toaster: mockSonner }));
vi.mock("@/components/game/contexts", () => ({
  useUIPreferences: () => ({ uiPreferences: mockPreferences }),
}));

describe("Toaster", () => {
  it.each(["dark", "light"] as const)(
    "uses the %s theme chosen in the game menu",
    (theme) => {
      mockPreferences.theme = theme;
      render(<Toaster />);

      expect(mockSonner).toHaveBeenLastCalledWith(
        expect.objectContaining({ theme }),
        undefined,
      );
    },
  );
});
