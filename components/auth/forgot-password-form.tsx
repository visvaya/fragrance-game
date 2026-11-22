"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { useRouter } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/client";

import {
  AuthCard,
  AuthForm,
  SubmitButton,
  SwitchScreenLink,
  TextField,
  showProviderError,
  useAuthSubmit,
} from "./auth-form-parts";

export type ForgotPasswordFormProperties = {
  readonly className?: string;
  readonly onLoginClick?: () => void;
};

/** Form for requesting a password-reset email via Supabase. */
export function ForgotPasswordForm({
  onLoginClick,
}: ForgotPasswordFormProperties) {
  const { isLoading, submit } = useAuthSubmit();
  const router = useRouter();
  const supabase = createClient();
  const t = useTranslations("Auth.forgotPassword");

  const forgotPasswordSchema = z.object({
    email: z.email({ message: t("invalidEmail") }),
  });

  type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

  const form = useForm<ForgotPasswordFormValues>({
    defaultValues: {
      email: "",
    },
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormValues) =>
    submit(async () => {
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${globalThis.location.origin}/auth/callback?next=/auth/reset-password`,
      });

      if (showProviderError(t("error"), error)) return;

      toast.success(t("success"), {
        description: t("successDescription"),
      });
    }, t("error"));

  // jscpd:ignore-start -- each auth screen has its own fields and texts; a shared shell would only pass them through
  return (
    <AuthCard description={t("description")} title={t("title")}>
      <AuthForm form={form} onSubmit={onSubmit}>
        <TextField
          control={form.control}
          label={t("emailLabel")}
          name="email"
          placeholder={t("emailPlaceholder")}
        />
        <SubmitButton isLoading={isLoading}>{t("submit")}</SubmitButton>
      </AuthForm>

      <SwitchScreenLink
        label={t("backToLogin")}
        onClick={onLoginClick ?? (() => router.push("/auth/login"))}
      />
    </AuthCard>
  );
  // jscpd:ignore-end
}
