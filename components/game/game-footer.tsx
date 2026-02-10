"use client";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { useGame } from "./game-provider";

/**
 * Stopka aplikacji w stylu "Elegant French Perfumery".
 * Zoptymalizowany układ dla różnych rozdzielczości i poprawiona czytelność.
 */
export function GameFooter() {
  const { gameState, uiPreferences, attempts, isInputFocused } = useGame();
  const t = useTranslations("Footer");


  return (
    <footer className="w-full border-t border-border bg-secondary/50 pb-[env(safe-area-inset-bottom)]">
      <div
        className={cn(
          "relative mx-auto flex flex-col items-center px-5 pt-8 pb-8 transition-all duration-300",
          uiPreferences.layoutMode === "wide" ? "max-w-5xl" : "max-w-xl",
        )}
      >
        {/* Helper Text - Reinstated in Footer, animated fade out on focus */}
        <div
          className={cn(
            "absolute top-2 right-7 pointer-events-none transition-all duration-500 ease-in-out",
            attempts.length === 0 && !isInputFocused
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-4"
          )}
        >
          <p className="rotate-[-3deg] font-[family-name:var(--font-hand)] text-base whitespace-nowrap text-primary/70">
            {t("selectHelper")} ↑
          </p>
        </div>

        {/* Links Group - Stable layout for mobile (column) and desktop (row) */}

        {/* Links Group - Stable layout for mobile (column) and desktop (row) */}
        <nav className="mb-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-x-10 sm:gap-y-0">
          <a
            className="font-[family-name:var(--font-playfair)] text-sm text-foreground/80 italic transition-all duration-300 hover:text-primary"
            href="#"
          >
            {t("contact")}
          </a>
          <a
            className="font-[family-name:var(--font-playfair)] text-sm text-foreground/80 italic transition-all duration-300 hover:text-primary"
            href={null as any}
          >
            {t("privacy")}
          </a>
          <a
            className="font-[family-name:var(--font-playfair)] text-sm text-foreground/80 italic transition-all duration-300 hover:text-primary"
            href={null as any}
          >
            {t("terms")}
          </a>
        </nav>

        {/* Branding & Info */}
        <div className="flex flex-col items-center gap-2 border-t border-border/30 pt-6 w-full max-w-[280px] text-center">
          <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            {t("copyright")}
          </p>
          <p className="rotate-[-1deg] font-[family-name:var(--font-hand)] text-lg text-muted-foreground/60 italic">
            {t("slogan")}
          </p>
        </div>
      </div>
    </footer>
  );
}
