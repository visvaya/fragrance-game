"use client";

import { memo } from "react";

import { Layers, Lock } from "lucide-react";
import { useTranslations } from "next-intl";

import { ScrollableRow } from "@/components/game/scrollable-row";
import { PyramidCluesSkeleton } from "@/components/game/skeletons";
import { useIsOverflowing } from "@/hooks/use-is-overflowing";
import { useScaleOnTap } from "@/hooks/use-scale-on-tap";
import { GENERIC_PLACEHOLDER, MASK_CHAR } from "@/lib/constants";
import { cn, noop } from "@/lib/utils";

import { useGameState } from "../contexts";
import { DotFiller } from "../dot-filler";
import { GameTooltip } from "../game-tooltip";

import { MaskedWord } from "./masked-word";

function renderPyramidNoteWord({
  hasMasking,
  isFullHidden,
  levelName,
  noteIndex,
  t,
  wIndex,
  word,
}: Readonly<{
  hasMasking: boolean;
  isFullHidden: boolean;
  levelName: string;
  noteIndex: number;
  t: (key: string, values?: Record<string, string | number>) => string;
  wIndex: number;
  word: string;
}>) {
  return hasMasking ? (
    <GameTooltip
      content={t("letters", { count: word.length })}
      key={`${levelName}-note-${noteIndex}-word-${wIndex}`}
    >
      {({ isHovered }: { isHovered?: boolean }) => (
        <span className="inline-flex flex-nowrap">
          {isFullHidden ? (
            <div className="flex items-center justify-center px-1.5 py-0.5 opacity-80 transition-colors duration-300 hover:opacity-100">
              <Lock
                className={cn(
                  "size-2.5 transition-colors duration-300",
                  isHovered
                    ? "text-[oklch(0.75_0.15_60)]"
                    : "text-muted-foreground",
                )}
              />
            </div>
          ) : (
            <MaskedWord
              isHovered={isHovered}
              keyPrefix={`${levelName}-note-${noteIndex}-tt-${wIndex}`}
              word={word}
            />
          )}
        </span>
      )}
    </GameTooltip>
  ) : (
    <span className="inline-flex flex-nowrap" key={wIndex}>
      {isFullHidden ? (
        <div className="group flex items-center justify-center px-1.5 py-0.5 opacity-80 transition-colors duration-300 hover:opacity-100">
          <Lock className="size-2.5 text-muted-foreground transition-colors group-hover:text-[oklch(0.75_0.15_60)]" />
        </div>
      ) : (
        <span className="font-sans text-sm text-foreground">{word}</span>
      )}
    </span>
  );
}

