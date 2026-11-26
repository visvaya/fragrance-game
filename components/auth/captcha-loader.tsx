import { useTranslations } from "next-intl";

/**
 * Placeholder of the Turnstile widget's size. The widget is drawn over it, so it shows until
 * Cloudflare's frame has painted, without waiting for a readiness signal Turnstile does not give.
 */
export function CaptchaLoader() {
  const t = useTranslations("Auth.register");
  return (
    // eslint-disable-next-line eauxle/restricted-syntax -- the Turnstile widget is a fixed 300 x 65 px frame, so its placeholder matches it in px, not rem
    <output className="mx-auto flex h-[65px] w-[300px] max-w-full animate-pulse items-center justify-center rounded bg-muted/20 text-xs text-muted-foreground motion-reduce:animate-none">
      {t("captchaLoading")}
    </output>
  );
}
