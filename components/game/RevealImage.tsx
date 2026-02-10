"use client";

import { useState, useEffect } from "react";

import Image from "next/image";

import { ScanEye } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { useGame } from "./game-provider";

/**
 *
 */
export function RevealImage() {
  const { dailyPerfume, uiPreferences } = useGame();
  const t = useTranslations("RevealImage");
  const targetSource = dailyPerfume.imageUrl || "/placeholder.svg";

  // STATE:
  // - activeSrc: The image currently fully visible (or fading out conceptually)
  // - fadingInSrc: The new image appearing on top. Null if no transition.
  // - isLoaded: heavy lifting for the opacity switch
  const [activeSource, setActiveSource] = useState(targetSource);
  const [fadingInSource, setFadingInSource] = useState<string | null>(null);
  const [isFadingInLoaded, setIsFadingInLoaded] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  // Effect: Detect change in targetSrc -> Start Transition
  // Logic: When target changes, it becomes 'fadingInSrc'. We keep the old 'activeSrc' visible behind.
  useEffect(() => {
    if (targetSource !== activeSource && targetSource !== fadingInSource) {
      setFadingInSource(targetSource);
      setIsFadingInLoaded(false);
    }
  }, [targetSource, activeSource, fadingInSource]);

  // Callback: When new image finishes loading
  const handleImageLoad = () => {
    setIsFadingInLoaded(true);

    // Wait for the CSS transition (e.g. 700ms) to complete visually, then swap buffers
    const timeout = setTimeout(() => {
      if (fadingInSource) {
        setActiveSource(fadingInSource);
        setFadingInSource(null);
        setIsFadingInLoaded(false);
      }
    }, 700); // Match duration-700

    return () => clearTimeout(timeout);
  };

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
          {/* Layer 1: Active Image (Background) */}
          {/* Always present. If nothing else, shows placeholder. */}
          <Image
            alt={t("altBase")}
            className={cn(
              "object-cover transition-transform duration-700 ease-in-out",
              isZoomed ? "scale-110" : "hover:scale-110",
            )}
            fill
            key={activeSource}
            loading="eager"
            priority
            sizes="(max-width: 768px) 100vw, 40vw"
            src={activeSource}
          />

          {/* Layer 2: Fading In Image (Foreground) */}
          {/* Only rendered when we have a new source pending */}
          {fadingInSource ? (
            <Image
              alt={t("altReveal")}
              className={cn(
                "object-cover transition-all duration-700 ease-in-out",
                isZoomed ? "scale-110" : "hover:scale-110",
                isFadingInLoaded ? "opacity-100" : "opacity-0",
              )}
              fill
              key={fadingInSource}
              onLoad={handleImageLoad}
              priority
              sizes="(max-width: 768px) 100vw, 40vw"
              src={fadingInSource}
            />
          ) : null}

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
