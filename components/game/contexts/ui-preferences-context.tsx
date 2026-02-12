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
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [layoutMode, setLayoutMode] = useState<"narrow" | "wide">("narrow");
  const [fontScale, setFontScale] = useState<"normal" | "large">("normal");
  const [isInputFocused, setIsInputFocused] = useState(false);

  const toggleTheme = useCallback(() => {
    setTheme((previous) => {
      const next = previous === "light" ? "dark" : "light";
      localStorage.setItem("fragrance-game-theme", next);
      return next;
    });
  }, []);

  const toggleLayoutMode = useCallback(() => {
    setLayoutMode((previous) => {
      const next = previous === "narrow" ? "wide" : "narrow";
      localStorage.setItem("fragrance-game-layout", next);
      return next;
    });
  }, []);

  const toggleFontScale = useCallback(() => {
    setFontScale((previous) => {
      const next = previous === "normal" ? "large" : "normal";
      localStorage.setItem("fragrance-game-font", next);
      return next;
    });
  }, []);

  // Apply Theme & Font Scale Side Effects
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    document.documentElement.classList.toggle(
      "large-text",
      fontScale === "large",
    );
  }, [fontScale]);

  // Load preferences from localStorage on mount
  useEffect(() => {
    const savedLayout = localStorage.getItem("fragrance-game-layout") as
      | "narrow"
      | "wide"
      | null;
    if (savedLayout) {
      setLayoutMode(savedLayout);
    } else if (window.innerWidth >= 1024) {
      // Default to wide on desktop if no preference saved
      setLayoutMode("wide");
    }

    const savedFont = localStorage.getItem("fragrance-game-font") as
      | "normal"
      | "large"
      | null;
    if (savedFont) setFontScale(savedFont);

    const savedTheme = localStorage.getItem("fragrance-game-theme") as
      | "light"
      | "dark"
      | null;
    if (savedTheme) setTheme(savedTheme);
  }, []);

  const value = {
    isInputFocused,
    setIsInputFocused,
    toggleFontScale,
    toggleLayoutMode,
    toggleTheme,
    uiPreferences: { fontScale, layoutMode, theme },
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
