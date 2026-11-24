import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SignOutMenuItem } from "../sign-out-menu-item";

const { mockSignOut } = vi.hoisted(() => ({
  mockSignOut: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signOut: mockSignOut } }),
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SignOutMenuItem", () => {
  it("closes the menu, signs out and reloads the page", async () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { reload });
    const onSelect = vi.fn();
    render(<SignOutMenuItem onSelect={onSelect} />);

    await userEvent.click(screen.getByRole("button", { name: "signOut" }));

    await waitFor(() => {
      expect(reload).toHaveBeenCalledOnce();
    });
    expect(onSelect).toHaveBeenCalledOnce();
    expect(mockSignOut).toHaveBeenCalledOnce();
  });
});