export const PyramidClues = memo(function PyramidClues() {
  const t = useTranslations("PyramidClues");
  const { currentAttempt, dailyPerfume, gameState, revealLevel, visibleNotes } =
    useGameState(); // isLinear is accessible via dailyPerfume.isLinear
  const notes = visibleNotes;
  const isLinear = dailyPerfume.isLinear;
  const { handlePointerDown: handleIconTap, scaled: iconScaled } =
    useScaleOnTap();

  // Skeleton state — structure mirrors the real layout exactly.
  if (dailyPerfume.id === "skeleton") {
    return <PyramidCluesSkeleton t={t} />;
  }

  // LINEAR PERFUME LOGIC
  if (isLinear) {
    const mergedNotes = [
      ...dailyPerfume.notes.top,
      ...dailyPerfume.notes.heart,
      ...dailyPerfume.notes.base,
    ].filter(Boolean);

    // Progressive reveal logic
    // Level 1: Generic placeholders (???, ???, ???)
    // Level 2: Masked notes (all notes, but masked e.g. ⎵⎵⎵⎵⎵)
    // Level 3: 1/3 notes revealed (from end)
    // Level 4: 2/3 notes revealed (from end)
    // Level 5+: All notes revealed

    const isGameOver = gameState === "won" || gameState === "lost";

    const displayNotes = (() => {
      if (isGameOver || revealLevel >= 5) return mergedNotes;
      switch (revealLevel) {
        case 1: {
          return [
            GENERIC_PLACEHOLDER.repeat(5),
            GENERIC_PLACEHOLDER.repeat(5),
            GENERIC_PLACEHOLDER.repeat(5),
          ];
        }
        case 2: {
          return mergedNotes.map((n) => n.replaceAll(/[a-z0-9]/gi, MASK_CHAR));
        }
        case 3: {
          const count = Math.ceil(mergedNotes.length * (1 / 3));
          return mergedNotes.map((n, i) =>
            i >= mergedNotes.length - count
              ? n
              : n.replaceAll(/[a-z0-9]/gi, MASK_CHAR),
          );
        }
        case 4: {
          const count = Math.ceil(mergedNotes.length * (2 / 3));
          return mergedNotes.map((n, i) =>
            i >= mergedNotes.length - count
              ? n
              : n.replaceAll(/[a-z0-9]/gi, MASK_CHAR),
          );
        }
        default: {
          return [];
        }
      }
    })();

    return (
      <div className="panel-standard">
        <div className="mb-2 flex w-fit max-w-full min-w-0 cursor-default items-center">
          <ScrollableRow className="flex w-full items-center gap-2 pr-1 pb-1">
            <span
              className={cn(
                "inline-flex transition-transform duration-300 hover:scale-[1.15]",
                iconScaled && "scale-[1.15]",
              )}
              onPointerDown={handleIconTap}
            >
              <Layers className="size-4 shrink-0 text-muted-foreground" />
            </span>
            <GameTooltip
              className="max-w-full min-w-0"
              content={t("pyramidTooltip")}
              sideOffset={6}
            >
              <h2 className="font-[family-name:var(--font-playfair)] text-base whitespace-nowrap text-foreground lowercase">
                {t("olfactoryProfile")}
              </h2>
            </GameTooltip>
          </ScrollableRow>
        </div>

        <ul className="flex flex-col">
          <li className="flex flex-col gap-2 border-b border-border/60 py-4 first:pt-0 last:border-b-0 last:pb-0">
            <div className="flex items-center gap-2">
              <span className="size-2 shrink-0 rounded-full bg-primary" />
              <span className="text-xs font-semibold tracking-widest text-muted-foreground lowercase">
                <GameTooltip content={t("linearMeaning")}>
                  <span className="cursor-help underline decoration-muted-foreground/30 decoration-dotted underline-offset-2">
                    {t("linearProfile")}
                  </span>
                </GameTooltip>{" "}
                {revealLevel === 1 ? (
                  <GameTooltip content={t("linearProfileTooltip")}>
                    <span className="cursor-help">
                      (
                      {t.rich("noteCountUnknown", {
                        q: (chunks) => (
                          <span className="underline decoration-muted-foreground/30 decoration-dotted underline-offset-2">
                            {chunks}
                          </span>
                        ),
                      })}
                      )
                    </span>
                  </GameTooltip>
                ) : (
                  `(${t("noteCount", { count: mergedNotes.length })})`
                )}
              </span>
            </div>

            <div>
              <div className="flex flex-wrap items-start justify-start gap-2 text-sm">
                {displayNotes.map((note, i, array) => {
                  const words = note.split(" ");
                  const isLast = i === array.length - 1;

                  // Generic placeholder case (Level 1)
                  // Note: In linear logic above we normalized to ___, but verify whatever comes in.
                  // If it's a generic placeholder for "hidden note"
                  const badgeNode: React.ReactNode =
                    revealLevel === 1 &&
                    note === GENERIC_PLACEHOLDER.repeat(5) ? (
                      <span
                        className="inline-flex min-h-[1.375rem] w-fit max-w-full cursor-default flex-nowrap items-center rounded-md border border-border bg-secondary/50 bg-striped-pattern px-2.5 py-1 text-sm font-normal text-muted-foreground transition-colors duration-300 hover:bg-secondary"
                        key={`linear-note-${i}-${note.charAt(0)}`}
                      >
                        <GameTooltip
                          content={t("hiddenNote", { attempt: currentAttempt })}
                        >
                          <div className="group flex h-5 cursor-help items-center justify-center opacity-80 transition-colors duration-300 hover:opacity-100">
                            <Lock className="size-3 text-muted-foreground transition-colors group-hover:text-[oklch(0.75_0.15_60)]" />
                          </div>
                        </GameTooltip>
                      </span>
                    ) : (
                      <PyramidNoteBadge key={`linear-note-${note}-${i}`}>
                        {!note.includes(MASK_CHAR) &&
                        note !== GENERIC_PLACEHOLDER.repeat(5) ? (
                          <span className="font-sans text-sm whitespace-nowrap text-foreground">
                            {note}
                          </span>
                        ) : (
                          words.map((word, wIndex) => {
                            // Check if word contains masking chars
                            const hasMasking = word.includes(MASK_CHAR);
                            const isFullHidden =
                              word === GENERIC_PLACEHOLDER.repeat(5);
                            const showTooltip = hasMasking;

                            const innerContent: React.ReactNode = (() => {
                              if (isFullHidden) {
                                return (
                                  <div className="group flex items-center justify-center px-1.5 py-0.5 opacity-80 transition-colors duration-300 hover:opacity-100">
                                    <Lock className="size-2.5 text-muted-foreground transition-colors group-hover:text-[oklch(0.75_0.15_60)]" />
                                  </div>
                                );
                              }
                              if (hasMasking) {
                                return (
                                  <MaskedWord
                                    keyPrefix={`linear-${i}-${wIndex}`}
                                    word={word}
                                  />
                                );
                              }
                              return (
                                <span className="font-sans text-sm text-foreground">
                                  {word}
                                </span>
                              );
                            })();

                            const content = (
                              <span
                                className="inline-flex flex-nowrap"
                                key={`word-content-${word}-${wIndex}`}
                              >
                                {innerContent}
                              </span>
                            );

                            if (showTooltip) {
                              return (
                                <GameTooltip
                                  content={t("letters", { count: word.length })}
                                  key={`linear-tooltip-${word}-${wIndex}`}
                                >
                                  {({ isHovered }: { isHovered?: boolean }) => (
                                    <span className="inline-flex flex-nowrap">
                                      {isFullHidden ? (
                                        <div className="flex items-center justify-center px-1.5 py-0.5 opacity-80 transition-colors duration-300 hover:opacity-100">
                                          <Lock
                                            className={cn(
                                              "size-2.5 transition-colors duration-300",
                                              isHovered
                                                ? "text-[oklch(0.75_0.15_60)]"
                                                : "text-muted-foreground",
                                            )}
                                          />
                                        </div>
                                      ) : (
                                        <MaskedWord
                                          isHovered={isHovered}
                                          keyPrefix={`linear-tt-${i}-${wIndex}`}
                                          word={word}
                                        />
                                      )}
                                    </span>
                                  )}
                                </GameTooltip>
                              );
                            }
                            return (
                              <span key={`word-span-${word}-${wIndex}`}>
                                {content}
                              </span>
                            );
                          })
                        )}
                      </PyramidNoteBadge>
                    );

                  if (isLast) {
                    return (
                      <div
                        className="flex min-w-0 flex-[1_1_auto] items-center gap-2"
                        key={`wrapper-${i}`}
                      >
                        {badgeNode}
                        <DotFiller className="pr-2" />
                      </div>
                    );
                  }

                  return badgeNode;
                })}
              </div>
            </div>
          </li>
        </ul>
      </div>
    );
  }

  // TRADITIONAL PYRAMID LOGIC
  const levels = [
    { dotClass: "bg-note-top", name: "Top", notes: notes.top },
    { dotClass: "bg-primary", name: "Heart", notes: notes.heart },
    { dotClass: "bg-foreground/60", name: "Base", notes: notes.base },
  ];

  return (
    <div className="panel-standard">
      <div className="mb-2 flex w-fit max-w-full min-w-0 cursor-default items-center">
        <ScrollableRow className="flex w-full items-center gap-2 pr-1 pb-1">
          <span
            className="inline-flex transition-transform duration-300 hover:scale-[1.15] active:scale-[1.15]"
            onTouchStart={noop}
          >
            <Layers className="size-4 text-muted-foreground" />
          </span>
          <GameTooltip
            className="max-w-full min-w-0"
            content={t("pyramidTooltip")}
            sideOffset={6}
          >
            <h2 className="font-[family-name:var(--font-playfair)] text-base whitespace-nowrap text-foreground lowercase">
              {t("pyramid")}
            </h2>
          </GameTooltip>
        </ScrollableRow>
      </div>

      <ul className="flex flex-col">
        {levels.map((level) => (
          <li
            className="flex flex-col gap-2 border-b border-border/60 py-4 first:pt-0 last:border-b-0 last:pb-0"
            key={level.name}
          >
            <div className="flex items-center gap-2">
              <span
                className={`size-2 shrink-0 rounded-full ${level.dotClass}`}
              />
              <span className="text-xs font-semibold tracking-widest text-muted-foreground lowercase">
                {t(level.name.toLowerCase())}{" "}
                {revealLevel === 1 ? (
                  <GameTooltip content={t("linearProfileTooltip")}>
                    <span className="cursor-help">
                      (
                      {t.rich("noteCountUnknown", {
                        q: (chunks) => (
                          <span className="underline decoration-muted-foreground/30 decoration-dotted underline-offset-2">
                            {chunks}
                          </span>
                        ),
                      })}
                      )
                    </span>
                  </GameTooltip>
                ) : (
                  level.notes &&
                  level.notes.length > 0 &&
                  `(${t("noteCount", { count: level.notes.length })})`
                )}
              </span>
            </div>

            <div>
              {level.notes && level.notes.length > 0 ? (
                <div className="flex flex-wrap items-start gap-1.5">
                  {level.notes.map((note, noteIndex, array) => {
                    const words = note.split(" ");
                    const isLast = noteIndex === array.length - 1;

                    const badgeNode =
                      note === GENERIC_PLACEHOLDER.repeat(5) ? (
                        // Generic placeholder badge (level 1 = "??????")
                        <span className="inline-flex min-h-[1.375rem] w-fit max-w-full cursor-default flex-nowrap items-center rounded-md border border-border bg-secondary/50 bg-striped-pattern px-2.5 py-1 text-sm font-normal text-muted-foreground transition-colors duration-300 hover:bg-secondary">
                          <GameTooltip
                            content={t("hiddenNote", {
                              attempt: currentAttempt,
                            })}
                          >
                            <div className="group flex h-5 cursor-help items-center justify-center opacity-80 transition-colors duration-300 hover:opacity-100">
                              <Lock className="size-3 text-muted-foreground transition-colors group-hover:text-[oklch(0.75_0.15_60)]" />
                            </div>
                          </GameTooltip>
                        </span>
                      ) : (
                        // Revealed or partially masked note badge
                        <PyramidNoteBadge>
                          {note.includes(MASK_CHAR) ? (
                            words.map((word, wIndex) => {
                              const hasMasking = word.includes(MASK_CHAR);
                              const isFullHidden =
                                word === GENERIC_PLACEHOLDER.repeat(5);
                              return renderPyramidNoteWord({
                                hasMasking,
                                isFullHidden,
                                levelName: level.name,
                                noteIndex,
                                t,
                                wIndex,
                                word,
                              });
                            })
                          ) : (
                            <span className="font-sans text-sm whitespace-nowrap text-foreground">
                              {note}
                            </span>
                          )}
                        </PyramidNoteBadge>
                      );

                    if (isLast) {
                      return (
                        <div
                          className="flex min-w-0 flex-[1_1_auto] items-center gap-2"
                          key={`wrapper-${noteIndex}`}
                        >
                          {badgeNode}
                          <DotFiller className="pr-2" />
                        </div>
                      );
                    }

                    return (
                      <span key={`${level.name}-note-${noteIndex}`}>
                        {badgeNode}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  <span className="inline-flex min-h-[1.375rem] w-fit max-w-full cursor-default flex-nowrap items-center rounded-md border border-border bg-secondary/50 bg-striped-pattern px-2.5 py-1 text-sm font-normal text-muted-foreground transition-colors duration-300 hover:bg-secondary">
                    <GameTooltip
                      content={t("hiddenNotes", { attempt: currentAttempt })}
                    >
                      <div className="group flex h-5 cursor-help items-center justify-center opacity-80 transition-colors duration-300 hover:opacity-100">
                        <Lock className="size-3 text-muted-foreground transition-colors group-hover:text-[oklch(0.75_0.15_60)]" />
                      </div>
                    </GameTooltip>
                  </span>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
});

function PyramidNoteBadge({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { canScrollLeft, canScrollRight, ref } =
    useIsOverflowing<HTMLSpanElement>();

  const maskClass = (() => {
    if (canScrollLeft && canScrollRight) {
      return "[mask-image:linear-gradient(to_right,transparent_0%,black_15%,black_85%,transparent_100%)]";
    }
    if (canScrollLeft) {
      return "[mask-image:linear-gradient(to_right,transparent_0%,black_15%,black_100%)]";
    }
    if (canScrollRight) {
      return "[mask-image:linear-gradient(to_right,black_85%,transparent_100%)]";
    }
    return "";
  })();

  return (
    <span
      className={cn(
        "group inline-flex min-h-[1.375rem] w-fit max-w-full cursor-default flex-nowrap items-center gap-1 rounded-md border border-border bg-secondary/50 px-2.5 py-1 text-sm font-normal text-muted-foreground transition-colors duration-300 hover:bg-secondary",
        "overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        maskClass,
      )}
      ref={ref}
    >
      {children}
    </span>
  );
}
