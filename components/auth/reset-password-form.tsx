"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { Form } from "@/components/ui/form";
import { useRouter } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/client";

import {
  AuthCard,
  isPasswordSafe,
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

  const onSubmit = async (data: ResetPasswordFormValues) =>
    submit(async () => {
      if (!(await isPasswordSafe(data.password))) {
        form.setError("password", {
          message: tRegister("passwordCommon"),
          type: "manual",
        });
        return;
      }

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

  return (
    <AuthCard description={t("description")} title={t("title")}>
      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
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
        </form>
      </Form>
    </AuthCard>
  );
}
