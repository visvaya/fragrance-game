import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Captcha } from "../captcha";

vi.mock("@/lib/public-env", () => ({
  publicEnv: { NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site-key" },
}));
vi.mock("@/components/game/contexts", () => ({
  useUIPreferences: () => ({ uiPreferences: { theme: "light" } }),
}));
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) =>
    `${namespace}.${key}`,
}));
// Turnstile itself is replaced by buttons that fire its callbacks.
vi.mock("@marsidev/react-turnstile", () => ({
  Turnstile: ({
    onError,
    onWidgetLoad,
  }: {
    onError?: (code: string) => void;
    onWidgetLoad?: () => void;
  }) => (
    <>
      <button onClick={() => onWidgetLoad?.()} type="button">
        widget-loaded
      </button>
      <button onClick={() => onError?.("600010")} type="button">
        widget-error
      </button>
    </>
  ),
}));

describe("Captcha", () => {
  it("holds the widget's place with a loading status until the widget has drawn", async () => {
    const onWidgetLoad = vi.fn();
    render(<Captcha onVerify={vi.fn()} onWidgetLoad={onWidgetLoad} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Auth.register.captchaLoading",
    );

    await userEvent.click(
      screen.getByRole("button", { name: "widget-loaded" }),
    );

    expect(screen.queryByRole("status")).toBeNull();
    expect(onWidgetLoad).toHaveBeenCalledOnce();
  });

  it("shows no placeholder for the invisible widget", () => {
    render(<Captcha appearance="interaction-only" onVerify={vi.fn()} />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("reports the kind of failure read from Cloudflare's code", async () => {
    const onFail = vi.fn();
    render(<Captcha onFail={onFail} onVerify={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "widget-error" }));

    expect(onFail).toHaveBeenCalledWith("challenge");
  });
});
