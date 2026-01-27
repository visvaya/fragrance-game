"use client"

import { useState, useEffect } from "react"


import { Menu, HelpCircle, BarChart3, ChevronDown, Monitor, Type, Moon } from "lucide-react"
import { HelpModal } from "./modals/help-modal"
import { StatsModal } from "./modals/stats-modal"
import { cn } from "@/lib/utils"
import { GameTooltip } from "./game-tooltip"
import { ResetButton } from "./reset-button"
import { useGame } from "./game-provider"
import { usePathname, useRouter } from "@/i18n/routing"
import { useLocale, useTranslations } from "next-intl"

export function GameHeader() {
  const { uiPreferences, toggleLayoutMode, toggleFontScale, toggleTheme } = useGame()
  const [menuOpen, setMenuOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  const [statsOpen, setStatsOpen] = useState(false)

  const router = useRouter()
  const pathname = usePathname()
  const locale = useLocale()
  const t = useTranslations('Header')

  const currentLang = locale === 'pl' ? 'PL' : 'EN'

  const changeLanguage = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale });
    setLangOpen(false);
  }

  return (
    <>
      <nav
        className={cn(
          "relative w-full px-5 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] flex justify-between items-center border-b border-x-0 sm:border-x border-border/50 bg-background rounded-b-none sm:rounded-b-md transition-all duration-300 mx-auto",
          uiPreferences.layoutMode === 'wide' ? "max-w-5xl" : "max-w-xl",
          (menuOpen || langOpen) ? "z-50" : "z-20"
        )}
      >
        {/* Left controls */}
        <div className="flex items-center gap-1 md:gap-2">
          <GameTooltip content={t('menu')} disableOnMobile className="cursor-pointer">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="text-foreground hover:text-primary transition-colors duration-300 p-2"
              aria-label={t('menu')}
            >
              <Menu className="w-5 h-5" />
            </button>
          </GameTooltip>

          <GameTooltip content={t('help')} disableOnMobile className="cursor-pointer">
            <button
              onClick={() => setHelpOpen(true)}
              className="text-foreground hover:text-primary transition-colors duration-300 p-2 relative"
              aria-label={t('help')}
            >
              <HelpCircle className="w-5 h-5" />
            </button>
          </GameTooltip>
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

          <GameTooltip content={t('language')} disableOnMobile className="cursor-pointer">
            <button
              onClick={() => setLangOpen(!langOpen)}
              className="flex items-center gap-1 text-sm font-semibold text-foreground hover:text-primary transition-colors duration-300 p-2"
            >
              {currentLang}
              <ChevronDown className="w-3 h-3" />
            </button>
          </GameTooltip>

          <GameTooltip content={t('stats')} disableOnMobile className="cursor-pointer">
            <button
              onClick={() => setStatsOpen(true)}
              className="text-foreground hover:text-primary transition-colors duration-300 p-2"
              aria-label={t('stats')}
            >
              <BarChart3 className="w-5 h-5" />
            </button>
          </GameTooltip>
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
            {t('archive')}
            <span className="font-sans text-[10px] uppercase text-muted-foreground">(240)</span>
          </a>
          <a
            href="#"
            className="px-5 py-3 font-[family-name:var(--font-playfair)] text-foreground hover:text-primary hover:pl-6 transition-all duration-300 border-b border-border"
          >
            {t('about')}
          </a>

          {/* Appearance Section */}
          <div className="px-5 py-3 border-b border-border bg-muted/20">
            <h3 className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-3">{t('appearance')}</h3>
            <div className="space-y-3">
              {/* Wide Layout Toggle */}
              <button
                onClick={toggleLayoutMode}
                className="flex items-center justify-between w-full text-foreground hover:text-primary transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="font-sans text-xs">{t('wideLayout')}</span>
                </div>
                <div className={cn(
                  "w-8 h-4 rounded-full transition-colors relative",
                  uiPreferences.layoutMode === 'wide' ? "bg-primary" : "bg-muted-foreground/30"
                )}>
                  <div className={cn(
                    "w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all text-xs",
                    uiPreferences.layoutMode === 'wide' ? "left-4.5" : "left-0.5"
                  )} />
                </div>
              </button>

              {/* Large Text Toggle */}
              <button
                onClick={toggleFontScale}
                className="flex items-center justify-between w-full text-foreground hover:text-primary transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <Type className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="font-sans text-xs">{t('largeText')}</span>
                </div>
                <div className={cn(
                  "w-8 h-4 rounded-full transition-colors relative",
                  uiPreferences.fontScale === 'large' ? "bg-primary" : "bg-muted-foreground/30"
                )}>
                  <div className={cn(
                    "w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all",
                    uiPreferences.fontScale === 'large' ? "left-4.5" : "left-0.5"
                  )} />
                </div>
              </button>

              {/* Dark Mode Toggle */}
              <button
                onClick={toggleTheme}
                className="flex items-center justify-between w-full text-foreground hover:text-primary transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <Moon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="font-sans text-xs">{t('darkMode')}</span>
                </div>
                <div className={cn(
                  "w-8 h-4 rounded-full transition-colors relative",
                  uiPreferences.theme === 'dark' ? "bg-primary" : "bg-muted-foreground/30"
                )}>
                  <div className={cn(
                    "w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all",
                    uiPreferences.theme === 'dark' ? "left-[18px]" : "left-0.5"
                  )} />
                </div>
              </button>
            </div>
          </div>

          <a
            href="#"
            className="px-5 py-3 font-[family-name:var(--font-playfair)] text-primary hover:pl-6 transition-all duration-300"
          >
            {t('support')}
          </a>
        </div>

        {/* Language Dropdown */}
        <div
          className={cn(
            "!absolute top-full right-16 mt-2 w-24 bg-background border border-border/50 shadow-xl flex-col transition-all duration-300 rounded-md overflow-hidden",
            langOpen ? "flex opacity-100 translate-y-0" : "hidden opacity-0 -translate-y-2",
          )}
        >
          {["en", "pl"].map((lang) => (
            <button
              key={lang}
              onClick={() => changeLanguage(lang)}
              className={cn(
                "px-4 py-2 text-sm font-semibold text-center transition-colors duration-300",
                currentLang.toLowerCase() === lang
                  ? "underline underline-offset-4 text-foreground"
                  : "text-foreground hover:text-primary hover:bg-muted/30",
              )}
            >
              {lang === "en" ? "English" : "Polski"}
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
