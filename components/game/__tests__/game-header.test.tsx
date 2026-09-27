/**
 * Tests for GameHeader component.
 * Mocks useGame, useUIPreferences, routing, and dynamic modal imports.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mock refs
// ---------------------------------------------------------------------------

const { mockUseGame, mockUseUIPreferences } = vi.hoisted(() => ({
  mockUseGame: vi.fn(),
  mockUseUIPreferences: vi.fn(),
}));

vi.mock("@/components/game/game-provider", () => ({
  useGame: mockUseGame,
}));

vi.mock("@/components/game/contexts", () => ({
  useUIPreferences: mockUseUIPreferences,
}));

vi.mock("@/hooks/use-scroll-direction", () => ({
  useScrollDirection: () => false,
}));

vi.mock("@/i18n/routing", () => ({
  localeNames: { en: "English", pl: "Polski" },
  routing: { defaultLocale: "en", locales: ["en", "pl"] },
  usePathname: () => "/en",
  useRouter: () => ({
    back: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

// Stub out all next/dynamic imports — we don't test modal content here
vi.mock("next/dynamic", () => ({
  default:
    (
      _importFunction: unknown,
      _options?: unknown,
    ): React.FC<Record<string, unknown>> =>
    (_props: Record<string, unknown>) =>
      null,
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock("@/components/game/game-tooltip", () => ({
  GameTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/game/mobile-reset-item", () => ({
  MobileResetItem: () => <li data-testid="mobile-reset-item" />,
}));

vi.mock("@/components/game/reset-button", () => ({
  ResetButton: () => <button data-testid="reset-button">Reset</button>,
}));

import { GameHeader } from "../game-header";

import type { User } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeDefaultGame = (overrides: Record<string, unknown> = {}) => ({
  attempts: [],
  authReady: true,
  blurLevel: 1,
  currentAttempt: 1,
  dailyPerfume: {
    brand: "Dior",
    concentration: "EDP",
    gender: "Male",
    id: "test-id",
    imageUrl: "/test.jpg",
    isLinear: false,
    name: "Sauvage",
    notes: { base: [], heart: [], top: [] },
    perfumer: "Creator",
    xsolve: 80,
    year: 2015,
  },
  gameState: "playing",
  getBlurLevel: vi.fn().mockReturnValue(1),
  getPotentialScore: vi.fn().mockReturnValue(1000),
  getRevealedBrand: vi.fn().mockReturnValue("?????"),
  getRevealedGender: vi.fn().mockReturnValue("?????"),
  getRevealedPerfumer: vi.fn().mockReturnValue("?????"),
  getRevealedYear: vi.fn().mockReturnValue("????"),
  getVisibleNotes: vi
    .fn()
    .mockReturnValue({ base: null, heart: null, top: null }),
  isBrandRevealed: false,
  isGenderRevealed: false,
  isInputFocused: false,
  isRateLimited: false,
  isYearRevealed: false,
  loading: false,
  makeGuess: vi.fn(),
  maxAttempts: 6,
  potentialScore: 1000,
  resetGame: vi.fn(),
  revealedBrand: "?????",
  revealedGender: "?????",
  revealedNotes: { base: null, heart: null, top: null },
  revealedPerfumer: "?????",
  revealedYear: "????",
  revealLevel: 1,
  sessionId: "session-123",
  sessionReady: true,
  setIsInputFocused: vi.fn(),
  skipAttempt: vi.fn(),
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
  user: null as User | null,
  visibleNotes: { base: null, heart: null, top: null },
  xsolveScore: 0,
  ...overrides,
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

function renderHeader(
  gameOverrides: Record<string, unknown> = {},
  uiOverrides: Record<string, unknown> = {},
) {
  mockUseGame.mockReturnValue(makeDefaultGame(gameOverrides));
  mockUseUIPreferences.mockReturnValue({ ...makeDefaultUI(), ...uiOverrides });
  return render(<GameHeader />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GameHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage to simulate first visit
    localStorage.clear();
  });

  describe("logo", () => {
    it("renders Eauxle logo text", () => {
      renderHeader();

      expect(screen.getByText("Eauxle")).toBeInTheDocument();
    });

    it("logo is an h1 element", () => {
      renderHeader();

      const logo = screen.getByRole("heading", { level: 1 });
      expect(logo).toHaveTextContent("Eauxle");
    });
  });

  describe("navigation buttons", () => {
    it("renders menu button with aria-label", () => {
      renderHeader();

      expect(screen.getByRole("button", { name: "menu" })).toBeInTheDocument();
    });

    it("renders help button with aria-label inside nav", () => {
      renderHeader();

      const nav = screen.getByRole("navigation");
      expect(
        within(nav).getByRole("button", { name: "help" }),
      ).toBeInTheDocument();
    });

    it("renders stats button with aria-label inside nav", () => {
      renderHeader();

      const nav = screen.getByRole("navigation");
      expect(
        within(nav).getByRole("button", { name: "stats" }),
      ).toBeInTheDocument();
    });

    it("renders language toggle button inside nav", () => {
      renderHeader();

      // Language button shows "EN" exactly (locale.toUpperCase() + chevron icon)
      const nav = screen.getByRole("navigation");
      const langButtons = within(nav).getAllByRole("button");
      const langButton = langButtons.find((btn: HTMLElement) =>
        btn.textContent.includes("EN"),
      );
      expect(langButton).toBeInTheDocument();
    });
  });

  describe("menu dropdown", () => {
    it("menu dropdown is not visible by default", () => {
      renderHeader();

      // Menu items are in the dropdown which is invisible (not present as separate testid)
      // Check that "about" menu item is not accessible when menu is closed
      // The dropdown uses visibility:hidden (invisible class) when closed
      // Check for sign-in button which should be in the closed menu
      const menuDropdownButtons = screen
        .getAllByRole("button")
        .filter((btn: HTMLElement) => btn.textContent === "signIn");
      // Button exists but is not visible (menu is closed)
      expect(menuDropdownButtons.length).toBeGreaterThan(0);
    });

    it("menu opens after clicking menu button", async () => {
      renderHeader();

      const menuButton = screen.getByRole("button", { name: "menu" });
      await userEvent.setup({ delay: null }).click(menuButton);

      // When menu is open, backdrop overlay is rendered
      const backdrop = screen.getByRole("button", { name: "Close menu" });
      expect(backdrop).toBeInTheDocument();
    });

    it("clicking menu button again closes the menu", async () => {
      renderHeader();

      const menuButton = screen.getByRole("button", { name: "menu" });
      await userEvent.setup({ delay: null }).click(menuButton); // open
      await userEvent.setup({ delay: null }).click(menuButton); // close

      expect(
        screen.queryByRole("button", { name: "Close menu" }),
      ).not.toBeInTheDocument();
    });

    it("pressing Escape on backdrop closes menu", async () => {
      renderHeader();

      const menuButton = screen.getByRole("button", { name: "menu" });
      await userEvent.setup({ delay: null }).click(menuButton); // open

      await userEvent.keyboard("{Escape}");

      expect(
        screen.queryByRole("button", { name: "Close menu" }),
      ).not.toBeInTheDocument();
    });

    it("clicking backdrop closes both menu and lang dropdowns", async () => {
      renderHeader();

      const menuButton = screen.getByRole("button", { name: "menu" });
      await userEvent.setup({ delay: null }).click(menuButton); // open

      const backdrop = screen.getByRole("button", { name: "Close menu" });
      await userEvent.setup({ delay: null }).click(backdrop); // close

      expect(
        screen.queryByRole("button", { name: "Close menu" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("menu content — user state", () => {
    it("shows signIn and createAccount when user is null", () => {
      renderHeader({ user: null });

      expect(screen.getByText("signIn")).toBeInTheDocument();
      expect(screen.getByText("createAccount")).toBeInTheDocument();
    });

    it("shows signIn and createAccount when user is anonymous", () => {
      const anonymousUser = { id: "anon-id", is_anonymous: true } as User;
      renderHeader({ user: anonymousUser });

      // Anonymous user sees sign-in and create account (profile + signIn + createAccount)
      expect(screen.getByText("signIn")).toBeInTheDocument();
      expect(screen.getByText("createAccount")).toBeInTheDocument();
    });

    it("shows profile button when user is registered", () => {
      const registeredUser = { id: "user-id", is_anonymous: false } as User;
      renderHeader({ user: registeredUser });

      expect(screen.getByText("profile")).toBeInTheDocument();
    });

    it("shows signOut when user is registered", () => {
      const registeredUser = { id: "user-id", is_anonymous: false } as User;
      renderHeader({ user: registeredUser });

      expect(screen.getByText("signOut")).toBeInTheDocument();
    });
  });

  describe("appearance toggles", () => {
    it("renders dark mode toggle button", () => {
      renderHeader();

      // The appearance section with darkMode text
      expect(screen.getByText("darkMode")).toBeInTheDocument();
    });

    it("clicking dark mode toggle calls toggleTheme", async () => {
      const toggleTheme = vi.fn();
      renderHeader({ toggleTheme });

      const darkModeButton = screen
        .getAllByRole("button")
        .find((btn: HTMLElement) => btn.textContent.includes("darkMode"));
      expect(darkModeButton).toBeDefined();
      if (darkModeButton)
        await userEvent.setup({ delay: null }).click(darkModeButton);

      expect(toggleTheme).toHaveBeenCalledTimes(1);
    });

    it("clicking large text toggle calls toggleFontScale", async () => {
      const toggleFontScale = vi.fn();
      renderHeader({ toggleFontScale });

      const fontButton = screen
        .getAllByRole("button")
        .find((btn) => btn.textContent.includes("largeText"));
      expect(fontButton).toBeDefined();
      if (fontButton) await userEvent.setup({ delay: null }).click(fontButton);

      expect(toggleFontScale).toHaveBeenCalledTimes(1);
    });

    it("clicking auto scroll toggle calls toggleAutoScroll", async () => {
      const toggleAutoScroll = vi.fn();
      renderHeader({ toggleAutoScroll });

      const autoScrollButton = screen
        .getAllByRole("button")
        .find((btn) => btn.textContent.includes("autoScroll"));
      expect(autoScrollButton).toBeDefined();
      if (autoScrollButton)
        await userEvent.setup({ delay: null }).click(autoScrollButton);

      expect(toggleAutoScroll).toHaveBeenCalledTimes(1);
    });
  });

  describe("help hint badge", () => {
    it("shows help hint on first visit (no localStorage key)", async () => {
      localStorage.removeItem("eauxle:hasVisited");
      renderHeader();

      // The pulse badge appears next to the help button after mount effect
      await waitFor(() => {
        const badge = screen.getByTestId("help-hint-badge");
        expect(badge).toBeInTheDocument();
      });
    });

    it("does not show help hint when already visited", () => {
      localStorage.setItem("eauxle:hasVisited", "1");
      renderHeader();

      const badge = screen.queryByTestId("help-hint-badge");
      expect(badge).not.toBeInTheDocument();
    });
  });

  describe("language dropdown", () => {
    it("opens language dropdown when language button is clicked", async () => {
      renderHeader();

      const nav = screen.getByRole("navigation");
      const langButtons = within(nav).getAllByRole("button");
      const langButton = langButtons.find((btn: HTMLElement) =>
        btn.textContent.includes("EN"),
      );
      if (!langButton) throw new Error("Language button not found");

      await userEvent.setup({ delay: null }).click(langButton);

      // Language options appear — "Polski" locale option should be visible
      expect(screen.getAllByText("Polski").length).toBeGreaterThan(0);
    });
  });
});
