import { useTranslations } from "next-intl";

/** Placeholder of the Turnstile widget's size, shown until the widget has drawn itself. */
export function CaptchaLoader() {
  const t = useTranslations("Auth.register");
  return (
    <output className="flex h-[4.0625rem] w-full animate-pulse items-center justify-center rounded bg-muted/20 text-xs text-muted-foreground motion-reduce:animate-none">
      {t("captchaLoading")}
    </output>
  );
}
