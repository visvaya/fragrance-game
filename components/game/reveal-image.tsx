"use client";

import { useState, useEffect } from "react";

import Image from "next/image";

import { ScanEye } from "lucide-react";
import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";
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

  // Hooks must be declared before any conditional returns (Rules of Hooks)
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
      const timeout = setTimeout(() => {
        setState((previous) => ({
          ...previous,
          currentSource: targetSource,
          isLoaded: true,
        }));
      }, 350);
      return () => clearTimeout(timeout);
    }
  }, [targetSource, state.currentSource]);

  const imageSize =
    uiPreferences.fontScale === "large" ? "w-[17.5rem]" : "w-[15rem]";
  const isSkeleton = dailyPerfume.id === "skeleton";

  return (
    <div className="flex size-full  flex-col">
      {/* Title row — skeleton shows simplified version (no hover/tooltip) */}
      <div className="mb-4 flex w-fit cursor-default items-center">
        {isSkeleton ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex">
              <ScanEye className="size-4  text-muted-foreground" />
            </span>
            <h2 className="font-[family-name:var(--font-playfair)] text-lg tracking-wide text-foreground lowercase opacity-40">
              {t("visualEvidence")}
            </h2>
          </div>
        ) : (
          <GameTooltip content={t("titleTooltip")} sideOffset={6}>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex transition-transform duration-300 hover:scale-[1.15]",
                  iconScaled && "scale-[1.15]",
                )}
                onPointerDown={handleIconTap}
              >
                <ScanEye className="size-4  text-muted-foreground" />
              </span>
              <h2 className="font-[family-name:var(--font-playfair)] text-lg tracking-wide text-foreground lowercase">
                {t("visualEvidence")}
              </h2>
            </div>
          </GameTooltip>
        )}
      </div>

      <div className="flex flex-1 flex-row items-center gap-2">
        {/* Left vertical dot filler */}
        <span
          aria-hidden="true"
          className="flex flex-1 justify-center self-stretch py-2"
        >
          <span className="h-full border-l border-dotted border-muted-foreground/25" />
        </span>

        {/* Image area — skeleton or real */}
        {isSkeleton ? (
          <div
            className={cn(
              "relative aspect-square overflow-hidden rounded-md",
              imageSize,
            )}
          >
            <Skeleton className="size-full  rounded-md" />
            <div className="pointer-events-none absolute top-2 left-2 size-4  border-t-2 border-l-2 border-foreground/10" />
            <div className="pointer-events-none absolute top-2 right-2 size-4  border-t-2 border-r-2 border-foreground/10" />
            <div className="pointer-events-none absolute bottom-2 left-2 size-4  border-b-2 border-l-2 border-foreground/10" />
            <div className="pointer-events-none absolute right-2 bottom-2 size-4  border-r-2 border-b-2 border-foreground/10" />
          </div>
        ) : (
          <div
            className={cn(
              "relative aspect-square overflow-hidden rounded-md border border-border bg-muted transition-all duration-300 dark:brightness-[0.85]",
              "focus:outline-none",
              state.isZoomed ? "cursor-zoom-out" : "cursor-zoom-in",
              imageSize,
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
              placeholder="blur"
              quality={90}
              sizes="(max-width: 640px) 100vw, (max-width: 768px) 80vw, 400px"
              src={state.currentSource}
            />
            <div className="pointer-events-none absolute top-2 left-2 size-4  border-t-2 border-l-2 border-foreground/20 dark:border-foreground" />
            <div className="pointer-events-none absolute top-2 right-2 size-4  border-t-2 border-r-2 border-foreground/20 dark:border-foreground" />
            <div className="pointer-events-none absolute bottom-2 left-2 size-4  border-b-2 border-l-2 border-foreground/20 dark:border-foreground" />
            <div className="pointer-events-none absolute right-2 bottom-2 size-4  border-r-2 border-b-2 border-foreground/20 dark:border-foreground" />
          </div>
        )}

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
