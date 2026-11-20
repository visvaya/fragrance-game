"use client";

import { useId, useRef, useState } from "react";

import { Check, Loader2, SkipForward, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useMountEffect } from "@/lib/hooks/use-mount-effect";
import { cn } from "@/lib/utils";

import { GameTooltip } from "./game-tooltip";

// A 28 px icon button with a 44 px touch area around it, so the status bar keeps its height.
const ICON_BUTTON =
  "relative flex size-7 items-center justify-center rounded-full transition-colors after:absolute after:-inset-2";

/**
 * The question that replaces the skip icon on a touch screen. Focus moves to cancel, so a
 * screen reader lands on the question; a tap elsewhere or Escape closes it without a skip.
 * @param props - Component props.
 * @param props.onCancel - Closes the question.
 * @param props.onConfirm - Skips the current attempt.
 */
function SkipConfirm({
  onCancel,
  onConfirm,
}: Readonly<{ onCancel: () => void; onConfirm: () => void }>) {
  const t = useTranslations("Game.input");
  const labelId = useId();
  const groupReference = useRef<HTMLFieldSetElement>(null);
  const cancelReference = useRef<HTMLButtonElement>(null);

  useMountEffect(() => {
    cancelReference.current?.focus();
    const handlePointerDown = (event: PointerEvent) => {
      if (!groupReference.current?.contains(event.target as Node)) onCancel();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  });

  return (
    <fieldset
      aria-labelledby={labelId}
      className="m-0 flex min-w-0 items-center gap-2 border-0 p-0"
      ref={groupReference}
    >
      <span className="text-foreground" id={labelId}>
        {t("skipConfirmTitle")}
      </span>
      <button
        aria-label={t("skipConfirmCancel")}
        className={cn(ICON_BUTTON, "text-muted-foreground hover:bg-muted/50")}
        onClick={onCancel}
        ref={cancelReference}
        type="button"
      >
        <X className="size-3.5" />
      </button>
      <button
        aria-label={t("skipConfirmConfirm")}
        className={cn(ICON_BUTTON, "bg-primary text-primary-foreground")}
        onClick={onConfirm}
        type="button"
      >
        <Check className="size-3.5" />
      </button>
    </fieldset>
  );
}

/**
 * Skip button of the guess input. On touch screens a skip is confirmed in place first,
 * because the button sits next to the keyboard and is easy to hit by accident; a dialog was
 * used before and took over a second to open on a slow phone.
 * @param props - Component props.
 * @param props.busy - The game is loading or rate limited; the button is dimmed.
 * @param props.isRateLimited - Shows the rate-limit warning instead of skipping.
 * @param props.onSkip - Skips the current attempt.
 * @param props.pending - A skip is queued until the sign-in finishes; the button shows a spinner.
 */
export function SkipAttemptButton({
  busy,
  isRateLimited,
  onSkip,
  pending,
}: Readonly<{
  busy: boolean;
  isRateLimited: boolean;
  onSkip: () => void;
  pending: boolean;
}>) {
  const t = useTranslations("Game.input");
  const tActions = useTranslations("GameActions");
  const [showConfirm, setShowConfirm] = useState(false);

  if (showConfirm) {
    return (
      <SkipConfirm
        onCancel={() => setShowConfirm(false)}
        onConfirm={() => {
          setShowConfirm(false);
          onSkip();
        }}
      />
    );
  }

  return (
    <GameTooltip
      content={t("skipTooltip")}
      disabled={busy}
      disableOnMobile
      sideOffset={8}
    >
      <button
        aria-busy={pending}
        aria-label={t("skipTooltip")}
        className={cn(
          "flex size-7 items-center justify-center rounded-sm text-muted-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-30",
          busy
            ? "cursor-not-allowed opacity-30"
            : "hover:bg-muted/50 hover:text-foreground active:bg-primary/15 active:duration-0",
        )}
        disabled={busy || pending}
        onClick={() => {
          if (isRateLimited) {
            toast.warning(tActions("rateLimitError"));
            return;
          }
          if (
            globalThis.matchMedia("(hover: none) and (pointer: coarse)").matches
          ) {
            setShowConfirm(true);
          } else {
            onSkip();
          }
        }}
        type="button"
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <SkipForward className="size-3.5" />
        )}
      </button>
    </GameTooltip>
  );
}
