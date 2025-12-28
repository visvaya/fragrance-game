"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Search } from "lucide-react"
import { useGame } from "./game-provider"

// Sample perfume suggestions
const PERFUME_DATABASE = [
  { name: "Terre d'Hermès", brand: "Hermès" },
  { name: "Terre d'Hermès Eau Givrée", brand: "Hermès" },
  { name: "Terre de Lumière", brand: "L'Occitane" },
  { name: "Sauvage", brand: "Dior" },
  { name: "Bleu de Chanel", brand: "Chanel" },
  { name: "Aventus", brand: "Creed" },
  { name: "Light Blue", brand: "Dolce & Gabbana" },
  { name: "Black Orchid", brand: "Tom Ford" },
  { name: "La Vie Est Belle", brand: "Lancôme" },
  { name: "Acqua di Gio", brand: "Giorgio Armani" },
]

export function GameInput() {
  const { currentAttempt, maxAttempts, gameState, makeGuess, getPotentialScore } = useGame()
  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState<typeof PERFUME_DATABASE>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Filter suggestions based on query
  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([])
      return
    }

    const normalizedQuery = query
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")

    const filtered = PERFUME_DATABASE.filter((p) => {
      const normalizedName = p.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
      const normalizedBrand = p.brand
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
      return normalizedName.includes(normalizedQuery) || normalizedBrand.includes(normalizedQuery)
    }).slice(0, 5)

    setSuggestions(filtered)
    setSelectedIndex(-1)
  }, [query])

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

  const handleSelect = (perfume: (typeof PERFUME_DATABASE)[0]) => {
    makeGuess(perfume.name, perfume.brand)
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
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault()
      handleSelect(suggestions[selectedIndex])
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
          <Search className="absolute right-0 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute bottom-full left-0 w-full mb-2 bg-background border border-border max-h-52 overflow-y-auto">
            {suggestions.map((perfume, index) => (
              <button
                key={`${perfume.brand}-${perfume.name}`}
                onClick={() => handleSelect(perfume)}
                className={`w-full px-4 py-3 text-left text-sm border-b border-muted last:border-b-0 transition-colors duration-200 ${
                  selectedIndex === index ? "bg-muted text-primary" : "hover:bg-muted/50 hover:text-primary"
                }`}
              >
                <span className="text-foreground">{perfume.name}</span>
                <span className="text-muted-foreground ml-2 text-xs">{perfume.brand}</span>
              </button>
            ))}
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
