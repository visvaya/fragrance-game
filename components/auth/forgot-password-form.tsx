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

export type ForgotPasswordFormProperties = {
  readonly className?: string;
  readonly onLoginClick?: () => void;
};

export function ForgotPasswordForm({
  onLoginClick,
}: ForgotPasswordFormProperties) {
  const [isLoading, setIsLoading] = useState(false);
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

  async function onSubmit(data: ForgotPasswordFormValues) {
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${globalThis.location.origin}/auth/callback?next=/auth/reset-password`,
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
      // Optional: redirect to login or stay here
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
        <h1 className="font-[family-name:var(--font-playfair)] text-2xl font-bold">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("emailLabel")}</FormLabel>
                <FormControl>
                  <Input placeholder={t("emailPlaceholder")} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button className="w-full" disabled={isLoading} type="submit">
            {isLoading ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : null}
            {t("submit")}
          </Button>
        </form>
      </Form>

      <div className="text-center text-sm">
        <button
          className="underline hover:text-primary"
          onClick={onLoginClick ?? (() => router.push("/auth/login"))}
          type="button"
        >
          {t("backToLogin")}
        </button>
      </div>
    </div>
  );
}
