import { getTranslations } from "next-intl/server";

/** Renders a localized 404 page for unmatched routes. */
export default async function NotFound() {
  const t = await getTranslations("NotFound");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-4xl font-bold">{t("title")}</h1>
      <p className="mt-2 text-lg">{t("description")}</p>
    </div>
  );
}
