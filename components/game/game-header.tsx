"use client"

import { useState, useEffect } from "react"
import { Menu, HelpCircle, BarChart3, ChevronDown } from "lucide-react"
import { HelpModal } from "./modals/help-modal"
import { StatsModal } from "./modals/stats-modal"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

import { ResetButton } from "./reset-button"

export function GameHeader() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  const [statsOpen, setStatsOpen] = useState(false)
  const [currentLang, setCurrentLang] = useState("EN")

  return (
    <>
      <nav
        className={cn(
          "relative w-full max-w-[640px] px-5 pb-5 pt-[calc(1.25rem+env(safe-area-inset-top))] flex justify-between items-center border-b border-x-0 sm:border-x border-border/50 bg-background/70 backdrop-blur-md rounded-b-none sm:rounded-b-md transition-all duration-200",
          (menuOpen || langOpen) ? "z-40" : "z-20"
        )}
      >
        {/* Left controls */}
        <div className="flex items-center gap-1 md:gap-2">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="text-foreground hover:text-primary transition-colors duration-300 p-3"
                  aria-label="Open menu"
                >
                  <Menu className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Menu</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setHelpOpen(true)}
                  className="text-foreground hover:text-primary transition-colors duration-300 p-3 relative"
                  aria-label="How to play"
                >
                  <HelpCircle className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>How to play</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Logo */}
        <h1 className="font-[family-name:var(--font-playfair)] text-2xl font-bold tracking-tight uppercase text-foreground absolute left-1/2 transform -translate-x-1/2">
          Eauxle
        </h1>

        {/* Right controls */}
        <div className="flex items-center gap-3 md:gap-4">
          {/* Reset Button (Debug) placed before Language */}
          <div className="relative">
            <ResetButton />
          </div>

          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setLangOpen(!langOpen)}
                  className="flex items-center gap-1 text-sm font-semibold text-foreground hover:text-primary transition-colors duration-300 p-3"
                >
                  {currentLang}
                  <ChevronDown className="w-3 h-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Language</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setStatsOpen(true)}
                  className="text-foreground hover:text-primary transition-colors duration-300 p-3"
                  aria-label="View statistics"
                >
                  <BarChart3 className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Statistics</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Menu Dropdown */}
        <div
          className={cn(
            "!absolute top-full left-5 mt-2 w-56 bg-background border border-border/50 shadow-xl flex-col transition-all duration-300 rounded-md overflow-hidden",
            menuOpen ? "flex opacity-100 translate-y-0" : "hidden opacity-0 -translate-y-2",
          )}
        >
          <a
            href="#"
            className="px-5 py-3 font-[family-name:var(--font-playfair)] text-foreground hover:text-primary hover:pl-6 transition-all duration-300 border-b border-border flex justify-between items-center"
          >
            Archive
            <span className="font-sans text-[10px] uppercase text-muted-foreground">(240)</span>
          </a>
          <a
            href="#"
            className="px-5 py-3 font-[family-name:var(--font-playfair)] text-foreground hover:text-primary hover:pl-6 transition-all duration-300 border-b border-border"
          >
            About Project
          </a>
          <a
            href="#"
            className="px-5 py-3 font-[family-name:var(--font-playfair)] text-primary hover:pl-6 transition-all duration-300"
          >
            Support Us
          </a>
        </div>

        {/* Language Dropdown */}
        <div
          className={cn(
            "!absolute top-full right-16 mt-2 w-24 bg-background border border-border/50 shadow-xl flex-col transition-all duration-300 rounded-md overflow-hidden",
            langOpen ? "flex opacity-100 translate-y-0" : "hidden opacity-0 -translate-y-2",
          )}
        >
          {["EN", "PL"].map((lang) => (
            <button
              key={lang}
              onClick={() => {
                setCurrentLang(lang)
                setLangOpen(false)
              }}
              className={cn(
                "px-4 py-2 text-sm font-semibold text-center transition-colors duration-300",
                currentLang === lang
                  ? "underline underline-offset-4 text-foreground"
                  : "text-foreground hover:text-primary hover:bg-muted/30",
              )}
            >
              {lang === "EN" ? "English" : "Polski"}
            </button>
          ))}
        </div>
      </nav>

      {/* Click outside to close dropdowns */}
      {(menuOpen || langOpen) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setMenuOpen(false)
            setLangOpen(false)
          }}
        />
      )}

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <StatsModal open={statsOpen} onClose={() => setStatsOpen(false)} />
    </>
  )
}
