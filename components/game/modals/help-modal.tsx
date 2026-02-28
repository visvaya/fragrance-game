"use client";

import { X, Waves } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { MarkerCircle } from "../marker-circle";

type HelpModalProperties = {
  onClose: () => void;
  open: boolean;
};

/**
 *
 * @param root0
 * @param root0.onClose
 * @param root0.open
 */
export function HelpModal({ onClose, open }: HelpModalProperties) {
  const t = useTranslations("HelpModal");

  return (
    <Dialog onOpenChange={(isOpen) => !isOpen && onClose()} open={open}>
      <DialogContent
        className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-background p-0 sm:max-w-md"
        showCloseButton={false}
      >
        {/* Header */}
        <DialogHeader className="flex flex-row items-center justify-between border-b border-border p-6 pb-4">
          <DialogTitle className="text-xl text-foreground">
            {t("title")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Instrukcja gry w odgadywanie perfum.
          </DialogDescription>
          <button
            aria-label={t("ariaClose")}
            className="text-muted-foreground transition-colors hover:text-primary"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </DialogHeader>

        {/* Content */}
        <div
          className="space-y-4 overflow-y-auto p-6 pt-4 text-sm leading-relaxed text-foreground"
          data-lenis-prevent
        >
          <p>
            <strong>{t("intro")}</strong>
          </p>
          <p className="text-muted-foreground">{t("description")}</p>

          <ul className="space-y-3 pl-4">
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              <span>
                <strong>{t("cluesTitle")}</strong> {t("cluesDesc")}
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              <span>
                <strong>{t("feedbackTitle")}</strong> {t("feedbackDesc")}
              </span>
            </li>
          </ul>

          {/* Feedback legend */}
          <div className="mt-4 space-y-2 bg-muted/50 p-4">
            <div className="flex items-center gap-3">
              <MarkerCircle className="h-5 w-5" letter="✓" />
              <span className="text-muted-foreground">
                {t("feedbackCorrect")}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-5 w-5 items-center justify-center">
                <Waves
                  className="h-4 w-4 -skew-x-12 transform text-muted-foreground opacity-50"
                  strokeWidth={1.5}
                />
              </span>
              <span className="text-muted-foreground">
                {t("feedbackClose")}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-5 w-5 items-center justify-center opacity-50">
                <X
                  className="h-4 w-4 -skew-x-12 transform text-muted-foreground"
                  strokeWidth={1.5}
                />
              </span>
              <span className="text-muted-foreground">
                {t("feedbackWrong")}
              </span>
            </div>
          </div>

          <ul className="space-y-3 pl-4">
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              <span>
                <strong>{t("scoreTitle")}</strong> {t("scoreDesc")}
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              <span>{t("doubleEnter")}</span>
            </li>
          </ul>

          <p className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground italic">
            {t("note")}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
