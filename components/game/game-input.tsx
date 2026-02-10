"use client";

import type React from "react";
import { useState, useRef, useEffect, useId } from "react";

import { Search, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner"; // Import toast

import {
  searchPerfumes,
  type PerfumeSuggestion,
} from "@/app/actions/autocomplete";
import { useMountTransition } from "@/hooks/use-mount-transition";
import { cn, normalizeText } from "@/lib/utils";

import { useGame } from "./game-provider";

function HighlightedText({ query, text }: { query: string; text: string; }) {
  if (!query || query.trim().length < 2) return <>{text}</>;

  const normalizedText = normalizeText(text);
  const searchTerms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length >= 2)
    .map((term) => normalizeText(term));

  if (searchTerms.length === 0) return <>{text}</>;

  // Find all matches for all terms
  const matches: { end: number; start: number; }[] = [];
  for (const term of searchTerms) {
    let startPos = 0;
    while ((startPos = normalizedText.indexOf(term, startPos)) !== -1) {
      matches.push({ end: startPos + term.length, start: startPos });
      startPos += 1;
    }
  }

  if (matches.length === 0) return <>{text}</>;

  // Sort matches
  matches.sort((a, b) => a.start - b.start || b.end - a.end);

  // Merge matches
  const mergedMatches: { end: number; start: number; }[] = [];
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

  return <>{result}</>;
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
    getPotentialScore,
    loading: gameLoading,
    makeGuess,
    maxAttempts,
    sessionId,
    uiPreferences,
    isInputFocused: isFocused,
    setIsInputFocused: setIsFocused,
  } = useGame();
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
  const shouldShowList = showSuggestions && (suggestions.length > 0 || (query.length >= 3 && !isLoading && !gameLoading));
  const hasTransitionedIn = useMountTransition(shouldShowList, 200); // 200ms matches duration-200

  const listId = useId();

  // Detect incorrect guess to show error state
  useEffect(() => {
    // If attempts increased
    if (attempts.length > previousAttemptsLengthReference.current) {
      const lastAttempt = attempts.at(-1);
      // Check if the last attempt was NOT a full match (game not won)
      if (gameState !== "won") {
        setIsError(true);
        const timer = setTimeout(() => setIsError(false), 2000);
        return () => clearTimeout(timer);
      }
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

    const timer = setTimeout(async () => {
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
    }, 300);

    setSelectedIndex(-1); // Reset selection on query change/search start

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [query, sessionId, currentAttempt]);

  // Scroll into view logic
  useEffect(() => {
    if (selectedIndex >= 0 && listReference.current) {
      const activeItem = listReference.current.children[selectedIndex] as HTMLElement;
      if (activeItem) {
        activeItem.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [selectedIndex]);

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
          (previous) => (previous - 1 + suggestions.length) % suggestions.length,
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
          perfumeToSelect = suggestions[selectedIndex];
        } else if (suggestions.length === 1) {
          perfumeToSelect = suggestions[0];
        }

        if (perfumeToSelect) {
          // Check for duplicates before selecting
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

  // 1. Loading State - Render nothing or a stable placeholder (prevents "No Puzzle" flash)
  if (gameLoading) {
    return (
      <div className={cn("sticky bottom-0 z-30 mx-auto w-full", uiPreferences.layoutMode === "wide" ? "max-w-5xl" : "max-w-xl")}>
        <div className="relative border-x-0 border-t border-border/50 bg-background/80 px-5 py-8 backdrop-blur-md sm:rounded-t-md sm:border-x">
          <div className="flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
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


  return (
    <>
      <div
        className={cn(
          "z-30 mx-auto w-full transition-all duration-300",
          isFocused ? "fixed bottom-0 left-0 right-0 sm:sticky sm:bottom-0 sm:left-auto sm:right-auto" : "sticky bottom-0",
          uiPreferences.layoutMode === "wide" ? "max-w-5xl" : "max-w-xl",
        )}
      >
        <div className="relative" ref={wrapperReference}>
          {/* Input Surface (Visual Layer) */}
          <div
            className={`relative z-20 border-x-0 border-t border-border/50 px-5 pt-[6px] pb-[calc(16px+env(safe-area-inset-bottom,20px))] backdrop-blur-md transition-colors duration-200 ease-in-out sm:border-x ${shouldShowList || hasTransitionedIn ? "rounded-t-none bg-background" : showSuggestions ? "rounded-t-none bg-background sm:rounded-t-md" : "rounded-t-none bg-background/70 sm:rounded-t-md"}`}
          >
            {/* Input */}
            <div className="relative">
              <input
                aria-activedescendant={selectedIndex >= 0 ? `${listId}-option-${selectedIndex}` : undefined}
                aria-autocomplete="list"
                aria-controls={listId}
                aria-expanded={shouldShowList}
                className="w-full border-b-2 border-border bg-transparent py-3 pr-10 font-[family-name:var(--font-playfair)] text-lg text-foreground transition-colors duration-300 outline-none placeholder:font-sans placeholder:text-sm placeholder:text-muted-foreground placeholder:italic focus:border-primary"
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
              <div className="pointer-events-none absolute top-1/2 right-0 flex h-8 w-8 -translate-y-1/2 items-center justify-center">
                {/* Search Icon */}
                <div
                  className={`absolute transition-all duration-300 ease-out ${!isLoading && !gameLoading && !isError
                    ? "scale-100 rotate-0 opacity-100"
                    : "scale-50 -rotate-90 opacity-0"
                    }`}
                >
                  <Search className="h-5 w-5 text-muted-foreground" />
                </div>

                {/* Loader Icon */}
                {(isLoading || gameLoading) ? <div className="absolute scale-100 opacity-100 transition-all duration-300 ease-out">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div> : null}

                {/* Error Icon */}
                <div
                  className={`absolute transition-all duration-300 ease-out ${!isLoading && !gameLoading && isError
                    ? "scale-100 rotate-0 opacity-100"
                    : "scale-50 rotate-90 opacity-0"
                    }`}
                >
                </div>
              </div>


            </div>

            {/* Status bar */}
            <div className="mt-3 flex items-center justify-between text-[10px] tracking-wide text-muted-foreground uppercase">
              <span>
                {t("attempt")} {currentAttempt} / {maxAttempts}
              </span>
              <span className="font-semibold text-primary">
                {t("score")}: {getPotentialScore()}
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
            >
              {suggestions.length === 0 && !isLoading && !gameLoading && query.length >= 3 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {t("noResults")}
                </div>
              ) : (
                suggestions.map((perfume, index) => {
                  // Check duplicate (Using ID is more robust, fallback to name)
                  const isDuplicate = attempts.some(
                    (a) =>
                      (a.perfumeId && a.perfumeId === perfume.perfume_id) ||
                      (!a.perfumeId &&
                        a.guess.toLowerCase() === perfume.name.toLowerCase()),
                  );

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
                        {perfume.year ? (
                          <>
                            <span className="text-muted-foreground/30">•</span>
                            <span className="inline-flex items-baseline">
                              {perfume.year.includes("_") ? (
                                // If it contains dots, apply masking logic:
                                // If full placeholder "____", use opacity-30 (lighter)
                                // If partial "19__", use opacity-50 for dots
                                perfume.year === "____" ? (
                                  <span className="font-mono tracking-widest text-muted-foreground opacity-30">
                                    ____
                                  </span>
                                ) : (
                                  perfume.year.split("").map((char, i) => (
                                    <span
                                      className={`${char === "_" ? "font-mono text-muted-foreground opacity-40" : "text-foreground"} whitespace-pre`}
                                      key={i}
                                    >
                                      {char}
                                    </span>
                                  ))
                                )
                              ) : (
                                // Fully revealed year
                                <span>{perfume.year}</span>
                              )}
                            </span>
                          </>
                        ) : null}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
