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

  // Apply Theme & Font Scale Side Effects
  useEffect(() => {
    document.documentElement.classList.toggle("dark", preferences.theme === "dark");
  }, [preferences.theme]);

  useEffect(() => {
    document.documentElement.classList.toggle(
      "large-text",
      preferences.fontScale === "large",
    );
  }, [preferences.fontScale]);

  // Load preferences from localStorage on mount
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

      setPreferences((previous) => ({
        fontScale: savedFont || previous.fontScale,
        layoutMode: savedLayout || (window.innerWidth >= 1024 ? "wide" : previous.layoutMode),
        theme: savedTheme || previous.theme,
      }));
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
export function useUIPreferences() {
  const context = useContext(UIPreferencesContext);
  if (!context) {
    throw new Error(
      "useUIPreferences must be used within UIPreferencesProvider",
    );
  }
  return context;
}
