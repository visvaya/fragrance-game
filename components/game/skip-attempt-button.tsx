"use client";

import { useState } from "react";

import { SkipForward } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

import { GameTooltip } from "./game-tooltip";

/**
 * Skip button of the guess input. On touch screens a skip is confirmed in a dialog first,
 * because the button sits next to the keyboard and is easy to hit by accident.
 * @param props - Component props.
 * @param props.busy - The game is loading or rate limited; the button is dimmed.
 * @param props.isRateLimited - Shows the rate-limit warning instead of skipping.
 * @param props.onSkip - Skips the current attempt.
 * @param props.ready - The player is signed in; the first skip starts the game session.
 */
export function SkipAttemptButton({
  busy,
  isRateLimited,
  onSkip,
  ready,
}: Readonly<{
  busy: boolean;
  isRateLimited: boolean;
  onSkip: () => void;
  ready: boolean;
}>) {
  const t = useTranslations("Game.input");
  const tActions = useTranslations("GameActions");
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <>
      <GameTooltip
        content={t("skipTooltip")}
        disabled={busy}
        disableOnMobile
        sideOffset={8}
      >
        <button
          aria-label={t("skipTooltip")}
          className={cn(
            "flex size-7 items-center justify-center rounded-sm text-muted-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-30",
            busy
              ? "cursor-not-allowed opacity-30"
              : "hover:bg-muted/50 hover:text-foreground active:bg-primary/15 active:duration-0",
          )}
          disabled={!ready || busy}
          onClick={() => {
            if (isRateLimited) {
              toast.warning(tActions("rateLimitError"));
              return;
            }
            if (
              globalThis.matchMedia("(hover: none) and (pointer: coarse)")
                .matches
            ) {
              setShowConfirm(true);
            } else {
              onSkip();
            }
          }}
          type="button"
        >
          <SkipForward className="size-3.5" />
        </button>
      </GameTooltip>

      <AlertDialog onOpenChange={setShowConfirm} open={showConfirm}>
        <AlertDialogContent onClickOutside={() => setShowConfirm(false)}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("skipConfirmTitle")}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("skipConfirmCancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={onSkip}>
              {t("skipConfirmConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
