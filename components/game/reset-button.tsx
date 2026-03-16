"use client";

import { useState } from "react";

import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { env } from "@/lib/env";

import { useGameActions } from "./contexts";

// Debug component: enabled only when NEXT_PUBLIC_GAME_RESET_ENABLED=true
/**
 * Button to reset the game state (available only in development/test mode).
 * @param props - Component properties.
 * @param props.tooltipDisabled - Whether the tooltip should be disabled.
 */
export function ResetButton({
  tooltipDisabled = false,
}: Readonly<{ tooltipDisabled?: boolean }>) {
  const { resetGame } = useGameActions();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const t = useTranslations("ResetButton");

  if (env.NEXT_PUBLIC_GAME_RESET_ENABLED !== "true") return null;

  const handleConfirmedReset = async () => {
    setIsResetting(true);
    try {
      await resetGame();
      setIsResetting(false);
      setShowConfirm(false);
    } catch (error) {
      setIsResetting(false);
      setShowConfirm(false);
      throw error;
    }
  };

  return (
    <>
      <TooltipProvider delayDuration={0}>
        <Tooltip
          onOpenChange={setTooltipOpen}
          open={tooltipDisabled ? false : tooltipOpen}
        >
          <TooltipTrigger asChild>
            <button
              aria-label={t("ariaLabel")}
              className="flex items-center justify-center rounded-sm p-2 text-foreground/70 transition-colors duration-300 hover:bg-muted/50 hover:text-foreground active:bg-muted/50 active:text-foreground"
              onClick={() => setShowConfirm(true)}
            >
              <RotateCcw size={18} />
            </button>
          </TooltipTrigger>
          <TooltipContent>{t("tooltip")}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {showConfirm ? (
        <div className="absolute top-full right-0 z-50 mt-2 w-max rounded border border-border bg-card px-4 py-2 text-card-foreground shadow-lg">
          <p className="mb-2 text-sm font-semibold">{t("question")}</p>
          <div className="flex justify-end gap-2">
            <button
              className="px-2 py-1 text-xs hover:underline disabled:opacity-50"
              disabled={isResetting}
              onClick={() => setShowConfirm(false)}
            >
              {t("cancel")}
            </button>
            <button
              className="rounded bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              disabled={isResetting}
              onClick={handleConfirmedReset}
            >
              {isResetting ? "..." : t("confirm")}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
