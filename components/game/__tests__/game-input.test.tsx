/**
 * Tests for GameInput component.
 * Mocks game contexts and autocomplete action to test rendering and interactions.
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mock refs – must exist before vi.mock() factories run
// ---------------------------------------------------------------------------

const { mockUseGameActions, mockUseGameState, mockUseUIPreferences } =
  vi.hoisted(() => ({
    mockUseGameActions: vi.fn(),
    mockUseGameState: vi.fn(),
    mockUseUIPreferences: vi.fn(),
  }));

const { mockSearchPerfumes } = vi.hoisted(() => ({
  mockSearchPerfumes: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/components/game/contexts", () => ({
  useGameActions: mockUseGameActions,
  useGameState: mockUseGameState,
  useUIPreferences: mockUseUIPreferences,
}));

vi.mock("@/app/actions/autocomplete", () => ({
  searchPerfumes: mockSearchPerfumes,
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/hooks/use-mount-transition", () => ({
  useMountTransition: () => false,
}));

vi.mock("@/lib/hooks/use-mount-effect", () => ({
  useMountEffect: (function_: () => void) => function_(),
}));

vi.mock("@/components/game/game-tooltip", () => ({
  GameTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/game/highlighted-text", () => ({
  HighlightedText: ({ text }: { text: string }) => <span>{text}</span>,
}));

vi.mock("@/components/game/skeletons", () => ({
  GameInputSkeleton: () => (
    <div data-testid="game-input-skeleton">Skeleton</div>
  ),
}));

vi.mock("@/lib/toast", () => ({
  toast: { error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

import { GameInput } from "../game-input";

import type { DailyPerfume } from "../contexts/game-state-context";

// ResizeObserver and scrollIntoView are not available in jsdom – provide stubs
vi.stubGlobal(
  "ResizeObserver",
  class {
    disconnect = vi.fn();
    observe = vi.fn();
    unobserve = vi.fn();
  },
);

globalThis.window.HTMLElement.prototype.scrollIntoView = vi.fn();

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DAILY_PERFUME: DailyPerfume = {
  concentration: "EDP",
  id: "test-perfume-id",
  imageUrl: "/test.jpg",
  name: "Sauvage",
  xsolve: 80,
};

const SKELETON_PERFUME: DailyPerfume = {
  concentration: undefined,
  id: "skeleton",
  imageUrl: "/placeholder.svg",
  name: "?????",
  xsolve: 0,
};

const makeDefaultState = (overrides: Record<string, unknown> = {}) => ({
  attempts: [],
  authReady: true,
  blurLevel: 1,
  currentAttempt: 1,
  dailyPerfume: DAILY_PERFUME,
  gameState: "playing",
  isGenderRevealed: false,
  loading: false,
  maxAttempts: 6,
  potentialScore: 1000,
  revealedBrand: "?????",
  revealedPerfumer: "?????",
  revealedYear: "????",
  revealLevel: 1,
  sessionId: "session-123",
  sessionReady: true,
  user: null,
  xsolveScore: 0,
  ...overrides,
});

const makeDefaultActions = () => ({
  isRateLimited: false,
  makeGuess: vi.fn().mockResolvedValue(undefined),
  resetGame: vi.fn(),
  retryStart: vi.fn().mockResolvedValue(undefined),
  skipAttempt: vi.fn().mockResolvedValue(undefined),
});

const makeDefaultUI = () => ({
  isInputFocused: false,
  setIsInputFocused: vi.fn(),
  toggleAutoScroll: vi.fn(),
  toggleFontScale: vi.fn(),
  toggleLayoutMode: vi.fn(),
  toggleTheme: vi.fn(),
  uiPreferences: {
    autoScroll: true,
    fontScale: "default" as const,
    layoutMode: "default" as const,
    theme: "light" as const,
  },
});

const makeSuggestion = (overrides: Record<string, unknown> = {}) => ({
  brand_masked: "Dior",
  brand_norm: "dior",
  concentration: "EDP",
  display_name: "Dior • Sauvage",
  name: "Sauvage",
  name_norm: "sauvage",
  perfume_id: "abc-123",
  raw_year: 2015,
  year: "2015",
  ...overrides,
});

function renderGameInput(
  stateOverrides: Record<string, unknown> = {},
  actionsOverrides: Partial<ReturnType<typeof makeDefaultActions>> = {},
  uiOverrides: Partial<ReturnType<typeof makeDefaultUI>> = {},
) {
  mockUseGameState.mockReturnValue(makeDefaultState(stateOverrides));
  mockUseGameActions.mockReturnValue({
    ...makeDefaultActions(),
    ...actionsOverrides,
  });
  mockUseUIPreferences.mockReturnValue({
    ...makeDefaultUI(),
    ...uiOverrides,
  });
  return render(<GameInput />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GameInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    mockSearchPerfumes.mockResolvedValue([]);
  });

  describe("rendering states", () => {
    it("shows skeleton when game is loading and dailyPerfume is skeleton", () => {
      renderGameInput({ dailyPerfume: SKELETON_PERFUME, loading: true });

      expect(screen.getByTestId("game-input-skeleton")).toBeInTheDocument();
    });

    it("shows closed message when gameState is won", () => {
      renderGameInput({ gameState: "won" });

      expect(screen.getByText("closed")).toBeInTheDocument();
    });

    it("shows closed message when gameState is lost", () => {
      renderGameInput({ gameState: "lost" });

      expect(screen.getByText("closed")).toBeInTheDocument();
    });

    it("shows noPuzzle when playing with skeleton dailyPerfume", () => {
      renderGameInput({ dailyPerfume: SKELETON_PERFUME, gameState: "playing" });

      expect(screen.getByText("noPuzzle")).toBeInTheDocument();
    });

    it("offers a retry when the signed-in start-up loaded no puzzle", async () => {
      const retryStart = vi.fn().mockResolvedValue(undefined);
      renderGameInput(
        { authReady: true, dailyPerfume: SKELETON_PERFUME },
        { retryStart },
      );

      await userEvent
        .setup()
        .click(screen.getByRole("button", { name: "retry" }));

      expect(retryStart).toHaveBeenCalledTimes(1);
    });

    it("offers no retry while the sign-in is still running", () => {
      renderGameInput({ authReady: false, dailyPerfume: SKELETON_PERFUME });

      expect(
        screen.queryByRole("button", { name: "retry" }),
      ).not.toBeInTheDocument();
    });

    it("offers no retry once the game is over", () => {
      renderGameInput({ gameState: "won" });

      expect(
        screen.queryByRole("button", { name: "retry" }),
      ).not.toBeInTheDocument();
    });

    it("renders input element in playing state", () => {
      renderGameInput();

      expect(screen.getByTestId("game-input")).toBeInTheDocument();
    });
  });

  describe("input attributes", () => {
    it("has role combobox", () => {
      renderGameInput();

      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    it("has data-testid game-input", () => {
      renderGameInput();

      expect(screen.getByTestId("game-input")).toBeInTheDocument();
    });

    it("has aria-expanded=false when no suggestions visible", () => {
      renderGameInput();

      expect(screen.getByRole("combobox")).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    });

    it("is enabled when playing and not rate-limited", () => {
      renderGameInput();

      expect(screen.getByTestId("game-input")).not.toBeDisabled();
    });
  });

  describe("disabled states", () => {
    it("is disabled when gameLoading is true", () => {
      renderGameInput({ loading: true });

      expect(screen.getByTestId("game-input")).toBeDisabled();
    });

    it("is disabled when isRateLimited is true", () => {
      renderGameInput({}, { isRateLimited: true });

      expect(screen.getByTestId("game-input")).toBeDisabled();
    });

    it("input is enabled when authReady=false but no pendingGuess (isConnecting=false)", () => {
      // isConnecting = pendingGuess !== null && !authReady
      // With no pendingGuess set, even authReady=false should not disable input
      renderGameInput({ authReady: false });

      expect(screen.getByTestId("game-input")).not.toBeDisabled();
    });
  });

  describe("status bar", () => {
    it("shows attempt count in status bar", () => {
      renderGameInput({ currentAttempt: 2, maxAttempts: 6 });

      // Status bar contains attempt info – use getAllByText since there's an invisible clone
      expect(screen.getAllByText(/2/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/6/).length).toBeGreaterThan(0);
    });

    it("shows potential score in status bar", () => {
      renderGameInput({ potentialScore: 850 });

      // Status bar contains score – use getAllByText since there's an invisible clone
      expect(screen.getAllByText(/850/).length).toBeGreaterThan(0);
    });

    it("keeps the one-row layout after a reset re-mounts the status bar", () => {
      // Records every observer so the test can fire them with chosen widths.
      const observers: { callback: () => void; targets: Element[] }[] = [];
      vi.stubGlobal(
        "ResizeObserver",
        class {
          private readonly entry: { callback: () => void; targets: Element[] };
          constructor(callback: () => void) {
            this.entry = { callback, targets: [] };
            observers.push(this.entry);
          }
          disconnect() {
            this.entry.targets = [];
          }
          observe(target: Element) {
            this.entry.targets.push(target);
          }
        },
      );
      const fireAll = () => {
        for (const { callback, targets } of observers) {
          if (targets.length > 0) act(callback);
        }
      };

      const { rerender } = renderGameInput();
      // A reset clears the puzzle (skeleton) and loads it again.
      mockUseGameState.mockReturnValue(
        makeDefaultState({ dailyPerfume: SKELETON_PERFUME, loading: true }),
      );
      rerender(<GameInput />);
      // The observer of the removed bar fires with zero widths.
      fireAll();
      mockUseGameState.mockReturnValue(makeDefaultState());
      rerender(<GameInput />);

      // The new bar's container must be observed.
      const statusBar = screen.getByTestId("game-status-bar");
      const container = observers
        .flatMap(({ targets }) => targets)
        .find((target) => target.contains(statusBar));
      expect(container).toBeDefined();

      // The new bar is wide enough for one row.
      vi.spyOn(container as HTMLElement, "clientWidth", "get").mockReturnValue(
        400,
      );
      fireAll();
      expect(statusBar).toHaveClass("grid");
    });
  });

  describe("skip button", () => {
    it("renders skip button with aria-label", () => {
      renderGameInput();

      expect(
        screen.getByRole("button", { name: "skipTooltip" }),
      ).toBeInTheDocument();
    });

    it("queues a skip made while signing in and sends it once auth is ready", async () => {
      const skipAttempt = vi.fn().mockResolvedValue(undefined);
      const signingIn = {
        authReady: false,
        sessionId: null,
        sessionReady: false,
      };
      const { rerender } = renderGameInput(signingIn, { skipAttempt });

      const skipButton = screen.getByRole("button", { name: "skipTooltip" });
      expect(skipButton).toBeEnabled();
      await userEvent.setup().click(skipButton);

      expect(skipAttempt).not.toHaveBeenCalled();
      expect(skipButton).toHaveAttribute("aria-busy", "true");
      expect(screen.getByText("connectingHint")).toBeInTheDocument();

      mockUseGameState.mockReturnValue(
        makeDefaultState({ ...signingIn, authReady: true }),
      );
      rerender(<GameInput />);

      await waitFor(() => {
        expect(skipAttempt).toHaveBeenCalledTimes(1);
      });
    });

    it("shows the spinner in place of the search icon while signing in", () => {
      renderGameInput({ authReady: false });

      expect(screen.getByTestId("input-icon")).toHaveAttribute(
        "data-icon",
        "loading",
      );
    });

    it("is enabled for a new player before the game session exists", () => {
      // The first skip starts the session lazily, as the first guess does.
      renderGameInput({
        authReady: true,
        sessionId: null,
        sessionReady: false,
      });

      expect(screen.getByRole("button", { name: "skipTooltip" })).toBeEnabled();
    });

    it("is disabled when gameLoading is true (skeleton + non-skeleton perfume)", () => {
      // With non-skeleton perfume: renders full UI but skip is disabled
      renderGameInput({ loading: true });

      const skipButton = screen.getByRole("button", { name: "skipTooltip" });
      expect(skipButton).toBeDisabled();
    });

    it("calls skipAttempt on desktop click (matchMedia returns false for touch)", async () => {
      const skipAttempt = vi.fn().mockResolvedValue(undefined);
      renderGameInput({}, { skipAttempt });

      const skipButton = screen.getByRole("button", { name: "skipTooltip" });
      await userEvent.setup().click(skipButton);

      expect(skipAttempt).toHaveBeenCalledTimes(1);
    });

    it("does not call skipAttempt when isRateLimited", () => {
      const skipAttempt = vi.fn().mockResolvedValue(undefined);
      renderGameInput(
        { sessionReady: true },
        { isRateLimited: true, skipAttempt },
      );

      const skipButton = screen.getByRole("button", { name: "skipTooltip" });
      // Button is disabled when isRateLimited
      expect(skipButton).toBeDisabled();
    });
  });

  describe("autocomplete search", () => {
    it("calls searchPerfumes after debounce period", async () => {
      mockSearchPerfumes.mockResolvedValue([]);
      renderGameInput();

      const input = screen.getByTestId("game-input");
      const user = userEvent.setup();
      await user.click(input);
      await user.type(input, "chanel");

      await waitFor(
        () => {
          expect(mockSearchPerfumes).toHaveBeenCalledWith(
            "chanel",
            "session-123",
            1,
          );
        },
        { timeout: 2000 },
      );
    });

    it("does not call searchPerfumes when query is empty", async () => {
      renderGameInput();

      const input = screen.getByTestId("game-input");
      const user = userEvent.setup();
      await user.click(input);
      // Already empty, so we just focus or type empty

      await new Promise((resolve) => setTimeout(resolve, 400)); // wait for debounce

      expect(mockSearchPerfumes).not.toHaveBeenCalled();
    });

    it("does not call searchPerfumes when isRateLimited", async () => {
      renderGameInput({}, { isRateLimited: true });

      const input = screen.getByTestId("game-input");
      const user = userEvent.setup();
      await user.click(input);
      await user.type(input, "chanel");

      await new Promise((resolve) => setTimeout(resolve, 400)); // wait for debounce

      expect(mockSearchPerfumes).not.toHaveBeenCalled();
    });

    it("shows suggestion items when search returns results", async () => {
      const suggestion = makeSuggestion();
      mockSearchPerfumes.mockResolvedValue([suggestion]);
      renderGameInput();

      const input = screen.getByTestId("game-input");
      const user = userEvent.setup();
      await user.click(input);
      await user.type(input, "sauvage");

      await waitFor(
        () => {
          expect(screen.getByRole("listbox")).toBeInTheDocument();
        },
        { timeout: 2000 },
      );
    });

    it("does not repeat the brand when the name starts with it", async () => {
      mockSearchPerfumes.mockResolvedValue([
        makeSuggestion({ name: "Dior Homme", name_norm: "dior homme" }),
      ]);
      renderGameInput();

      const input = screen.getByTestId("game-input");
      const user = userEvent.setup();
      await user.click(input);
      await user.type(input, "homme");

      const option = await screen.findByRole("option", {}, { timeout: 2000 });
      expect(option.textContent).toMatch(/^Dior Homme/);
    });
  });

  describe("keyboard navigation", () => {
    async function setupWithSuggestions(
      overrides?: Partial<ReturnType<typeof makeDefaultActions>>,
    ) {
      const suggestions = [
        makeSuggestion({ name: "Sauvage", perfume_id: "id-1" }),
        makeSuggestion({ name: "Bleu", perfume_id: "id-2" }),
      ];
      mockSearchPerfumes.mockResolvedValue(suggestions);
      renderGameInput({}, overrides);

      const input = screen.getByTestId("game-input");
      const user = userEvent.setup();
      await user.click(input);
      await user.type(input, "sau");

      await waitFor(
        () => {
          expect(screen.getByRole("listbox")).toBeInTheDocument();
        },
        { timeout: 2000 },
      );

      return input;
    }

    it("hides suggestions on Escape key", async () => {
      await setupWithSuggestions();

      await userEvent.setup().keyboard("{Escape}");

      await waitFor(() => {
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      });
    });

    it("calls makeGuess when Enter is pressed with single suggestion", async () => {
      const suggestion = makeSuggestion();
      mockSearchPerfumes.mockResolvedValue([suggestion]);
      const makeGuess = vi.fn().mockResolvedValue(undefined);
      renderGameInput({}, { makeGuess });

      const input = screen.getByTestId("game-input");
      const user = userEvent.setup();
      await user.click(input);
      await user.type(input, "sauvage");

      await waitFor(
        () => {
          expect(screen.getByRole("listbox")).toBeInTheDocument();
        },
        { timeout: 2000 },
      );

      await userEvent.setup().keyboard("{Enter}");

      await waitFor(() => {
        expect(makeGuess).toHaveBeenCalledWith(
          suggestion.name,
          suggestion.brand_masked,
          suggestion.perfume_id,
        );
      });
    });
  });

  describe("text entry", () => {
    it("turns off autocorrect, capitalisation and spell check", () => {
      renderGameInput();
      const input = screen.getByTestId("game-input");

      expect(input).toHaveAttribute("autocorrect", "off");
      expect(input).toHaveAttribute("autocapitalize", "off");
      expect(input).toHaveAttribute("spellcheck", "false");
    });

    it("ignores Enter that confirms an IME composition", async () => {
      const suggestion = makeSuggestion();
      mockSearchPerfumes.mockResolvedValue([suggestion]);
      const makeGuess = vi.fn().mockResolvedValue(undefined);
      renderGameInput({}, { makeGuess });

      const input = screen.getByTestId("game-input");
      const user = userEvent.setup();
      await user.click(input);
      await user.type(input, "sauvage");
      await waitFor(
        () => {
          expect(screen.getByRole("listbox")).toBeInTheDocument();
        },
        { timeout: 2000 },
      );

      // user-event cannot mark a key event as part of an IME composition, so the event is built here.
      act(() => {
        input.dispatchEvent(
          new KeyboardEvent("keydown", {
            bubbles: true,
            isComposing: true,
            key: "Enter",
          }),
        );
      });

      expect(makeGuess).not.toHaveBeenCalled();
    });
  });

  describe("suggestion selection", () => {
    it("keeps a pick made while the sign-in is pending and sends it once auth is ready", async () => {
      // A new player with an SSR challenge: no session yet, sign-in still running.
      const suggestion = makeSuggestion();
      mockSearchPerfumes.mockResolvedValue([suggestion]);
      const makeGuess = vi.fn().mockResolvedValue(undefined);
      const pending = {
        authReady: false,
        sessionId: null,
        sessionReady: false,
      };
      const { rerender } = renderGameInput(pending, { makeGuess });

      const input = screen.getByTestId("game-input");
      const user = userEvent.setup();
      await user.click(input);
      await user.type(input, "sauvage");
      await user.click(
        await screen.findByRole("option", {}, { timeout: 2000 }),
      );

      // Still queued: the input shows the connecting state instead of resetting.
      expect(screen.getByTestId("game-input")).toBeDisabled();
      expect(makeGuess).not.toHaveBeenCalled();

      mockUseGameState.mockReturnValue(
        makeDefaultState({ ...pending, authReady: true }),
      );
      rerender(<GameInput />);

      await waitFor(() => {
        expect(makeGuess).toHaveBeenCalledWith(
          suggestion.name,
          suggestion.brand_masked,
          suggestion.perfume_id,
        );
      });
    });

    it("drops a queued pick when the sign-in has failed", async () => {
      const suggestion = makeSuggestion();
      mockSearchPerfumes.mockResolvedValue([suggestion]);
      const pending = {
        authReady: false,
        sessionId: null,
        sessionReady: false,
      };
      const makeGuess = vi.fn().mockResolvedValue(undefined);
      const { rerender } = renderGameInput(pending, { makeGuess });

      const input = screen.getByTestId("game-input");
      const user = userEvent.setup();
      await user.click(input);
      await user.type(input, "sauvage");
      await user.click(
        await screen.findByRole("option", {}, { timeout: 2000 }),
      );

      mockUseGameState.mockReturnValue(
        makeDefaultState({ ...pending, authFailed: true }),
      );
      rerender(<GameInput />);

      await waitFor(() => {
        expect(screen.getByTestId("game-input")).toBeEnabled();
      });
      expect(makeGuess).not.toHaveBeenCalled();

      // A later sign-in (after a reload, say) must not replay the dropped pick.
      mockUseGameState.mockReturnValue(
        makeDefaultState({ ...pending, authReady: true }),
      );
      rerender(<GameInput />);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(makeGuess).not.toHaveBeenCalled();
    });

    it("calls makeGuess when suggestion is clicked", async () => {
      const suggestion = makeSuggestion();
      mockSearchPerfumes.mockResolvedValue([suggestion]);
      const makeGuess = vi.fn().mockResolvedValue(undefined);
      renderGameInput({}, { makeGuess });

      const input = screen.getByTestId("game-input");
      const user = userEvent.setup();
      await user.click(input);
      await user.type(input, "sauvage");

      await waitFor(
        () => {
          expect(screen.getByRole("listbox")).toBeInTheDocument();
        },
        { timeout: 2000 },
      );

      const optionButton = screen.getByRole("option");
      await userEvent.setup().click(optionButton);

      await waitFor(() => {
        expect(makeGuess).toHaveBeenCalledWith(
          suggestion.name,
          suggestion.brand_masked,
          suggestion.perfume_id,
        );
      });
    });

    it("marks duplicate suggestions as disabled", async () => {
      const suggestion = makeSuggestion({ perfume_id: "dup-id" });
      mockSearchPerfumes.mockResolvedValue([suggestion]);
      renderGameInput({
        attempts: [
          {
            brand: "Dior",
            feedback: {
              brandMatch: true,
              notesMatch: 0,
              perfumerMatch: "none" as const,
              yearDirection: "equal" as const,
              yearMatch: "correct" as const,
            },
            guess: "Sauvage",
            perfumeId: "dup-id",
          },
        ],
      });

      const input = screen.getByTestId("game-input");
      const user = userEvent.setup();
      await user.click(input);
      await user.type(input, "sauvage");

      await waitFor(
        () => {
          expect(screen.getByRole("listbox")).toBeInTheDocument();
        },
        { timeout: 2000 },
      );

      const optionButton = screen.getByRole("option");
      expect(optionButton).toBeDisabled();
    });
  });

  describe("onboarding tooltip", () => {
    it("tooltip is visible when no attempts and input not focused", () => {
      renderGameInput({ attempts: [] }, {}, { isInputFocused: false });

      // The tooltip has aria-hidden=true but it should be visible (opacity-100)
      // We check it renders by finding the text
      expect(screen.getByText("selectHelper")).toBeInTheDocument();
    });

    it("tooltip has aria-hidden to prevent screen reader interference", () => {
      renderGameInput();

      const tooltipElement = screen
        .getByText("selectHelper")
        .closest("[aria-hidden]"); // eslint-disable-line testing-library/no-node-access
      expect(tooltipElement).toHaveAttribute("aria-hidden", "true");
    });
  });
});
