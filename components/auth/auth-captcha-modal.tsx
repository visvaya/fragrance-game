"use client";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { Captcha } from "./captcha";

type AuthCaptchaModalProperties = {
  /** True once Cloudflare asks the player to interact; until then nothing is shown. */
  readonly isInteractive: boolean;
  readonly onBeforeInteractive: () => void;
  readonly onError: () => void;
  readonly onVerify: (token: string) => void;
};

/**
 * Turnstile check for anonymous sign-in. The widget is mounted at once in its invisible
 * "interaction-only" mode, so most players get a token without seeing anything; the dialog
 * appears only when Cloudflare asks for a click. It stays mounted (not a Radix dialog,
 * which would unmount the closed content and lose the widget).
 */
export function AuthCaptchaModal({
  isInteractive,
  onBeforeInteractive,
  onError,
  onVerify,
}: AuthCaptchaModalProperties) {
  const t = useTranslations("Auth.register");

  return (
    <div
      aria-hidden={!isInteractive}
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4",
        isInteractive
          ? "bg-black/40 backdrop-blur-sm"
          : "pointer-events-none opacity-0",
      )}
    >
      <div
        aria-describedby="anonymous-captcha-description"
        aria-labelledby="anonymous-captcha-title"
        aria-modal={isInteractive}
        className="w-full max-w-md rounded-md border panel-border bg-background p-6 panel-shadow"
        role="alertdialog"
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
          {t("captchaDescription")}
        </p>
        <div className="flex justify-center p-4">
          <Captcha
            appearance="interaction-only"
            onBeforeInteractive={onBeforeInteractive}
            onError={onError}
            onVerify={onVerify}
          />
        </div>
      </div>
    </div>
  );
}
