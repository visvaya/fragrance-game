"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type UIPreferencesContextType = {
  isInputFocused: boolean;
  setIsInputFocused: (focused: boolean) => void;
  toggleAutoScroll: () => void;
  toggleFontScale: () => void;
  toggleLayoutMode: () => void;
  toggleTheme: () => void;
  uiPreferences: {
    autoScroll: boolean;
    fontScale: "normal" | "large";
    layoutMode: "narrow" | "wide";
    theme: "light" | "dark";
  };
};

const SSR_DEFAULTS: UIPreferencesContextType = {
  isInputFocused: false,
  setIsInputFocused: () => {
    /* Default */
  },
  toggleAutoScroll: () => {
    /* Default */
  },
  toggleFontScale: () => {
    /* Default */
  },
  toggleLayoutMode: () => {
    /* Default */
  },
  toggleTheme: () => {
    /* Default */
  },
  uiPreferences: {
    autoScroll: true,
    fontScale: "normal",
    layoutMode: "narrow",
    theme: "light",
  },
};

const UIPreferencesContext =
  createContext<UIPreferencesContextType>(SSR_DEFAULTS);

/**
 * UIPreferencesProvider - Manages UI-only state (theme, layout, font, input focus)
 * Isolated from game logic to prevent unnecessary re-renders
 */
export function UIPreferencesProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [preferences, setPreferences] = useState<{
    autoScroll: boolean;
    fontScale: "normal" | "large";
    layoutMode: "narrow" | "wide";
    theme: "light" | "dark";
  }>({
    autoScroll: true,
    fontScale: "normal",
    layoutMode: "narrow",
    theme: "light",
  });

  // Gate: the layout sync effect must NOT write to the DOM until localStorage has
  // been read (in the rAF callback below). Before that point, React state holds the
  // SSR default ("narrow"), and writing it would delete the data-layout="wide"
  // attribute that the blocking script in layout.tsx already set — causing a flash.
  // Using a ref (instead of the old isFirstLayoutSync flag) makes this resilient to
  // React Strict Mode, which re-fires effects and would defeat a "skip first run" guard.
  const hasHydratedPreferences = useRef(false);

  const [isInputFocused, setIsInputFocused] = useState(false);

  const toggleAutoScroll = useCallback(() => {
    setPreferences((previous) => {
      const next = !previous.autoScroll;
      localStorage.setItem("fragrance-game-auto-scroll", next ? "1" : "0");
      return { ...previous, autoScroll: next };
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setPreferences((previous) => {
      const next = previous.theme === "light" ? "dark" : "light";
      localStorage.setItem("fragrance-game-theme", next);
      return { ...previous, theme: next };
    });
  }, []);

  const toggleLayoutMode = useCallback(() => {
    setPreferences((previous) => {
      const next = previous.layoutMode === "narrow" ? "wide" : "narrow";
      localStorage.setItem("fragrance-game-layout", next);
      return { ...previous, layoutMode: next };
    });
  }, []);

  const toggleFontScale = useCallback(() => {
    setPreferences((previous) => {
      const next = previous.fontScale === "normal" ? "large" : "normal";
      localStorage.setItem("fragrance-game-font", next);
      return { ...previous, fontScale: next };
    });
  }, []);

  // Sync all DOM attributes/classes with preferences state.
  // Guarded by hasHydratedPreferences — until localStorage is read in the rAF
  // callback below, the blocking script's DOM values are authoritative and must
  // not be overwritten. All three mutations are idempotent (toggle/dataset), so
  // running them together on any preference change is safe.
  useEffect(() => {
    if (!hasHydratedPreferences.current) return;

    document.documentElement.classList.toggle(
      "dark",
      preferences.theme === "dark",
    );
    document.documentElement.classList.toggle(
      "large-text",
      preferences.fontScale === "large",
    );
    if (preferences.layoutMode === "wide") {
      // eslint-disable-next-line fp/no-mutation -- DOM dataset property assignment, no immutable API available
      document.documentElement.dataset.layout = "wide";
    } else {
      // eslint-disable-next-line fp/no-delete -- DOM API requires delete for attribute removal
      delete document.documentElement.dataset.layout;
    }
  }, [preferences]);

  // Load preferences from localStorage on mount.
  // Deferred to useEffect + rAF to avoid blocking the initial paint (TBT reduction).
  // Only calls setPreferences if computed values differ from current state — avoids
  // spurious re-renders (and LCP repaint) on Lighthouse/cold loads with empty localStorage.
  useEffect(() => {
    requestAnimationFrame(() => {
      const savedLayout = localStorage.getItem("fragrance-game-layout") as
        | "narrow"
        | "wide"
        | null;
      const savedFont = localStorage.getItem("fragrance-game-font") as
        | "normal"
        | "large"
        | null;
      const savedTheme = localStorage.getItem("fragrance-game-theme") as
        | "light"
        | "dark"
        | null;
      const savedAutoScroll = localStorage.getItem(
        "fragrance-game-auto-scroll",
      );

      // Auto-detect system dark mode if no preference is saved
      const systemDark = globalThis.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      const defaultTheme = systemDark ? "dark" : "light";

      // Mark hydration complete BEFORE updating state — the layout sync effect
      // checks this ref and must be allowed to write on the resulting re-render.
      hasHydratedPreferences.current = true;

      setPreferences((previous) => {
        const nextFont = savedFont ?? previous.fontScale;
        const nextLayout =
          savedLayout ??
          (window.innerWidth >= 1024 ? "wide" : previous.layoutMode);
        const nextTheme = savedTheme ?? defaultTheme;
        const nextAutoScroll =
          savedAutoScroll === null
            ? previous.autoScroll
            : savedAutoScroll === "1";

        // Skip update if nothing changed — avoids unnecessary re-render and LCP repaint
        if (
          nextAutoScroll === previous.autoScroll &&
          nextFont === previous.fontScale &&
          nextLayout === previous.layoutMode &&
          nextTheme === previous.theme
        ) {
          return previous;
        }

        return {
          autoScroll: nextAutoScroll,
          fontScale: nextFont,
          layoutMode: nextLayout,
          theme: nextTheme,
        };
      });
    });
  }, []);

  const value = {
    isInputFocused,
    setIsInputFocused,
    toggleAutoScroll,
    toggleFontScale,
    toggleLayoutMode,
    toggleTheme,
    uiPreferences: preferences,
  };

  return (
    <UIPreferencesContext.Provider value={value}>
      {children}
    </UIPreferencesContext.Provider>
  );
}

/**
 * useUIPreferences - Hook to access UI preferences
 * Use this for components that only need UI state (header, footer, etc.)
 */
export function useUIPreferences() {
  return useContext(UIPreferencesContext);
}
