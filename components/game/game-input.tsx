"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Search, Loader2 } from "lucide-react"
import { useGame } from "./game-provider"
import { searchPerfumes, type PerfumeSuggestion } from "@/app/actions/autocomplete"
import { toast } from "sonner" // Import toast

export function GameInput() {
  const { currentAttempt, maxAttempts, gameState, makeGuess, getPotentialScore, sessionId, attempts } = useGame()
  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState<PerfumeSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

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

    return () => clearTimeout(timer)
  }, [query, sessionId, currentAttempt])

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
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, -1))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        handleSelect(suggestions[selectedIndex])
      }
    }
  }

  if (gameState !== "playing") {
    return (
      <div className="sticky bottom-0 w-full max-w-[640px] bg-background border-t border-border px-5 py-6">
        <div className="text-center">
          <p className="font-[family-name:var(--font-hand)] text-xl text-primary">
            Come back tomorrow for a new challenge!
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="sticky bottom-0 w-full max-w-[640px] bg-background border-t border-muted/50 px-5 py-5 z-40">
      <div ref={wrapperRef} className="relative">
        {/* Status bar */}
        <div className="flex justify-between text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
          <span>
            Attempt {currentAttempt} / {maxAttempts}
          </span>
          <span className="text-primary font-semibold">Potential Score: {getPotentialScore()}</span>
        </div>

        {/* Input */}
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            placeholder="Type perfume name..."
            className="w-full py-3 pr-10 font-[family-name:var(--font-playfair)] text-lg text-foreground bg-transparent border-b-2 border-border focus:border-primary outline-none transition-colors duration-300 placeholder:font-sans placeholder:text-sm placeholder:italic placeholder:text-muted-foreground"
          />
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none flex items-center justify-center">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-5 h-5" />}
          </div>
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute bottom-full left-0 w-full mb-2 bg-background border border-border max-h-52 overflow-y-auto">
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
                  disabled={isDuplicate}
                  className={`w-full px-4 py-3 text-left text-sm border-b border-muted last:border-b-0 transition-colors duration-200 
                  ${isDuplicate ? "opacity-50 cursor-not-allowed bg-muted/20" : ""}
                  ${selectedIndex === index && !isDuplicate ? "bg-muted text-primary" : ""}
                  ${!isDuplicate ? "hover:bg-muted/50 hover:text-primary" : ""}
                `}
                >
                  <span className="text-foreground flex flex-wrap gap-x-1 items-center">
                    {/* Brand Masked */}
                    <span>
                      {perfume.brand_masked.split('').map((char, i) => (
                        <span key={i} className={char === '•' ? "opacity-30 text-muted-foreground" : "text-foreground"}>
                          {char}
                        </span>
                      ))}
                    </span>

                    <span className="text-muted-foreground">•</span>

                    {/* Name (if duplicate, maybe strike-through? Optional. Just opacity is fine per plan) */}
                    <span className={isDuplicate ? "line-through decoration-muted-foreground" : ""}>{perfume.name}</span>

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
                        <span>
                          {perfume.year.includes('•') ? (
                            // If it contains dots, apply masking logic: 
                            // If full placeholder "••••", use opacity-30 (lighter)
                            // If partial "19••", use opacity-50 for dots
                            perfume.year === "••••" ? (
                              <span className="opacity-30 tracking-widest text-muted-foreground">••••</span>
                            ) : (
                              perfume.year.split('').map((char, i) => (
                                <span key={i} className={char === '•' ? "opacity-30 text-muted-foreground" : "text-foreground"}>
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

        {/* Handwritten annotation */}
        <p className="absolute -right-2 -bottom-6 font-[family-name:var(--font-hand)] text-sm text-primary/70 rotate-[-3deg]">
          Select from list ↑
        </p>
      </div>
    </div>
  )
}
