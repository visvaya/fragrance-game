"use client";

import { useTranslations } from "next-intl";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";

import { Captcha } from "./captcha";

type AuthCaptchaModalProperties = {
  readonly isOpen: boolean;
  readonly onVerify: (token: string) => void;
};

export function AuthCaptchaModal({
  isOpen,
  onVerify,
}: AuthCaptchaModalProperties) {
  const t = useTranslations("Auth.register"); // Re-using existing keys where possible

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("captchaTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("captchaDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex justify-center p-4">
          <Captcha onVerify={onVerify} />
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
