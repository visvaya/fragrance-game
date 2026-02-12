"use client";

import type React from "react";
import { useState, useRef, useEffect, useId, useMemo, memo } from "react";

import { Search, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  searchPerfumes,
  type PerfumeSuggestion,
} from "@/app/actions/autocomplete";
import { useMountTransition } from "@/hooks/use-mount-transition";
import { cn, normalizeText } from "@/lib/utils";

import { useGameState, useGameActions, useUIPreferences } from "./contexts";

const HighlightedText = memo(
  ({ query, text }: Readonly<{ query: string; text: string }>) => {
    const tokens = useMemo(() => {
      if (!query || query.trim().length < 2) return [text];

      const normalizedText = normalizeText(text);
      const searchTerms = query
        .toLowerCase()
        .split(/\s+/)
        .filter((term) => term.length >= 2)
        .map((term) => normalizeText(term));

      if (searchTerms.length === 0) return [text];

      // Find all matches for all terms
      const matches: { end: number; start: number }[] = [];
      for (const term of searchTerms) {
        let startPos = 0;
        while ((startPos = normalizedText.indexOf(term, startPos)) !== -1) {
          matches.push({ end: startPos + term.length, start: startPos });
          startPos += 1;
        }
      }

      if (matches.length === 0) return [text];

      // Sort matches
      matches.sort((a, b) => a.start - b.start || b.end - a.end);

      // Merge matches
      const mergedMatches: { end: number; start: number }[] = [];
      if (matches.length > 0) {
        let currentMatch = matches[0];
        for (let i = 1; i < matches.length; i++) {
          if (matches[i].start <= currentMatch.end) {
            currentMatch.end = Math.max(currentMatch.end, matches[i].end);
          } else {
            mergedMatches.push(currentMatch);
            currentMatch = matches[i];
          }
        }
        mergedMatches.push(currentMatch);
      }

      // Build result
      const result: React.ReactNode[] = [];
      let lastIndex = 0;

      for (const [index, match] of mergedMatches.entries()) {
        if (match.start > lastIndex) {
          result.push(text.slice(lastIndex, match.start));
        }
        result.push(
          <b className="font-bold" key={index}>
            {text.slice(match.start, match.end)}
          </b>,
        );
        lastIndex = match.end;
      }

      if (lastIndex < text.length) {
        result.push(text.slice(lastIndex));
      }

      return result;
    }, [text, query]);

    return <>{tokens}</>;
  },
);

/**
 *
 */
export function GameInput() {
  const {
    attempts,
    currentAttempt,
    dailyPerfume,
    gameState,
    potentialScore,
    loading: gameLoading,
    maxAttempts,
    sessionId,
  } = useGameState();
  const { makeGuess } = useGameActions();
  const {
    isInputFocused: isFocused,
    setIsInputFocused: setIsFocused,
    uiPreferences,
  } = useUIPreferences();
  const t = useTranslations("Game.input");
  const [query, setQuery] = useState("");

  const [suggestions, setSuggestions] = useState<PerfumeSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
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

  // Detect incorrect guess to show error state
  useEffect(() => {
    // If attempts increased and game not won
    if (
      attempts.length > previousAttemptsLengthReference.current &&
      gameState !== "won"
    ) {
      setIsError(true);
      const timer = setTimeout(() => setIsError(false), 2000);
      return () => clearTimeout(timer);
    }
    previousAttemptsLengthReference.current = attempts.length;
  }, [attempts, gameState]);

  // Debounced search
  useEffect(() => {
    let ignore = false;

    // Reset results and loading state if query is too short
    if (query.length < 3) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    // Set loading to true immediately when a valid query length is reached
    // This prevents "No results" from showing during the debounce period
    setIsLoading(true);

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const results = await searchPerfumes(
            query,
            sessionId || undefined,
            currentAttempt,
          );
          if (ignore) return;
          setSuggestions(results);
        } catch (error) {
          if (ignore) return;
          console.error("Autocomplete failed:", error);
          setSuggestions([]);
        } finally {
          if (!ignore) {
            setIsLoading(false);
          }
        }
      })();
    }, 300);

    setSelectedIndex(-1); // Reset selection on query change/search start

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
    // eslint-disable-next-line unicorn/no-typeof-undefined
    if (
      isFocused &&
      typeof globalThis.window !== "undefined" &&
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
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (perfume: PerfumeSuggestion) => {
    makeGuess(perfume.name, perfume.brand_masked, perfume.perfume_id);
    setQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        // Cyclic navigation: (current + 1) % length
        setSelectedIndex((previous) => (previous + 1) % suggestions.length);

        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        // Cyclic navigation: (current - 1 + length) % length
        setSelectedIndex(
          (previous) =>
            (previous - 1 + suggestions.length) % suggestions.length,
        );

        break;
      }
      case "Escape": {
        e.preventDefault();
        setShowSuggestions(false);
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
            setSelectedIndex(firstAvailableIndex);
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
            <span className="font-[family-name:var(--font-hand)] text-lg text-primary">
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
                setShowSuggestions(false);
                setIsFocused(false);
              }}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => {
                setShowSuggestions(true);
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
            className={`!absolute bottom-full left-0 z-10 max-h-56 w-full touch-pan-y !overflow-y-auto rounded-t-md border-x border-t border-border/50 bg-background ${
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
                    onClick={() => handleSelect(perfume)}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setSelectedIndex(index)}
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
                                  {/* eslint-disable-next-line unicorn/prefer-spread */}
                                  {Array.from(perfume.year).map((char, i) => (
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
