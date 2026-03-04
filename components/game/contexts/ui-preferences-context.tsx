"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

type UIPreferencesContextType = {
  isInputFocused: boolean;
  setIsInputFocused: (focused: boolean) => void;
  toggleFontScale: () => void;
  toggleLayoutMode: () => void;
  toggleTheme: () => void;
  uiPreferences: {
    fontScale: "normal" | "large";
    layoutMode: "narrow" | "wide";
    theme: "light" | "dark";
  };
};

const UIPreferencesContext = createContext<
  UIPreferencesContextType | undefined
>(undefined);

/**
 * UIPreferencesProvider - Manages UI-only state (theme, layout, font, input focus)
 * Isolated from game logic to prevent unnecessary re-renders
 */
export function UIPreferencesProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [preferences, setPreferences] = useState<{
    fontScale: "normal" | "large";
    layoutMode: "narrow" | "wide";
    theme: "light" | "dark";
  }>({
    fontScale: "normal",
    layoutMode: "narrow",
    theme: "light",
  });

  const [isInputFocused, setIsInputFocused] = useState(false);

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

  // Sync data-layout attribute on <html> so the CSS pre-hydration rule
  // stays in sync after React hydrates and when the user manually toggles layout.
  useEffect(() => {
    if (preferences.layoutMode === "wide") {
      document.documentElement.dataset.layout = "wide";
    } else {
      delete document.documentElement.dataset.layout;
    }
  }, [preferences.layoutMode]);

  // Apply Theme & Font Scale Side Effects
  useEffect(() => {
    document.documentElement.classList.toggle(
      "dark",
      preferences.theme === "dark",
    );
  }, [preferences.theme]);

  useEffect(() => {
    document.documentElement.classList.toggle(
      "large-text",
      preferences.fontScale === "large",
    );
  }, [preferences.fontScale]);

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

      // Auto-detect system dark mode if no preference is saved
      const systemDark = globalThis.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      const defaultTheme = systemDark ? "dark" : "light";

      setPreferences((previous) => {
        const nextFont = savedFont ?? previous.fontScale;
        const nextLayout =
          savedLayout ??
          (window.innerWidth >= 1024 ? "wide" : previous.layoutMode);
        const nextTheme = savedTheme ?? defaultTheme;

        // Skip update if nothing changed — avoids unnecessary re-render and LCP repaint
        if (
          nextFont === previous.fontScale &&
          nextLayout === previous.layoutMode &&
          nextTheme === previous.theme
        ) {
          return previous;
        }

        return {
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
// eslint-disable-next-line react-refresh/only-export-components
export function useUIPreferences() {
  const context = useContext(UIPreferencesContext);
  if (!context) {
    throw new Error(
      "useUIPreferences must be used within UIPreferencesProvider",
    );
  }
  return context;
}
