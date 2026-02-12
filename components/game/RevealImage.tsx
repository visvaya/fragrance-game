"use client";

import { useState, useEffect } from "react";

import Image from "next/image";

import { ScanEye } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { useGameState, useUIPreferences } from "./contexts";

// Low Quality Image Placeholder (LQIP) - 20x20px blurred perfume bottle
// Improves LCP by providing instant visual feedback
const BLUR_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVR42mN8//HLfwYiAOOoQvoqBABbWyZJf74GZgAAAABJRU5ErkJggg==";

/**
 *
 */
export function RevealImage() {
  const { dailyPerfume } = useGameState();
  const { uiPreferences } = useUIPreferences();
  const t = useTranslations("RevealImage");
  const targetSource = dailyPerfume.imageUrl || "/placeholder.svg";

  // Simplified single-image state with CSS transitions
  const [currentSrc, setCurrentSrc] = useState(targetSource);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  // Effect: Detect change in targetSrc and update with transition
  useEffect(() => {
    if (targetSource !== currentSrc) {
      // Fade out current image
      setIsLoaded(false);

      // After fade out, swap source and fade in
      const timeout = setTimeout(() => {
        setCurrentSrc(targetSource);
        setIsLoaded(true);
      }, 350); // Half of 700ms for smoother transition

      return () => clearTimeout(timeout);
    }
  }, [targetSource, currentSrc]);

  // Initial load
  useEffect(() => {
    setIsLoaded(true);
  }, []);

  return (
    <div className="flex h-full w-full flex-col">
      <div className="mb-4 flex items-center gap-2">
        <ScanEye className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-[family-name:var(--font-playfair)] text-lg tracking-wide text-foreground">
          {t("visualEvidence")}
        </h2>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <div
          className={cn(
            "relative aspect-square w-[80%] overflow-hidden rounded-md border border-border bg-muted transition-all duration-300 md:w-full dark:brightness-[0.85]",
            "focus:outline-none",
            isZoomed ? "cursor-zoom-out" : "cursor-zoom-in",
            uiPreferences.fontScale === "large"
              ? "max-w-[280px]"
              : "max-w-[240px]",
          )}
          onClick={() => setIsZoomed(!isZoomed)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setIsZoomed(!isZoomed);
            }
          }}
          role="button"
          tabIndex={0}
        >
          {/* Single image with CSS transition */}
          <Image
            alt={t("altBase")}
            blurDataURL={BLUR_DATA_URL}
            className={cn(
              "object-cover transition-all duration-700 ease-in-out",
              isZoomed ? "scale-110" : "hover:scale-110",
              isLoaded ? "opacity-100" : "opacity-0",
            )}
            fill
            key={currentSrc}
            loading="eager"
            placeholder="blur"
            priority
            quality={90}
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 80vw, 400px"
            src={currentSrc}
          />

          {/* Decorative corner marks (always on top) */}
          <div className="pointer-events-none absolute top-2 left-2 h-4 w-4 border-t-2 border-l-2 border-foreground/20 dark:border-foreground" />
          <div className="pointer-events-none absolute top-2 right-2 h-4 w-4 border-t-2 border-r-2 border-foreground/20 dark:border-foreground" />
          <div className="pointer-events-none absolute bottom-2 left-2 h-4 w-4 border-b-2 border-l-2 border-foreground/20 dark:border-foreground" />
          <div className="pointer-events-none absolute right-2 bottom-2 h-4 w-4 border-r-2 border-b-2 border-foreground/20 dark:border-foreground" />
        </div>
      </div>
    </div>
  );
}
