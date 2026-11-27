"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { toast } from "@/lib/toast";
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
  useCaptcha,
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
  const captcha = useCaptcha();
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

  // jscpd:ignore-start -- the captcha guard of each form wraps its own provider request
  async function onSubmit(data: ForgotPasswordFormValues) {
    if (captcha.isMissing) {
      toast.error(t("captchaError"));
      return;
    }

    await submit(async () => {
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        ...(captcha.token ? { captchaToken: captcha.token } : {}),
        redirectTo: `${globalThis.location.origin}/auth/callback?next=/auth/reset-password`,
      });
      captcha.reset();

      if (showProviderError(t("error"), error)) return;

      toast.success(t("success"), {
        description: t("successDescription"),
      });
    }, t("error"));
  }
  // jscpd:ignore-end

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
        {captcha.widget}
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
