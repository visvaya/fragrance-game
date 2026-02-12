import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  UIPreferencesProvider,
  useUIPreferences,
} from "../ui-preferences-context";

describe("UIPreferencesContext", () => {
  // Mock localStorage
  const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
      clear: () => {
        store = {};
      },
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value.toString();
      },
    };
  })();

  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: localStorageMock,
      writable: true,
    });
    localStorageMock.clear();

    // Mock classList toggle
    document.documentElement.classList.toggle = vi.fn();

    // Mock window.innerWidth to control default layout behavior
    Object.defineProperty(globalThis, "innerWidth", {
      configurable: true,
      value: 800, // Default to narrow (< 1024)
      writable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should provide default UI preferences", () => {
    const { result } = renderHook(() => useUIPreferences(), {
      wrapper: UIPreferencesProvider,
    });

    expect(result.current.uiPreferences).toEqual({
      fontScale: "normal",
      layoutMode: "narrow",
      theme: "light",
    });
    expect(result.current.isInputFocused).toBe(false);
  });

  it("should toggle theme and persist to localStorage", () => {
    const { result } = renderHook(() => useUIPreferences(), {
      wrapper: UIPreferencesProvider,
    });

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.uiPreferences.theme).toBe("dark");
    expect(localStorageMock.getItem("fragrance-game-theme")).toBe("dark");

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.uiPreferences.theme).toBe("light");
    expect(localStorageMock.getItem("fragrance-game-theme")).toBe("light");
  });

  it("should toggle layout mode and persist to localStorage", () => {
    const { result } = renderHook(() => useUIPreferences(), {
      wrapper: UIPreferencesProvider,
    });

    act(() => {
      result.current.toggleLayoutMode();
    });

    expect(result.current.uiPreferences.layoutMode).toBe("wide");
    expect(localStorageMock.getItem("fragrance-game-layout")).toBe("wide");

    act(() => {
      result.current.toggleLayoutMode();
    });

    expect(result.current.uiPreferences.layoutMode).toBe("narrow");
    expect(localStorageMock.getItem("fragrance-game-layout")).toBe("narrow");
  });

  it("should toggle font scale and persist to localStorage", () => {
    const { result } = renderHook(() => useUIPreferences(), {
      wrapper: UIPreferencesProvider,
    });

    act(() => {
      result.current.toggleFontScale();
    });

    expect(result.current.uiPreferences.fontScale).toBe("large");
    expect(localStorageMock.getItem("fragrance-game-font")).toBe("large");

    act(() => {
      result.current.toggleFontScale();
    });

    expect(result.current.uiPreferences.fontScale).toBe("normal");
    expect(localStorageMock.getItem("fragrance-game-font")).toBe("normal");
  });

  it("should set input focus state", () => {
    const { result } = renderHook(() => useUIPreferences(), {
      wrapper: UIPreferencesProvider,
    });

    expect(result.current.isInputFocused).toBe(false);

    act(() => {
      result.current.setIsInputFocused(true);
    });

    expect(result.current.isInputFocused).toBe(true);

    act(() => {
      result.current.setIsInputFocused(false);
    });

    expect(result.current.isInputFocused).toBe(false);
  });

  it("should load preferences from localStorage on mount", () => {
    localStorageMock.setItem("fragrance-game-theme", "dark");
    localStorageMock.setItem("fragrance-game-layout", "wide");
    localStorageMock.setItem("fragrance-game-font", "large");

    const { result } = renderHook(() => useUIPreferences(), {
      wrapper: UIPreferencesProvider,
    });

    expect(result.current.uiPreferences).toEqual({
      fontScale: "large",
      layoutMode: "wide",
      theme: "dark",
    });
  });

  it("should throw error when used outside provider", () => {
    expect(() => {
      renderHook(() => useUIPreferences());
    }).toThrow("useUIPreferences must be used within UIPreferencesProvider");
  });
});
