"use client";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

import { useGameState, useUIPreferences } from "./contexts";

/**
 * Stopka aplikacji w stylu "Elegant French Perfumery".
 * Zoptymalizowany układ dla różnych rozdzielczości i poprawiona czytelność.
 */
export function GameFooter() {
  const { attempts, gameState } = useGameState();
  const { isInputFocused, uiPreferences } = useUIPreferences();
  const t = useTranslations("Footer");

  return (
    <footer className="relative z-10 w-full border-t border-border bg-secondary pb-[env(safe-area-inset-bottom)]">
      <div
        className={cn(
          "relative mx-auto flex flex-col items-center px-5 pt-8 pb-8 transition-all duration-300",
          uiPreferences.layoutMode === "wide" ? "max-w-5xl" : "max-w-2xl",
        )}
      >
        {/* Helper Text removed - moved to game-input.tsx as sticky tooltip */}

        {/* Links Group - Stable layout for mobile (column) and desktop (row) */}

        {/* Links Group - Stable layout for mobile (column) and desktop (row) */}
        <nav className="mb-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-x-10 sm:gap-y-0">
          <button
            className="font-[family-name:var(--font-playfair)] text-sm text-foreground/80 italic transition-all duration-300 hover:text-primary"
            onClick={() => toast.info(t("comingSoon"))}
          >
            {t("contact")}
          </button>
          <button
            className="font-[family-name:var(--font-playfair)] text-sm text-foreground/80 italic transition-all duration-300 hover:text-primary"
            onClick={() => toast.info(t("comingSoon"))}
          >
            {t("privacy")}
          </button>
          <button
            className="font-[family-name:var(--font-playfair)] text-sm text-foreground/80 italic transition-all duration-300 hover:text-primary"
            onClick={() => toast.info(t("comingSoon"))}
          >
            {t("terms")}
          </button>
        </nav>

        {/* Branding & Info */}
        <div className="flex w-full max-w-[280px] flex-col items-center gap-2 border-t border-border/30 pt-6 text-center">
          <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            {t("copyright")}
          </p>
          <p className="rotate-[-1deg] font-hand text-lg text-muted-foreground/60 italic">
            {t("slogan")}
          </p>
        </div>
      </div>
    </footer>
  );
}
