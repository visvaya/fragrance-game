/**
 * Tests for AttemptLog component.
 * Mocks useGameState and useUIPreferences so we can control rendered output.
 */
import { createContext, useContext } from "react";

import { render, screen, act } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mock refs — must exist before vi.mock() factories run
// ---------------------------------------------------------------------------

const { mockGameState, mockUIPreferences } = vi.hoisted(() => ({
  mockGameState: vi.fn(),
  mockUIPreferences: vi.fn(),
}));

vi.mock("@/components/game/contexts", () => ({
  useGameState: mockGameState,
  useUIPreferences: mockUIPreferences,
}));

// Simplify child components to avoid deep dependency chains
vi.mock("@/components/game/attempt-row", () => ({
  AttemptRow: ({ index }: { index: number }) => (
    // id={`attempt-${index}`} mirrors the real component — needed for autoScroll querySelector
    <div data-testid={`attempt-row-${index}`} id={`attempt-${index}`}>
      AttemptRow
    </div>
  ),
}));

vi.mock("@/components/game/skeletons", () => ({
  AttemptLogSkeleton: () => (
    <div data-testid="attempt-log-skeleton">Skeleton</div>
  ),
}));

vi.mock("@/components/game/scrollable-row", () => ({
  ScrollableRow: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/components/game/game-tooltip", () => ({
  GameTooltip: ({
    children,
    content,
  }: {
    children: React.ReactNode;
    content: React.ReactNode;
  }) => (
    <div
      data-testid={
        typeof content === "string" ? `tooltip-${content}` : undefined
      }
    >
      {children}
    </div>
  ),
}));

vi.mock("@/components/providers/smooth-scroll-provider", () => ({
  lenisScrollTo: vi.fn(),
}));

vi.mock("@/hooks/use-is-overflowing", () => ({
  useIsOverflowing: () => ({
    canScrollLeft: false,
    canScrollRight: false,
    ref: { current: null },
  }),
}));

vi.mock("@/hooks/use-scale-on-tap", () => ({
  useScaleOnTap: () => ({
    handlePointerDown: vi.fn(),
    scaled: false,
  }),
}));

vi.mock("@/lib/hooks/use-mount-effect", () => ({
  useMountEffect: vi.fn(),
}));

import { lenisScrollTo } from "@/components/providers/smooth-scroll-provider";
import { HIDDEN_CLUES } from "@/lib/game/clue-reveal";

import { AttemptLog } from "../attempt-log";

import type {
  Attempt,
  DailyPerfume,
  GameState,
} from "../contexts/game-state-context";

// ---------------------------------------------------------------------------
// Messages and fixtures
// ---------------------------------------------------------------------------

const MESSAGES = {
  AttemptLog: {
    by: "by",
    columns: {
      attempt: "#",
      attemptTooltip: "Attempt Number",
      brandTooltip: "Brand",
      genderTooltip: "Gender",
      notesTooltip: "Notes",
      perfume: "Perfume",
      perfumersTooltip: "Perfumers",
      perfumerTooltip: "Perfumer",
      yearTooltip: "Year",
    },
    skipped: "Skipped",
    title: "Investigation Log",
    titleTooltip: "History of your attempts",
    tooltips: {
      brandCorrect: "Brand: Correct",
      brandIncorrect: "Brand: Incorrect",
      brandMissing: "Brand: No data",
      genderCorrect: "Gender: Correct",
      genderIncorrect: "Gender: Incorrect",
      genderMissing: "Gender: No data",
      genderUnknown: "Gender: Unknown",
      notesCorrect: "Notes: 100%",
      notesMissing: "Notes: No data",
      notesPercentage: "Notes: {percent}%",
      perfumerFull: "Perfumer: Full",
      perfumerIncorrect: "Perfumer: Incorrect",
      perfumerMissing: "Perfumer: No data",
      perfumerPartial: "Perfumer: Partial",
      yearCloseHigher: "Year: Close higher",
      yearCloseLower: "Year: Close lower",
      yearCorrect: "Year: Correct",
      yearMissing: "Year: No data",
      yearWrongHigher: "Year: Higher",
      yearWrongLower: "Year: Lower",
    },
  },
};

const SKELETON_PERFUME: DailyPerfume = {
  concentration: undefined,
  id: "skeleton",
  imageUrl: "/placeholder.svg",
  name: "?????",
  xsolve: 0,
};

const DAILY_PERFUME: DailyPerfume = {
  concentration: "EDP",
  id: "daily",
  imageUrl: "/dior.jpg",
  name: "Sauvage",
  xsolve: 80,
};

