"use client";

import { useState } from "react";

import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { useGame } from "./game-provider";

/**
 * Mobile-specific reset item for the GameHeader menu.
 * Provides inline confirmation instead of a popover to avoid overflow issues.
 */
export function MobileResetItem() {
  const { resetGame } = useGame();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const t = useTranslations("ResetButton");

  const handleConfirmedReset = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResetting(true);
    try {
      await resetGame();
    } finally {
      setIsResetting(false);
      setShowConfirm(false);
    }
  };

  const handleToggleConfirm = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowConfirm(true);
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowConfirm(false);
  };

  if (!showConfirm) {
    return (
      <button
        className="flex w-full items-center justify-between border-b border-border px-5 py-3 font-[family-name:var(--font-playfair)] text-foreground transition-all duration-300 hover:pl-6 hover:text-primary sm:hidden"
        onClick={handleToggleConfirm}
      >
        <span>{t("confirm")}</span>
      </button>
    );
  }

  return (
    <div className="flex w-full items-center justify-between border-b border-border bg-muted/20 px-5 py-3 sm:hidden">
      <span className="shrink-0 font-sans text-xs font-semibold text-primary uppercase">
        {t("question")}
      </span>
      <div className="flex items-center gap-2">
        <button
          aria-label={t("cancel")}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/50 text-muted-foreground transition-colors hover:bg-muted"
          disabled={isResetting}
          onClick={handleCancel}
        >
          <X className="h-4 w-4" />
        </button>
        <button
          aria-label={t("confirm")}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
          disabled={isResetting}
          onClick={handleConfirmedReset}
        >
          {isResetting ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
          ) : (
            <Check className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
