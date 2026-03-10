import type React from "react";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GENERIC_PLACEHOLDER } from "@/lib/constants";

import {
  GameStateProvider,
  type Attempt,
  type DailyPerfume,
  type GameState,
} from "../../contexts";
import { PyramidClues } from "../pyramid-clues";

// Mock next-intl
vi.mock("next-intl", () => {
  type TranslationParameters = Record<string, unknown>;
  type TranslationFunction = (params: TranslationParameters) => string;
  type RichHandlerFunction = (chunks: string) => React.ReactNode;

  const t = (key: string, params?: TranslationParameters) => {
    const translations: Record<string, string | TranslationFunction> = {
      base: "Base Notes",
      heart: "Heart Notes",
      hiddenNote: "Hidden note",
      letters: (p: TranslationParameters) => `${String(p.count)} letters`,
      linearMeaning: "Linear profile - no top/heart/base division",
      linearProfile: "Linear Profile",
      linearProfileTooltip: "Linear fragrance - notes evolve uniformly",
      noteCount: (p: TranslationParameters) => `${String(p.count)} notes`,
      noteCountUnknown: "? notes",
      olfactoryProfile: "Olfactory Profile",
      pyramid: "Fragrance Pyramid",
      top: "Top Notes",
    };
    const value = translations[key];
    if (typeof value === "function" && params !== undefined) {
      return value(params);
    }
    if (typeof value === "function") {
      return value({});
    }
    return typeof value === "string" ? value : key;
  };

  t.rich = (
    key: string,
    handlers?: Record<string, RichHandlerFunction>,
    // eslint-disable-next-line sonarjs/function-return-type
  ): React.ReactNode => {
    if (key === "noteCountUnknown") {
      const text = GENERIC_PLACEHOLDER;
      if (handlers?.q) {
        return handlers.q(text);
      }
      return text;
    }
    return key;
  };

  return {
    useTranslations: () => t,
  };
});

// Mock GameTooltip
vi.mock("../../game-tooltip", () => ({
  GameTooltip: ({
    children,
    content,
  }: {
    children:
      | React.ReactNode
      | ((props: { isHovered?: boolean }) => React.ReactNode);
    content: string;
  }) => (
    <div data-tooltip={content}>
      {typeof children === "function"
        ? children({ isHovered: false })
        : children}
    </div>
  ),
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  Circle: ({ className }: { className?: string }) => (
    <div className={className} data-testid="circle-icon">
      ○
    </div>
  ),
  Layers: ({ className }: { className?: string }) => (
    <div className={className} data-testid="layers-icon">
      ≡
    </div>
  ),
  Lock: ({ className }: { className?: string }) => (
    <div className={className} data-testid="lock-icon" />
  ),
}));

const MOCK_PERFUME_PYRAMID = {
  brand: "Chanel",
  concentration: "EDP",
  gender: "Female",
  id: "test-perfume",
  imageUrl: "/test.jpg",
  isLinear: false, // Traditional pyramid
  name: "Chanel No. 5",
  notes: {
    base: ["Vanilla", "Sandalwood", "Vetiver"],
    heart: ["Jasmine", "Rose", "Lily of the Valley"],
    top: ["Aldehydes", "Neroli", "Ylang-Ylang"],
  },
  perfumer: "Ernest Beaux",
  xsolve: 100,
  year: 1921,
};

const MOCK_PERFUME_LINEAR = {
  ...MOCK_PERFUME_PYRAMID,
  isLinear: true, // Linear fragrance
  notes: {
    base: ["Musk", "Amber"],
    heart: ["Jasmine", "Rose"],
    top: ["Bergamot", "Lemon"],
  },
};

