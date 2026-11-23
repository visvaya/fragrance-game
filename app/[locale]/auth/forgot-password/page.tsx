import { getTranslations } from "next-intl/server";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

// jscpd:ignore-start -- each page names its own namespace and form; a shared helper would only pass them through
/**
 * Generates metadata for the forgot password page.
 */
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
 * Forgot password page.
 */
export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <ForgotPasswordForm />
    </div>
  );
}
// jscpd:ignore-end
