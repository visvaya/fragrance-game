"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Search, Loader2, X } from "lucide-react"
import { useGame } from "./game-provider"
import { cn } from "@/lib/utils"
import { searchPerfumes, type PerfumeSuggestion } from "@/app/actions/autocomplete"
import { toast } from "sonner" // Import toast
import { useTranslations } from "next-intl"

import { useMountTransition } from "@/hooks/use-mount-transition"
import { normalizeText } from "@/lib/utils"


export function GameInput() {
  const {
    currentAttempt,
    maxAttempts,
    gameState,
    makeGuess,
    getPotentialScore,
    sessionId,
    attempts,
    loading: gameLoading,
    uiPreferences
  } = useGame()
  const t = useTranslations('Game.input')
  const [query, setQuery] = useState("")

  const [suggestions, setSuggestions] = useState<PerfumeSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Animation state
  const shouldShowList = showSuggestions && suggestions.length > 0
  const hasTransitionedIn = useMountTransition(shouldShowList, 200) // 200ms matches duration-200

  const [isLoading, setIsLoading] = useState(false)
  const [isError, setIsError] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const previousAttemptsLengthRef = useRef(attempts.length)

  // Detect incorrect guess to show error state
  useEffect(() => {
    // If attempts increased
    if (attempts.length > previousAttemptsLengthRef.current) {
      const lastAttempt = attempts[attempts.length - 1]
      // Check if the last attempt was NOT a full match (game not won)
      if (gameState !== "won") {
        setIsError(true)
        const timer = setTimeout(() => setIsError(false), 2000)
        return () => clearTimeout(timer)
      }
    }
    previousAttemptsLengthRef.current = attempts.length
  }, [attempts, gameState])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length < 3) {
        setSuggestions([])
        return
      }

      setIsLoading(true)
      try {
        const results = await searchPerfumes(query, sessionId || undefined, currentAttempt)
        setSuggestions(results)
      } catch (error) {
        console.error("Autocomplete failed:", error)
        setSuggestions([])
      } finally {
        setIsLoading(false)
      }
    }, 300)

    setSelectedIndex(-1) // Reset selection on query change/search start

    return () => clearTimeout(timer)
  }, [query, sessionId, currentAttempt])

  // Scroll into view logic
  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const activeItem = listRef.current.children[selectedIndex] as HTMLElement
      if (activeItem) {
        activeItem.scrollIntoView({ block: "nearest", behavior: "smooth" })
      }
    }
  }, [selectedIndex])

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSelect = (perfume: PerfumeSuggestion) => {
    makeGuess(perfume.name, perfume.brand_masked, perfume.perfume_id)
    setQuery("")
    setSuggestions([])
    setShowSuggestions(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (suggestions.length === 0) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      // Cyclic navigation: (current + 1) % length
      setSelectedIndex((prev) => (prev + 1) % suggestions.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      // Cyclic navigation: (current - 1 + length) % length
      setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === "Enter") {
      e.preventDefault()

      let perfumeToSelect = null
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        perfumeToSelect = suggestions[selectedIndex]
      } else if (suggestions.length === 1) {
        perfumeToSelect = suggestions[0]
      }

      if (perfumeToSelect) {
        // Check for duplicates before selecting
        const isDuplicate = attempts.some(a =>
          (a.perfumeId && a.perfumeId === perfumeToSelect.perfume_id) ||
          (!a.perfumeId && a.guess.toLowerCase() === perfumeToSelect.name.toLowerCase())
        );

        if (!isDuplicate) {
          handleSelect(perfumeToSelect)
        }
      }
    }
  }

  if (gameState !== "playing") {
    return (
      <div className={cn(
        "sticky bottom-0 w-full z-30 mx-auto",
        uiPreferences.layoutMode === 'wide' ? "max-w-5xl" : "max-w-xl"
      )}>
        <div className="relative border-t border-x-0 sm:border-x border-border/50 px-5 py-4 backdrop-blur-md bg-background/80 sm:rounded-t-md transition-colors duration-500 ease-in-out">
          {/* Input-like look for closed state */}
          <div className="relative flex justify-center items-center">
            <span className="text-lg text-primary font-[family-name:var(--font-hand)]">
              {t('closed')}
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      "sticky bottom-0 w-full z-30 transition-all duration-300 mx-auto",
      uiPreferences.layoutMode === 'wide' ? "max-w-5xl" : "max-w-xl"
    )}>
      <div ref={wrapperRef} className="relative">

        {/* Input Surface (Visual Layer) */}
        <div
          className={`relative z-20 backdrop-blur-md border-t border-x-0 sm:border-x border-border/50 px-5 pt-[6px] pb-[calc(16px+env(safe-area-inset-bottom,20px))] transition-colors duration-200 ease-in-out ${shouldShowList || hasTransitionedIn ? "bg-background rounded-t-none" : (showSuggestions ? "bg-background rounded-t-none sm:rounded-t-md" : "bg-background/70 rounded-t-none sm:rounded-t-md")}`}
        >
          {/* Input */}
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setShowSuggestions(false)}
              onKeyDown={handleKeyDown}
              placeholder={t('placeholder')}
              className="w-full py-3 pr-10 font-[family-name:var(--font-playfair)] text-lg text-foreground bg-transparent border-b-2 border-border focus:border-primary outline-none transition-colors duration-300 placeholder:font-sans placeholder:text-sm placeholder:italic placeholder:text-muted-foreground"
            />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-8 pointer-events-none flex items-center justify-center">
              {/* Search Icon */}
              <div
                className={`absolute transition-all duration-300 ease-out ${!isLoading && !gameLoading && !isError
                  ? "opacity-100 rotate-0 scale-100"
                  : "opacity-0 -rotate-90 scale-50"
                  }`}
              >
                <Search className="w-5 h-5 text-muted-foreground" />
              </div>

              {/* Loader Icon */}
              <div
                className={`absolute transition-all duration-300 ease-out ${isLoading || gameLoading
                  ? "opacity-100 scale-100"
                  : "opacity-0 scale-50"
                  }`}
              >
                <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
              </div>

              {/* Error Icon */}
              <div
                className={`absolute transition-all duration-300 ease-out ${!isLoading && !gameLoading && isError
                  ? "opacity-100 rotate-0 scale-100"
                  : "opacity-0 rotate-90 scale-50"
                  }`}
              >
                <X className="w-5 h-5 text-destructive" />
              </div>
            </div>
          </div>

          {/* Status bar */}
          <div className="flex justify-between items-center text-[10px] uppercase tracking-wide text-muted-foreground mt-3">
            <span>
              {t('attempt')} {currentAttempt} / {maxAttempts}
            </span>
            <span className="text-primary font-semibold">{t('score')}: {getPotentialScore()}</span>
          </div>

        </div>

        {/* Suggestions dropdown (Behind Input Surface) */}
        {(hasTransitionedIn || shouldShowList) && (
          <div
            ref={listRef}
            onMouseDown={(e) => e.preventDefault()}
            data-lenis-prevent
            className={`!absolute bottom-full left-0 w-full bg-background border-t border-x border-border/50 rounded-t-md !overflow-y-auto max-h-56 touch-pan-y z-10
              ${shouldShowList
                ? "animate-in slide-in-from-bottom-12 fade-in duration-200 ease-out"
                : "animate-out slide-out-to-bottom-12 fade-out duration-200 ease-in"
              }
            `}
          >
            {suggestions.map((perfume, index) => {
              // Check duplicate (Using ID is more robust, fallback to name)
              const isDuplicate = attempts.some(a =>
                (a.perfumeId && a.perfumeId === perfume.perfume_id) ||
                (!a.perfumeId && a.guess.toLowerCase() === perfume.name.toLowerCase())
              );

              return (
                <button
                  key={perfume.perfume_id}
                  onClick={() => handleSelect(perfume)}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setSelectedIndex(index)}
                  disabled={isDuplicate}
                  className={`w-full px-4 py-3 text-left text-sm border-b border-muted last:border-b-0 transition-colors duration-200 
                  ${isDuplicate ? "cursor-not-allowed" : ""}
                  ${isDuplicate && selectedIndex !== index ? "opacity-50 bg-muted/20" : ""}
                  ${selectedIndex === index ? "bg-muted text-primary" : ""}
                  ${isDuplicate && selectedIndex === index ? "opacity-70" : ""} 
                  ${!isDuplicate && selectedIndex !== index ? "hover:bg-muted/50 hover:text-primary" : ""}
                `}
                >
                  <span className="text-foreground flex flex-wrap gap-x-1 items-baseline">
                    {/* Brand Masked */}
                    <span className="inline-flex items-baseline">
                      {perfume.brand_masked.split('').map((char, i) => {
                        const isFullHidden = /^•+$/.test(perfume.brand_masked)
                        return (
                          <span key={i} className={`${char === '•' ? `font-mono ${isFullHidden ? "opacity-30" : "opacity-40"} text-muted-foreground` : "text-foreground"} whitespace-pre`}>
                            {char}
                          </span>
                        )
                      })}
                    </span>

                    <span className="text-muted-foreground">•</span>

                    {/* Name (if duplicate, maybe strike-through? Optional. Just opacity is fine per plan) */}
                    {/* Name with highlighting */}
                    <span className={isDuplicate ? "line-through decoration-muted-foreground" : ""}>
                      {(() => {
                        if (!query || query.length < 2) return perfume.name;

                        const text = perfume.name.normalize('NFC');
                        const normText = normalizeText(text);
                        const normQuery = normalizeText(query);

                        if (!normText.includes(normQuery)) return text;

                        const result = [];
                        let lastIndex = 0;
                        let currentIndex = normText.indexOf(normQuery);

                        while (currentIndex !== -1) {
                          if (currentIndex > lastIndex) {
                            result.push(text.slice(lastIndex, currentIndex));
                          }

                          const matchEnd = currentIndex + normQuery.length;
                          result.push(
                            <b key={`${currentIndex}-${matchEnd}`} className="font-bold">
                              {text.slice(currentIndex, matchEnd)}
                            </b>
                          );

                          lastIndex = matchEnd;
                          currentIndex = normText.indexOf(normQuery, lastIndex);
                        }

                        if (lastIndex < text.length) {
                          result.push(text.slice(lastIndex));
                        }

                        return result;
                      })()}
                    </span>

                    {/* Concentration */}
                    {perfume.concentration && (
                      <>
                        <span className="text-muted-foreground">•</span>
                        <span>{perfume.concentration}</span>
                      </>
                    )}

                    {/* Year Masked */}
                    {perfume.year && (
                      <>
                        <span className="text-muted-foreground">•</span>
                        <span className="inline-flex items-baseline">
                          {perfume.year.includes('_') ? (
                            // If it contains dots, apply masking logic: 
                            // If full placeholder "____", use opacity-30 (lighter)
                            // If partial "19__", use opacity-50 for dots
                            perfume.year === "____" ? (
                              <span className="opacity-30 font-mono tracking-widest text-muted-foreground">____</span>
                            ) : (
                              perfume.year.split('').map((char, i) => (
                                <span key={i} className={`${char === '_' ? "font-mono opacity-40 text-muted-foreground" : "text-foreground"} whitespace-pre`}>
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
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
