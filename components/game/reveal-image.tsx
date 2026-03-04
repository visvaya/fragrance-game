"use client";

import { useState, useEffect } from "react";

import Image from "next/image";

import { ScanEye } from "lucide-react";
import { useTranslations } from "next-intl";

import { useScaleOnTap } from "@/hooks/use-scale-on-tap";
import { cn } from "@/lib/utils";

import { useGameState, useUIPreferences } from "./contexts";
import { GameTooltip } from "./game-tooltip";

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
  const { handlePointerDown: handleIconTap, scaled: iconScaled } =
    useScaleOnTap();
  const targetSource = dailyPerfume.imageUrl || "/placeholder.svg";

  const [state, setState] = useState({
    currentSource: targetSource,
    isLoaded: true,
    isZoomed: false,
    previousTargetSource: targetSource,
  });

  // Derive state: instantly fade out if target changes
  if (targetSource !== state.previousTargetSource) {
    setState((previous) => ({
      ...previous,
      isLoaded: false,
      previousTargetSource: targetSource,
    }));
  }

  // Effect: Detect change in targetSrc and update with transition AFTER fade out
  useEffect(() => {
    if (targetSource !== state.currentSource) {
      // After fade out, swap source and fade in
      const timeout = setTimeout(() => {
        setState((previous) => ({
          ...previous,
          currentSource: targetSource,
          isLoaded: true,
        }));
      }, 350); // Half of 700ms for smoother transition

      return () => clearTimeout(timeout);
    }
  }, [targetSource, state.currentSource]);

  return (
    <div className="flex h-full w-full flex-col">
      <div className="mb-4 flex w-fit cursor-default items-center">
        <GameTooltip content={t("titleTooltip")} sideOffset={6}>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex transition-transform duration-300 hover:scale-[1.15]",
                iconScaled && "scale-[1.15]",
              )}
              onPointerDown={handleIconTap}
            >
              <ScanEye className="h-4 w-4 text-muted-foreground" />
            </span>
            <h2 className="font-[family-name:var(--font-playfair)] text-lg tracking-wide text-foreground lowercase">
              {t("visualEvidence")}
            </h2>
          </div>
        </GameTooltip>
      </div>

      <div className="flex flex-1 flex-row items-center gap-2">
        {/* Left vertical dot filler */}
        <span
          aria-hidden="true"
          className="flex flex-1 justify-center self-stretch py-2"
        >
          <span className="h-full border-l border-dotted border-muted-foreground/25" />
        </span>

        {/* Image */}
        <div
          className={cn(
            "relative aspect-square overflow-hidden rounded-md border border-border bg-muted transition-all duration-300 dark:brightness-[0.85]",
            "focus:outline-none",
            state.isZoomed ? "cursor-zoom-out" : "cursor-zoom-in",
            uiPreferences.fontScale === "large" ? "w-[17.5rem]" : "w-[15rem]",
          )}
          onClick={() =>
            setState((previous) => ({
              ...previous,
              isZoomed: !previous.isZoomed,
            }))
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setState((previous) => ({
                ...previous,
                isZoomed: !previous.isZoomed,
              }));
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
              state.isZoomed ? "scale-110" : "hover:scale-110",
              state.isLoaded ? "opacity-100" : "opacity-0",
            )}
            fill
            key={state.currentSource}
            loading="eager"
            placeholder="blur"
            priority
            quality={90}
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 80vw, 400px"
            src={state.currentSource}
          />

          {/* Decorative corner marks (always on top) */}
          <div className="pointer-events-none absolute top-2 left-2 h-4 w-4 border-t-2 border-l-2 border-foreground/20 dark:border-foreground" />
          <div className="pointer-events-none absolute top-2 right-2 h-4 w-4 border-t-2 border-r-2 border-foreground/20 dark:border-foreground" />
          <div className="pointer-events-none absolute bottom-2 left-2 h-4 w-4 border-b-2 border-l-2 border-foreground/20 dark:border-foreground" />
          <div className="pointer-events-none absolute right-2 bottom-2 h-4 w-4 border-r-2 border-b-2 border-foreground/20 dark:border-foreground" />
        </div>

        {/* Right vertical dot filler */}
        <span
          aria-hidden="true"
          className="flex flex-1 justify-center self-stretch py-2"
        >
          <span className="h-full border-l border-dotted border-muted-foreground/25" />
        </span>
      </div>
    </div>
  );
}
