import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthCaptchaModal } from "../auth-captcha-modal";

vi.mock("../captcha", () => ({
  Captcha: ({ onWidgetLoad }: { onWidgetLoad: () => void }) => (
    <button onClick={() => onWidgetLoad()} type="button">
      widget-loaded
    </button>
  ),
}));

const messages = {
  Auth: {
    register: {
      captchaDescription: "Please verify you are human.",
      captchaFailed: "The verification did not go through.",
      captchaLoading: "Loading verification...",
      captchaReload: "Reload",
      captchaTitle: "Verification Required",
    },
  },
};

function renderModal(stage: "pending" | "waiting" | "interactive" | "failed") {
  const props = {
    onNeedsAttention: vi.fn(),
    onUnavailable: vi.fn(),
    onVerify: vi.fn(),
    onWidgetError: vi.fn(),
    stage,
    widgetVisible: false,
  };
  const view = render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AuthCaptchaModal {...props} />
    </NextIntlClientProvider>,
  );
  const rerenderStage = (next: typeof stage) =>
    view.rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <AuthCaptchaModal {...props} stage={next} />
      </NextIntlClientProvider>,
    );
  return { rerenderStage, ...view };
}

describe("AuthCaptchaModal", () => {
  afterEach(() => {
    document.body.style.overflow = "";
  });

  it("locks page scroll while visible and restores the previous value when hidden", () => {
    document.body.style.overflow = "auto";
    const { rerenderStage } = renderModal("pending");
    expect(document.body.style.overflow).toBe("auto");

    rerenderStage("waiting");
    expect(document.body.style.overflow).toBe("hidden");

    rerenderStage("pending");
    expect(document.body.style.overflow).toBe("auto");
  });

  it("restores the scroll value on unmount", () => {
    const { rerenderStage, unmount } = renderModal("pending");
    rerenderStage("interactive");
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("shows a loading status while the check is slow", () => {
    renderModal("waiting");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading verification...",
    );
  });

  it("shows the loading status until the interactive widget has loaded", async () => {
    renderModal("interactive");
    expect(screen.getByRole("status")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "widget-loaded" }),
    );
    expect(screen.queryByRole("status")).toBeNull();
  });
});
