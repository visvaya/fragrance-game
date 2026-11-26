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
    captchaErrors: {
      challenge: "Try a regular window.",
      unknown: "The verification did not go through.",
    },
    register: {
      captchaDescription: "Please verify you are human.",
      captchaLoading: "Loading verification...",
      captchaReload: "Reload",
      captchaTitle: "Verification Required",
    },
  },
};

type Stage = "pending" | "attention" | "waiting" | "interactive" | "failed";

function renderModal(
  stage: Stage,
  overrides: {
    failure?: "challenge" | "unknown";
    widgetVisible?: boolean;
  } = {},
) {
  const props = {
    failure: overrides.failure ?? ("unknown" as const),
    onFail: vi.fn(),
    onNeedsAttention: vi.fn(),
    onVerify: vi.fn(),
    stage,
    widgetVisible: overrides.widgetVisible ?? false,
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

  it("leaves the loading status to a visible widget's own placeholder", () => {
    renderModal("interactive", { widgetVisible: true });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("stays hidden while Cloudflare's request for a click may still pass on its own", () => {
    document.body.style.overflow = "auto";
    renderModal("attention");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(document.body.style.overflow).toBe("auto");
  });

  it("says why the check failed", () => {
    renderModal("failed", { failure: "challenge" });
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "Try a regular window.",
    );
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
  });
});
