"use client";

/* eslint-disable no-restricted-syntax -- Required for strict breakpoints (max-[280px]) and viewport calculations (calc(100vw - Xpx)) */
/* eslint-disable better-tailwindcss/no-unknown-classes -- Custom animations defined in globals.css */

// eslint-disable-next-line no-restricted-imports -- dom read: reads localStorage on mount; dismisses help hint on input focus
import { useState, useEffect } from "react";

import dynamic from "next/dynamic";

import {
  Menu,
  HelpCircle,
  BarChart3,
  ChevronDown,
  ChevronsUpDown,
  Monitor,
  Moon,
  Type,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { useScrollDirection } from "@/hooks/use-scroll-direction";
import { usePathname, useRouter, routing, localeNames } from "@/i18n/routing";
import { cn } from "@/lib/utils";

import { useUIPreferences } from "./contexts";
import { useGame } from "./game-provider";
import { GameTooltip } from "./game-tooltip";
import { MobileResetItem } from "./mobile-reset-item";
import { ResetButton } from "./reset-button";

const SessionsModal = dynamic(
  async () =>
    import("@/components/auth/sessions-modal").then(
      (module_) => module_.SessionsModal,
    ),
  { ssr: false },
);
const ProfileModal = dynamic(
  async () =>
    import("@/components/profile/profile-modal").then(
      (module_) => module_.ProfileModal,
    ),
  { ssr: false },
);
const HelpModal = dynamic(
  async () =>
    import("./modals/help-modal").then((module_) => module_.HelpModal),
  { ssr: false },
);
const StatsModal = dynamic(
  async () =>
    import("./modals/stats-modal").then((module_) => module_.StatsModal),
  { ssr: false },
);
const AuthModal = dynamic(
  async () =>
    import("@/components/auth/auth-modal").then((module_) => module_.AuthModal),
  { ssr: false },
);

/** Reusable toggle pill used in the appearance settings section. */
function TogglePill({ isOn }: { readonly isOn: boolean }) {
  return (
    <div
      className={cn(
        "relative h-4 w-8 rounded-full transition-colors",
        isOn ? "bg-primary" : "bg-muted-foreground/30",
      )}
    >
      <div
        className={cn(
          "absolute top-0.5 size-3 rounded-full bg-white transition-all",
          isOn ? "left-4.5" : "left-0.5",
        )}
      />
    </div>
  );
}

/**
 * Game header bar, containing logo, settings menu, help, and statistics.
 */
export function GameHeader() {
  const {
    toggleAutoScroll,
    toggleFontScale,
    toggleLayoutMode,
    toggleTheme,
    uiPreferences,
    user,
  } = useGame();
  const { isInputFocused } = useUIPreferences();
  const isScrollHidden = useScrollDirection();
  const [showHelpHint, setShowHelpHint] = useState(false);
  const [modals, setModals] = useState({
    authOpen: false,
    authView: "login" as "login" | "register",
    helpOpen: false,
    langOpen: false,
    menuOpen: false,
    profileOpen: false,
    sessionsOpen: false,
    statsOpen: false,
  });

  const openAuth = (view: "login" | "register") => {
    setModals((previous) => ({
      ...previous,
      authOpen: true,
      authView: view,
      menuOpen: false,
    }));
  };

  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("Header");
  useEffect(() => {
    // Show help hint badge on first visit instead of auto-opening the modal.
    // Avoids Radix FocusScope scan (~89ms forced reflow) on page load.
    try {
      if (!localStorage.getItem("eauxle:hasVisited")) {
        setShowHelpHint(true);
      }
    } catch {
      // localStorage may be unavailable in some environments
    }
  }, []);

  // Dismiss hint when user focuses the input (they've found the game on their own).
  useEffect(() => {
    if (!showHelpHint || !isInputFocused) return;
    setShowHelpHint(false);
    try {
      localStorage.setItem("eauxle:hasVisited", "1");
    } catch {
      // localStorage may be unavailable in some environments
    }
  }, [showHelpHint, isInputFocused]);

  const currentLang = locale.toUpperCase();

  // Disable all tooltips when any dropdown/menu is open to prevent UI overlap
  const anyDropdownOpen = modals.menuOpen || modals.langOpen;

  const changeLanguage = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale });
    setModals((previous) => ({ ...previous, langOpen: false }));
  };

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 w-full transition-transform duration-300 ease-in-out will-change-transform",
          isScrollHidden && "max-sm:-translate-y-full",
        )}
      >
        <nav
          className={cn(
            "relative mx-auto flex w-full max-w-2xl items-center justify-between rounded-b-none border-x-0 border-b panel-border bg-background/70 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 panel-shadow backdrop-blur-md transition-[max-width] duration-300 sm:rounded-b-md sm:border-x sm:px-5 wide:max-w-5xl",
            modals.menuOpen || modals.langOpen ? "z-50" : "z-20",
          )}
          suppressHydrationWarning
        >
          {/* Left controls */}
          <div className="flex min-w-0 items-center justify-start gap-0.5 sm:gap-2 md:gap-4">
            <GameTooltip
              className="cursor-pointer"
              content={t("menu")}
              disabled={anyDropdownOpen}
              disableOnMobile
            >
              <button
                aria-label={t("menu")}
                className="rounded-sm p-1.5 text-foreground transition-colors duration-300 hover:bg-muted/50 hover:text-foreground active:bg-muted/50 active:text-foreground min-[350px]:p-2"
                onClick={() =>
                  setModals((previous) => ({
                    ...previous,
                    menuOpen: !previous.menuOpen,
                  }))
                }
              >
                <Menu className="size-5" />
              </button>
            </GameTooltip>

            <GameTooltip
              className="cursor-pointer max-[280px]:hidden"
              content={t("help")}
              disabled={anyDropdownOpen}
              disableOnMobile
            >
              <button
                aria-label={t("help")}
                className="relative rounded-sm p-1.5 text-foreground transition-colors duration-300 hover:bg-muted/50 hover:text-foreground active:bg-muted/50 active:text-foreground max-[280px]:hidden min-[350px]:p-2"
                onClick={() => {
                  setShowHelpHint(false);
                  setModals((previous) => ({ ...previous, helpOpen: true }));
                }}
              >
                <HelpCircle className="size-5" />
                {showHelpHint ? (
                  <span
                    aria-hidden="true"
                    className="animate-pulse-slow absolute top-0.5 right-0.5 inline-flex size-2 rounded-full bg-amber-500"
                  />
                ) : null}
              </button>
            </GameTooltip>
          </div>

          {/* Logo - Perfectly centered regardless of side icons */}
          <h1 className="absolute top-1/2 left-1/2 -translate-1/2 font-[family-name:var(--font-playfair)] text-2xl font-semibold tracking-tight text-foreground lowercase">
            Eauxle
          </h1>

          {/* Right controls */}
          <div className="flex min-w-0 items-center justify-end gap-0.5 sm:gap-2 md:gap-4">
            {/* Reset Button (Debug) placed before Language */}
            <div className="relative hidden sm:block">
              <ResetButton tooltipDisabled={anyDropdownOpen} />
            </div>

            <GameTooltip
              className="cursor-pointer max-[280px]:hidden"
              content={t("language")}
              disabled={anyDropdownOpen}
              disableOnMobile
            >
              <button
                className="flex items-center gap-1 rounded-sm p-1.5 text-sm font-semibold text-foreground lowercase transition-colors duration-300 hover:bg-muted/50 hover:text-foreground active:bg-muted/50 active:text-foreground max-[280px]:hidden min-[350px]:p-2"
                onClick={() =>
                  setModals((previous) => ({
                    ...previous,
                    langOpen: !previous.langOpen,
                  }))
                }
              >
                {currentLang}
                <ChevronDown className="size-3" />
              </button>
            </GameTooltip>

            <GameTooltip
              className="cursor-pointer max-[280px]:hidden"
              content={t("stats")}
              disabled={anyDropdownOpen}
              disableOnMobile
            >
              <button
                aria-label={t("stats")}
                className="rounded-sm p-1.5 text-foreground transition-colors duration-300 hover:bg-muted/50 hover:text-foreground active:bg-muted/50 active:text-foreground max-[280px]:hidden min-[350px]:p-2"
                onClick={() =>
                  setModals((previous) => ({ ...previous, statsOpen: true }))
                }
              >
                <BarChart3 className="size-5" />
              </button>
            </GameTooltip>
          </div>
        </nav>

        {/* Dropdown positioning layer: sibling of nav so backdrop-blur sees raw page content.
            No aria-hidden on container — accessibility is controlled by visibility on each dropdown:
            closed dropdowns use `invisible` (visibility:hidden) which removes them from tab order
            and the accessibility tree without needing explicit aria-hidden. */}
        <div
          className="pointer-events-none absolute inset-0 mx-auto max-w-2xl wide:max-w-5xl"
        >
          {/* Menu Dropdown */}
          <div
            className={cn(
              "pointer-events-auto absolute top-full left-2 mt-2 flex max-h-[calc(100dvh-5rem)] w-56 max-w-[calc(100vw-16px)] flex-col overflow-x-hidden overflow-y-auto rounded-md border panel-border bg-background/70 panel-shadow backdrop-blur-md transition-all duration-300 min-[350px]:left-5 min-[350px]:max-w-[calc(100vw-40px)]",
              modals.menuOpen
                ? "visible translate-y-0 opacity-100"
                : "invisible pointer-events-none -translate-y-2 opacity-0",
            )}
            style={{ zIndex: 60 }}
          >
            {/* Mobile-only menu items for ultra-low resolutions */}
            <div className="hidden flex-col max-[280px]:flex">
              <button
                className="flex w-full items-center justify-start gap-3 border-b border-border p-3 text-left font-[family-name:var(--font-playfair)] leading-tight text-foreground transition-colors duration-300 hover:bg-muted/50 hover:text-foreground active:bg-muted/50 active:text-foreground min-[350px]:px-5"
                onClick={() => {
                  setModals((previous) => ({
                    ...previous,
                    helpOpen: true,
                    menuOpen: false,
                  }));
                }}
              >
                <HelpCircle className="size-4 shrink-0 text-muted-foreground" />
                {t("help")}
              </button>
              <button
                className="flex w-full items-center justify-start gap-3 border-b border-border p-3 text-left font-[family-name:var(--font-playfair)] leading-tight text-foreground transition-colors duration-300 hover:bg-muted/50 hover:text-foreground active:bg-muted/50 active:text-foreground min-[350px]:px-5"
                onClick={() => {
                  setModals((previous) => ({
                    ...previous,
                    menuOpen: false,
                    statsOpen: true,
                  }));
                }}
              >
                <BarChart3 className="size-4 shrink-0 text-muted-foreground" />
                {t("stats")}
              </button>

              {/* Language Accordion Toggle */}
              <button
                className="flex w-full items-center justify-between border-b border-border p-3 text-left font-[family-name:var(--font-playfair)] leading-tight text-foreground transition-colors duration-300 hover:bg-muted/50 hover:text-foreground active:bg-muted/50 active:text-foreground min-[350px]:px-5"
                onClick={() => {
                  setModals((previous) => ({
                    ...previous,
                    langOpen: !previous.langOpen,
                  }));
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="shrink-0 font-sans text-xs font-semibold text-muted-foreground uppercase">
                    {currentLang}
                  </span>
                  {t("language")}
                </div>
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform duration-300",
                    modals.langOpen && "rotate-180",
                  )}
                />
              </button>

              {/* Language Accordion Content */}
              <div
                className={cn(
                  "flex flex-col overflow-hidden bg-muted/20 transition-all duration-300",
                  modals.langOpen
                    ? "max-h-[500px] border-b border-border"
                    : "max-h-0",
                )}
              >
                {routing.locales.map((lang) => (
                  <button
                    className={cn(
                      "flex w-full items-center gap-3 p-3 text-left leading-tight transition-colors duration-300 min-[350px]:px-5",
                      locale === lang
                        ? "border-l-2 border-primary pl-2 text-foreground min-[350px]:pl-4"
                        : "text-foreground hover:bg-muted/50 hover:text-foreground active:bg-muted/50 active:text-foreground",
                    )}
                    key={lang}
                    onClick={() => changeLanguage(lang)}
                  >
                    <span className="shrink-0 font-sans text-xs text-muted-foreground">
                      {lang}
                    </span>
                    <span className="font-[family-name:var(--font-playfair)] text-sm">
                      {localeNames[lang] ?? lang}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {user ? (
              <>
                <button
                  className="flex w-full items-center justify-between border-b border-border p-3 text-left font-[family-name:var(--font-playfair)] leading-tight text-foreground transition-colors duration-300 hover:bg-muted/50 hover:text-foreground active:bg-muted/50 active:text-foreground min-[350px]:px-5"
                  onClick={() => {
                    setModals((previous) => ({
                      ...previous,
                      menuOpen: false,
                      profileOpen: true,
                    }));
                  }}
                >
                  {t("profile")}
                </button>

                {user.is_anonymous ? (
                  <>
                    <button
                      className="w-full border-b border-border p-3 text-left font-[family-name:var(--font-playfair)] leading-tight text-foreground transition-colors duration-300 hover:bg-muted/50 hover:text-foreground active:bg-muted/50 active:text-foreground min-[350px]:px-5"
                      onClick={() => openAuth("login")}
                    >
                      {t("signIn")}
                    </button>
                    <button
                      className="w-full border-b border-border p-3 text-left font-[family-name:var(--font-playfair)] leading-tight text-foreground transition-colors duration-300 hover:bg-muted/50 hover:text-foreground active:bg-muted/50 active:text-foreground min-[350px]:px-5"
                      onClick={() => openAuth("register")}
                    >
                      {t("createAccount")}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="w-full border-b border-border p-3 text-left font-[family-name:var(--font-playfair)] leading-tight text-foreground transition-colors duration-300 hover:bg-muted/50 hover:text-foreground active:bg-muted/50 active:text-foreground min-[350px]:px-5"
                      onClick={async () => {
                        setModals((previous) => ({
                          ...previous,
                          menuOpen: false,
                        }));
                        const { createClient } =
                          await import("@/lib/supabase/client");
                        const supabase = createClient();
                        await supabase.auth.signOut();
                        // Hard reload: reinitializes GameProvider with a new anonymous session,
                        // which restores the "Zobacz profil" button in the menu.
                        globalThis.location.reload();
                      }}
                    >
                      {t("signOut")}
                    </button>
                    <button
                      className="w-full border-b border-border p-3 text-left font-[family-name:var(--font-playfair)] leading-tight text-foreground transition-colors duration-300 hover:bg-muted/50 hover:text-foreground active:bg-muted/50 active:text-foreground min-[350px]:px-5"
                      onClick={() => {
                        setModals((previous) => ({
                          ...previous,
                          menuOpen: false,
                          sessionsOpen: true,
                        }));
                      }}
                    >
                      {t("manageSessions")}
                    </button>
                  </>
                )}
              </>
            ) : (
              <>
                <button
                  className="w-full border-b border-border p-3 text-left font-[family-name:var(--font-playfair)] leading-tight text-foreground transition-colors duration-300 hover:bg-muted/50 hover:text-foreground active:bg-muted/50 active:text-foreground min-[350px]:px-5"
                  onClick={() => openAuth("login")}
                >
                  {t("signIn")}
                </button>
                <button
                  className="w-full border-b border-border p-3 text-left font-[family-name:var(--font-playfair)] leading-tight text-foreground transition-colors duration-300 hover:bg-muted/50 hover:text-foreground active:bg-muted/50 active:text-foreground min-[350px]:px-5"
                  onClick={() => openAuth("register")}
                >
                  {t("createAccount")}
                </button>
              </>
            )}

            <button
              className="border-b border-border p-3 text-left font-[family-name:var(--font-playfair)] leading-tight text-foreground transition-colors duration-300 hover:bg-muted/50 hover:text-foreground active:bg-muted/50 active:text-foreground min-[350px]:px-5"
              onClick={() => {
                toast.info(t("comingSoon"));
                setModals((previous) => ({ ...previous, menuOpen: false }));
              }}
            >
              {t("about")}
            </button>

            {/* Appearance Section */}
            <div className="border-b border-border bg-muted/20 p-3 min-[350px]:px-5">
              <h3 className="mb-3 text-[0.625rem] font-semibold tracking-widest text-muted-foreground uppercase">
                {t("appearance")}
              </h3>
              <div className="space-y-3">
                {/* Wide Layout Toggle */}
                <button
                  className="group hidden w-full items-center justify-between text-foreground transition-colors hover:text-primary lg:flex"
                  onClick={toggleLayoutMode}
                >
                  <div className="flex items-center gap-2">
                    <Monitor className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                    <span className="text-left font-sans text-xs leading-tight">
                      {t("wideLayout")}
                    </span>
                  </div>
                  <TogglePill isOn={uiPreferences.layoutMode === "wide"} />
                </button>

                {/* Large Text Toggle */}
                <button
                  className="group flex w-full items-center justify-between gap-2 text-foreground transition-colors hover:text-primary"
                  onClick={toggleFontScale}
                >
                  <div className="flex items-center gap-2">
                    <Type className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                    <span className="text-left font-sans text-xs leading-tight">
                      {t("largeText")}
                    </span>
                  </div>
                  <TogglePill isOn={uiPreferences.fontScale === "large"} />
                </button>

                {/* Dark Mode Toggle */}
                <button
                  className="group flex w-full items-center justify-between gap-2 text-foreground transition-colors hover:text-primary"
                  onClick={toggleTheme}
                >
                  <div className="flex items-center gap-2">
                    <Moon className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                    <span className="text-left font-sans text-xs leading-tight">
                      {t("darkMode")}
                    </span>
                  </div>
                  <TogglePill isOn={uiPreferences.theme === "dark"} />
                </button>

                {/* Auto Scroll Toggle */}
                <button
                  className="group flex w-full items-center justify-between gap-2 text-foreground transition-colors hover:text-primary"
                  onClick={toggleAutoScroll}
                >
                  <div className="flex items-center gap-2">
                    <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                    <span className="text-left font-sans text-xs leading-tight">
                      {t("autoScroll")}
                    </span>
                  </div>
                  <TogglePill isOn={uiPreferences.autoScroll} />
                </button>
              </div>
            </div>

            {/* Mobile Reset Action */}
            <MobileResetItem />

            <button
              className="px-5 py-3 text-left font-[family-name:var(--font-playfair)] text-foreground transition-colors duration-300 hover:bg-muted/50 hover:text-foreground active:bg-muted/50 active:text-foreground"
              onClick={() => {
                toast.info(t("comingSoon"));
                setModals((previous) => ({ ...previous, menuOpen: false }));
              }}
            >
              {t("support")}
            </button>
          </div>

          {/* Language Dropdown */}
          <div
            className={cn(
              "pointer-events-auto absolute top-full right-16 mt-2 flex max-h-[calc(100dvh-5rem)] w-36 max-w-[calc(100vw-84px)] flex-col overflow-x-hidden overflow-y-auto rounded-md border panel-border bg-background/70 panel-shadow backdrop-blur-md transition-all duration-300 max-[280px]:hidden",
              modals.langOpen
                ? "visible translate-y-0 opacity-100"
                : "invisible pointer-events-none -translate-y-2 opacity-0",
            )}
            style={{ zIndex: 60 }}
          >
            {routing.locales.map((lang) => (
              <button
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-300",
                  locale === lang
                    ? "border-l-2 border-primary pl-3 text-foreground"
                    : "text-foreground hover:bg-muted/50 hover:text-foreground active:bg-muted/50 active:text-foreground",
                )}
                key={lang}
                onClick={() => changeLanguage(lang)}
              >
                <span className="font-sans text-xs text-muted-foreground">
                  {lang}
                </span>
                <span className="font-[family-name:var(--font-playfair)] text-sm">
                  {localeNames[lang] ?? lang}
                </span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Click outside to close dropdowns */}
      {modals.menuOpen || modals.langOpen ? (
        <div
          aria-label="Close menu"
          className="fixed inset-0 z-40"
          onClick={() => {
            setModals((previous) => ({
              ...previous,
              langOpen: false,
              menuOpen: false,
            }));
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setModals((previous) => ({
                ...previous,
                langOpen: false,
                menuOpen: false,
              }));
            }
          }}
          role="button"
          tabIndex={-1}
        />
      ) : null}

      <HelpModal
        onClose={() => {
          try {
            localStorage.setItem("eauxle:hasVisited", "1");
          } catch {
            // localStorage may be unavailable in some environments
          }
          setModals((previous) => ({ ...previous, helpOpen: false }));
        }}
        open={modals.helpOpen}
      />
      <StatsModal
        onClose={() =>
          setModals((previous) => ({ ...previous, statsOpen: false }))
        }
        open={modals.statsOpen}
      />
      <AuthModal
        defaultView={modals.authView}
        isOpen={modals.authOpen}
        onOpenChange={(open) =>
          setModals((previous) => ({ ...previous, authOpen: open }))
        }
      />

      {user ? (
        <>
          <SessionsModal
            onClose={() =>
              setModals((previous) => ({ ...previous, sessionsOpen: false }))
            }
            open={modals.sessionsOpen}
            user={user}
          />
          <ProfileModal
            onClose={() =>
              setModals((previous) => ({ ...previous, profileOpen: false }))
            }
            open={modals.profileOpen}
            user={user}
          />
        </>
      ) : null}
    </>
  );
}
