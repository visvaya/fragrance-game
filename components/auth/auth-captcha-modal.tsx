"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { Captcha } from "./captcha";

type AuthCaptchaModalProperties = {
  /** Asks the provider to show the dialog (Cloudflare wants a click, or the widget failed). */
  readonly onNeedsAttention: () => void;
  /** The Turnstile script did not load or the browser is unsupported. */
  readonly onUnavailable: () => void;
  readonly onVerify: (token: string) => void;
  /** "pending": invisible check; "interactive": dialog with the widget; "failed": reload offer. */
  readonly stage: "pending" | "interactive" | "failed";
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
  stage,
}: AuthCaptchaModalProperties) {
  const t = useTranslations("Auth.register");
  const isVisible = stage !== "pending";

  return (
    <div
      aria-hidden={!isVisible}
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4",
        isVisible
          ? "bg-black/40 backdrop-blur-sm"
          : "pointer-events-none opacity-0",
      )}
      inert={!isVisible}
    >
      <div
        aria-describedby="anonymous-captcha-description"
        aria-labelledby="anonymous-captcha-title"
        aria-modal={isVisible}
        className="w-full max-w-md rounded-md border panel-border bg-background p-6 panel-shadow outline-none"
        // Moves focus into the dialog when it appears, so keyboard users start there.
        ref={(node) => {
          if (isVisible) node?.focus();
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
        {stage === "failed" ? (
          <div className="mt-4 flex justify-end">
            <Button onClick={() => globalThis.location.reload()} type="button">
              {t("captchaReload")}
            </Button>
          </div>
        ) : (
          <div className="flex justify-center p-4">
            <Captcha
              appearance="interaction-only"
              onBeforeInteractive={onNeedsAttention}
              onError={onNeedsAttention}
              onUnavailable={onUnavailable}
              onVerify={onVerify}
            />
          </div>
        )}
      </div>
    </div>
  );
}
