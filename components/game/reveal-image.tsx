"use client";

import { useState, useRef, useCallback, useEffect } from "react";

import Image from "next/image";

import { ScanEye } from "lucide-react";
import { useTranslations } from "next-intl";

import { RevealImageSquareSkeleton } from "@/components/game/skeletons";
import { useScaleOnTap } from "@/hooks/use-scale-on-tap";
import { cn } from "@/lib/utils";

import { useGameState } from "./contexts";
import { GameTooltip } from "./game-tooltip";

// Low Quality Image Placeholder (LQIP) - 20x20px blurred perfume bottle
// Improves LCP by providing instant visual feedback
const BLUR_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVR42mN8//HLfwYiAOOoQvoqBABbWyZJf74GZgAAAABJRU5ErkJggg==";

/** Duration of the crossfade transition in ms — must match Tailwind duration-300. */
const CROSSFADE_DURATION_MS = 300;

function isConfirmKey(e: React.KeyboardEvent): boolean {
  return e.key === "Enter" || e.key === " ";
}

type ImageDisplayProperties = {
  activeSource: string;
  altText: string;
  imageSize: string;
  isCrossfading: boolean;
  isZoomed: boolean;
  onPendingLoad: () => void;
  onToggleZoom: () => void;
  pendingSource: string | null;
};

/**
 * Inner component handling zoom interaction and the crossfade between two image layers.
 * Isolated so its JSX complexity does not inflate RevealImage's cognitive complexity.
 */
function ImageDisplay({
  activeSource,
  altText,
  imageSize,
  isCrossfading,
  isZoomed,
  onPendingLoad,
  onToggleZoom,
  pendingSource,
}: Readonly<ImageDisplayProperties>) {
  function handleKeyDown(e: React.KeyboardEvent) {
    if (isConfirmKey(e)) {
      e.preventDefault();
      onToggleZoom();
    }
  }

  return (
    <div
      className={cn(
        "relative aspect-square overflow-hidden rounded-md border border-border bg-muted transition-all duration-300 dark:brightness-[0.85]",
        "focus:outline-none",
        isZoomed ? "cursor-zoom-out" : "cursor-zoom-in",
        imageSize,
      )}
      onClick={onToggleZoom}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      {/* Active image — always fully visible. Never fades out (prevents background flash).
          Only the incoming image fades in on top; once it reaches full opacity we swap.
          No placeholder="blur" here: blur requires JS hydration to remove, which blocks LCP. */}
      <Image
        alt={altText}
        className={cn(
          "object-cover transition-transform duration-700 ease-in-out",
          isZoomed ? "scale-110" : "hover:scale-110",
        )}
        fill
        priority
        quality={90}
        sizes="(max-width: 640px) 100vw, (max-width: 768px) 80vw, 400px"
        src={activeSource}
      />

      {/* Pending image — pre-loads invisibly, fades in on top of the active image.
          Background never shows through because active stays at full opacity.
          key={pendingSource} ensures a fresh <img> for each new URL so onLoad
          fires reliably even for previously cached images. */}
      {pendingSource ? (
        <Image
          alt={altText}
          blurDataURL={BLUR_DATA_URL}
          className={cn(
            "object-cover transition-opacity duration-300 ease-in-out",
            isZoomed ? "scale-110" : "hover:scale-110",
            isCrossfading ? "opacity-100" : "opacity-0",
          )}
          fill
          key={pendingSource}
          onLoad={onPendingLoad}
          placeholder="blur"
          quality={90}
          sizes="(max-width: 640px) 100vw, (max-width: 768px) 80vw, 400px"
          src={pendingSource}
        />
      ) : null}

      <div className="pointer-events-none absolute top-2 left-2 size-4 border-t-2 border-l-2 border-foreground/20 dark:border-foreground" />
      <div className="pointer-events-none absolute top-2 right-2 size-4 border-t-2 border-r-2 border-foreground/20 dark:border-foreground" />
      <div className="pointer-events-none absolute bottom-2 left-2 size-4 border-b-2 border-l-2 border-foreground/20 dark:border-foreground" />
      <div className="pointer-events-none absolute right-2 bottom-2 size-4 border-r-2 border-b-2 border-foreground/20 dark:border-foreground" />
    </div>
  );
}

/**
 * Displays the perfume image (visual evidence) with a progressive reveal system.
 * Uses a crossfade technique: the incoming image loads invisibly behind the active one,
 * then both fade simultaneously — no blank-state flicker between stages.
 */
export function RevealImage() {
  const { dailyPerfume } = useGameState();
  const t = useTranslations("RevealImage");
  const { handlePointerDown: handleIconTap, scaled: iconScaled } =
    useScaleOnTap();
  const targetSource = dailyPerfume.imageUrl || "/placeholder.svg";

  /** The currently displayed image URL. */
  const [activeSource, setActiveSource] = useState(targetSource);
  /** The incoming image URL being pre-loaded in the background (null when idle). */
  const [pendingSource, setPendingSource] = useState<string | null>(null);
  /** When true: active fades out, pending fades in. */
  const [isCrossfading, setIsCrossfading] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  const timerReference = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Ref mirror of pendingSource for use inside setTimeout closures. */
  const pendingSourceReference = useRef<string | null>(null);

  // Detect target changes and queue the incoming image.
  useEffect(() => {
    if (targetSource === activeSource) return;
    if (timerReference.current) clearTimeout(timerReference.current);
    pendingSourceReference.current = targetSource;
    setPendingSource(targetSource);
    setIsCrossfading(false);
  }, [targetSource, activeSource]);

  useEffect(() => {
    return () => {
      if (timerReference.current) clearTimeout(timerReference.current);
    };
  }, []);

  const handlePendingLoad = useCallback(() => {
    setIsCrossfading(true);
    if (timerReference.current) clearTimeout(timerReference.current);
    // +50 ms buffer to let the CSS transition finish before we swap DOM nodes.
    timerReference.current = setTimeout(() => {
      const source = pendingSourceReference.current;
      pendingSourceReference.current = null;
      if (source) setActiveSource(source);
      setPendingSource(null);
      setIsCrossfading(false);
    }, CROSSFADE_DURATION_MS + 50);
  }, []);

  const handleToggleZoom = useCallback(() => {
    setIsZoomed((previous) => !previous);
  }, []);

  // Image size driven by CSS only (no React state), so it is correct from the very
  // first paint (blocking script already set html.large-text before hydration).
  const imageSize = "w-[15rem] large-text:w-[17.5rem]";
  const isSkeleton = dailyPerfume.id === "skeleton";

  return (
    <div className="flex size-full flex-col">
      {/* Title row — skeleton: przyciemniony/statyczny. Real: z tooltip i hover. */}
      <div className="mb-4 flex w-fit cursor-default items-center">
        {isSkeleton ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex size-4 rounded bg-muted/30" />
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
                <ScanEye className="size-4 text-muted-foreground" />
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
          <RevealImageSquareSkeleton />
        ) : (
          <ImageDisplay
            activeSource={activeSource}
            altText={t("altBase")}
            imageSize={imageSize}
            isCrossfading={isCrossfading}
            isZoomed={isZoomed}
            onPendingLoad={handlePendingLoad}
            onToggleZoom={handleToggleZoom}
            pendingSource={pendingSource}
          />
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
