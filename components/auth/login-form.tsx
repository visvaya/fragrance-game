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
  const router = useRouter();
  const supabase = createClient();
  const t = useTranslations("Auth.login");

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

  const onSubmit = async (data: LoginFormValues) =>
    submit(async () => {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (showProviderError(t("failed"), error)) return;

      toast.success(t("success"));
      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/");
      }
    }, t("error"));

  return (
    <AuthCard
      className={className}
      description={t("description")}
      title={t("title")}
    >
      <GoogleSignIn />

      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
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
                className="text-sm text-primary hover:underline"
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
          <SubmitButton isLoading={isLoading}>{t("submit")}</SubmitButton>
        </form>
      </Form>

      <SwitchScreenLink
        label={t("signUpLink")}
        onClick={onRegisterClick ?? (() => router.push("/auth/register"))}
        prompt={t("noAccount")}
      />
    </AuthCard>
  );
}
