import { getTranslations } from "next-intl/server";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";

/**
 *
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Auth.resetPassword" });

  return {
    description: t("description"),
    title: t("title"),
  };
}

/**
 *
 */
export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <ResetPasswordForm />
    </div>
  );
}
