import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

type AuthPage = "signIn" | "signUp";

/**
 * Page metadata of an auth page, from its `Metadata` messages (`<page>` and `<page>Description`).
 * @param params - Route parameters with the locale.
 * @param page - Message key of the page title.
 */
export async function authPageMetadata(
  params: Promise<{ locale: string }>,
  page: AuthPage,
): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { description: t(`${page}Description`), title: t(page) };
}
