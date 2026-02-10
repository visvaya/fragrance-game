"use client";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { useGame } from "./game-provider";

/**
 *
 */
export function GameFooter() {
  const { gameState, uiPreferences } = useGame();
  const t = useTranslations("Footer");

  return (
    <footer className="mt-auto w-full border-t border-border bg-secondary pb-[env(safe-area-inset-bottom)]">
      <div
        className={cn(
          "relative mx-auto flex flex-col items-center gap-4 px-5 py-10 transition-all duration-300",
          uiPreferences.layoutMode === "wide" ? "max-w-5xl" : "max-w-xl",
        )}
      >
        {/* Helper Text - visible only when playing */}
        {gameState === "playing" && (
          <p className="pointer-events-none absolute top-2 right-7 rotate-[-3deg] font-[family-name:var(--font-hand)] text-base whitespace-nowrap text-primary/70">
            {t("selectHelper")}
          </p>
        )}

        {/* Links */}
        <div className="flex gap-6">
          <a
            className="font-[family-name:var(--font-playfair)] text-sm text-foreground italic transition-colors duration-300 hover:text-primary hover:underline"
            href="#"
          >
            {t("contact")}
          </a>
          <a
            className="font-[family-name:var(--font-playfair)] text-sm text-foreground italic transition-colors duration-300 hover:text-primary hover:underline"
            href="#"
          >
            {t("privacy")}
          </a>
          <a
            className="font-[family-name:var(--font-playfair)] text-sm text-foreground italic transition-colors duration-300 hover:text-primary hover:underline"
            href="#"
          >
            {t("terms")}
          </a>
        </div>

        {/* Copyright */}
        <p className="text-xs text-muted-foreground">{t("copyright")}</p>

        {/* Decorative handwritten note */}
        <p className="mt-2 rotate-[-2deg] font-[family-name:var(--font-hand)] text-lg text-muted-foreground/60 italic">
          {t("slogan")}
        </p>
      </div>
    </footer>
  );
}
