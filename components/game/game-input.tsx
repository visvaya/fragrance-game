"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Search, Loader2, X } from "lucide-react"
import { useGame } from "./game-provider"
import { searchPerfumes, type PerfumeSuggestion } from "@/app/actions/autocomplete"
import { toast } from "sonner" // Import toast

export function GameInput() {
  const { currentAttempt, maxAttempts, gameState, makeGuess, getPotentialScore, sessionId, attempts, loading: gameLoading } = useGame()
  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState<PerfumeSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
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
    // Pass everything needed: name, brand (masked if needed, but here we pass real brand from backend?), 
    // Wait, makeGuess takes (name, brand, id). 
    // If the suggestion has a masked brand, we should probably pass the UNMASKED name if possible?
    // Actually, `searchPerfumes` returns `name` (unmasked?) and `brand_masked`.
    // Let's check the action again. It selects `name` and `brand_name` from VIEW.
    // The VIEW `perfumes_public` HAS `brand_name`? 
    // Yes, the action returns `name` (raw) and `brand_masked` (logic).
    // Ideally we pass the raw brand if available, or just what we show.
    // `makeGuess` in provider calculates feedback. 
    // If we pass MASKED brand, the feedback might be wrong if it compares string equality.
    // However, the `submitGuess` on server uses ID, so it is robust.
    // The client-side feedback in `makeGuess` (fake feedback) might use the strings.
    // Let's rely on the Server Action's result primarily.
    // We update GameInput to pass `perfume.brand_masked` or `perfume.display_name`?
    // Let's pass `perfume.brand_masked` for now as the "brand" argument, 
    // trusting the server `submitGuess` deals with the real check.

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
      <div className="sticky bottom-0 w-full max-w-[640px] z-30">
        <div className="relative border-t border-x-0 sm:border-x border-border/50 px-5 pt-[6px] pb-[calc(8px+env(safe-area-inset-bottom,20px))] backdrop-blur-md bg-background/70 rounded-t-none sm:rounded-t-md transition-colors duration-500 ease-in-out">
          {/* Input-like look for closed state */}
          <div className="relative">
            <div className="w-full py-3 text-center text-lg text-primary font-[family-name:var(--font-hand)]">
              Come back tomorrow for a new challenge!
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="sticky bottom-0 w-full max-w-[640px] z-30">
      <div
        ref={wrapperRef}
        className={`relative border-t border-x-0 sm:border-x border-border/50 px-5 pt-[6px] pb-4 backdrop-blur-md transition-colors duration-500 ease-in-out ${showSuggestions ? "bg-background" : "bg-background/70"} ${showSuggestions && suggestions.length > 0 ? "rounded-t-none" : "rounded-t-none sm:rounded-t-md"}`}
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
            placeholder="Type perfume name..."
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
            Attempt {currentAttempt} / {maxAttempts}
          </span>
          <span className="text-primary font-semibold">Potential Score: {getPotentialScore()}</span>
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div ref={listRef} onMouseDown={(e) => e.preventDefault()} data-lenis-prevent className="!absolute bottom-full left-[-1px] w-[calc(100%+2px)] bg-background border-t border-x border-b border-border/50 rounded-t-md !overflow-y-auto max-h-80 sm:max-h-60 touch-pan-y shadow-none">
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
                      {perfume.brand_masked.split('').map((char, i) => (
                        <span key={i} className={`${char === '•' ? "opacity-30 text-muted-foreground" : "text-foreground"} whitespace-pre`}>
                          {char}
                        </span>
                      ))}
                    </span>

                    <span className="text-muted-foreground">•</span>

                    {/* Name (if duplicate, maybe strike-through? Optional. Just opacity is fine per plan) */}
                    {/* Name with highlighting */}
                    <span className={isDuplicate ? "line-through decoration-muted-foreground" : ""}>
                      {(() => {
                        if (!query || query.length < 2) return perfume.name;
                        // Escape special regex characters in query
                        const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const parts = perfume.name.split(new RegExp(`(${safeQuery})`, 'gi'));
                        return parts.map((part, i) =>
                          part.toLowerCase() === query.toLowerCase() ? <b key={i} className="font-bold">{part}</b> : part
                        );
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
                          {perfume.year.includes('•') ? (
                            // If it contains dots, apply masking logic: 
                            // If full placeholder "••••", use opacity-30 (lighter)
                            // If partial "19••", use opacity-50 for dots
                            perfume.year === "••••" ? (
                              <span className="opacity-30 tracking-widest text-muted-foreground">••••</span>
                            ) : (
                              perfume.year.split('').map((char, i) => (
                                <span key={i} className={`${char === '•' ? "opacity-30 text-muted-foreground" : "text-foreground"} whitespace-pre`}>
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

      {/* Handwritten annotation - Outside wrapper, aligned right */}
      {/* Transparent Safe Area Spacer */}
      <div className="w-full h-[env(safe-area-inset-bottom,20px)] pointer-events-none" />
    </div>
  )
}
