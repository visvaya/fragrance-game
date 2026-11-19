import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthErrorWatcher } from "../auth-error-watcher";

const { mockSearch, mockToast } = vi.hoisted(() => ({
  mockSearch: { value: new URLSearchParams() },
  mockToast: { error: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearch.value,
}));
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) =>
    `${namespace}.${key}`,
}));
vi.mock("sonner", () => ({ toast: mockToast }));

beforeEach(() => {
  vi.clearAllMocks();
  mockSearch.value = new URLSearchParams();
});

describe("AuthErrorWatcher", () => {
  it("shows the provider description of an error in the query", async () => {
    mockSearch.value = new URLSearchParams(
      "error=access_denied&error_description=Link%20expired",
    );
    render(<AuthErrorWatcher />);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        "Auth.errorWatcher.authError",
        { description: "Link expired" },
      );
    });
  });

  it("falls back to the generic message without a description", async () => {
    mockSearch.value = new URLSearchParams("error=server_error");
    render(<AuthErrorWatcher />);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        "Auth.errorWatcher.authError",
        { description: "Auth.errorWatcher.unknownError" },
      );
    });
  });

  it("stays silent without an error", () => {
    render(<AuthErrorWatcher />);
    expect(mockToast.error).not.toHaveBeenCalled();
  });
});