const DEFAULT_FEEDBACK = {
  brandMatch: false,
  genderMatch: false,
  notesMatch: 0,
  perfumerMatch: "none" as const,
  yearDirection: "higher" as const,
  yearMatch: "wrong" as const,
};

let _attemptCounter = 0;
function makeAttempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    brand: "Chanel",
    feedback: DEFAULT_FEEDBACK,
    guess: "No. 5",
    perfumeId: `perfume-${++_attemptCounter}`,
    ...overrides,
  };
}

function defaultGameState(
  overrides: Partial<ReturnType<typeof mockGameState>> = {},
) {
  return {
    attempts: [],
    clues: HIDDEN_CLUES,
    dailyPerfume: DAILY_PERFUME,
    gameState: "playing" as GameState,
    loading: false,
    maxAttempts: 6,
    ...overrides,
  };
}

function defaultUIPrefs() {
  return {
    uiPreferences: { autoScroll: true },
  };
}

function renderAttemptLog() {
  return render(
    <NextIntlClientProvider locale="en" messages={MESSAGES}>
      <AttemptLog />
    </NextIntlClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AttemptLog — skeleton state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUIPreferences.mockReturnValue(defaultUIPrefs());
  });

  it("renders skeleton when dailyPerfume.id is 'skeleton'", () => {
    mockGameState.mockReturnValue(
      defaultGameState({ dailyPerfume: SKELETON_PERFUME }),
    );

    renderAttemptLog();

    expect(screen.getByTestId("attempt-log-skeleton")).toBeInTheDocument();
  });

  it("does NOT render heading when skeleton", () => {
    mockGameState.mockReturnValue(
      defaultGameState({ dailyPerfume: SKELETON_PERFUME }),
    );

    renderAttemptLog();

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});

describe("AttemptLog — playing state (no attempts)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGameState.mockReturnValue(defaultGameState());
    mockUIPreferences.mockReturnValue(defaultUIPrefs());
  });

  it("renders main container with title", () => {
    renderAttemptLog();
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
  });

  it("renders the section title", () => {
    renderAttemptLog();
    expect(screen.getByText("Investigation Log")).toBeInTheDocument();
  });

  it("renders column header for attempt number", () => {
    renderAttemptLog();
    expect(screen.getByText("#")).toBeInTheDocument();
  });

  it("renders column header for perfume name", () => {
    renderAttemptLog();
    expect(screen.getByText("Perfume")).toBeInTheDocument();
  });

  it("renders 6 empty attempt slots when no attempts and maxAttempts=6", () => {
    renderAttemptLog();
    // Each empty slot has a number (1-6)
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    // No attempt rows
    expect(screen.queryByTestId("attempt-row-0")).not.toBeInTheDocument();
  });

  it("renders correct number of empty slots based on maxAttempts", () => {
    mockGameState.mockReturnValue(defaultGameState({ maxAttempts: 3 }));

    renderAttemptLog();

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.queryByText("4")).not.toBeInTheDocument();
  });
});

describe("AttemptLog — with attempts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUIPreferences.mockReturnValue(defaultUIPrefs());
  });

  it("renders AttemptRow for each attempt", () => {
    mockGameState.mockReturnValue(
      defaultGameState({ attempts: [makeAttempt(), makeAttempt()] }),
    );

    renderAttemptLog();

    expect(screen.getByTestId("attempt-row-0")).toBeInTheDocument();
    expect(screen.getByTestId("attempt-row-1")).toBeInTheDocument();
  });

  it("renders remaining empty slots correctly (2 attempts → 4 empty slots)", () => {
    const attempts = [makeAttempt(), makeAttempt()];
    mockGameState.mockReturnValue(defaultGameState({ attempts }));

    renderAttemptLog();

    // Attempt rows for 0, 1
    expect(screen.getByTestId("attempt-row-0")).toBeInTheDocument();
    expect(screen.getByTestId("attempt-row-1")).toBeInTheDocument();
    // Empty slots for positions 3, 4, 5, 6
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    // No slot for position 1 or 2 (filled by attempts)
    expect(screen.queryByText("1")).not.toBeInTheDocument();
  });

  it("renders no empty slots when maxAttempts reached", () => {
    const attempts = Array.from({ length: 6 }, () => makeAttempt());
    mockGameState.mockReturnValue(defaultGameState({ attempts }));

    renderAttemptLog();

    expect(screen.getByTestId("attempt-row-0")).toBeInTheDocument();
    expect(screen.getByTestId("attempt-row-5")).toBeInTheDocument();
    // No empty slot numbers
    expect(screen.queryByText("7")).not.toBeInTheDocument();
  });
});

