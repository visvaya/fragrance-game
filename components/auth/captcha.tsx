"use client";

import { useRef, useState } from "react";

import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useTranslations } from "next-intl";

import { useUIPreferences } from "@/components/game/contexts";
import {
  type TurnstileErrorKind,
  turnstileErrorKind,
} from "@/lib/auth/turnstile-error";
import { publicEnv } from "@/lib/public-env";

import { CaptchaLoader } from "./captcha-loader";

type CaptchaProperties = Readonly<{
  /** "interaction-only" keeps the widget invisible unless Cloudflare asks for a click. */
  appearance?: "always" | "interaction-only";
  onBeforeInteractive?: () => void;
  onExpire?: () => void;
  /** The check failed, the script did not load or the browser is unsupported. */
  onFail?: (kind: TurnstileErrorKind) => void;
  onVerify: (token: string) => void;
  onWidgetLoad?: () => void;
}>;

/**
 * Captcha component using Cloudflare Turnstile.
 * Automatically adapts the theme (light/dark) to application settings. A visible widget has a
 * loading placeholder in its place until it has drawn itself, so the form shows no empty gap.
 */
export function Captcha({
  appearance = "always",
  onBeforeInteractive,
  onExpire,
  onFail,
  onVerify,
  onWidgetLoad,
}: CaptchaProperties) {
  const t = useTranslations("Auth.common");
  const ref = useRef<TurnstileInstance>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  // The theme chosen in the game menu; Turnstile also accepts "auto", which would follow the system instead.
  const { theme } = useUIPreferences().uiPreferences;
  // Turnstile test keys:
  // 1x00000000000000000000AA - Always Pass
  // 2x00000000000000000000AB - Always Block
  // 3x00000000000000000000FF - Force Interactive Challenge
  const siteKey = publicEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

  if (!siteKey) {
    console.error("Captcha: Missing NEXT_PUBLIC_TURNSTILE_SITE_KEY");
    return (
      <div className="rounded border border-red-500 p-4 text-sm text-red-500">
        {t("captchaKeyMissing")}
      </div>
    );
  }

  return (
    // eslint-disable-next-line eauxle/restricted-syntax -- Cloudflare Turnstile documented minimum height is 65px (fixed hardware constraint)
    <div className="relative flex min-h-[65px] w-full justify-center py-2">
      {appearance === "always" && !isLoaded ? (
        <div className="absolute inset-x-0 top-2">
          <CaptchaLoader />
        </div>
      ) : null}
      <Turnstile
        {...(onBeforeInteractive ? { onBeforeInteractive } : {})}
        {...(onExpire ? { onExpire } : {})}
        {...(onFail
          ? {
              onError: (code: string) => onFail(turnstileErrorKind(code)),
              onUnsupported: () => onFail("unsupported"),
              scriptOptions: { onError: () => onFail("blocked") },
            }
          : {})}
        onSuccess={onVerify}
        onWidgetLoad={() => {
          setIsLoaded(true);
          onWidgetLoad?.();
        }}
        options={{
          appearance,
          size: "normal",
          theme,
        }}
        ref={ref}
        siteKey={siteKey}
      />
    </div>
  );
}
