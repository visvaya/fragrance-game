import Link from "next/link";

import { getLocale, getTranslations } from "next-intl/server";

import { ErrorPage } from "@/components/error-page";
import { Button } from "@/components/ui/button";

/** Renders a localized 404 page for unmatched routes, with a way back to today's game. */
export default async function NotFound() {
  const [t, locale] = await Promise.all([
    getTranslations("NotFound"),
    getLocale(),
  ]);

  return (
    <ErrorPage description={t("description")} title={t("title")}>
      <Button asChild size="lg">
        <Link href={`/${locale}`}>{t("backToGame")}</Link>
      </Button>
    </ErrorPage>
  );
}
