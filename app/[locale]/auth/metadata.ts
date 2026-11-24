import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

type AuthPage = "signIn" | "signUp";

/**
 * `generateMetadata` of an auth page, from its `Metadata` messages (`<page>` and `<page>Description`).
 * @param page - Message key of the page title.
 */
export function authPageMetadata(page: AuthPage) {
  return async ({
    params,
  }: {
    params: Promise<{ locale: string }>;
  }): Promise<Metadata> => {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: "Metadata" });
    return { description: t(`${page}Description`), title: t(page) };
  };
}
