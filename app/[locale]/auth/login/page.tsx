import { getTranslations } from "next-intl/server";

import { LoginForm } from "@/components/auth/login-form";

/**
 *
 */
// eslint-disable-next-line react-refresh/only-export-components
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });

  return {
    description: t("signInDescription"),
    title: t("signIn"),
  };
}

/**
 *
 */
export default function LoginPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <LoginForm />
    </div>
  );
}
