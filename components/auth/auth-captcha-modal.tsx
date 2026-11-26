"use client";

import { useState } from "react";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import type { CaptchaStage } from "@/components/game/use-captcha-stage";
import type { TurnstileErrorKind } from "@/lib/auth/turnstile-error";
import { useScrollLock } from "@/lib/hooks/use-scroll-lock";
import { cn } from "@/lib/utils";

import { Captcha } from "./captcha";

type AuthCaptchaModalProperties = {
  /** Why the check failed, shown in the "failed" stage. */
  readonly failure: TurnstileErrorKind;
  /**
   * The widget reported an error, the script did not load or the browser is unsupported; an
   * invisible widget would leave the dialog empty.
   */
  readonly onFail: (kind: TurnstileErrorKind) => void;
  /** Tells the provider that Cloudflare wants a click. */
  readonly onNeedsAttention: () => void;
  readonly onVerify: (token: string) => void;
  /** Stage of the check; "none" unmounts the dialog instead (see CaptchaStage). */
  readonly stage: Exclude<CaptchaStage, "none">;
  /**
   * Shows the widget from the start instead of only when Cloudflare asks for a click. Used after
   * a rejected sign-in, when the dialog is already open and must not stay empty.
   */
  readonly widgetVisible: boolean;
};

/**
 * Turnstile check for anonymous sign-in. The widget is mounted at once in its invisible
 * "interaction-only" mode, so most players get a token without seeing anything; the dialog
 * appears only when Cloudflare asks for a click or the check failed. It stays mounted (not a
 * Radix dialog, which would unmount the closed content and lose the widget), and it is inert
 * while hidden so neither the pointer nor the keyboard reaches it.
 */
export function AuthCaptchaModal({
  failure,
  onFail,
  onNeedsAttention,
  onVerify,
  stage,
  widgetVisible,
}: AuthCaptchaModalProperties) {
  const t = useTranslations("Auth.register");
  const tError = useTranslations("Auth.captchaErrors");
  const isVisible = stage !== "pending" && stage !== "attention";
  const [widgetLoaded, setWidgetLoaded] = useState(false);
  useScrollLock(isVisible);
  // A visible widget shows its own placeholder until it loads.
  const isLoading =
    stage === "waiting" ||
    (stage === "interactive" && !widgetLoaded && !widgetVisible);

  return (
    <div
      aria-hidden={!isVisible}
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4",
        isVisible
          ? "bg-black/50 backdrop-blur-sm"
          : "pointer-events-none opacity-0",
      )}
      inert={!isVisible}
    >
      <div
        aria-describedby="anonymous-captcha-description"
        aria-labelledby="anonymous-captcha-title"
        aria-modal={isVisible}
        className="w-full max-w-md rounded-md border panel-border bg-background px-4 py-6 panel-shadow outline-none sm:px-6"
        // Moves focus into the dialog when it appears or changes stage (unless focus is already
        // inside, such as in the widget) and gives it back to the page element that had it
        // when the dialog closes. Reading `stage` makes the callback run again when the widget
        // is replaced by the reload offer, which would otherwise drop focus to the page.
        ref={(node) => {
          if (stage === "pending" || stage === "attention" || !node) return;
          const previous = document.activeElement;
          if (!node.contains(previous)) node.focus();
          return () => {
            if (previous instanceof HTMLElement && previous.isConnected)
              previous.focus();
          };
        }}
        role="alertdialog"
        tabIndex={-1}
      >
        <h2
          className="font-[family-name:var(--font-playfair)] text-lg text-foreground"
          id="anonymous-captcha-title"
        >
          {t("captchaTitle")}
        </h2>
        <p
          className="mt-2 text-sm text-muted-foreground"
          id="anonymous-captcha-description"
        >
          {stage === "failed" ? tError(failure) : t("captchaDescription")}
        </p>
        {isLoading ? (
          <output className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2
              aria-hidden="true"
              className="size-4 animate-spin motion-reduce:animate-none"
            />
            {t("captchaLoading")}
          </output>
        ) : null}
        {stage === "failed" ? (
          <div className="mt-4 flex justify-end">
            <Button onClick={() => globalThis.location.reload()} type="button">
              {t("captchaReload")}
            </Button>
          </div>
        ) : (
          // Narrow side padding: the widget is 300 px wide and must fit a 375 px phone.
          <div
            className={cn(
              "flex justify-center",
              (widgetVisible || stage === "interactive") && "py-4",
            )}
          >
            <Captcha
              appearance={widgetVisible ? "always" : "interaction-only"}
              onBeforeInteractive={onNeedsAttention}
              onFail={onFail}
              onVerify={onVerify}
              onWidgetLoad={() => setWidgetLoaded(true)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
