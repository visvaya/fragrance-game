"use client";

import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/client";

import { PasswordStrength } from "./password-strength";

async function checkPasswordSafety(password: string) {
  const { validatePasswordSafety } =
    await import("@/app/actions/security-actions");
  return validatePasswordSafety(password);
}

/**
 * ResetPasswordForm component for authenticated password reset.
 */
// eslint_disable-next-line react-compiler/react-compiler
export function ResetPasswordForm() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const t = useTranslations("Auth.resetPassword");
  const tAuth = useTranslations("Auth");

  const resetPasswordSchema = z
    .object({
      confirmPassword: z
        .string()
        .min(1, { message: t("confirmPasswordLabel") }),
      password: z
        .string()
        .min(8, { message: tAuth("register.passwordMinLength") })
        .regex(/[a-z]/, { message: tAuth("register.passwordLowercase") })
        .regex(/[A-Z]/, { message: tAuth("register.passwordUppercase") })
        .regex(/\d/, { message: tAuth("register.passwordDigit") })
        .regex(/[^a-z0-9]/i, { message: tAuth("register.passwordSpecial") }),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: tAuth("passwordsMismatch"),
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

  async function onSubmit(data: ResetPasswordFormValues) {
    setIsLoading(true);

    try {
      // 1. Server-side password safety check
      const safetyCheck = await checkPasswordSafety(data.password);

      if (!safetyCheck.isSafe) {
        form.setError("password", {
          message: tAuth("passwordCommon"),
          type: "manual",
        });
        setIsLoading(false);
        return;
      }

      // 2. Proceed with password reset
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (error) {
        toast.error(t("error"), {
          description: error.message,
        });
        setIsLoading(false);
        return;
      }

      toast.success(t("success"), {
        description: t("successDescription"),
      });
      // eslint-disable-next-line fp/no-mutating-methods
      router.push("/");
      router.refresh();
      setIsLoading(false);
    } catch (error) {
      toast.error(t("error"));
      console.error(error);
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md space-y-6 rounded-lg border bg-card p-6 shadow-sm">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("newPasswordLabel")}</FormLabel>
                <FormControl>
                  <Input type="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* eslint-disable-next-line fp/no-mutating-methods -- react-hook-form watch() is not a mutating method */}
          <PasswordStrength password={form.watch("password")} />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("confirmPasswordLabel")}</FormLabel>
                <FormControl>
                  <Input type="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button className="w-full" disabled={isLoading} type="submit">
            {isLoading ? (
              <Loader2 className="mr-2 size-4  animate-spin" />
            ) : null}
            {t("submit")}
          </Button>
        </form>
      </Form>
    </div>
  );
}
