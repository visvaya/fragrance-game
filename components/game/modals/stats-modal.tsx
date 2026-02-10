"use client";

import { useEffect, useState } from "react";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { createPortal } from "react-dom";

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
export function StatsModal({ onClose, open }: StatsModalProperties) {
  const [mounted, setMounted] = useState(false);
  const t = useTranslations("StatsModal");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "unset";
      };
    }
  }, [open]);

  if (!open || !mounted) return null;

  const maxDistribution = Math.max(...STATS.distribution);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-5 backdrop-blur-sm duration-300 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-background duration-300 animate-in slide-in-from-bottom-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border p-6 pb-4">
          <h2 className="font-[family-name:var(--font-playfair)] text-xl text-foreground">
            {t("title")}
          </h2>
          <button
            aria-label={t("ariaClose")}
            className="text-muted-foreground transition-colors hover:text-primary"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

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
                <span className="text-[10px] tracking-wide text-muted-foreground uppercase">
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
                <div className="flex items-center gap-3 text-sm" key={index}>
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
          <p className="mt-8 rotate-[-1deg] text-center font-[family-name:var(--font-hand)] text-lg text-primary/60">
            {t("slogan")}
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
