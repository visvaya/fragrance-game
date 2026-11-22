import { type ReactNode, useState } from "react";

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
import { cn } from "@/lib/utils";

import { GoogleAuthButton } from "./google-auth-button";

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
 * and an exception shows `unexpectedErrorTitle` as a toast.
 */
export function useAuthSubmit() {
  const [isLoading, setIsLoading] = useState(false);

  async function submit(
    request: () => Promise<void>,
    unexpectedErrorTitle: string,
  ) {
    setIsLoading(true);
    try {
      await request();
    } catch (error) {
      toast.error(unexpectedErrorTitle);
      console.error(error);
    } finally {
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
 * Whether the server accepts the password (not on the common password list).
 * Loaded on demand so the server action stays out of the first form bundle.
 * @param password - Password to check.
 */
export async function isPasswordSafe(password: string): Promise<boolean> {
  const { validatePasswordSafety } =
    await import("@/app/actions/security-actions");
  const { isSafe } = await validatePasswordSafety(password);
  return isSafe;
}
