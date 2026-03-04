import { getTranslations } from "next-intl/server";

import { RegisterForm } from "@/components/auth/register-form";

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
    description: t("signUpDescription"),
    title: t("signUp"),
  };
}

/**
 *
 */
export default function RegisterPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <RegisterForm />
    </div>
  );
}
