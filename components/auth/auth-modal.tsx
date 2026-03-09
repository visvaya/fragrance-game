"use client";

import { useState } from "react";

import dynamic from "next/dynamic";

import { useTranslations } from "next-intl";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import type { ForgotPasswordFormProperties } from "@/components/auth/forgot-password-form";
import type { LoginFormProperties } from "@/components/auth/login-form";
import type { RegisterFormProperties } from "@/components/auth/register-form";

const LoginForm = dynamic<LoginFormProperties>(
  async () => import("@/components/auth/login-form").then((m) => m.LoginForm),
  {
    loading: () => (
      <div className="flex h-[25rem] items-center justify-center">
        Loading...
      </div>
    ),
    ssr: false,
  },
);
const RegisterForm = dynamic<RegisterFormProperties>(
  async () =>
    import("@/components/auth/register-form").then((m) => m.RegisterForm),
  {
    loading: () => (
      <div className="flex h-[25rem] items-center justify-center">
        Loading...
      </div>
    ),
    ssr: false,
  },
);
const ForgotPasswordForm = dynamic<ForgotPasswordFormProperties>(
  async () =>
    import("@/components/auth/forgot-password-form").then(
      (m) => m.ForgotPasswordForm,
    ),
  {
    loading: () => (
      <div className="flex h-[12.5rem] items-center justify-center">
        Loading...
      </div>
    ),
    ssr: false,
  },
);

type AuthView = "login" | "register" | "forgot-password";

type AuthModalProperties = Readonly<{
  children?: React.ReactNode;
  defaultView?: AuthView;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}>;

/**
 *
 */
export function AuthModal({
  children,
  defaultView = "login",
  isOpen,
  onOpenChange,
}: AuthModalProperties) {
  const [internalView, setInternalView] = useState<AuthView>(defaultView);
  const [internalOpen, setInternalOpen] = useState(false);
  const t = useTranslations("Auth");

  // Controlled vs Uncontrolled state
  const isControlled = isOpen !== undefined;
  const open = isControlled ? isOpen : internalOpen;
  const setOpen = (value: boolean) => {
    if (isControlled && onOpenChange) {
      onOpenChange(value);
    } else {
      setInternalOpen(value);
    }
  };

  // Sync view with defaultView prop when modal opens
  // This fixes the issue where 'Create Account' might open 'Login' if previously viewed
  const [previousOpen, setPreviousOpen] = useState(open);
  let view = internalView;

  if (open && !previousOpen) {
    // Just opened, reset the view
    view = defaultView;
    setInternalView(defaultView);
  }

  if (open !== previousOpen) {
    setPreviousOpen(open);
  }

  const setView = (newView: AuthView) => {
    setInternalView(newView);
  };

  const handleSuccess = () => {
    setOpen(false);
  };

  const getTitle = () => {
    switch (view) {
      case "login": {
        return t("login.title");
      }
      case "register": {
        return t("register.title");
      }
      case "forgot-password": {
        return t("forgotPassword.title");
      }
    }
  };

  const getDescription = () => {
    switch (view) {
      case "login": {
        return t("login.description");
      }
      case "register": {
        return t("register.description");
      }
      case "forgot-password": {
        return t("forgotPassword.description");
      }
    }
  };

  return (
    <Dialog
      onOpenChange={(newOpen) => {
        setOpen(newOpen);
        if (!newOpen) {
          // Reset to default view when closed (after unmatched transition)
          setTimeout(() => setView(defaultView), 300);
        }
      }}
      open={open}
    >
      {/*
        We only render Trigger if children are provided.
        If controlled, the parent handles the trigger.
      */}
      {/* eslint-disable-next-line @typescript-eslint/strict-boolean-expressions */}
      {children ? <DialogTrigger asChild>{children}</DialogTrigger> : null}

      {/* eslint-disable-next-line no-restricted-syntax -- shadcn/ui standard dialog width: 425px is a design system convention, not a user-scalable size */}
      <DialogContent className="flex flex-col gap-0 overflow-hidden border-0 bg-transparent p-0 shadow-none sm:max-w-[425px] sm:bg-transparent">
        <div className="mx-auto w-full max-w-md overflow-hidden rounded-lg border bg-background shadow-lg">
          <DialogHeader className="sr-only">
            <DialogTitle>{getTitle()}</DialogTitle>
            <DialogDescription>{getDescription()}</DialogDescription>
          </DialogHeader>

          {view === "login" && (
            <LoginForm
              className="border-0 shadow-none"
              onForgotPasswordClick={() => setView("forgot-password")}
              onRegisterClick={() => setView("register")}
              onSuccess={handleSuccess}
            />
          )}

          {view === "register" && (
            <RegisterForm
              className="border-0 shadow-none"
              onLoginClick={() => setView("login")}
              onSuccess={handleSuccess}
            />
          )}

          {view === "forgot-password" && (
            <ForgotPasswordForm
              className="border-0 shadow-none"
              onLoginClick={() => setView("login")}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
