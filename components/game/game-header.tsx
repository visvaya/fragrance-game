"use client";

import { useState, useEffect } from "react";

import dynamic from "next/dynamic";

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
import { toast } from "sonner";

import { revokeAllSessions } from "@/app/actions/auth-actions";
import { AuthModal } from "@/components/auth/auth-modal";
import { Button } from "@/components/ui/button";

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
import { useScrollDirection } from "@/hooks/use-scroll-direction";
import { usePathname, useRouter, routing, localeNames } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

import { useUIPreferences } from "./contexts";
import { GameTooltip } from "./game-tooltip";
import { MobileResetItem } from "./mobile-reset-item";
import { ResetButton } from "./reset-button";

/**
 *
 */
export function GameHeader() {
  const { toggleFontScale, toggleLayoutMode, toggleTheme, uiPreferences } =
    useUIPreferences();
  const isScrollHidden = useScrollDirection();
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
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // Show help modal on first visit. We intentionally do NOT write
    // eauxle:hasVisited here — it's written when the modal is closed.
    // This way React StrictMode's simulated remount (which resets state)
    // doesn't prevent the modal from reopening after the simulated unmount.
    try {
      if (!localStorage.getItem("eauxle:hasVisited")) {
        setModals((previous) => ({ ...previous, helpOpen: true }));
      }
    } catch {
      // localStorage may be unavailable in some environments
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      // Skip refresh for anonymous sign-in: anonymous sessions are created
      // automatically on every page load, and router.refresh() would remount
      // client components, resetting transient UI state (e.g. open modals).
      const isAnonymousSignIn =
        _event === "SIGNED_IN" && session?.user?.is_anonymous === true;
      if (
        (_event === "SIGNED_IN" || _event === "SIGNED_OUT") &&
        !isAnonymousSignIn
      ) {
        router.refresh();
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

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
          "sticky top-0 z-50 w-full transition-transform duration-300 ease-in-out",
          isScrollHidden && "max-sm:-translate-y-full",
        )}
      >
        <nav
          className={cn(
            "layout-container relative mx-auto flex w-full items-center justify-between rounded-b-none border-x-0 border-b border-border/50 bg-background/70 px-5 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 backdrop-blur-md transition-all duration-300 sm:rounded-b-md sm:border-x",
            uiPreferences.layoutMode === "wide" ? "max-w-5xl" : "max-w-2xl",
            modals.menuOpen || modals.langOpen ? "z-50" : "z-20",
          )}
          suppressHydrationWarning
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
                onClick={() =>
                  setModals((previous) => ({
                    ...previous,
                    menuOpen: !previous.menuOpen,
                  }))
                }
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
                onClick={() =>
                  setModals((previous) => ({ ...previous, helpOpen: true }))
                }
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
                onClick={() =>
                  setModals((previous) => ({
                    ...previous,
                    langOpen: !previous.langOpen,
                  }))
                }
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
                onClick={() =>
                  setModals((previous) => ({ ...previous, statsOpen: true }))
                }
              >
                <BarChart3 className="h-5 w-5" />
              </button>
            </GameTooltip>
          </div>

          {/* Menu Dropdown */}
          <div
            className={cn(
              "!absolute top-full left-5 mt-2 w-56 flex-col overflow-hidden rounded-md border border-border/50 bg-background/95 shadow-2xl shadow-black/10 backdrop-blur-md transition-all duration-300",
              modals.menuOpen
                ? "flex translate-y-0 opacity-100"
                : "hidden -translate-y-2 opacity-0",
            )}
          >
            {user ? (
              <>
                <button
                  className="flex w-full items-center justify-between border-b border-border px-5 py-3 font-[family-name:var(--font-playfair)] text-foreground transition-all duration-300 hover:pl-6 hover:text-primary"
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
                      className="w-full border-b border-border px-5 py-3 text-left font-[family-name:var(--font-playfair)] text-foreground transition-all duration-300 hover:pl-6 hover:text-primary"
                      onClick={() => openAuth("login")}
                    >
                      {t("signIn")}
                    </button>
                    <button
                      className="w-full border-b border-border px-5 py-3 text-left font-[family-name:var(--font-playfair)] text-foreground transition-all duration-300 hover:pl-6 hover:text-primary"
                      onClick={() => openAuth("register")}
                    >
                      {t("createAccount")}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="w-full border-b border-border px-5 py-3 text-left font-[family-name:var(--font-playfair)] text-foreground transition-all duration-300 hover:pl-6 hover:text-primary"
                      onClick={async () => {
                        setModals((previous) => ({
                          ...previous,
                          menuOpen: false,
                        }));
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
                      className="w-full border-b border-border px-5 py-3 text-left font-[family-name:var(--font-playfair)] text-foreground transition-all duration-300 hover:pl-6 hover:text-primary"
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
                  className="w-full border-b border-border px-5 py-3 text-left font-[family-name:var(--font-playfair)] text-foreground transition-all duration-300 hover:pl-6 hover:text-primary"
                  onClick={() => openAuth("login")}
                >
                  {t("signIn")}
                </button>
                <button
                  className="w-full border-b border-border px-5 py-3 text-left font-[family-name:var(--font-playfair)] text-foreground transition-all duration-300 hover:pl-6 hover:text-primary"
                  onClick={() => openAuth("register")}
                >
                  {t("createAccount")}
                </button>
              </>
            )}

            <button
              className="border-b border-border px-5 py-3 text-left font-[family-name:var(--font-playfair)] text-foreground transition-all duration-300 hover:pl-6 hover:text-primary"
              onClick={() => {
                toast.info(t("comingSoon"));
                setModals((previous) => ({ ...previous, menuOpen: false }));
              }}
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
              "!absolute top-full right-16 mt-2 w-24 flex-col overflow-hidden rounded-md border border-border/50 bg-background/95 shadow-2xl shadow-black/10 backdrop-blur-md transition-all duration-300",
              modals.langOpen
                ? "flex translate-y-0 opacity-100"
                : "hidden -translate-y-2 opacity-0",
            )}
          >
            {routing.locales.map((lang) => (
              <button
                className={cn(
                  "px-4 py-2 text-center text-sm font-semibold transition-colors duration-300",
                  locale === lang
                    ? "text-foreground underline underline-offset-4"
                    : "text-foreground hover:bg-muted/30 hover:text-primary",
                )}
                key={lang}
                onClick={() => changeLanguage(lang)}
              >
                {localeNames[lang] || lang.toUpperCase()}
              </button>
            ))}
          </div>
        </nav>
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
