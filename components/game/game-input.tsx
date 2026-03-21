"use client";

import type React from "react";
// eslint-disable-next-line no-restricted-imports -- autocomplete: debounced search, keyboard nav, auto-submit, rate-limit clear, safety cleanup, guess-outcome feedback (dep effects)
import { useState, useRef, useEffect, useId, useMemo, useReducer } from "react";

import { Search, Loader2, SkipForward, X, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

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
import { MASK_CHAR, BULLET_CHAR } from "@/lib/constants";
import { useMountEffect } from "@/lib/hooks/use-mount-effect";
import { cn, normalizeText } from "@/lib/utils";

import { useGameState, useGameActions, useUIPreferences } from "./contexts";
import { GameTooltip } from "./game-tooltip";
import { HighlightedText } from "./highlighted-text";
import { GameInputSkeleton } from "./skeletons";
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
 * Game input component handling perfume guessing, autocomplete, and skipping attempts.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity -- GameInput handles full input lifecycle: autocomplete debounce, keyboard shortcuts, skip confirmation, submit; decomposition would split tightly coupled state
export function GameInput() {
  const {
    attempts,
    authReady,
    currentAttempt,
    dailyPerfume,
    gameState,
    loading: gameLoading,
    maxAttempts,
    potentialScore,
    sessionId,
    sessionReady,
  } = useGameState();
  const { isRateLimited, makeGuess, skipAttempt } = useGameActions();
  const { isInputFocused: isFocused, setIsInputFocused: setIsFocused } =
    useUIPreferences();
  const t = useTranslations("Game.input");
  const tFooter = useTranslations("Footer");
  const tActions = useTranslations("GameActions");

  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const [pendingGuess, setPendingGuess] = useState<PerfumeSuggestion | null>(
    null,
  );
  const [showWrongFeedback, setShowWrongFeedback] = useState(false);

  // Status bar dynamic wrapping
  const [needsStack, setNeedsStack] = useState(false);
  const statusBarContainerReference = useRef<HTMLDivElement>(null);
  const statusBarMeasureReference = useRef<HTMLDivElement>(null);

  const hasInputInitialized = useRef(false);
  const previousAttemptCount = useRef(attempts.length);
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

  // True when user selected a perfume but auth JWT is not yet ready.
  const isConnecting = pendingGuess !== null && !authReady;

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

  // Clear suggestions immediately when rate-limited so the dropdown closes.
  useEffect(() => {
    if (isRateLimited) dispatch({ type: "CLEAR_SUGGESTIONS" });
  }, [isRateLimited]);

  // Debounced search with client-side prefix filtering
  useEffect(() => {
    let ignore = false;

    const tq = query.trim();

    if (tq.length === 0 || isRateLimited) {
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
                  // eslint-disable-next-line sonarjs/no-nested-functions -- single-expression filter predicate; extraction requires hoisting tq from enclosing closure
                  (r) => {
                    return normalizeText(r.name) === normalizeText(tq);
                  },
                )
              : results;

          // Re-rank: brand/name matches first, perfumer-only matches last.
          // Stable sort preserves the DB relevance order within each tier.
          const nq = normalizeText(tq);
          // eslint-disable-next-line sonarjs/no-nested-functions -- single-expression sort comparator; extraction requires hoisting nq from enclosing closure
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
      // eslint-disable-next-line fp/no-mutation -- necessary for async cleanup
      ignore = true;
      clearTimeout(timer);
    };
  }, [query, sessionId, currentAttempt, isRateLimited]);

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

  // Handle click outside
  useMountEffect(() => {
    // eslint-disable-next-line unicorn/consistent-function-scoping -- closes over wrapperReference and dispatch from component scope
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
  });

  // Auto-submit pending guess once auth JWT is ready (Gate 6: authReady replaces sessionId).
  // makeGuess handles lazy startGame when sessionId is still null.
  useEffect(() => {
    if (!authReady || !pendingGuess) return;
    void makeGuess(
      pendingGuess.name,
      pendingGuess.brand_masked,
      pendingGuess.perfume_id,
    );
    setPendingGuess(null);
    dispatch({ type: "RESET" });
    const focusTimer = setTimeout(() => inputReference.current?.focus(), 0);
    return () => clearTimeout(focusTimer);
  }, [authReady, pendingGuess, makeGuess]);

  // Safety cleanup: if auth failed (loading done, no session, pending guess still set).
  useEffect(() => {
    if (!gameLoading && !sessionReady && !sessionId && pendingGuess) {
      setPendingGuess(null);
      dispatch({ type: "RESET" });
    }
  }, [gameLoading, sessionReady, sessionId, pendingGuess]);

  // Track guess outcomes to show brief icon feedback on the submit button.
  // Mirrors AttemptLog's hasInitialized pattern — ignores attempts restored on page load.
  useEffect(() => {
    if (!gameLoading && !hasInputInitialized.current) {
      hasInputInitialized.current = true;
      previousAttemptCount.current = attempts.length;
      return;
    }

    if (
      hasInputInitialized.current &&
      attempts.length > previousAttemptCount.current &&
      !gameLoading
    ) {
      const lastAttempt = attempts.at(-1);
      if (lastAttempt?.isCorrect !== true) setShowWrongFeedback(true);
      const timer = setTimeout(() => setShowWrongFeedback(false), 1500);
      previousAttemptCount.current = attempts.length;
      return () => clearTimeout(timer);
    }

    previousAttemptCount.current = attempts.length;
  }, [attempts, gameLoading]);

  // Dynamic status bar wrapping
  useEffect(() => {
    const container = statusBarContainerReference.current;
    const measure = statusBarMeasureReference.current;
    if (!container || !measure) return;

    const observer = new ResizeObserver(() => {
      const containerWidth = container.clientWidth;
      const requiredWidth = measure.scrollWidth;
      // Ensure we have a comfortable 8px buffer so elements don't squeeze
      setNeedsStack(containerWidth < requiredWidth + 8);
    });

    observer.observe(container);
    observer.observe(measure);

    return () => observer.disconnect();
  }, []);

  const handleSelect = async (perfume: PerfumeSuggestion) => {
    if (!authReady) {
      // Auth still in progress — queue the guess and show connecting state.
      dispatch({ payload: perfume.name, type: "SET_QUERY" });
      dispatch({ payload: false, type: "SET_SHOW_SUGGESTIONS" });
      setPendingGuess(perfume);
      return;
    }
    await makeGuess(perfume.name, perfume.brand_masked, perfume.perfume_id);

    dispatch({ type: "RESET" });
    setTimeout(() => inputReference.current?.focus(), 0);
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

        const perfumeToSelect =
          (selectedIndex >= 0 ? suggestions[selectedIndex] : undefined) ??
          (suggestions.length === 1 ? suggestions[0] : null);

        // eslint-disable-next-line unicorn/no-negated-condition -- guard clause; null means no selection, positive action only when selected
        if (perfumeToSelect !== null) {
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

  // 1. Loading State — show skeleton until SSR clue data or reset is complete.
  // This ensures consistency with loading.tsx and avoids jarring spinner replacements.
  if (gameLoading && isSkeleton) {
    return <GameInputSkeleton />;
  }

  // 2. Closed / No Puzzle State (Only if loaded and invalid)
  if (gameState !== "playing" || isSkeleton) {
    return (
      <div
        className={cn(
          "sticky bottom-0 z-30 mx-auto w-full max-w-2xl will-change-transform wide:max-w-xl",
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

  const isCurrentlyLoading = isLoading || gameLoading;
  const isNormallyVisible = !isCurrentlyLoading && !isError;
  const isErrorVisible = !isCurrentlyLoading && isError;

  const getSurfaceClasses = (): string => {
    if (shouldShowList || hasTransitionedIn) {
      return "rounded-t-none bg-background text-foreground";
    }
    if (showSuggestions) {
      return "rounded-t-none bg-background sm:rounded-t-md";
    }
    return "rounded-t-none bg-background/70 sm:rounded-t-md";
  };

  const surfaceClasses = getSurfaceClasses();

  return (
    <div
      className={cn(
        "sticky bottom-0 z-30 mx-auto w-full max-w-2xl will-change-transform wide:max-w-xl",
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
          <ChevronDown className="size-3 text-primary/60" strokeWidth={2} />
        </div>
      </div>

      <div className="relative" ref={wrapperReference}>
        {/* Input Surface (Visual Layer) */}
        <div
          className={cn(
            "relative z-20 border-x-0 border-t panel-border px-5 py-1.5 panel-shadow backdrop-blur-md transition-colors duration-200 ease-in-out sm:border-x",
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
              className="w-full border-b-2 border-border bg-transparent pt-2 pr-10 pb-1 pl-1 text-[1.0625rem] text-foreground transition-all duration-300 outline-none placeholder:text-[0.9375rem] placeholder:text-muted-foreground placeholder:lowercase focus:border-primary disabled:cursor-not-allowed disabled:opacity-50 sm:text-lg sm:placeholder:text-base"
              data-testid="game-input"
              disabled={gameLoading || isRateLimited || isConnecting}
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
            {isRateLimited ? (
              <div
                aria-hidden="true"
                className="absolute inset-0 z-10 cursor-not-allowed"
                onClick={() => toast.warning(tActions("rateLimitError"))}
                onKeyDown={() => toast.warning(tActions("rateLimitError"))}
                role="presentation"
              />
            ) : null}
            <div className="pointer-events-none absolute top-[calc(50%+1px)] right-0.5 flex size-8 -translate-y-1/2 items-center justify-center">
              {/* Search Icon — hidden during loading, connecting, autocomplete error, or wrong-guess feedback */}
              <div
                className={cn(
                  "absolute transition-all duration-300 ease-out",
                  isNormallyVisible && !isConnecting && !showWrongFeedback
                    ? "scale-100 rotate-0 opacity-100"
                    : "scale-50 -rotate-90 opacity-0",
                )}
              >
                <Search className="size-5 text-muted-foreground" />
              </div>

              {/* Loader Icon — shown during autocomplete search or pending guess (isConnecting) */}
              {isCurrentlyLoading || isConnecting ? (
                <div className="absolute scale-100 opacity-100 transition-all duration-300 ease-out">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : null}

              {/* Autocomplete Error Icon */}
              <div
                className={cn(
                  "absolute transition-all duration-300 ease-out",
                  isErrorVisible && !showWrongFeedback
                    ? "scale-100 rotate-0 opacity-100"
                    : "scale-50 rotate-90 opacity-0",
                )}
              >
                <X className="size-5 text-destructive" />
              </div>

              {/* Guess Wrong / Skip Icon — temporary feedback after incorrect submission */}
              <div
                className={cn(
                  "absolute transition-all duration-300 ease-out",
                  showWrongFeedback
                    ? "scale-100 rotate-0 opacity-100"
                    : "scale-50 rotate-90 opacity-0",
                )}
              >
                <X className="size-5 text-destructive" />
              </div>
            </div>
          </div>

          {/* Connecting hint — shown when user selected a perfume but session not ready */}
          {isConnecting ? (
            <p className="mt-1 pl-1 text-xs text-muted-foreground">
              {t("connectingHint")}
            </p>
          ) : null}

          {/* Status bar */}
          <div className="relative mt-2" ref={statusBarContainerReference}>
            {/* Invisible measuring clone that dictates the required width */}
            <div
              aria-hidden="true"
              className="pointer-events-none invisible absolute flex w-max items-center gap-1 text-xs tracking-wide text-muted-foreground lowercase sm:gap-2"
              ref={statusBarMeasureReference}
            >
              <span className="pl-1 text-left whitespace-nowrap lining-nums tabular-nums">
                {t("attempt")}: {currentAttempt} / {maxAttempts}
              </span>
              <div className="flex size-7 px-2" />
              <span className="pr-1 text-right whitespace-nowrap">
                {t("score")}: {potentialScore}
              </span>
            </div>

            {/* Actual status bar */}
            <div
              className={cn(
                "flex text-xs tracking-wide text-muted-foreground lowercase transition-all duration-200",
                needsStack
                  ? "flex-col items-center justify-center gap-2"
                  : "flex-row items-center justify-between gap-1 sm:gap-2",
              )}
            >
              <span
                className={cn(
                  "whitespace-nowrap lining-nums tabular-nums",
                  needsStack ? "text-center" : "pl-1 text-left",
                )}
              >
                {t("attempt")}: {currentAttempt} / {maxAttempts}
              </span>
              <div className="flex justify-center">
                <GameTooltip
                  content={t("skipTooltip")}
                  disabled={isRateLimited || gameLoading}
                  disableOnMobile
                  sideOffset={8}
                >
                  <button
                    aria-label={t("skipTooltip")}
                    className={cn(
                      "flex size-7 items-center justify-center rounded-sm text-muted-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-30",
                      isRateLimited || gameLoading
                        ? "cursor-not-allowed opacity-30"
                        : "hover:bg-muted/50 hover:text-foreground active:bg-muted/50",
                    )}
                    disabled={!sessionReady || gameLoading || isRateLimited}
                    onClick={() => {
                      if (isRateLimited) {
                        toast.warning(tActions("rateLimitError"));
                        return;
                      }
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
                    <SkipForward className="size-3.5" />
                  </button>
                </GameTooltip>
              </div>
              <span
                className={cn(
                  "whitespace-nowrap text-primary",
                  needsStack ? "text-center" : "pr-1 text-right",
                )}
              >
                {t("score")}: {potentialScore}
              </span>
            </div>
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
                    className={`w-full border-b border-muted px-4 py-3 text-left text-sm transition-colors duration-200 last:border-b-0 ${isDuplicate || isRateLimited ? "cursor-not-allowed" : ""} ${isDuplicate && selectedIndex !== index ? "bg-muted/20 opacity-50" : ""} ${selectedIndex === index ? "bg-muted text-primary" : ""} ${isDuplicate && selectedIndex === index ? "opacity-70" : ""} ${!isDuplicate && selectedIndex !== index && !isRateLimited ? "hover:bg-muted/50 hover:text-primary" : ""} `}
                    data-perfume-id={perfume.perfume_id}
                    disabled={isDuplicate || isRateLimited}
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
                        {perfume.brand_masked}
                      </span>

                      <span className="text-muted-foreground/30">
                        {BULLET_CHAR}
                      </span>

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
                          <span className="text-muted-foreground/30">
                            {BULLET_CHAR}
                          </span>
                          <span>{perfume.concentration}</span>
                        </>
                      ) : null}

                      {/* Year Masked */}
                      {!!perfume.year && (
                        <>
                          <span className="text-muted-foreground/30">
                            {BULLET_CHAR}
                          </span>
                          <span className="inline-flex items-baseline">
                            {(() => {
                              if (!perfume.year.includes(MASK_CHAR)) {
                                return <span>{perfume.year}</span>;
                              }

                              {
                                /*
                                 * NOTE: We use underscores here instead of MASK_CHAR for the input results list
                                 * as they are more visually legible and familiar for year placeholders in autocomplete.
                                 */
                              }
                              if (perfume.year === MASK_CHAR.repeat(4)) {
                                return (
                                  <span className="tracking-widest text-muted-foreground opacity-30">
                                    {/* eslint-disable-next-line unicorn/prefer-spread -- string character iteration; split("") vs [...str] conflict with no-misused-spread */}
                                    {"____".split("").map((char, i) => (
                                      <span className="inline-block" key={i}>
                                        {char}
                                      </span>
                                    ))}
                                  </span>
                                );
                              }

                              return (
                                <span className="tracking-widest">
                                  {/* eslint-disable-next-line unicorn/prefer-spread -- string character iteration; split("") vs [...str] conflict with no-misused-spread */}
                                  {perfume.year.split("").map((char, i) => (
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
