"use client";

import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { GoogleAuthButton } from "@/components/auth/google-auth-button";
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

/**
 * LoginForm component for user authentication.
 * Handles sign in with email and password.
 */
import { cn } from "@/lib/utils";

type LoginFormProperties = {
  className?: string;
  onForgotPasswordClick?: () => void;
  onRegisterClick?: () => void;
  onSuccess?: () => void;
  viewMode?: "page" | "modal";
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
  viewMode = "page",
}: LoginFormProperties) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const t = useTranslations("Auth.login");
  const tCommon = useTranslations("Auth.common");

  const loginSchema = z.object({
    email: z.string().email({ message: t("invalidEmail") }),
    password: z.string().min(1, { message: t("passwordLabel") }),
  });

  type LoginFormValues = z.infer<typeof loginSchema>;

  const form = useForm<LoginFormValues>({
    defaultValues: {
      email: "",
      password: "",
    },
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginFormValues) {
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        toast.error(t("failed"), {
          description: error.message,
        });
        setIsLoading(false);
        return;
      }

      toast.success(t("success"));
      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/");
      }
      setIsLoading(false);
    } catch (error) {
      toast.error(t("error"));
      console.error(error);
      setIsLoading(false);
    }
  }

  return (
    <div
      className={cn(
        "w-full max-w-md space-y-6 rounded-lg border bg-card p-6 shadow-sm",
        className,
      )}
    >
      <div className="space-y-2 text-center">
        <h1 className="font-[family-name:var(--font-playfair)] text-2xl font-bold">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <div className="grid gap-6">
        <GoogleAuthButton />

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              {tCommon("or")}
            </span>
          </div>
        </div>
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

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>{t("passwordLabel")}</FormLabel>
                  <button
                    className="text-sm text-primary hover:underline"
                    onClick={
                      onForgotPasswordClick ||
                      (() => router.push("/auth/forgot-password"))
                    }
                    type="button"
                  >
                    {t("forgotPassword")}
                  </button>
                </div>
                <FormControl>
                  <Input type="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button className="w-full" disabled={isLoading} type="submit">
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {t("submit")}
          </Button>
        </form>
      </Form>

      <div className="text-center text-sm">
        {t("noAccount")}{" "}
        <button
          className="underline hover:text-primary"
          onClick={onRegisterClick || (() => router.push("/auth/register"))}
          type="button"
        >
          {t("signUpLink")}
        </button>
      </div>
    </div>
  );
}
