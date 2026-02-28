"use client";

import { useState } from "react";

import dynamic from "next/dynamic";

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
import { cn } from "@/lib/utils";

import { GoogleAuthButton } from "./google-auth-button";
import { PasswordStrength } from "./password-strength";

const CaptchaLoader = () => {
  const t = useTranslations("Auth.register");
  return (
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

async function checkPasswordSafety(password: string) {
  const { validatePasswordSafety } =
    await import("@/app/actions/security-actions");
  return validatePasswordSafety(password);
}

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
  const [isLoading, setIsLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const t = useTranslations("Auth.register");
  const tCommon = useTranslations("Auth.common");

  const registerSchema = z
    .object({
      confirmPassword: z.string().min(1, { message: t("passwordLabel") }),
      email: z.email({ message: t("invalidEmail") }),
      password: z
        .string()
        .min(8, { message: t("passwordMinLength") })
        .regex(/[a-z]/, { message: t("passwordLowercase") })
        .regex(/[A-Z]/, { message: t("passwordUppercase") })
        .regex(/\d/, { message: t("passwordDigit") })
        .regex(/[^a-z0-9]/i, { message: t("passwordSpecial") }),
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

    setIsLoading(true);

    try {
      // 1. Server-side password safety check
      const safetyCheck = await checkPasswordSafety(data.password);

      if (!safetyCheck.isSafe) {
        form.setError("password", {
          message: t("passwordCommon"),
          type: "manual",
        });
        setIsLoading(false);
        return;
      }

      // 2. Proceed with registration
      const { error } = await supabase.auth.signUp({
        email: data.email,
        options: {
          captchaToken,
          emailRedirectTo: `${globalThis.location.origin}/api/auth/callback`,
        },
        password: data.password,
      });

      if (error) {
        toast.error(t("unexpectedError"), {
          description: error.message,
        });
        setIsLoading(false);
        return;
      }

      toast.success(t("success"), {
        description: t("successDescription"),
      });

      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/auth/login");
      }
      setIsLoading(false);
    } catch (error) {
      toast.error(t("unexpectedError"));
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
                <FormLabel>{t("passwordLabel")}</FormLabel>
                <FormControl>
                  <Input type="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

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

          <PasswordStrength password={form.watch("password")} />

          <Captcha
            onError={() => setCaptchaToken(null)}
            onExpire={() => setCaptchaToken(null)}
            onVerify={(token) => setCaptchaToken(token)}
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
        {t("hasAccount")}{" "}
        <button
          className="underline hover:text-primary"
          onClick={onLoginClick ?? (() => router.push("/auth/login"))}
          type="button"
        >
          {t("signInLink")}
        </button>
      </div>
    </div>
  );
}
