"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { toast } from "@/lib/toast";
import * as z from "zod";

import { useRouter } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/client";

import {
  acceptPassword,
  AuthCard,
  AuthForm,
  GoogleSignIn,
  strongPasswordSchema,
  SubmitButton,
  SwitchScreenLink,
  TextField,
  showProviderError,
  useAuthSubmit,
  useCaptcha,
} from "./auth-form-parts";
import { PasswordStrength } from "./password-strength";

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
  const captcha = useCaptcha();
  const router = useRouter();
  const supabase = createClient();
  const t = useTranslations("Auth.register");

  // jscpd:ignore-start -- each auth screen validates its own fields; the password rules are shared in strongPasswordSchema
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
  // jscpd:ignore-end

  async function onSubmit(data: RegisterFormValues) {
    if (captcha.isMissing) {
      toast.error(t("captchaError"));
      return;
    }

    await submit(async () => {
      if (!(await acceptPassword(form, data.password, t("passwordCommon"))))
        return;

      const { error } = await supabase.auth.signUp({
        email: data.email,
        options: {
          ...(captcha.token ? { captchaToken: captcha.token } : {}),
          emailRedirectTo: `${globalThis.location.origin}/api/auth/callback`,
        },
        password: data.password,
      });
      // A token works once: a second attempt after an error needs a new one.
      captcha.reset();

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

        {captcha.widget}

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