function createTestWrapper({
  currentAttempt = 1,
  dailyPerfume = MOCK_PERFUME_PYRAMID,
  gameState = "playing" as GameState,
}: {
  currentAttempt?: number;
  dailyPerfume?: DailyPerfume;
  gameState?: GameState;
} = {}) {
  return function TestWrapper({ children }: { children: React.ReactNode }) {
    return (
      <GameStateProvider
        attempts={
          Array.from({ length: currentAttempt - 1 }).map(() => ({
            brand: "Test",
            feedback: {
              brandMatch: false,
              notesMatch: 0.1,
              perfumerMatch: "none",
              yearDirection: "lower",
              yearMatch: "wrong",
            },
            guess: "Test",
          })) as Attempt[]
        }
        dailyPerfume={dailyPerfume}
        discoveredPerfumers={new Set()}
        gameState={gameState}
        loading={false}
        maxAttempts={6}
        sessionId="test-session"
        user={null}
      >
        {children}
      </GameStateProvider>
    );
  };
}

describe("PyramidClues", () => {
  describe("traditional pyramid mode", () => {
    it("renders pyramid title", () => {
      const Wrapper = createTestWrapper();
      render(<PyramidClues />, { wrapper: Wrapper });

      expect(screen.getByText("Fragrance Pyramid")).toBeInTheDocument();
    });

    it("renders three note levels (Top, Heart, Base)", () => {
      const Wrapper = createTestWrapper({ currentAttempt: 6 });
      render(<PyramidClues />, { wrapper: Wrapper });

      expect(screen.getByText(/Top Notes/i)).toBeInTheDocument();
      expect(screen.getByText(/Heart Notes/i)).toBeInTheDocument();
      expect(screen.getByText(/Base Notes/i)).toBeInTheDocument();
    });

    it("displays note counts for each level", () => {
      const Wrapper = createTestWrapper({ currentAttempt: 6 });
      render(<PyramidClues />, { wrapper: Wrapper });

      // Should show note counts: (3 notes) for each level
      const noteCounts = screen.getAllByText(/3 notes/i);
      expect(noteCounts).toHaveLength(3); // Top, Heart, Base
    });

    it("shows top notes at early attempts", () => {
      const Wrapper = createTestWrapper({ currentAttempt: 2 });
      render(<PyramidClues />, { wrapper: Wrapper });

      // At attempt 2, should show top notes (at least partially)
      expect(screen.getByText(/Top Notes/i)).toBeInTheDocument();
    });

    it("progressively reveals notes from Top to Heart to Base", () => {
      // Early attempt - only Top revealed
      const { rerender } = render(<PyramidClues />, {
        wrapper: createTestWrapper({ currentAttempt: 2 }),
      });

      expect(screen.getByText(/Top Notes/i)).toBeInTheDocument();

      // Mid attempt - Top and Heart
      rerender(
        <GameStateProvider
          attempts={
            Array.from({ length: 3 }).map(() => ({
              brand: "Test",
              feedback: {
                brandMatch: false,
                notesMatch: 0.1,
                perfumerMatch: "none",
                yearDirection: "lower",
                yearMatch: "wrong",
              },
              guess: "Test",
            })) as Attempt[]
          }
          dailyPerfume={MOCK_PERFUME_PYRAMID}
          discoveredPerfumers={new Set()}
          gameState="playing"
          loading={false}
          maxAttempts={6}
          sessionId="test-session"
          user={null}
        >
          <PyramidClues />
        </GameStateProvider>,
      );

      expect(screen.getByText(/Top Notes/i)).toBeInTheDocument();
      expect(screen.getByText(/Heart Notes/i)).toBeInTheDocument();
    });

    it("shows all levels at final attempts", () => {
      const Wrapper = createTestWrapper({ currentAttempt: 6 });
      render(<PyramidClues />, { wrapper: Wrapper });

      expect(screen.getByText(/Top Notes/i)).toBeInTheDocument();
      expect(screen.getByText(/Heart Notes/i)).toBeInTheDocument();
      expect(screen.getByText(/Base Notes/i)).toBeInTheDocument();
    });

    it("shows placeholder at attempt 1", () => {
      const Wrapper = createTestWrapper({ currentAttempt: 1 });
      render(<PyramidClues />, { wrapper: Wrapper });

      // At attempt 1, should show "?" placeholders (one for each level)
      const placeholders = screen.getAllByText(GENERIC_PLACEHOLDER);
      expect(placeholders.length).toBeGreaterThan(0);
    });
  });

  describe("linear perfume mode", () => {
    it("renders linear profile title", () => {
      const Wrapper = createTestWrapper({ dailyPerfume: MOCK_PERFUME_LINEAR });
      render(<PyramidClues />, { wrapper: Wrapper });

      expect(screen.getByText("Olfactory Profile")).toBeInTheDocument();
    });

    it("shows linear profile label", () => {
      const Wrapper = createTestWrapper({
        currentAttempt: 6,
        dailyPerfume: MOCK_PERFUME_LINEAR,
      });
      render(<PyramidClues />, { wrapper: Wrapper });

      expect(screen.getByText(/Linear Profile/i)).toBeInTheDocument();
    });

    it("displays total note count for linear perfume", () => {
      const Wrapper = createTestWrapper({
        currentAttempt: 6,
        dailyPerfume: MOCK_PERFUME_LINEAR,
      });
      render(<PyramidClues />, { wrapper: Wrapper });

      // Linear perfume has 6 notes total (2 top + 2 heart + 2 base)
      expect(screen.getByText(/6 notes/i)).toBeInTheDocument();
    });

    it("shows placeholder at attempt 1 for linear", () => {
      const Wrapper = createTestWrapper({
        currentAttempt: 1,
        dailyPerfume: MOCK_PERFUME_LINEAR,
      });
      render(<PyramidClues />, { wrapper: Wrapper });

      // At attempt 1, should show "?" placeholder
      expect(screen.getByText(GENERIC_PLACEHOLDER)).toBeInTheDocument();
    });

    it("progressively reveals linear notes (1/3, 2/3, all)", () => {
      // Level 3: 1/3 revealed
      const { rerender } = render(<PyramidClues />, {
        wrapper: createTestWrapper({
          currentAttempt: 3,
          dailyPerfume: MOCK_PERFUME_LINEAR,
        }),
      });

      expect(screen.getByText(/Linear Profile/i)).toBeInTheDocument();

      // Level 4: 2/3 revealed
      rerender(
        <GameStateProvider
          attempts={
            Array.from({ length: 3 }).map(() => ({
              brand: "Test",
              feedback: {
                brandMatch: false,
                notesMatch: 0.1,
                perfumerMatch: "none",
                yearDirection: "lower",
                yearMatch: "wrong",
              },
              guess: "Test",
            })) as Attempt[]
          }
          dailyPerfume={MOCK_PERFUME_LINEAR}
          discoveredPerfumers={new Set()}
          gameState="playing"
          loading={false}
          maxAttempts={6}
          sessionId="test-session"
          user={null}
        >
          <PyramidClues />
        </GameStateProvider>,
      );

      expect(screen.getByText(/Linear Profile/i)).toBeInTheDocument();

      // Level 5+: All revealed
      rerender(
        <GameStateProvider
          attempts={
            Array.from({ length: 4 }).map(() => ({
              brand: "Test",
              feedback: {
                brandMatch: false,
                notesMatch: 0.1,
                perfumerMatch: "none",
                yearDirection: "lower",
                yearMatch: "wrong",
              },
              guess: "Test",
            })) as Attempt[]
          }
          dailyPerfume={MOCK_PERFUME_LINEAR}
          discoveredPerfumers={new Set()}
          gameState="playing"
          loading={false}
          maxAttempts={6}
          sessionId="test-session"
          user={null}
        >
          <PyramidClues />
        </GameStateProvider>,
      );

      expect(screen.getByText(/6 notes/i)).toBeInTheDocument();
    });
  });

  describe("game end states", () => {
    it("reveals all notes when game is won", () => {
      const Wrapper = createTestWrapper({
        currentAttempt: 3,
        gameState: "won",
      });
      render(<PyramidClues />, { wrapper: Wrapper });

      // Should show all levels even though only at attempt 3
      expect(screen.getByText(/Top Notes/i)).toBeInTheDocument();
      expect(screen.getByText(/Heart Notes/i)).toBeInTheDocument();
      expect(screen.getByText(/Base Notes/i)).toBeInTheDocument();
    });

    it("reveals all notes when game is lost", () => {
      const Wrapper = createTestWrapper({
        currentAttempt: 6,
        gameState: "lost",
      });
      render(<PyramidClues />, { wrapper: Wrapper });

      // Should show all levels
      expect(screen.getByText(/Top Notes/i)).toBeInTheDocument();
      expect(screen.getByText(/Heart Notes/i)).toBeInTheDocument();
      expect(screen.getByText(/Base Notes/i)).toBeInTheDocument();
    });

    it("reveals all linear notes when game ends", () => {
      const Wrapper = createTestWrapper({
        currentAttempt: 3,
        dailyPerfume: MOCK_PERFUME_LINEAR,
        gameState: "won",
      });
      render(<PyramidClues />, { wrapper: Wrapper });

      // Should show all 6 notes even though only at attempt 3
      expect(screen.getByText(/6 notes/i)).toBeInTheDocument();
    });
  });

  describe("edge cases", () => {
    it("handles perfume with empty notes array", () => {
      const perfumeWithEmptyNotes = {
        ...MOCK_PERFUME_PYRAMID,
        notes: {
          base: [],
          heart: [],
          top: [],
        },
      };

      const Wrapper = createTestWrapper({
        currentAttempt: 6,
        dailyPerfume: perfumeWithEmptyNotes,
      });
      render(<PyramidClues />, { wrapper: Wrapper });

      // Should still render the component
      expect(screen.getByText("Fragrance Pyramid")).toBeInTheDocument();
    });

    it("handles perfume with only top notes", () => {
      const perfumeWithOnlyTop = {
        ...MOCK_PERFUME_PYRAMID,
        notes: {
          base: [],
          heart: [],
          top: ["Bergamot", "Lemon"],
        },
      };

      const Wrapper = createTestWrapper({
        currentAttempt: 6,
        dailyPerfume: perfumeWithOnlyTop,
      });
      render(<PyramidClues />, { wrapper: Wrapper });

      expect(screen.getByText(/Top Notes/i)).toBeInTheDocument();
      expect(screen.getByText(/2 notes/i)).toBeInTheDocument();
    });

    it("handles linear perfume with single note", () => {
      const linearWithOneNote = {
        ...MOCK_PERFUME_LINEAR,
        notes: {
          base: ["Vanilla"],
          heart: [],
          top: [],
        },
      };

      const Wrapper = createTestWrapper({
        currentAttempt: 6,
        dailyPerfume: linearWithOneNote,
      });
      render(<PyramidClues />, { wrapper: Wrapper });

      expect(screen.getByText(/1 notes/i)).toBeInTheDocument();
    });

    it("handles very long note names", () => {
      const perfumeWithLongNotes = {
        ...MOCK_PERFUME_PYRAMID,
        notes: {
          base: ["Supercalifragilisticexpialidocious Vanilla Extract"],
          heart: ["Long Chemical Compound Name with Numbers 123"],
          top: ["Another Very Long Perfume Note Name"],
        },
      };

      const Wrapper = createTestWrapper({
        currentAttempt: 6,
        dailyPerfume: perfumeWithLongNotes,
      });
      render(<PyramidClues />, { wrapper: Wrapper });

      // Should render without errors
      expect(screen.getByText("Fragrance Pyramid")).toBeInTheDocument();
    });
  });

  describe("visual indicators", () => {
    it("displays layers icon", () => {
      const Wrapper = createTestWrapper();
      render(<PyramidClues />, { wrapper: Wrapper });

      expect(screen.getByTestId("layers-icon")).toBeInTheDocument();
    });

    it("does not show pyramid title for linear perfumes", () => {
      const Wrapper = createTestWrapper({ dailyPerfume: MOCK_PERFUME_LINEAR });
      render(<PyramidClues />, { wrapper: Wrapper });

      expect(screen.queryByText("Fragrance Pyramid")).not.toBeInTheDocument();
      expect(screen.getByText("Olfactory Profile")).toBeInTheDocument();
    });
  });
});
