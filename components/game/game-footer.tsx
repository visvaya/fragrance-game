"use client"
import { useGame } from "./game-provider"
import { cn } from "@/lib/utils"

import { useTranslations } from "next-intl"

export function GameFooter() {
  const { gameState, uiPreferences } = useGame()
  const t = useTranslations('Footer')


  return (
    <footer className="w-full bg-secondary border-t border-border mt-auto pb-[env(safe-area-inset-bottom)]">
      <div className={cn(
        "mx-auto px-5 py-10 flex flex-col items-center gap-4 relative transition-all duration-300",
        uiPreferences.layoutMode === 'wide' ? "max-w-5xl" : "max-w-xl"
      )}>
        {/* Helper Text - visible only when playing */}
        {gameState === 'playing' && (
          <p className="absolute right-7 top-2 font-[family-name:var(--font-hand)] text-base text-primary/70 rotate-[-3deg] pointer-events-none whitespace-nowrap">
            {t('selectHelper')}
          </p>
        )}

        {/* Links */}
        <div className="flex gap-6">
          <a
            href="#"
            className="font-[family-name:var(--font-playfair)] italic text-sm text-foreground hover:text-primary hover:underline transition-colors duration-300"
          >
            {t('contact')}
          </a>
          <a
            href="#"
            className="font-[family-name:var(--font-playfair)] italic text-sm text-foreground hover:text-primary hover:underline transition-colors duration-300"
          >
            {t('privacy')}
          </a>
          <a
            href="#"
            className="font-[family-name:var(--font-playfair)] italic text-sm text-foreground hover:text-primary hover:underline transition-colors duration-300"
          >
            {t('terms')}
          </a>
        </div>

        {/* Copyright */}
        <p className="text-xs text-muted-foreground">{t('copyright')}</p>

        {/* Decorative handwritten note */}
        <p className="font-[family-name:var(--font-hand)] text-lg text-muted-foreground/60 italic mt-2 rotate-[-2deg]">
          {t('slogan')}
        </p>
      </div>
    </footer>
  )
}
