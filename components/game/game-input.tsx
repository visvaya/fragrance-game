"use client";

import type React from "react";
import { useState, useRef, useEffect, useId, useMemo, useReducer } from "react";

import { Search, Loader2, SkipForward, X, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  searchPerfumes,
  type PerfumeSuggestion,
} from "@/app/actions/autocomplete";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useMountTransition } from "@/hooks/use-mount-transition";
import { MASK_CHAR } from "@/lib/constants";
import { cn, normalizeText } from "@/lib/utils";

import { useGameState, useGameActions, useUIPreferences } from "./contexts";
import { GameTooltip } from "./game-tooltip";
import { HighlightedText } from "./highlighted-text";
type GameInputState = {
  hasSearched: boolean;
  isError: boolean;
  isLoading: boolean;
  query: string;
  selectedIndex: number;
  showSuggestions: boolean;
  suggestions: PerfumeSuggestion[];
};

type GameInputAction =
  | { payload: string; type: "SET_QUERY" }
  | { type: "SEARCH_START" }
  | { payload: PerfumeSuggestion[]; type: "SEARCH_SUCCESS" }
  | { type: "SEARCH_ERROR" }
  | { type: "CLEAR_SUGGESTIONS" }
  | { payload: boolean; type: "SET_SHOW_SUGGESTIONS" }
  | {
      payload: number | ((previous: number) => number);
      type: "SET_SELECTED_INDEX";
    }
  | { type: "RESET" };

const initialState: GameInputState = {
  hasSearched: false,
  isError: false,
  isLoading: false,
  query: "",
  selectedIndex: -1,
  showSuggestions: false,
  suggestions: [],
};

