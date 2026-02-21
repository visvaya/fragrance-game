"use client";

import type React from "react";
import { useState, useRef, useEffect, useId, useMemo, memo, useReducer } from "react";

import { Search, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { searchPerfumes, type PerfumeSuggestion } from "@/app/actions/autocomplete";
import { useMountTransition } from "@/hooks/use-mount-transition";
import { cn } from "@/lib/utils";

import { useGameState, useGameActions, useUIPreferences } from "./contexts";
import { HighlightedText } from "./highlighted-text";
type GameInputState = {
  isError: boolean;
  isLoading: boolean;
  query: string;
  selectedIndex: number;
  showSuggestions: boolean;
  suggestions: PerfumeSuggestion[];
};

type GameInputAction =
  | { payload: string; type: "SET_QUERY"; }
  | { type: "SEARCH_START" }
  | { payload: PerfumeSuggestion[]; type: "SEARCH_SUCCESS"; }
  | { type: "SEARCH_ERROR" }
  | { payload: boolean; type: "SET_SHOW_SUGGESTIONS"; }
  | { payload: number | ((previous: number) => number); type: "SET_SELECTED_INDEX"; }
  | { type: "RESET" };

const initialState: GameInputState = {
  isError: false,
  isLoading: false,
  query: "",
  selectedIndex: -1,
  showSuggestions: false,
  suggestions: [],
};

function gameInputReducer(state: GameInputState, action: GameInputAction): GameInputState {
  switch (action.type) {
    case "SET_QUERY": {
      return { ...state, query: action.payload, showSuggestions: action.payload.length > 0 };
    }
    case "SEARCH_START": {
      return { ...state, isError: false, isLoading: true };
    }
    case "SEARCH_SUCCESS": {
      return { ...state, isLoading: false, suggestions: action.payload };
    }
    case "SEARCH_ERROR": {
      return { ...state, isError: true, isLoading: false, suggestions: [] };
    }
    case "SET_SHOW_SUGGESTIONS": {
      return { ...state, showSuggestions: action.payload };
    }
    case "SET_SELECTED_INDEX": {
      return {
        ...state,
        selectedIndex:
          typeof action.payload === "function"
            ? action.payload(state.selectedIndex)
            : action.payload,
      };
    }
    case "RESET": {
      return { ...initialState };
    }
    default: {
      return state;
    }
  }
}

/**
 *
 */
export function GameInput() {
  const {
    attempts,
    currentAttempt,
    dailyPerfume,
    gameState,
    loading: gameLoading,
    maxAttempts,
    potentialScore,
    sessionId,
  } = useGameState();
  const { makeGuess } = useGameActions();
  const {
    isInputFocused: isFocused,
    setIsInputFocused: setIsFocused,
    uiPreferences,
  } = useUIPreferences();
  const t = useTranslations("Game.input");

  const [state, dispatch] = useReducer(gameInputReducer, initialState);
  const { isError, isLoading, query, selectedIndex, showSuggestions, suggestions } = state;

  const inputReference = useRef<HTMLInputElement>(null);
  const wrapperReference = useRef<HTMLDivElement>(null);
  const listReference = useRef<HTMLDivElement>(null);
  const previousAttemptsLengthReference = useRef(attempts.length);

  // Animation state
  const shouldShowList =
    showSuggestions &&
    (suggestions.length > 0 ||
      (query.length >= 3 && !isLoading && !gameLoading));
  const hasTransitionedIn = useMountTransition(shouldShowList, 200); // 200ms matches duration-200

  const listId = useId();

  // Debounced search
  useEffect(() => {
    let ignore = false;

    // Reset results and loading state if query is too short
    if (query.length < 3) {
      return;
    }

    const timer = setTimeout(() => {
      const sid = sessionId || undefined;
      void (async () => {
        dispatch({ type: "SEARCH_START" });
        try {
          const results = await searchPerfumes(query, sid, currentAttempt);
          if (ignore) return;
          dispatch({ payload: results, type: "SEARCH_SUCCESS" });
        } catch (error) {
          if (ignore) return;
          console.error("Autocomplete failed:", error);
          dispatch({ type: "SEARCH_ERROR" });
        }
      })();
    }, 300);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [query, sessionId, currentAttempt]);

  // Scroll into view logic
  useEffect(() => {
    const listElement = listReference.current;
    if (listElement && selectedIndex >= 0) {
      const activeItem = listElement.children[selectedIndex] as
        | HTMLElement
        | undefined;
      if (activeItem) {
        activeItem.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [selectedIndex]);

  // Scroll input into view on mobile focus
  useEffect(() => {
    if (
      isFocused &&
      globalThis.window !== undefined &&
      globalThis.window.innerWidth < 640
    ) {
      const timer = setTimeout(() => {
        // block: "center" is safer as it puts the input
        // in the middle of the remaining visual viewport
        wrapperReference.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isFocused]);

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperReference.current &&
        !wrapperReference.current.contains(event.target as Node)
      ) {
        dispatch({ payload: false, type: "SET_SHOW_SUGGESTIONS" });
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = async (perfume: PerfumeSuggestion) => {
    await makeGuess(
      perfume.name,
      perfume.brand_masked,
      perfume.perfume_id,
    );

    dispatch({ type: "RESET" });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        // Cyclic navigation: (current + 1) % length
        dispatch({
          payload: (previous: number) => (previous + 1) % suggestions.length,
          type: "SET_SELECTED_INDEX",
        });

        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        // Cyclic navigation: wrap to last item if at beginning
        dispatch({
          payload: (previous: number) => {
            if (previous <= 0) {
              return suggestions.length - 1;
            }
            return previous - 1;
          },
          type: "SET_SELECTED_INDEX",
        });

        break;
      }
      case "Escape": {
        e.preventDefault();
        dispatch({ payload: false, type: "SET_SHOW_SUGGESTIONS" });
        inputReference.current?.blur();

        break;
      }
      case "Enter": {
        e.preventDefault();

        let perfumeToSelect = null;

        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          // If something is already selected, use it
          perfumeToSelect = suggestions[selectedIndex];
        } else if (suggestions.length === 1) {
          // If only one suggestion, use it immediately
          perfumeToSelect = suggestions[0];
        } else {
          // Nothing selected and multiple suggestions: highlight first available
          const firstAvailableIndex = suggestions.findIndex(
            (s) =>
              !attempts.some(
                (a) =>
                  (a.perfumeId && a.perfumeId === s.perfume_id) ||
                  (!a.perfumeId &&
                    a.guess.toLowerCase() === s.name.toLowerCase()),
              ),
          );

          if (firstAvailableIndex !== -1) {
            dispatch({ payload: firstAvailableIndex, type: "SET_SELECTED_INDEX" });
            // We return early here as we only wanted to highlight
            return;
          }
        }

        if (perfumeToSelect) {
          // Check for duplicates before selecting (standard protection)
          const isDuplicate = attempts.some(
            (a) =>
              (a.perfumeId && a.perfumeId === perfumeToSelect.perfume_id) ||
              (!a.perfumeId &&
                a.guess.toLowerCase() === perfumeToSelect.name.toLowerCase()),
          );

          if (!isDuplicate) {
            handleSelect(perfumeToSelect);
          }
        }

        break;
      }
      // No default
    }
  };

  // Check if daily challenge is actually loaded (not skeleton)
  const isSkeleton = dailyPerfume.id === "skeleton";

  // Pre-compute duplicate checks for all suggestions
  // IMPORTANT: This must be at top level before any conditional returns
  const suggestionsWithDuplicates = useMemo(
    () =>
      suggestions.map((s) => ({
        ...s,
        isDuplicate: attempts.some(
          (a) =>
            (a.perfumeId && a.perfumeId === s.perfume_id) ||
            (!a.perfumeId && a.guess.toLowerCase() === s.name.toLowerCase()),
        ),
      })),
    [suggestions, attempts],
  );

  // 1. Loading State - Render nothing or a stable placeholder (prevents "No Puzzle" flash)
  if (gameLoading) {
    return (
      <div
        className={cn(
          "sticky bottom-0 z-30 mx-auto w-full",
          uiPreferences.layoutMode === "wide" ? "max-w-5xl" : "max-w-xl",
        )}
      >
        <div className="relative border-x-0 border-t border-border/50 bg-background/80 px-5 py-8 backdrop-blur-md sm:rounded-t-md sm:border-x">
          <div className="flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </div>
      </div>
    );
  }

  // 2. Closed / No Puzzle State (Only if loaded and invalid)
  if (gameState !== "playing" || isSkeleton) {
    return (
      <div
        className={cn(
          "sticky bottom-0 z-30 mx-auto w-full",
          uiPreferences.layoutMode === "wide" ? "max-w-5xl" : "max-w-xl",
        )}
      >
        <div className="relative border-x-0 border-t border-border/50 bg-background/80 px-5 py-4 backdrop-blur-md transition-colors duration-500 ease-in-out sm:rounded-t-md sm:border-x">
          {/* Input-like look for closed state */}
          <div className="relative flex items-center justify-center">
            <span className="font-hand text-lg text-primary">
              {isSkeleton ? t("noPuzzle") : t("closed")}
            </span>
          </div>
        </div>
      </div>
    );
  }

  const isCurrentlyLoading = isLoading || gameLoading;
  const isNormallyVisible = !isCurrentlyLoading && !isError;
  const isErrorVisible = !isCurrentlyLoading && isError;

  let surfaceClasses = "rounded-t-none bg-background/70 sm:rounded-t-md";
  if (shouldShowList || hasTransitionedIn) {
    surfaceClasses = "rounded-t-none bg-background text-foreground";
  } else if (showSuggestions) {
    surfaceClasses = "rounded-t-none bg-background sm:rounded-t-md";
  }

  return (
    <div
      className={cn(
        "sticky bottom-0 z-30 mx-auto w-full",
        uiPreferences.layoutMode === "wide" ? "max-w-5xl" : "max-w-xl",
      )}
    >
      <div className="relative" ref={wrapperReference}>
        {/* Input Surface (Visual Layer) */}
        <div
          className={cn(
            "relative z-20 border-x-0 border-t border-border/50 px-5 pt-[2px] pb-3 backdrop-blur-md transition-colors duration-200 ease-in-out sm:border-x",
            surfaceClasses,
          )}
        >
          {/* Input */}
          <div className="relative">
            <input
              aria-activedescendant={
                selectedIndex >= 0
                  ? `${listId}-option-${selectedIndex}`
                  : undefined
              }
              aria-autocomplete="list"
              aria-controls={listId}
              aria-expanded={shouldShowList}
              className="w-full border-b-2 border-border bg-transparent pt-3 pr-10 pb-2 font-[family-name:var(--font-playfair)] text-lg text-foreground transition-colors duration-300 outline-none placeholder:font-[family-name:var(--font-playfair)] placeholder:text-sm placeholder:text-muted-foreground placeholder:italic focus:border-primary"
              data-testid="game-input"
              onBlur={() => {
                dispatch({ payload: false, type: "SET_SHOW_SUGGESTIONS" });
                setIsFocused(false);
              }}
              onChange={(e) => {
                const value = e.target.value;
                dispatch({ payload: value, type: "SET_QUERY" });

                if (value.length < 3) {
                  dispatch({ payload: [], type: "SEARCH_SUCCESS" });
                }
              }}
              onFocus={() => {
                dispatch({ payload: true, type: "SET_SHOW_SUGGESTIONS" });
                setIsFocused(true);
              }}
              onKeyDown={handleKeyDown}
              placeholder={t("placeholder")}
              ref={inputReference}
              role="combobox"
              type="text"
              value={query}
            />
            <div className="pointer-events-none absolute top-[calc(50%+1px)] right-0 flex h-8 w-8 -translate-y-1/2 items-center justify-center">
              {/* Search Icon */}
              <div
                className={cn(
                  "absolute transition-all duration-300 ease-out",
                  isNormallyVisible
                    ? "scale-100 rotate-0 opacity-100"
                    : "scale-50 -rotate-90 opacity-0",
                )}
              >
                <Search className="h-5 w-5 text-muted-foreground" />
              </div>

              {/* Loader Icon */}
              {isCurrentlyLoading ? (
                <div className="absolute scale-100 opacity-100 transition-all duration-300 ease-out">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : null}

              {/* Error Icon */}
              <div
                className={cn(
                  "absolute transition-all duration-300 ease-out",
                  isErrorVisible
                    ? "scale-100 rotate-0 opacity-100"
                    : "scale-50 rotate-90 opacity-0",
                )}
              >
                <X className="h-5 w-5 text-destructive" />
              </div>
            </div>
          </div>

          {/* Status bar */}
          <div className="mt-3 flex items-center justify-between text-[10px] tracking-wide text-muted-foreground uppercase">
            <span>
              {t("attempt")} {currentAttempt} / {maxAttempts}
            </span>
            <span className="font-semibold text-primary">
              {t("score")}: {potentialScore}
            </span>
          </div>
        </div>

        {/* Suggestions dropdown (Behind Input Surface) */}
        {hasTransitionedIn || shouldShowList ? (
          <div
            className={`!absolute bottom-full left-0 z-10 max-h-56 w-full touch-pan-y !overflow-y-auto rounded-t-md border-x border-t border-border/50 bg-background ${shouldShowList
              ? "duration-200 ease-out animate-in fade-in slide-in-from-bottom-12"
              : "duration-200 ease-in animate-out fade-out slide-out-to-bottom-12"
              } `}
            data-lenis-prevent
            id={listId}
            onMouseDown={(e) => e.preventDefault()}
            ref={listReference}
            role="listbox"
            tabIndex={-1}
          >
            {suggestions.length === 0 && !isCurrentlyLoading ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                {t("noResults")}
              </div>
            ) : (
              suggestionsWithDuplicates.map((perfume, index) => {
                const { isDuplicate } = perfume;

                return (
                  <button
                    aria-selected={selectedIndex === index}
                    className={`w-full border-b border-muted px-4 py-3 text-left text-sm transition-colors duration-200 last:border-b-0 ${isDuplicate ? "cursor-not-allowed" : ""} ${isDuplicate && selectedIndex !== index ? "bg-muted/20 opacity-50" : ""} ${selectedIndex === index ? "bg-muted text-primary" : ""} ${isDuplicate && selectedIndex === index ? "opacity-70" : ""} ${!isDuplicate && selectedIndex !== index ? "hover:bg-muted/50 hover:text-primary" : ""} `}
                    data-perfume-id={perfume.perfume_id}
                    disabled={isDuplicate}
                    id={`${listId}-option-${index}`}
                    key={perfume.perfume_id}
                    onClick={async () => handleSelect(perfume)}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => dispatch({ payload: index, type: "SET_SELECTED_INDEX" })}
                    role="option"
                  >
                    <span className="flex flex-wrap items-baseline gap-x-1 text-foreground">
                      {/* Brand Revealed */}
                      <span className="text-foreground">
                        {perfume.brand_masked}
                      </span>

                      <span className="text-muted-foreground/30">•</span>

                      {/* Name with highlighting */}
                      <span
                        className={
                          isDuplicate
                            ? "line-through decoration-muted-foreground"
                            : ""
                        }
                      >
                        <HighlightedText query={query} text={perfume.name} />
                      </span>

                      {/* Concentration */}
                      {perfume.concentration ? (
                        <>
                          <span className="text-muted-foreground/30">•</span>
                          <span>{perfume.concentration}</span>
                        </>
                      ) : null}

                      {/* Year Masked */}
                      {!!perfume.year && (
                        <>
                          <span className="text-muted-foreground/30">•</span>
                          <span className="inline-flex items-baseline">
                            {(() => {
                              if (!perfume.year.includes("_")) {
                                return <span>{perfume.year}</span>;
                              }

                              if (perfume.year === "____") {
                                return (
                                  <span className="font-mono tracking-widest text-muted-foreground opacity-30">
                                    ____
                                  </span>
                                );
                              }

                              return (
                                <>
                                  {/* eslint_disable-next-line unicorn/prefer-spread */}
                                  {[...perfume.year].map((char, i) => (
                                    <span
                                      className={`${char === "_" ? "font-mono text-muted-foreground opacity-40" : "text-foreground"} whitespace-pre`}
                                      key={i}
                                    >
                                      {char}
                                    </span>
                                  ))}
                                </>
                              );
                            })()}
                          </span>
                        </>
                      )}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
