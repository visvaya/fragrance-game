"use client";

import type React from "react";
// eslint-disable-next-line no-restricted-imports -- autocomplete: debounced search, keyboard nav, auto-submit, rate-limit clear, safety cleanup, guess-outcome feedback (dep effects)
import { useState, useRef, useEffect, useId, useMemo, useReducer } from "react";

import { Search, Loader2, X, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "@/lib/toast";

import {
  searchPerfumes,
  type PerfumeSuggestion,
} from "@/app/actions/autocomplete";
import { useMountTransition } from "@/hooks/use-mount-transition";
import { MASK_CHAR, BULLET_CHAR } from "@/lib/constants";
import { showsBrand } from "@/lib/game/suggestions";
import { useMountEffect } from "@/lib/hooks/use-mount-effect";
import { cn, normalizeText } from "@/lib/utils";

import { useGameState, useGameActions, useUIPreferences } from "./contexts";
import { HighlightedText } from "./highlighted-text";
import { GameInputSkeleton } from "./skeletons";
import { SkipAttemptButton } from "./skip-attempt-button";
import { UnplayableInputBar } from "./unplayable-input-bar";
import { useKeyboardScrollRestore } from "./use-keyboard-scroll-restore";
import { useStatusBarStack } from "./use-status-bar-stack";
/** A move made before the anonymous sign-in finished, sent once auth is ready. */
type PendingAction =
  | { kind: "guess"; perfume: PerfumeSuggestion }
  | { kind: "skip" }
  | null;

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
      // Used when the query falls below search threshold – cancels any in-flight
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
export function GameInput() {
  const {
    attempts,
    authFailed,
    authReady,
    currentAttempt,
    dailyPerfume,
    gameState,
    loading: gameLoading,
    maxAttempts,
    potentialScore,
    sessionId,
  } = useGameState();
  const { isRateLimited, makeGuess, skipAttempt } = useGameActions();
  const { isInputFocused: isFocused, setIsInputFocused: setIsFocused } =
    useUIPreferences();
  const t = useTranslations("Game.input");
  const tFooter = useTranslations("Footer");
  const tActions = useTranslations("GameActions");

  // A guess or skip made before the sign-in finished; sent once authReady.
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [showWrongFeedback, setShowWrongFeedback] = useState(false);

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
  const keyboardScroll = useKeyboardScrollRestore();
  const wrapperReference = useRef<HTMLDivElement>(null);
  const listReference = useRef<HTMLDivElement>(null);
  const previousResultsReference = useRef<{
    query: string;
    results: PerfumeSuggestion[];
  } | null>(null);

  const trimmedQuery = query.trim();

  // True when user selected a perfume but auth JWT is not yet ready.
  const isConnecting = pendingAction?.kind === "guess" && !authReady;
  const isSigningIn = !authReady && !authFailed;

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
  // not auth loading state – allows autocomplete to work as soon as SSR data is present.
  const isSkeleton = dailyPerfume.id === "skeleton";
  // The input bar with its status bar shows only while a loaded puzzle is being played.
  const isPlayable = gameState === "playing" && !isSkeleton;
  const {
    containerReference: statusBarContainerReference,
    measureReference: statusBarMeasureReference,
    needsStack,
  } = useStatusBarStack(isPlayable);

  // Animation state – list opens when: results exist, loading, or delayed no-results.
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
              ? results.filter((r) => {
                  return normalizeText(r.name) === normalizeText(tq);
                })
              : results;

          // Re-rank: brand/name matches first, perfumer-only matches last.
          // Stable sort preserves the DB relevance order within each tier.
          const nq = normalizeText(tq);

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
      listElement.children
        .item(selectedIndex)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedIndex]);

  // Handle click outside
  useMountEffect(() => {
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

  // Send the queued guess or skip once auth is ready; makeGuess and skipAttempt start the
  // game session lazily when sessionId is still null.
  useEffect(() => {
    if (!authReady || !pendingAction) return;
    setPendingAction(null);
    if (pendingAction.kind === "skip") {
      void skipAttempt();
      return;
    }
    const { perfume } = pendingAction;
    void makeGuess(perfume.name, perfume.brand_masked, perfume.perfume_id);
    dispatch({ type: "RESET" });
    const focusTimer = setTimeout(() => inputReference.current?.focus(), 0);
    return () => clearTimeout(focusTimer);
  }, [authReady, pendingAction, makeGuess, skipAttempt]);

  // Safety cleanup: the sign-in gave up, so a queued action would never be sent.
  useEffect(() => {
    if (authFailed && pendingAction) {
      setPendingAction(null);
      dispatch({ type: "RESET" });
    }
  }, [authFailed, pendingAction]);

  // jscpd:ignore-start -- the two effects share the initial-restore guard but react differently (scroll versus icon feedback)
  // Track guess outcomes to show brief icon feedback on the submit button.
  // Mirrors AttemptLog's hasInitialized pattern – ignores attempts restored on page load.
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
  // jscpd:ignore-end

  const handleSelect = async (perfume: PerfumeSuggestion) => {
    if (!authReady) {
      // Auth still in progress – queue the guess and show connecting state.
      dispatch({ payload: perfume.name, type: "SET_QUERY" });
      dispatch({ payload: false, type: "SET_SHOW_SUGGESTIONS" });
      setPendingAction({ kind: "guess", perfume });
      return;
    }
    await makeGuess(perfume.name, perfume.brand_masked, perfume.perfume_id);

    dispatch({ type: "RESET" });
    setTimeout(() => inputReference.current?.focus(), 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Keys that confirm or move an IME composition (Japanese, Chinese, ...) belong to the input method.
    if (suggestions.length === 0 || e.nativeEvent.isComposing) return;

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
          suggestions[selectedIndex] ??
          (suggestions.length === 1 ? suggestions[0] : undefined);

        // eslint-disable-next-line unicorn/no-negated-condition -- guard clause; undefined means no selection, positive action only when selected
        if (perfumeToSelect !== undefined) {
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

  // 1. Loading State – show skeleton until SSR clue data or reset is complete.
  // A skeleton instead of a spinner keeps the layout of the real input.
  if (gameLoading && isSkeleton) {
    return <GameInputSkeleton />;
  }

  // 2. Closed / No Puzzle State (Only if loaded and invalid)
  if (!isPlayable) return <UnplayableInputBar noPuzzle={isSkeleton} />;

  const isCurrentlyLoading = isLoading || gameLoading;

  type InputIcon = "search" | "loading" | "error" | "wrong";
  const activeIcon: InputIcon = (() => {
    if (showWrongFeedback) return "wrong";
    if (isCurrentlyLoading || isConnecting || isSigningIn) return "loading";
    if (isError) return "error";
    return "search";
  })();

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
      {/* Onboarding Tooltip – fixed above the sticky input bar */}
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
          <div className="rounded-lg bg-primary px-4 py-1.5 panel-shadow">
            <p className="font-hand text-base whitespace-nowrap text-foreground dark:text-primary-foreground">
              {tFooter("selectHelper")}
            </p>
          </div>
          <ChevronDown className="size-4 text-primary" strokeWidth={2.5} />
        </div>
      </div>

      <div className="relative" ref={wrapperReference}>
        {/* Input Surface (Visual Layer) */}
        <div
          className={cn(
            "relative z-20 border-x-0 border-t panel-border px-5 pt-1.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] panel-shadow backdrop-blur-md transition-colors duration-200 ease-in-out sm:border-x",
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
              autoCapitalize="off"
              autoCorrect="off"
              className="w-full border-b-2 border-border bg-transparent pt-2 pr-10 pb-1 pl-1 text-[1.0625rem] text-foreground transition-all duration-300 outline-none placeholder:text-[0.9375rem] placeholder:text-muted-foreground placeholder:lowercase focus:border-primary disabled:cursor-not-allowed disabled:opacity-50 sm:text-lg sm:placeholder:text-base"
              data-testid="game-input"
              disabled={gameLoading || isRateLimited || isConnecting}
              onBlur={() => {
                dispatch({ payload: false, type: "SET_SHOW_SUGGESTIONS" });
                setIsFocused(false);
                keyboardScroll.onBlur();
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
                keyboardScroll.onFocus();
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
            <div
              className="pointer-events-none absolute top-[calc(50%+1px)] right-0.5 flex size-8 -translate-y-1/2 items-center justify-center"
              data-icon={activeIcon}
              data-testid="input-icon"
            >
              {/* Search */}
              <div
                className={cn(
                  "absolute transition-all duration-300 ease-out",
                  activeIcon === "search"
                    ? "scale-100 rotate-0 opacity-100"
                    : "scale-50 -rotate-90 opacity-0",
                )}
              >
                <Search className="size-5 text-muted-foreground" />
              </div>

              {/* Loader */}
              <div
                className={cn(
                  "absolute transition-all duration-300 ease-out",
                  activeIcon === "loading"
                    ? "scale-100 rotate-0 opacity-100"
                    : "scale-50 -rotate-90 opacity-0",
                )}
              >
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>

              {/* Autocomplete Error */}
              <div
                className={cn(
                  "absolute transition-all duration-300 ease-out",
                  activeIcon === "error"
                    ? "scale-100 rotate-0 opacity-100"
                    : "scale-50 rotate-90 opacity-0",
                )}
              >
                <X className="size-5 text-destructive" />
              </div>

              {/* Wrong / Skip feedback */}
              <div
                className={cn(
                  "absolute transition-all duration-300 ease-out",
                  activeIcon === "wrong"
                    ? "scale-100 rotate-0 opacity-100"
                    : "scale-50 rotate-90 opacity-0",
                )}
              >
                <X className="size-5 text-destructive" />
              </div>
            </div>
          </div>

          {/* Connecting hint – a guess or skip waits for the sign-in to finish */}
          {pendingAction !== null && !authReady ? (
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

            {/* Actual status bar: in a row, equal side columns keep the skip button centred
                whatever the widths of the attempt counter and the score. */}
            <div
              className={cn(
                "text-xs tracking-wide text-muted-foreground lowercase transition-all duration-200",
                needsStack
                  ? "flex flex-col items-center justify-center gap-2"
                  : "grid grid-cols-[1fr_auto_1fr] items-center gap-1 sm:gap-2",
              )}
              data-testid="game-status-bar"
            >
              <span
                className={cn(
                  "whitespace-nowrap lining-nums tabular-nums",
                  needsStack
                    ? "text-center"
                    : "justify-self-start pl-1 text-left",
                )}
              >
                {t("attempt")}: {currentAttempt} / {maxAttempts}
              </span>
              <div className="flex justify-center">
                <SkipAttemptButton
                  busy={isRateLimited || gameLoading}
                  isRateLimited={isRateLimited}
                  onSkip={() => {
                    if (authReady) {
                      void skipAttempt();
                    } else {
                      setPendingAction((action) => action ?? { kind: "skip" });
                    }
                  }}
                  pending={pendingAction?.kind === "skip"}
                />
              </div>
              <span
                className={cn(
                  "whitespace-nowrap text-muted-foreground lining-nums tabular-nums",
                  needsStack
                    ? "text-center"
                    : "justify-self-end pr-1 text-right",
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
                      {showsBrand(perfume) ? (
                        <>
                          <span className="text-foreground">
                            {perfume.brand_masked}
                          </span>
                          <span className="text-muted-foreground/30">
                            {BULLET_CHAR}
                          </span>
                        </>
                      ) : null}

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
                                    {/* eslint-disable-next-line @typescript-eslint/no-misused-spread -- digits/placeholders are ASCII safe */}
                                    {[..."____"].map((char, i) => (
                                      <span
                                        className="inline-block"
                                        // eslint-disable-next-line react/no-array-index-key -- index is required for stable char keying
                                        key={i}
                                      >
                                        {char}
                                      </span>
                                    ))}
                                  </span>
                                );
                              }

                              return (
                                <span className="tracking-widest">
                                  {/* eslint-disable-next-line @typescript-eslint/no-misused-spread -- year digits are ASCII safe */}
                                  {[...perfume.year].map((char, i) => (
                                    <span
                                      className={
                                        char === MASK_CHAR
                                          ? "inline-block text-muted-foreground opacity-40"
                                          : "text-foreground"
                                      }
                                      // eslint-disable-next-line react/no-array-index-key -- index is required for stable char keying
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
    </div>
  );
}