function gameInputReducer(
  state: GameInputState,
  action: GameInputAction,
): GameInputState {
  switch (action.type) {
    case "SET_QUERY": {
      return {
        ...state,
        hasSearched: false,
        query: action.payload,
        showSuggestions: action.payload.length > 0,
      };
    }
    case "SEARCH_START": {
      return { ...state, hasSearched: false, isError: false, isLoading: true };
    }
    case "SEARCH_SUCCESS": {
      return {
        ...state,
        hasSearched: true,
        isLoading: false,
        suggestions: action.payload,
      };
    }
    case "SEARCH_ERROR": {
      return {
        ...state,
        hasSearched: true,
        isError: true,
        isLoading: false,
        suggestions: [],
      };
    }
    case "CLEAR_SUGGESTIONS": {
      // Clears suggestions + resets loading without touching hasSearched.
      // Used when the query falls below search threshold — cancels any in-flight
      // request effect and ensures the spinner stops even if the async never resolves.
      return { ...state, isError: false, isLoading: false, suggestions: [] };
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
 * Scores a suggestion by how well it matches the query against brand/name.
 * Results matching only on perfumer name (DB-side) score 0 and sink to the bottom.
 */
function relevanceScore(
  suggestion: PerfumeSuggestion,
  normalizedQuery: string,
): number {
  const { brand_norm: brand, name_norm: name } = suggestion;
  if (brand === normalizedQuery || name === normalizedQuery) return 4;
  if (brand.startsWith(normalizedQuery) || name.startsWith(normalizedQuery))
    return 3;
  if (brand.includes(normalizedQuery)) return 2;
  if (name.includes(normalizedQuery)) return 1;
  return 0;
}

/**
 *
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
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
  const { makeGuess, skipAttempt } = useGameActions();
  const { isInputFocused: isFocused, setIsInputFocused: setIsFocused } =
    useUIPreferences();
  const t = useTranslations("Game.input");
  const tFooter = useTranslations("Footer");

  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const [state, dispatch] = useReducer(gameInputReducer, initialState);
  const {
    hasSearched,
    isError,
    isLoading,
    query,
    selectedIndex,
    showSuggestions,
    suggestions,
  } = state;

  const inputReference = useRef<HTMLInputElement>(null);
  const wrapperReference = useRef<HTMLDivElement>(null);
  const listReference = useRef<HTMLDivElement>(null);
  const previousResultsReference = useRef<{
    query: string;
    results: PerfumeSuggestion[];
  } | null>(null);

  const trimmedQuery = query.trim();

  // Delay "Brak wyników" by 500ms so it doesn't flash on fast connections.
  // Resets immediately when results arrive, loading starts, or query changes.
  const noResultsRaw =
    hasSearched &&
    !isLoading &&
    suggestions.length === 0 &&
    trimmedQuery.length > 0;
  const [noResultsDelayed, setNoResultsDelayed] = useState(false);
  useEffect(() => {
    if (!noResultsRaw) {
      setNoResultsDelayed(false);
      return;
    }
    const timer = setTimeout(() => setNoResultsDelayed(true), 500);
    return () => clearTimeout(timer);
  }, [noResultsRaw]);

  // Check if daily challenge is actually loaded (not skeleton).
  // Defined here (before shouldShowList) so autocomplete gating uses real data availability,
  // not auth loading state — allows autocomplete to work as soon as SSR data is present.
  const isSkeleton = dailyPerfume.id === "skeleton";

  // Animation state — list opens when: results exist, loading, or delayed no-results.
  // Never during the debounce window. Uses !isSkeleton (not !gameLoading) so autocomplete
  // works immediately when SSR clue data is available, even while auth is in progress.
  const shouldShowList =
    showSuggestions &&
    !isSkeleton &&
    (suggestions.length > 0 || isLoading || noResultsDelayed);
  const hasTransitionedIn = useMountTransition(shouldShowList, 200); // 200ms matches duration-200

  const listId = useId();

  // Debounced search with client-side prefix filtering
  useEffect(() => {
    let ignore = false;

    const tq = query.trim();

    if (tq.length === 0) {
      previousResultsReference.current = null;
      return;
    }

    // Instant client-side filter when query extends previous (e.g. "fo" -> "for")
    if (
      previousResultsReference.current &&
      tq.startsWith(previousResultsReference.current.query)
    ) {
      const nq = normalizeText(tq);
      const localFiltered = previousResultsReference.current.results.filter(
        (r) => r.brand_norm.includes(nq) || r.name_norm.includes(nq),
      );
      if (localFiltered.length > 0) {
        dispatch({ payload: localFiltered, type: "SEARCH_SUCCESS" });
      }
    }

    const timer = setTimeout(() => {
      const sid = sessionId || undefined;
      void (async () => {
        dispatch({ type: "SEARCH_START" });
        try {
          const results = await searchPerfumes(tq, sid, currentAttempt);
          if (ignore) return;
          // Short queries (< 3 chars): only exact name matches to avoid
          // noisy partial results for names like "Y" or "Si".
          const filtered =
            tq.length < 3
              ? results.filter(
                  // eslint-disable-next-line sonarjs/no-nested-functions
                  (r) => {
                    return normalizeText(r.name) === normalizeText(tq);
                  },
                )
              : results;

          // Re-rank: brand/name matches first, perfumer-only matches last.
          // Stable sort preserves the DB relevance order within each tier.
          const nq = normalizeText(tq);
          // eslint-disable-next-line sonarjs/no-nested-functions
          const ranked = filtered.toSorted((a, b) => {
            return relevanceScore(b, nq) - relevanceScore(a, nq);
          });
          dispatch({ payload: ranked, type: "SEARCH_SUCCESS" });
          previousResultsReference.current = { query: tq, results: ranked };
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
    if (isFocused && globalThis.window.innerWidth < 640) {
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
    // Auth still in progress — session not ready yet, ignore premature submit.
    if (!sessionId) return;
    await makeGuess(perfume.name, perfume.brand_masked, perfume.perfume_id);

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
            dispatch({
              payload: firstAvailableIndex,
              type: "SET_SELECTED_INDEX",
            });
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
            void handleSelect(perfumeToSelect);
          }
        }

        break;
      }
      // No default
    }
  };

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

  // 1. Loading State — show spinner only when there is no SSR clue data (skeleton fallback).
  // When initialChallenge exists (isSkeleton=false), render the real input immediately
  // and let auth complete in the background — submit/skip stay disabled until sessionId arrives.
  if (gameLoading && isSkeleton) {
    return (
      <div
        className={cn(
          "sticky bottom-0 z-30 mx-auto w-full max-w-2xl wide:max-w-xl",
        )}
      >
        <div className="relative border-x-0 border-t panel-border bg-background/70 px-5 py-8 panel-shadow backdrop-blur-md sm:rounded-t-md sm:border-x">
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
          "sticky bottom-0 z-30 mx-auto w-full max-w-2xl wide:max-w-xl",
        )}
      >
        <div className="relative border-x-0 border-t panel-border bg-background/70 px-5 py-4 panel-shadow backdrop-blur-md transition-colors duration-500 ease-in-out sm:rounded-t-md sm:border-x">
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

  const isCurrentlyLoading = isLoading || (gameLoading && isSkeleton);
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
        "sticky bottom-0 z-30 mx-auto w-full max-w-2xl wide:max-w-xl",
      )}
    >
      {/* Onboarding Tooltip — fixed above the sticky input bar */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute bottom-[calc(100%-8px)] left-1/2 z-10 -translate-x-1/2 pb-4 transition-all duration-500 ease-in-out",
          attempts.length === 0 && !isFocused
            ? "translate-y-0 opacity-100"
            : "translate-y-8 opacity-0",
        )}
      >
        <div className="flex flex-col items-center gap-0">
          <div className="rounded-lg border border-primary/40 bg-background px-4 py-1.5">
            <p className="font-hand text-base whitespace-nowrap text-primary">
              {tFooter("selectHelper")}
            </p>
          </div>
          <ChevronDown className="h-3 w-3 text-primary/60" strokeWidth={2} />
        </div>
      </div>

      <div className="relative" ref={wrapperReference}>
        {/* Input Surface (Visual Layer) */}
        <div
          className={cn(
            "relative z-20 border-x-0 border-t panel-border px-5 pt-1.5 pb-1.5 panel-shadow backdrop-blur-md transition-colors duration-200 ease-in-out sm:border-x",
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
              className="w-full border-b-2 border-border bg-transparent pt-2 pr-10 pb-1 pl-1 text-lg text-foreground transition-colors duration-300 outline-none placeholder:text-base placeholder:text-muted-foreground placeholder:lowercase focus:border-primary"
              data-testid="game-input"
              onBlur={() => {
                dispatch({ payload: false, type: "SET_SHOW_SUGGESTIONS" });
                setIsFocused(false);
              }}
              onChange={(e) => {
                const value = e.target.value;
                dispatch({ payload: value, type: "SET_QUERY" });

                // Clear stale suggestions when input is fully empty.
                if (value.trim().length === 0) {
                  dispatch({ type: "CLEAR_SUGGESTIONS" });
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
              spellCheck={false}
              type="text"
              value={query}
            />
            <div className="pointer-events-none absolute top-[calc(50%+1px)] right-0.5 flex h-8 w-8 -translate-y-1/2 items-center justify-center">
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
          <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center text-xs tracking-wide text-muted-foreground lowercase">
            <span className="pl-1 whitespace-nowrap lining-nums tabular-nums">
              {t("attempt")}: {currentAttempt} / {maxAttempts}
            </span>
            <div className="flex justify-center">
              <GameTooltip
                content={t("skipTooltip")}
                disableOnMobile
                sideOffset={8}
              >
                <button
                  aria-label={t("skipTooltip")}
                  className="flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground active:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-30"
                  disabled={!sessionId}
                  onClick={() => {
                    if (
                      globalThis.matchMedia(
                        "(hover: none) and (pointer: coarse)",
                      ).matches
                    ) {
                      setShowSkipConfirm(true);
                    } else {
                      void skipAttempt();
                    }
                  }}
                  type="button"
                >
                  <SkipForward className="h-3.5 w-3.5" />
                </button>
              </GameTooltip>
            </div>
            <span className="pr-1 text-right whitespace-nowrap text-primary">
              {t("score")}: {potentialScore}
            </span>
          </div>
        </div>

        {/* Suggestions dropdown (Behind Input Surface) */}
        {hasTransitionedIn || shouldShowList ? (
          <div
            className={`!absolute bottom-full left-0 z-10 max-h-56 w-full touch-pan-y !overflow-y-auto rounded-t-md border-x border-t panel-border bg-background/100 panel-shadow backdrop-blur-none ${
              shouldShowList
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
            {suggestions.length === 0 &&
            !isCurrentlyLoading &&
            shouldShowList ? (
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
                    onMouseEnter={() =>
                      dispatch({ payload: index, type: "SET_SELECTED_INDEX" })
                    }
                    role="option"
                  >
                    <span className="flex flex-wrap items-baseline gap-x-1 text-foreground">
                      {/* Brand Revealed */}
                      <span className="text-foreground">
                        {perfume.brand_masked.replaceAll(MASK_CHAR, "_")}
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
                        <HighlightedText
                          query={trimmedQuery}
                          text={perfume.name}
                        />
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
                              if (!perfume.year.includes(MASK_CHAR)) {
                                return <span>{perfume.year}</span>;
                              }

                              if (perfume.year === MASK_CHAR.repeat(4)) {
                                return (
                                  <span className="tracking-widest text-muted-foreground opacity-30">
                                    {/* eslint-disable-next-line @typescript-eslint/no-misused-spread */}
                                    {[..."____"].map((char, i) => (
                                      <span className="inline-block" key={i}>
                                        {char}
                                      </span>
                                    ))}
                                  </span>
                                );
                              }

                              return (
                                <span className="tracking-widest">
                                  {/* eslint-disable-next-line @typescript-eslint/no-misused-spread */}
                                  {[...perfume.year].map((char, i) => (
                                    <span
                                      className={
                                        char === MASK_CHAR
                                          ? "inline-block text-muted-foreground opacity-40"
                                          : "text-foreground"
                                      }
                                      key={i}
                                    >
                                      {char === MASK_CHAR ? "_" : char}
                                    </span>
                                  ))}
                                </span>
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

      <AlertDialog onOpenChange={setShowSkipConfirm} open={showSkipConfirm}>
        <AlertDialogContent onClickOutside={() => setShowSkipConfirm(false)}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("skipConfirmTitle")}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("skipConfirmCancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void skipAttempt();
              }}
            >
              {t("skipConfirmConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
