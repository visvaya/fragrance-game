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
vi.mock("@/lib/public-env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/public-env")>();
  return {
    publicEnv: {
      ...actual.publicEnv,
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "test-site-key",
    },
  };
});

// Turnstile itself is replaced by buttons that fire its callbacks.
vi.mock("@/components/auth/captcha", () => ({
  Captcha: ({
    onBeforeInteractive,
    onUnavailable,
    onVerify,
  }: {
    onBeforeInteractive: () => void;
    onUnavailable: () => void;
    onVerify: (token: string) => void;
  }) => (
    <>
      <button onClick={() => onBeforeInteractive()} type="button">
        needs-interaction
      </button>
      <button onClick={() => onVerify("turnstile-token")} type="button">
        turnstile-solved
      </button>
      <button onClick={() => onUnavailable()} type="button">
        turnstile-unavailable
      </button>
    </>
  ),
}));

const messages = {
  Auth: {
    register: {
      captchaDescription: "Please verify you are human.",
      captchaFailed: "The verification did not go through.",
      captchaReload: "Reload",
      captchaTitle: "Verification Required",
    },
  },
  Migration: { title: "Anonymous Session Detected" },
};

const SSR_CHALLENGE = {
  clues: { ...HIDDEN_CLUES, brand: "C____l" },
  id: "550e8400-e29b-41d4-a716-446655440000",
};

/** Shows the revealed brand and the auth flags the input reads. */
function StateProbe() {
  const game = useGame();
  return (
    <>
      <div data-testid="daily-brand">{game.revealedBrand}</div>
      <div data-testid="auth">
        {game.authReady ? "ready" : "waiting"}
        {game.authFailed ? " failed" : ""}
      </div>
    </>
  );
}

function renderProvider(initialChallenge?: typeof SSR_CHALLENGE) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <UIPreferencesProvider>
        <GameProvider
          {...(initialChallenge
            ? { initialChallenge: initialChallenge as never }
            : {})}
        >
          <StateProbe />
        </GameProvider>
      </UIPreferencesProvider>
    </NextIntlClientProvider>,
  );
}

/**
 * Finds a stand-in Turnstile button, which sits in the hidden dialog until it shows. The
 * dialog module loads dynamically, which on a loaded machine takes over the default 1 s.
 */
async function findTurnstile(name: string) {
  return screen.findByRole("button", { hidden: true, name }, { timeout: 5000 });
}

/** Clicks a stand-in Turnstile button. */
async function clickTurnstile(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  await user.click(await findTurnstile(name));
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
    const solved = await findTurnstile("turnstile-solved");
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

    const needsInteraction = await findTurnstile("needs-interaction");
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

    await clickTurnstile(user, "turnstile-solved");

    expect(await screen.findByRole("alertdialog")).toHaveTextContent(
      "Please verify you are human.",
    );
    expect(gameActions.initializeGame).not.toHaveBeenCalled();

    // A fresh token after the rejection completes the start-up.
    await clickTurnstile(user, "turnstile-solved");
    await waitFor(() => {
      expect(screen.getByTestId("daily-brand")).toHaveTextContent("Ch___l");
    });
    expect(signInAnonymously).toHaveBeenCalledTimes(2);
  });

  it("stops after two rejected sign-ins and offers a reload", async () => {
    signInAnonymously.mockResolvedValue({
      error: { message: "captcha protection: request disallowed" },
    });
    const user = userEvent.setup();
    renderProvider();

    await clickTurnstile(user, "turnstile-solved");
    await clickTurnstile(user, "turnstile-solved");

    expect(
      await screen.findByRole("button", { name: "Reload" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { hidden: true, name: "turnstile-solved" }),
    ).toBeNull();
    expect(signInAnonymously).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("auth")).toHaveTextContent("waiting failed");
  });

  it("offers a reload when the Turnstile script cannot load", async () => {
    const user = userEvent.setup();
    renderProvider();

    await clickTurnstile(user, "turnstile-unavailable");

    expect(await screen.findByRole("alertdialog")).toHaveTextContent(
      "The verification did not go through.",
    );
    expect(screen.getByTestId("auth")).toHaveTextContent("waiting failed");
    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  it("marks auth ready after the token on the SSR path without fetching the challenge", async () => {
    const user = userEvent.setup();
    renderProvider(SSR_CHALLENGE);
    expect(screen.getByTestId("auth")).toHaveTextContent("waiting");

    await clickTurnstile(user, "turnstile-solved");

    await waitFor(() => {
      expect(screen.getByTestId("auth")).toHaveTextContent("ready");
    });
    expect(gameActions.initializeGame).not.toHaveBeenCalled();
  });
});
