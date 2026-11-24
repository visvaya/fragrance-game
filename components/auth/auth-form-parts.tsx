import { type ReactNode, useRef, useState } from "react";

import dynamic from "next/dynamic";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type {
  Control,
  FieldPath,
  FieldValues,
  SubmitHandler,
  UseFormReturn,
} from "react-hook-form";
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
import { publicEnv } from "@/lib/public-env";
import { cn } from "@/lib/utils";

import { GoogleAuthButton } from "./google-auth-button";

const CaptchaLoader = () => {
  const t = useTranslations("Auth.register");
  return (
    <div className="flex h-[4.0625rem] animate-pulse items-center justify-center rounded bg-muted/20 text-xs text-muted-foreground">
      {t("captchaLoading")}
    </div>
  );
};

/** Turnstile widget, loaded on demand so its script stays out of the first form bundle. */
export const Captcha = dynamic(
  async () => import("./captcha").then((m) => m.Captcha),
  {
    loading: () => <CaptchaLoader />,
    ssr: false,
  },
);

/**
 * Turnstile state of an auth form. `widget` is the widget, or null without a site key (local
 * setups without captcha: the request then goes without a token). `isMissing` is true while a
 * required token has not arrived. A token works once, so `reset` clears it and mounts a new widget.
 * When the Turnstile script cannot load, the widget gives way to the reload advice.
 */
export function useCaptcha() {
  const t = useTranslations("Auth.register");
  const [token, setToken] = useState<string | null>(null);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const hasCaptcha = Boolean(publicEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  return {
    isMissing: hasCaptcha && token === null,
    reset: () => {
      setToken(null);
      setAttempt((count) => count + 1);
    },
    token,
    widget: hasCaptcha ? (
      isUnavailable ? (
        <p className="text-sm text-destructive" role="alert">
          {t("captchaFailed")}
        </p>
      ) : (
        <Captcha
          key={attempt}
          onError={() => setToken(null)}
          onExpire={() => setToken(null)}
          onUnavailable={() => setIsUnavailable(true)}
          onVerify={setToken}
        />
      )
    ) : null,
  };
}

type AuthCardProperties = {
  readonly children: ReactNode;
  readonly className?: string | undefined;
  readonly description: string;
  readonly title: string;
};

/** Card with the heading shared by the sign-in, registration and password forms. */
export function AuthCard({
  children,
  className,
  description,
  title,
}: AuthCardProperties) {
  return (
    <div
      className={cn(
        "w-full max-w-md space-y-6 rounded-lg border bg-card p-6 shadow-sm",
        className,
      )}
    >
      <div className="space-y-2 text-center">
        <h1 className="font-[family-name:var(--font-playfair)] text-2xl font-bold">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

/** Google sign-in button above an "or" divider that leads to the email form. */
export function GoogleSignIn() {
  const tCommon = useTranslations("Auth.common");
  return (
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
  );
}

/** Form provider and `<form>` element wired to a react-hook-form instance. */
export function AuthForm<TValues extends FieldValues>({
  children,
  form,
  onSubmit,
}: {
  readonly children: ReactNode;
  readonly form: UseFormReturn<TValues>;
  readonly onSubmit: SubmitHandler<TValues>;
}) {
  return (
    <Form {...form}>
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        {children}
      </form>
    </Form>
  );
}

type TextFieldProperties<TValues extends FieldValues> = {
  readonly control: Control<TValues>;
  readonly label: string;
  /** Rendered next to the label, such as a "forgot password" link. */
  readonly labelAction?: ReactNode;
  readonly name: FieldPath<TValues>;
  readonly placeholder?: string;
  readonly type?: "password" | "text";
};

/** Labelled input bound to a react-hook-form field, with its validation message. */
export function TextField<TValues extends FieldValues>({
  control,
  label,
  labelAction,
  name,
  placeholder,
  type = "text",
}: TextFieldProperties<TValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          {labelAction === undefined ? (
            <FormLabel>{label}</FormLabel>
          ) : (
            <div className="flex items-center justify-between">
              <FormLabel>{label}</FormLabel>
              {labelAction}
            </div>
          )}
          <FormControl>
            <Input placeholder={placeholder} type={type} {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/** Full-width submit button with a spinner while the request runs. */
export function SubmitButton({
  children,
  isLoading,
}: {
  readonly children: ReactNode;
  readonly isLoading: boolean;
}) {
  return (
    <Button className="w-full" disabled={isLoading} type="submit">
      {isLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
      {children}
    </Button>
  );
}

/** Centered link-styled button that switches to another auth screen. */
export function SwitchScreenLink({
  label,
  onClick,
  prompt,
}: {
  readonly label: string;
  readonly onClick: () => void;
  readonly prompt?: string;
}) {
  return (
    <div className="text-center text-sm">
      {prompt === undefined ? null : `${prompt} `}
      <button
        className="underline hover:text-primary"
        onClick={onClick}
        type="button"
      >
        {label}
      </button>
    </div>
  );
}

/**
 * Loading state and error handling around an auth request: `isLoading` is true while it runs,
 * and an exception shows `unexpectedErrorTitle` as a toast. A submit that arrives while a request
 * runs is dropped: the disabled button only takes effect after a render, so a double tap could
 * otherwise sign in twice and leave two sessions.
 */
export function useAuthSubmit() {
  const [isLoading, setIsLoading] = useState(false);
  const inFlight = useRef(false);

  async function submit(
    request: () => Promise<void>,
    unexpectedErrorTitle: string,
  ) {
    if (inFlight.current) return;
    inFlight.current = true;
    setIsLoading(true);
    try {
      await request();
    } catch (error) {
      toast.error(unexpectedErrorTitle);
      console.error(error);
    } finally {
      inFlight.current = false;
      setIsLoading(false);
    }
  }

  return { isLoading, submit };
}

/**
 * Shows an error returned by the auth provider as a toast.
 * @param title - Toast title.
 * @param error - Error from the provider call, or null when it succeeded.
 * @returns Whether there was an error to show.
 */
export function showProviderError(
  title: string,
  error: { message: string } | null,
): error is { message: string } {
  if (error) toast.error(title, { description: error.message });
  return error !== null;
}

/**
 * Password rules shared by registration and password reset.
 * @param t - Translator of the `Auth.register` namespace, which holds the rule messages.
 */
export function strongPasswordSchema(
  t: ReturnType<typeof useTranslations<"Auth.register">>,
) {
  return z
    .string()
    .min(8, { message: t("passwordMinLength") })
    .regex(/[a-z]/, { message: t("passwordLowercase") })
    .regex(/[A-Z]/, { message: t("passwordUppercase") })
    .regex(/\d/, { message: t("passwordDigit") })
    .regex(/[^a-z0-9]/i, { message: t("passwordSpecial") });
}

/**
 * Whether the server accepts the password (not on the common password list); when it
 * does not, the password field of the form gets the error message.
 * Loaded on demand so the server action stays out of the first form bundle.
 * @param form - Form with a `password` field.
 * @param password - Password to check.
 * @param message - Error shown on the field for a common password.
 */
export async function acceptPassword<TValues extends FieldValues>(
  form: UseFormReturn<TValues>,
  password: string,
  message: string,
): Promise<boolean> {
  const { validatePasswordSafety } =
    await import("@/app/actions/security-actions");
  const { isSafe } = await validatePasswordSafety(password);
  if (!isSafe)
    form.setError("password" as FieldPath<TValues>, {
      message,
      type: "manual",
    });
  return isSafe;
}
