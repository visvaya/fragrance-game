"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type StatsModalProperties = {
  onClose: () => void;
  open: boolean;
};

// Sample stats data
const STATS = {
  currentStreak: 4,
  distribution: [0, 2, 6, 3, 1],
  maxStreak: 9,
  played: 12,
  winPercent: 83,
};

/**
 *
 * @param root0
 * @param root0.onClose
 * @param root0.open
 */
export function StatsModal({ onClose, open }: Readonly<StatsModalProperties>) {
  const t = useTranslations("StatsModal");

  const maxDistribution = Math.max(...STATS.distribution);

  return (
    <Dialog onOpenChange={(isOpen) => !isOpen && onClose()} open={open}>
      <DialogContent
        className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-background p-0 sm:max-w-md"
        showCloseButton={false}
      >
        <DialogHeader className="flex flex-row items-center justify-between border-b border-border p-6 pb-4">
          <DialogTitle className="text-xl text-foreground">
            {t("title")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("played")}
          </DialogDescription>
          <button
            aria-label={t("ariaClose")}
            className="text-muted-foreground transition-colors hover:text-primary"
            onClick={onClose}
          >
            <X className="size-5" />
          </button>
        </DialogHeader>

        {/* Content wrapper */}
        <div className="overflow-y-auto p-6 pt-4" data-lenis-prevent>
          {/* Stats Grid */}
          <div className="mb-8 grid grid-cols-2 gap-4">
            {[
              { label: t("played"), value: STATS.played },
              { label: t("winPercent"), value: `${STATS.winPercent}%` },
              { label: t("currentStreak"), value: STATS.currentStreak },
              { label: t("maxStreak"), value: STATS.maxStreak },
            ].map((stat) => (
              <div
                className="border border-border p-4 text-center"
                key={stat.label}
              >
                <span className="block font-[family-name:var(--font-playfair)] text-3xl text-foreground">
                  {stat.value}
                </span>
                <span className="text-xs tracking-wide text-muted-foreground uppercase">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>

          {/* Distribution */}
          <h3 className="mb-4 font-[family-name:var(--font-playfair)] text-base text-foreground">
            {t("distribution")}
          </h3>

          <div className="space-y-2">
            {STATS.distribution.map((count, index) => {
              const width =
                maxDistribution > 0 ? (count / maxDistribution) * 100 : 0;
              const isHighest = count === maxDistribution && count > 0;

              return (
                <div
                  className="flex items-center gap-3 text-sm"
                  key={`distribution-${index}`}
                >
                  <span className="w-5 text-right text-muted-foreground">
                    {index + 1}
                  </span>
                  <div className="h-5 flex-1 bg-muted">
                    <div
                      className={`flex h-full items-center justify-end px-2 text-xs text-primary-foreground transition-all duration-500 ${
                        isHighest ? "bg-primary" : "bg-foreground"
                      }`}
                      style={{
                        width: `${Math.max(width, count > 0 ? 10 : 0)}%`,
                      }}
                    >
                      {count > 0 && count}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Handwritten note */}
          <p className="mt-8 rotate-[-1deg] text-center font-hand text-lg text-primary/60">
            {t("slogan")}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
