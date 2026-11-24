"use client";

import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { useRouter } from "@/i18n/routing";
import { publicEnv } from "@/lib/public-env";
import { createClient } from "@/lib/supabase/client";

import {
  AuthCard,
  AuthForm,
  Captcha,
  GoogleSignIn,
  SubmitButton,
  SwitchScreenLink,
  TextField,
  showProviderError,
  useAuthSubmit,
} from "./auth-form-parts";

export type LoginFormProperties = {
  readonly className?: string;
  readonly onForgotPasswordClick?: () => void;
  readonly onRegisterClick?: () => void;
  readonly onSuccess?: () => void;
};

/**
 * LoginForm component for user authentication.
 * Handles sign in with email and password.
 */
export function LoginForm({
  className,
  onForgotPasswordClick,
  onRegisterClick,
  onSuccess,
}: LoginFormProperties) {
  const { isLoading, submit } = useAuthSubmit();
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  // A token works once, so a new widget (new key) is mounted after each attempt.
  const [captchaAttempt, setCaptchaAttempt] = useState(0);
  // Without a site key (local setups without captcha) the sign-in goes without a token.
  const hasCaptcha = Boolean(publicEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const router = useRouter();
  const supabase = createClient();
  const t = useTranslations("Auth.login");

  // jscpd:ignore-start -- each auth screen validates its own fields; the password rules are shared in strongPasswordSchema
  const loginSchema = z.object({
    email: z.email({ message: t("invalidEmail") }),
    password: z.string().min(1, { message: t("passwordRequired") }),
  });

  type LoginFormValues = z.infer<typeof loginSchema>;

  const form = useForm<LoginFormValues>({
    defaultValues: {
      email: "",
      password: "",
    },
    resolver: zodResolver(loginSchema),
  });
  // jscpd:ignore-end

  async function onSubmit(data: LoginFormValues) {
    if (hasCaptcha && !captchaToken) {
      toast.error(t("captchaError"));
      return;
    }

    await submit(async () => {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
        ...(captchaToken ? { options: { captchaToken } } : {}),
      });
      setCaptchaToken(null);
      setCaptchaAttempt((attempt) => attempt + 1);

      if (showProviderError(t("failed"), error)) return;

      toast.success(t("success"));
      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/");
      }
    }, t("error"));
  }

  // jscpd:ignore-start -- each auth screen has its own fields and texts; a shared shell would only pass them through
  return (
    <AuthCard
      className={className}
      description={t("description")}
      title={t("title")}
    >
      <GoogleSignIn />

      <AuthForm form={form} onSubmit={onSubmit}>
        <TextField
          control={form.control}
          label={t("emailLabel")}
          name="email"
          placeholder={t("emailPlaceholder")}
        />
        <TextField
          control={form.control}
          label={t("passwordLabel")}
          labelAction={
            <button
              className="text-sm underline hover:text-primary"
              onClick={
                onForgotPasswordClick ??
                (() => router.push("/auth/forgot-password"))
              }
              type="button"
            >
              {t("forgotPassword")}
            </button>
          }
          name="password"
          type="password"
        />
        {hasCaptcha ? (
          <Captcha
            key={captchaAttempt}
            onError={() => setCaptchaToken(null)}
            onExpire={() => setCaptchaToken(null)}
            onVerify={(token) => setCaptchaToken(token)}
          />
        ) : null}
        <SubmitButton isLoading={isLoading}>{t("submit")}</SubmitButton>
      </AuthForm>

      <SwitchScreenLink
        label={t("signUpLink")}
        onClick={onRegisterClick ?? (() => router.push("/auth/register"))}
        prompt={t("noAccount")}
      />
    </AuthCard>
  );
  // jscpd:ignore-end
}
