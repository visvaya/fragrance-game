import { getTranslations } from "next-intl/server";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

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
  const t = await getTranslations({ locale, namespace: "Auth.forgotPassword" });

  return {
    description: t("description"),
    title: t("title"),
  };
}

/**
 *
 */
export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <ForgotPasswordForm />
    </div>
  );
}