describe("AttemptLog — won/lost state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUIPreferences.mockReturnValue(defaultUIPrefs());
  });

  it("renders title and attempt rows in won state", () => {
    mockGameState.mockReturnValue(
      defaultGameState({
        attempts: [makeAttempt()],
        gameState: "won" as GameState,
      }),
    );

    renderAttemptLog();

    expect(screen.getByText("Investigation Log")).toBeInTheDocument();
    expect(screen.getByTestId("attempt-row-0")).toBeInTheDocument();
  });

  it("renders title in lost state", () => {
    const attempts = Array.from({ length: 6 }, () => makeAttempt());
    mockGameState.mockReturnValue(
      defaultGameState({ attempts, gameState: "lost" as GameState }),
    );

    renderAttemptLog();

    expect(screen.getByText("Investigation Log")).toBeInTheDocument();
  });
});

describe("AttemptLog — perfumer column header", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUIPreferences.mockReturnValue(defaultUIPrefs());
  });

  it("shows the multi-perfumer icon when the server reports several perfumers", () => {
    mockGameState.mockReturnValue(
      defaultGameState({
        attempts: [makeAttempt()],
        clues: { ...HIDDEN_CLUES, perfumerCount: 2 },
      }),
    );

    renderAttemptLog();
    expect(screen.getByText("Investigation Log")).toBeInTheDocument();
    expect(screen.getByTestId("tooltip-Perfumers")).toBeInTheDocument();
  });

  it("shows the single-perfumer icon for one perfumer", () => {
    mockGameState.mockReturnValue(
      defaultGameState({ attempts: [makeAttempt()] }),
    );

    renderAttemptLog();
    expect(screen.getByTestId("tooltip-Perfumer")).toBeInTheDocument();
    expect(screen.queryByTestId("tooltip-Perfumers")).not.toBeInTheDocument();
  });
});

// AttemptLog is memoized and takes no props, so a plain vi.fn() hook mock never
// re-renders it on rerender(). Serving the mocked state through a real context makes
// value changes re-render the component the way GameStateProvider does in the app.
type TestGameStateValue = ReturnType<typeof defaultGameState>;
const TestGameStateContext = createContext<TestGameStateValue | null>(null);

function useTestGameState(): TestGameStateValue | null {
  return useContext(TestGameStateContext);
}

function renderWithGameState(initial: TestGameStateValue): {
  update: (next: TestGameStateValue) => void;
} {
  mockGameState.mockImplementation(useTestGameState);
  const tree = (value: TestGameStateValue) => (
    <NextIntlClientProvider locale="en" messages={MESSAGES}>
      <TestGameStateContext.Provider value={value}>
        <AttemptLog />
      </TestGameStateContext.Provider>
    </NextIntlClientProvider>
  );
  const { rerender } = render(tree(initial));
  return {
    update: (next) => {
      rerender(tree(next));
    },
  };
}

describe("AttemptLog — autoScroll behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUIPreferences.mockReturnValue(defaultUIPrefs());
    // jsdom does not implement scrollIntoView — set a spy so we can assert on it
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls scrollIntoView when a new attempt is added and autoScroll is enabled", () => {
    vi.useFakeTimers();

    // Initial render: loading=false, attempts=[] → hasInitialized fires (no scroll)
    const { update } = renderWithGameState(defaultGameState({ attempts: [] }));

    // Add one attempt — triggers the scroll branch
    update(defaultGameState({ attempts: [makeAttempt()] }));

    // Advance past the 100ms setTimeout inside the scroll effect
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("does not call scrollIntoView when autoScroll is disabled", () => {
    vi.useFakeTimers();
    mockUIPreferences.mockReturnValue({ uiPreferences: { autoScroll: false } });

    const { update } = renderWithGameState(defaultGameState({ attempts: [] }));
    update(defaultGameState({ attempts: [makeAttempt()] }));

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it("calls lenisScrollTo(0) when game transitions from playing to won", () => {
    vi.useFakeTimers();

    const { update } = renderWithGameState(
      defaultGameState({
        attempts: [makeAttempt()],
        gameState: "playing" as GameState,
      }),
    );

    // Transition to won
    update(
      defaultGameState({
        attempts: [makeAttempt()],
        gameState: "won" as GameState,
      }),
    );

    // Advance past the 300ms endTimer
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(lenisScrollTo).toHaveBeenCalledWith(0);
  });

  it("does not call lenisScrollTo when game starts already won (page restore)", () => {
    vi.useFakeTimers();

    // Start directly in "won" state — previousGameStateReference stays null on mount
    renderWithGameState(
      defaultGameState({
        attempts: [makeAttempt()],
        gameState: "won" as GameState,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(400);
    });

    // No playing→won transition detected — lenisScrollTo must not fire
    expect(lenisScrollTo).not.toHaveBeenCalled();
  });
});
