"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

import {
  acceptPassword,
  AuthCard,
  AuthForm,
  strongPasswordSchema,
  SubmitButton,
  TextField,
  showProviderError,
  useAuthSubmit,
} from "./auth-form-parts";
import { PasswordStrength } from "./password-strength";

/**
 * ResetPasswordForm component for authenticated password reset.
 */
export function ResetPasswordForm() {
  const { isLoading, submit } = useAuthSubmit();
  const router = useRouter();
  const supabase = createClient();
  const t = useTranslations("Auth.resetPassword");
  const tRegister = useTranslations("Auth.register");

  // jscpd:ignore-start -- each auth screen validates its own fields; the password rules are shared in strongPasswordSchema
  const resetPasswordSchema = z
    .object({
      confirmPassword: z
        .string()
        .min(1, { message: tRegister("confirmPasswordRequired") }),
      password: strongPasswordSchema(tRegister),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: tRegister("passwordsDoNotMatch"),
      path: ["confirmPassword"],
    });

  type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

  const form = useForm<ResetPasswordFormValues>({
    defaultValues: {
      confirmPassword: "",
      password: "",
    },
    resolver: zodResolver(resetPasswordSchema),
  });
  // jscpd:ignore-end

  const onSubmit = async (data: ResetPasswordFormValues) =>
    submit(async () => {
      if (
        !(await acceptPassword(
          form,
          data.password,
          tRegister("passwordCommon"),
        ))
      )
        return;

      const { error } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (showProviderError(t("error"), error)) return;

      toast.success(t("success"), {
        description: t("successDescription"),
      });
      router.push("/");
      router.refresh();
    }, t("error"));

  // jscpd:ignore-start -- each auth screen has its own fields and texts; a shared shell would only pass them through
  return (
    <AuthCard description={t("description")} title={t("title")}>
      <AuthForm form={form} onSubmit={onSubmit}>
        <TextField
          control={form.control}
          label={t("newPasswordLabel")}
          name="password"
          type="password"
        />

        <PasswordStrength password={form.watch("password")} />

        <TextField
          control={form.control}
          label={t("confirmPasswordLabel")}
          name="confirmPassword"
          type="password"
        />

        <SubmitButton isLoading={isLoading}>{t("submit")}</SubmitButton>
      </AuthForm>
    </AuthCard>
  );
  // jscpd:ignore-end
}
