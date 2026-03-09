"use client";

import { useRef } from "react";

import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useTheme } from "next-themes";

import { useUIPreferences } from "@/components/game/contexts";
import { env } from "@/lib/env";

type CaptchaProperties = Readonly<{
  onError?: () => void;
  onExpire?: () => void;
  onVerify: (token: string) => void;
}>;

/**
 * Captcha component using Cloudflare Turnstile.
 * Automatically adapts the theme (light/dark) to application settings.
 */
export function Captcha({ onError, onExpire, onVerify }: CaptchaProperties) {
  const ref = useRef<TurnstileInstance>(null);
  const { theme: nextTheme } = useTheme();
  const { uiPreferences } = useUIPreferences();

  // Determine actual theme to pass to Turnstile
  // Priority: uiPreferences.theme -> next-themes system/light/dark
  // Turnstile supports: 'light' | 'dark' | 'auto'
  const theme =
    uiPreferences.theme === "dark" || nextTheme === "dark" ? "dark" : "light";
  // Turnstile test keys:
  // 1x00000000000000000000AA - Always Pass
  // 2x00000000000000000000AB - Always Block
  // 3x00000000000000000000FF - Force Interactive Challenge
  const siteKey = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

  if (!siteKey) {
    console.error("Captcha: Missing NEXT_PUBLIC_TURNSTILE_SITE_KEY");
    return (
      <div className="rounded border border-red-500 p-4 text-sm text-red-500">
        Error: Captcha Site Key missing
      </div>
    );
  }

  return (
    // eslint-disable-next-line no-restricted-syntax -- Cloudflare Turnstile documented minimum height is 65px (fixed hardware constraint)
    <div className="flex min-h-[65px] w-full justify-center py-2">
      <Turnstile
        onError={onError}
        onExpire={onExpire}
        onSuccess={onVerify}
        options={{
          size: "normal",
          theme: theme as "light" | "dark" | "auto",
        }}
        ref={ref}
        siteKey={siteKey}
      />
    </div>
  );
}
