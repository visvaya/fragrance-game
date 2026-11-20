import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as gameActions from "@/app/actions/game-actions";
import { HIDDEN_CLUES } from "@/lib/game/clue-reveal";
import * as getClientModule from "@/lib/supabase/get-client";

import { UIPreferencesProvider } from "../contexts/ui-preferences-context";
import { GameProvider, useGame } from "../game-provider";

vi.mock("next/navigation", () => ({
  usePathname: () => "/en",
  useRouter: () => ({
    back: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/i18n/routing", () => ({
  routing: { defaultLocale: "pl", locales: ["en", "pl"] },
  usePathname: () => "/en",
  useRouter: () => ({
    back: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock("@sentry/nextjs", () => ({ setUser: vi.fn() }));

vi.mock("@/app/actions/game-actions", () => ({
  initializeGame: vi.fn(),
  startGame: vi.fn(),
}));

vi.mock("@/lib/supabase/get-client", () => ({ getSupabaseClient: vi.fn() }));

vi.mock("../when-idle", () => ({
  whenIdle: (callback: () => void) => {
    callback();
    return vi.fn();
  },
}));

// Captcha protection is on, as in production.
vi.mock("@/lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/env")>();
  return {
    env: { ...actual.env, NEXT_PUBLIC_TURNSTILE_SITE_KEY: "test-site-key" },
  };
});

// Turnstile itself is replaced by buttons that fire its callbacks.
vi.mock("@/components/auth/captcha", () => ({
  Captcha: ({
    onBeforeInteractive,
    onVerify,
  }: {
    onBeforeInteractive: () => void;
    onVerify: (token: string) => void;
  }) => (
    <>
      <button onClick={() => onBeforeInteractive()} type="button">
        needs-interaction
      </button>
      <button onClick={() => onVerify("turnstile-token")} type="button">
        turnstile-solved
      </button>
    </>
  ),
}));

const messages = {
  Auth: {
    register: {
      captchaDescription: "Please verify you are human.",
      captchaTitle: "Verification Required",
    },
  },
  Migration: { title: "Anonymous Session Detected" },
};

/** Shows the revealed brand, which appears once the challenge and session are loaded. */
function BrandProbe() {
  const game = useGame();
  return <div data-testid="daily-brand">{game.revealedBrand}</div>;
}

function renderProvider() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <UIPreferencesProvider>
        <GameProvider>
          <BrandProbe />
        </GameProvider>
      </UIPreferencesProvider>
    </NextIntlClientProvider>,
  );
}

describe("GameProvider anonymous sign-in for a new visitor", () => {
  const signInAnonymously = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    signInAnonymously.mockResolvedValue({ error: null });
    const getSession = vi
      .fn()
      // No session yet: a first visit.
      .mockResolvedValueOnce({ data: { session: null } })
      .mockResolvedValue({ data: { session: { user: { id: "anon-user" } } } });
    vi.mocked(getClientModule.getSupabaseClient).mockResolvedValue({
      auth: {
        getSession,
        onAuthStateChange: vi.fn().mockReturnValue({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
        signInAnonymously,
      },
    } as never);
    vi.mocked(gameActions.initializeGame).mockResolvedValue({
      challenge: {
        clues: { ...HIDDEN_CLUES, brand: "C____l" },
        id: "550e8400-e29b-41d4-a716-446655440000",
      },
      session: {
        guesses: [],
        nonce: "nonce",
        revealed: { ...HIDDEN_CLUES, brand: "Ch___l" },
        sessionId: "123e4567-e89b-12d3-a456-426614174000",
      },
    } as never);
  });

  it("signs in once with the Turnstile token and finishes start-up without a reload", async () => {
    const user = userEvent.setup();
    renderProvider();

    // The check runs invisibly first: the dialog is mounted but hidden.
    const solved = await screen.findByRole("button", {
      hidden: true,
      name: "turnstile-solved",
    });
    expect(signInAnonymously).not.toHaveBeenCalled();

    await user.click(solved);

    await waitFor(() => {
      expect(screen.getByTestId("daily-brand")).toHaveTextContent("Ch___l");
    });
    expect(signInAnonymously).toHaveBeenCalledTimes(1);
    expect(signInAnonymously).toHaveBeenCalledWith({
      options: { captchaToken: "turnstile-token" },
    });
    expect(screen.queryByRole("alertdialog", { hidden: true })).toBeNull();
  });

  it("shows the dialog only when Cloudflare asks for interaction", async () => {
    const user = userEvent.setup();
    renderProvider();

    const needsInteraction = await screen.findByRole("button", {
      hidden: true,
      name: "needs-interaction",
    });
    expect(screen.queryByRole("alertdialog")).toBeNull();

    await user.click(needsInteraction);

    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "Verification Required",
    );
  });

  it("asks again with the dialog visible when the sign-in is rejected", async () => {
    signInAnonymously.mockResolvedValueOnce({
      error: { message: "captcha protection: request disallowed" },
    });
    const user = userEvent.setup();
    renderProvider();

    await user.click(
      await screen.findByRole("button", {
        hidden: true,
        name: "turnstile-solved",
      }),
    );

    expect(await screen.findByRole("alertdialog")).toBeVisible();
    expect(gameActions.initializeGame).not.toHaveBeenCalled();
  });
});
