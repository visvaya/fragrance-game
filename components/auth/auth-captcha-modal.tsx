"use client";

import { useState } from "react";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { useScrollLock } from "@/lib/hooks/use-scroll-lock";
import { cn } from "@/lib/utils";

import { Captcha } from "./captcha";

type AuthCaptchaModalProperties = {
  /** Asks the provider to show the dialog: Cloudflare wants a click. */
  readonly onNeedsAttention: () => void;
  /** The Turnstile script did not load or the browser is unsupported. */
  readonly onUnavailable: () => void;
  readonly onVerify: (token: string) => void;
  /** The widget reported an error; an invisible widget would leave the dialog empty. */
  readonly onWidgetError: () => void;
  /**
   * "pending": invisible check; "waiting": the check is slow, the dialog says so;
   * "interactive": the dialog shows the widget; "failed": the dialog offers a reload.
   */
  readonly stage: "pending" | "waiting" | "interactive" | "failed";
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
  onNeedsAttention,
  onUnavailable,
  onVerify,
  onWidgetError,
  stage,
  widgetVisible,
}: AuthCaptchaModalProperties) {
  const t = useTranslations("Auth.register");
  const isVisible = stage !== "pending";
  const [widgetLoaded, setWidgetLoaded] = useState(false);
  useScrollLock(isVisible);
  const isLoading =
    stage === "waiting" || (stage === "interactive" && !widgetLoaded);

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
        className="w-full max-w-md rounded-md border panel-border bg-background p-6 panel-shadow outline-none"
        // Moves focus into the dialog when it appears or changes stage (unless focus is already
        // inside, such as in the widget) and gives it back to the page element that had it
        // when the dialog closes. Reading `stage` makes the callback run again when the widget
        // is replaced by the reload offer, which would otherwise drop focus to the page.
        ref={(node) => {
          if (stage === "pending" || !node) return;
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
          {stage === "failed" ? t("captchaFailed") : t("captchaDescription")}
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
          <div className="flex justify-center p-4">
            <Captcha
              appearance={widgetVisible ? "always" : "interaction-only"}
              onBeforeInteractive={onNeedsAttention}
              onError={onWidgetError}
              onUnavailable={onUnavailable}
              onVerify={onVerify}
              onWidgetLoad={() => setWidgetLoaded(true)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
