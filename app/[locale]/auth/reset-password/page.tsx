import { getTranslations } from "next-intl/server";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";

// jscpd:ignore-start -- each page names its own namespace and form; a shared helper would only pass them through
/**
 * Generates metadata for the reset password page.
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
 * Reset password page.
 */
export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <ResetPasswordForm />
    </div>
  );
}
// jscpd:ignore-end
