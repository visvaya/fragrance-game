"use client";

import { useState } from "react";

import dynamic from "next/dynamic";

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
  GoogleSignIn,
  isPasswordSafe,
  strongPasswordSchema,
  SubmitButton,
  SwitchScreenLink,
  TextField,
  showProviderError,
  useAuthSubmit,
} from "./auth-form-parts";
import { PasswordStrength } from "./password-strength";

const CaptchaLoader = () => {
  const t = useTranslations("Auth.register");
  return (
    // eslint-disable-next-line eauxle/restricted-syntax -- Cloudflare Turnstile documented minimum height is 65px (fixed hardware constraint)
    <div className="flex h-[65px] animate-pulse items-center justify-center rounded bg-muted/20 text-xs text-muted-foreground">
      {t("captchaLoading")}
    </div>
  );
};

const Captcha = dynamic(
  async () => import("./captcha").then((m) => m.Captcha),
  {
    loading: () => <CaptchaLoader />,
    ssr: false,
  },
);

export type RegisterFormProperties = {
  readonly className?: string;
  readonly onLoginClick?: () => void;
  readonly onSuccess?: () => void;
};

/**
 * RegisterForm component for new user registration.
 * Includes CAPTCHA verification and password confirmation.
 */
export function RegisterForm({
  className,
  onLoginClick,
  onSuccess,
}: RegisterFormProperties) {
  const { isLoading, submit } = useAuthSubmit();
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const t = useTranslations("Auth.register");

  const registerSchema = z
    .object({
      confirmPassword: z
        .string()
        .min(1, { message: t("confirmPasswordRequired") }),
      email: z.email({ message: t("invalidEmail") }),
      password: strongPasswordSchema(t),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("passwordsDoNotMatch"),
      path: ["confirmPassword"],
    });

  type RegisterFormValues = z.infer<typeof registerSchema>;

  const form = useForm<RegisterFormValues>({
    defaultValues: {
      confirmPassword: "",
      email: "",
      password: "",
    },
    resolver: zodResolver(registerSchema),
  });

  async function onSubmit(data: RegisterFormValues) {
    if (!captchaToken) {
      toast.error(t("captchaError"));
      return;
    }

    await submit(async () => {
      if (!(await isPasswordSafe(data.password))) {
        form.setError("password", {
          message: t("passwordCommon"),
          type: "manual",
        });
        return;
      }

      const { error } = await supabase.auth.signUp({
        email: data.email,
        options: {
          captchaToken,
          emailRedirectTo: `${globalThis.location.origin}/api/auth/callback`,
        },
        password: data.password,
      });

      if (showProviderError(t("unexpectedError"), error)) return;

      toast.success(t("success"), {
        description: t("successDescription"),
      });
      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/auth/login");
      }
    }, t("unexpectedError"));
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
          name="password"
          type="password"
        />
        <TextField
          control={form.control}
          label={t("confirmPasswordLabel")}
          name="confirmPassword"
          type="password"
        />

        <PasswordStrength password={form.watch("password")} />

        <Captcha
          onError={() => setCaptchaToken(null)}
          onExpire={() => setCaptchaToken(null)}
          onVerify={(token) => setCaptchaToken(token)}
        />

        <SubmitButton isLoading={isLoading}>{t("submit")}</SubmitButton>
      </AuthForm>

      <SwitchScreenLink
        label={t("signInLink")}
        onClick={onLoginClick ?? (() => router.push("/auth/login"))}
        prompt={t("hasAccount")}
      />
    </AuthCard>
  );
  // jscpd:ignore-end
}
