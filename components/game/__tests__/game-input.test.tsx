/**
 * Tests for GameInput component.
 * Mocks game contexts and autocomplete action to test rendering and interactions.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mock refs — must exist before vi.mock() factories run
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

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open: boolean;
  }) => (open ? <div data-testid="alert-dialog">{children}</div> : null),
  AlertDialogAction: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button data-testid="skip-confirm-button" onClick={onClick}>
      {children}
    </button>
  ),
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) => (
    <button data-testid="skip-cancel-button">{children}</button>
  ),
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
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

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

import { GameInput } from "../game-input";

import type { DailyPerfume } from "../contexts/game-state-context";

// ResizeObserver and scrollIntoView are not available in jsdom — provide stubs
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
  isBrandRevealed: false,
  isGenderRevealed: false,
  isYearRevealed: false,
  loading: false,
  maxAttempts: 6,
  potentialScore: 1000,
  revealedBrand: "?????",
  revealedGender: "?????",
  revealedPerfumer: "?????",
  revealedYear: "????",
  revealLevel: 1,
  sessionId: "session-123",
  sessionReady: true,
  user: null,
  visibleNotes: { base: null, heart: null, top: null },
  xsolveScore: 0,
  ...overrides,
});

const makeDefaultActions = () => ({
  isRateLimited: false,
  makeGuess: vi.fn().mockResolvedValue(undefined),
  resetGame: vi.fn(),
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

      // Status bar contains attempt info — use getAllByText since there's an invisible clone
      expect(screen.getAllByText(/2/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/6/).length).toBeGreaterThan(0);
    });

    it("shows potential score in status bar", () => {
      renderGameInput({ potentialScore: 850 });

      // Status bar contains score — use getAllByText since there's an invisible clone
      expect(screen.getAllByText(/850/).length).toBeGreaterThan(0);
    });
  });

  describe("skip button", () => {
    it("renders skip button with aria-label", () => {
      renderGameInput();

      expect(
        screen.getByRole("button", { name: "skipTooltip" }),
      ).toBeInTheDocument();
    });

    it("is disabled when sessionReady is false", () => {
      renderGameInput({ sessionReady: false });

      expect(
        screen.getByRole("button", { name: "skipTooltip" }),
      ).toBeDisabled();
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

  describe("suggestion selection", () => {
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
