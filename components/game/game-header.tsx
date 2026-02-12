"use client";

import { useState } from "react";

import {
  Menu,
  HelpCircle,
  BarChart3,
  ChevronDown,
  Monitor,
  Type,
  Moon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { usePathname, useRouter } from "@/i18n/routing";
import { cn } from "@/lib/utils";

import { useUIPreferences } from "./contexts";
import { GameTooltip } from "./game-tooltip";
import { MobileResetItem } from "./mobile-reset-item";
import { HelpModal } from "./modals/help-modal";
import { StatsModal } from "./modals/stats-modal";
import { ResetButton } from "./reset-button";

/**
 *
 */
export function GameHeader() {
  const { toggleFontScale, toggleLayoutMode, toggleTheme, uiPreferences } =
    useUIPreferences();
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const [statsOpen, setStatsOpen] = useState(false);

  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("Header");

  const currentLang = locale === "pl" ? "PL" : "EN";

  // Disable all tooltips when any dropdown/menu is open to prevent UI overlap
  const anyDropdownOpen = menuOpen || langOpen;

  const changeLanguage = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale });
    setLangOpen(false);
  };

  return (
    <>
      <header className="w-full">
        <nav
          className={cn(
            "relative mx-auto flex w-full items-center justify-between rounded-b-none border-x-0 border-b border-border/50 bg-background px-5 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 transition-all duration-300 sm:rounded-b-md sm:border-x",
            uiPreferences.layoutMode === "wide" ? "max-w-5xl" : "max-w-xl",
            menuOpen || langOpen ? "z-50" : "z-20",
          )}
        >
          {/* Left controls */}
          <div className="flex items-center gap-2 md:gap-4">
            <GameTooltip
              className="cursor-pointer"
              content={t("menu")}
              disabled={anyDropdownOpen}
              disableOnMobile
            >
              <button
                aria-label={t("menu")}
                className="p-2 text-foreground transition-colors duration-300 hover:text-primary"
                onClick={() => setMenuOpen(!menuOpen)}
              >
                <Menu className="h-5 w-5" />
              </button>
            </GameTooltip>

            <GameTooltip
              className="cursor-pointer"
              content={t("help")}
              disabled={anyDropdownOpen}
              disableOnMobile
            >
              <button
                aria-label={t("help")}
                className="relative p-2 text-foreground transition-colors duration-300 hover:text-primary"
                onClick={() => setHelpOpen(true)}
              >
                <HelpCircle className="h-5 w-5" />
              </button>
            </GameTooltip>
          </div>

          {/* Logo */}
          <h1 className="absolute left-1/2 -translate-x-1/2 transform font-[family-name:var(--font-playfair)] text-2xl font-bold tracking-tight text-foreground uppercase">
            Eauxle
          </h1>

          {/* Right controls */}
          <div className="flex items-center gap-2 md:gap-4">
            {/* Reset Button (Debug) placed before Language */}
            <div className="relative hidden sm:block">
              <ResetButton tooltipDisabled={anyDropdownOpen} />
            </div>

            <GameTooltip
              className="cursor-pointer"
              content={t("language")}
              disabled={anyDropdownOpen}
              disableOnMobile
            >
              <button
                className="flex items-center gap-1 p-2 text-sm font-semibold text-foreground transition-colors duration-300 hover:text-primary"
                onClick={() => setLangOpen(!langOpen)}
              >
                {currentLang}
                <ChevronDown className="h-3 w-3" />
              </button>
            </GameTooltip>

            <GameTooltip
              className="cursor-pointer"
              content={t("stats")}
              disabled={anyDropdownOpen}
              disableOnMobile
            >
              <button
                aria-label={t("stats")}
                className="p-2 text-foreground transition-colors duration-300 hover:text-primary"
                onClick={() => setStatsOpen(true)}
              >
                <BarChart3 className="h-5 w-5" />
              </button>
            </GameTooltip>
          </div>

          {/* Menu Dropdown */}
          <div
            className={cn(
              "!absolute top-full left-5 mt-2 w-56 flex-col overflow-hidden rounded-md border border-border/50 bg-background shadow-xl transition-all duration-300",
              menuOpen
                ? "flex translate-y-0 opacity-100"
                : "hidden -translate-y-2 opacity-0",
            )}
          >
            <button
              className="flex items-center justify-between border-b border-border px-5 py-3 font-[family-name:var(--font-playfair)] text-foreground transition-all duration-300 hover:pl-6 hover:text-primary"
              onClick={(e) => e.preventDefault()}
            >
              {t("archive")}
              <span className="font-sans text-[10px] text-muted-foreground uppercase">
                (240)
              </span>
            </button>
            <button
              className="border-b border-border px-5 py-3 text-left font-[family-name:var(--font-playfair)] text-foreground transition-all duration-300 hover:pl-6 hover:text-primary"
              onClick={(e) => e.preventDefault()}
            >
              {t("about")}
            </button>

            {/* Appearance Section */}
            <div className="border-b border-border bg-muted/20 px-5 py-3">
              <h3 className="mb-3 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                {t("appearance")}
              </h3>
              <div className="space-y-3">
                {/* Wide Layout Toggle */}
                <button
                  className="group flex w-full items-center justify-between text-foreground transition-colors hover:text-primary"
                  onClick={toggleLayoutMode}
                >
                  <div className="flex items-center gap-2">
                    <Monitor className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                    <span className="font-sans text-xs">{t("wideLayout")}</span>
                  </div>
                  <div
                    className={cn(
                      "relative h-4 w-8 rounded-full transition-colors",
                      uiPreferences.layoutMode === "wide"
                        ? "bg-primary"
                        : "bg-muted-foreground/30",
                    )}
                  >
                    <div
                      className={cn(
                        "absolute top-0.5 h-3 w-3 rounded-full bg-white text-xs transition-all",
                        uiPreferences.layoutMode === "wide"
                          ? "left-4.5"
                          : "left-0.5",
                      )}
                    />
                  </div>
                </button>

                {/* Large Text Toggle */}
                <button
                  className="group flex w-full items-center justify-between text-foreground transition-colors hover:text-primary"
                  onClick={toggleFontScale}
                >
                  <div className="flex items-center gap-2">
                    <Type className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                    <span className="font-sans text-xs">{t("largeText")}</span>
                  </div>
                  <div
                    className={cn(
                      "relative h-4 w-8 rounded-full transition-colors",
                      uiPreferences.fontScale === "large"
                        ? "bg-primary"
                        : "bg-muted-foreground/30",
                    )}
                  >
                    <div
                      className={cn(
                        "absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all",
                        uiPreferences.fontScale === "large"
                          ? "left-4.5"
                          : "left-0.5",
                      )}
                    />
                  </div>
                </button>

                {/* Dark Mode Toggle */}
                <button
                  className="group flex w-full items-center justify-between text-foreground transition-colors hover:text-primary"
                  onClick={toggleTheme}
                >
                  <div className="flex items-center gap-2">
                    <Moon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                    <span className="font-sans text-xs">{t("darkMode")}</span>
                  </div>
                  <div
                    className={cn(
                      "relative h-4 w-8 rounded-full transition-colors",
                      uiPreferences.theme === "dark"
                        ? "bg-primary"
                        : "bg-muted-foreground/30",
                    )}
                  >
                    <div
                      className={cn(
                        "absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all",
                        uiPreferences.theme === "dark"
                          ? "left-[18px]"
                          : "left-0.5",
                      )}
                    />
                  </div>
                </button>
              </div>
            </div>

            {/* Mobile Reset Action */}
            <MobileResetItem />

            <button
              className="px-5 py-3 text-left font-[family-name:var(--font-playfair)] text-primary transition-all duration-300 hover:pl-6"
              onClick={(e) => e.preventDefault()}
            >
              {t("support")}
            </button>
          </div>

          {/* Language Dropdown */}
          <div
            className={cn(
              "!absolute top-full right-16 mt-2 w-24 flex-col overflow-hidden rounded-md border border-border/50 bg-background shadow-xl transition-all duration-300",
              langOpen
                ? "flex translate-y-0 opacity-100"
                : "hidden -translate-y-2 opacity-0",
            )}
          >
            {["en", "pl"].map((lang) => (
              <button
                className={cn(
                  "px-4 py-2 text-center text-sm font-semibold transition-colors duration-300",
                  currentLang.toLowerCase() === lang
                    ? "text-foreground underline underline-offset-4"
                    : "text-foreground hover:bg-muted/30 hover:text-primary",
                )}
                key={lang}
                onClick={() => changeLanguage(lang)}
              >
                {lang === "en" ? "English" : "Polski"}
              </button>
            ))}
          </div>
        </nav>
      </header>

      {/* Click outside to close dropdowns */}
      {menuOpen || langOpen ? (
        <div
          aria-label="Close menu"
          className="fixed inset-0 z-40"
          onClick={() => {
            setMenuOpen(false);
            setLangOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setMenuOpen(false);
              setLangOpen(false);
            }
          }}
          role="button"
          tabIndex={-1}
        />
      ) : null}

      <HelpModal onClose={() => setHelpOpen(false)} open={helpOpen} />
      <StatsModal onClose={() => setStatsOpen(false)} open={statsOpen} />
    </>
  );
}
