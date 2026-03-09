"use client";

import { memo } from "react";

import { Layers, Lock } from "lucide-react";
import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";
import { useScaleOnTap } from "@/hooks/use-scale-on-tap";
import { GENERIC_PLACEHOLDER, MASK_CHAR } from "@/lib/constants";
import { cn } from "@/lib/utils";

import { useGameState } from "../contexts";
import { DotFiller } from "../dot-filler";
import { GameTooltip } from "../game-tooltip";

import { MaskSlot } from "./mask-slot";

/**
 *
 */
export const PyramidClues = memo(function PyramidClues() {
  const t = useTranslations("PyramidClues");
  const { currentAttempt, dailyPerfume, gameState, revealLevel, visibleNotes } =
    useGameState(); // isLinear is accessible via dailyPerfume.isLinear
  const notes = visibleNotes;
  const isLinear = dailyPerfume.isLinear;
  const { handlePointerDown: handleIconTap, scaled: iconScaled } =
    useScaleOnTap();

  // Skeleton state — structure mirrors the real layout exactly.
  // Static translations are shown as-is; only dynamic content (note names) uses <Skeleton> bars.
  if (dailyPerfume.id === "skeleton") {
    const skeletonLevels = [
      { count: 3, dotClass: "bg-note-top", label: t("top") },
      { count: 3, dotClass: "bg-primary", label: t("heart") },
      { count: 3, dotClass: "bg-foreground/60", label: t("base") },
    ];
    return (
      <div className="panel-standard">
        {/* Title row — matches real header exactly */}
        <div className="mb-4 flex w-fit cursor-default items-center">
          <div className="flex items-center gap-2">
            <span className="inline-flex">
              <Layers className="h-4 w-4 text-muted-foreground" />
            </span>
            <h2 className="font-[family-name:var(--font-playfair)] text-lg text-foreground lowercase opacity-40">
              {t("pyramid")}
            </h2>
          </div>
        </div>
        <ul className="flex flex-col">
          {skeletonLevels.map((level) => (
            <li
              className="flex flex-col gap-2 border-b border-border/60 py-4 first:pt-0 last:border-b-0 last:pb-0"
              key={level.label}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${level.dotClass} opacity-40`}
                />
                <span className="text-xs font-semibold tracking-widest text-muted-foreground/40 lowercase">
                  {level.label}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: level.count }).map((_, i) => (
                  <Skeleton
                    className="min-h-[1.375rem] w-[4.5rem] py-1"
                    key={`skel-${level.label}-${i}`}
                  />
                ))}
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
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

    let displayNotes: string[] = [];

    const isGameOver = gameState === "won" || gameState === "lost";

    if (isGameOver || revealLevel >= 5) {
      // Level 5+ or Game Over -> All
      displayNotes = mergedNotes;
    } else
      switch (revealLevel) {
        case 1: {
          // 3 generic dots -> now 3 generic scores/slots
          displayNotes = [
            GENERIC_PLACEHOLDER.repeat(5),
            GENERIC_PLACEHOLDER.repeat(5),
            GENERIC_PLACEHOLDER.repeat(5),
          ];

          break;
        }
        case 2: {
          // All notes masked (0% reveal)
          displayNotes = mergedNotes.map((n) =>
            n.replaceAll(/[a-z0-9]/gi, MASK_CHAR),
          );

          break;
        }
        case 3: {
          // 1/3 revealed from end, rest masked
          const count = Math.ceil(mergedNotes.length * (1 / 3));
          displayNotes = mergedNotes.map((n, i) => {
            // if index is in the last 'count', show it. Else mask it.
            if (i >= mergedNotes.length - count) return n;
            return n.replaceAll(/[a-z0-9]/gi, MASK_CHAR);
          });

          break;
        }
        case 4: {
          // 2/3 revealed from end
          const count = Math.ceil(mergedNotes.length * (2 / 3));
          displayNotes = mergedNotes.map((n, i) => {
            if (i >= mergedNotes.length - count) return n;
            return n.replaceAll(/[a-z0-9]/gi, MASK_CHAR);
          });

          break;
        }
        // No default
      }

    return (
      <div className="panel-standard">
        <div className="mb-4 flex w-fit cursor-default items-center">
          <GameTooltip content={t("olfactoryProfileTooltip")} sideOffset={6}>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex transition-transform duration-300 hover:scale-[1.15]",
                  iconScaled && "scale-[1.15]",
                )}
                onPointerDown={handleIconTap}
              >
                <Layers className="h-4 w-4 text-muted-foreground" />
              </span>
              <h2 className="font-[family-name:var(--font-playfair)] text-lg text-foreground lowercase">
                {t("olfactoryProfile")}
              </h2>
            </div>
          </GameTooltip>
        </div>

        <ul className="flex flex-col">
          <li className="flex flex-col gap-2 border-b border-border/60 py-4 first:pt-0 last:border-b-0 last:pb-0">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
              <span className="text-xs font-semibold tracking-widest text-muted-foreground/70 lowercase">
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
              <div className="flex flex-wrap items-center justify-start gap-2 text-sm">
                {/* eslint-disable-next-line sonarjs/max-lines-per-function */}
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
                        className="inline-flex min-h-[1.375rem] max-w-full cursor-default flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 rounded-md border border-border bg-secondary/50 bg-striped-pattern px-2.5 py-1 text-sm font-normal text-muted-foreground transition-colors duration-300 hover:bg-secondary"
                        key={`linear-note-${i}-${note.charAt(0)}`}
                      >
                        <GameTooltip
                          content={t("hiddenNote", { attempt: currentAttempt })}
                        >
                          <div className="group flex h-5 cursor-help items-center justify-center opacity-80 transition-colors duration-300 hover:opacity-100">
                            <Lock className="h-3 w-3 text-muted-foreground transition-colors group-hover:text-[oklch(0.75_0.15_60)]" />
                          </div>
                        </GameTooltip>
                      </span>
                    ) : (
                      <span
                        className="group inline-flex min-h-[1.375rem] max-w-full cursor-default flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 rounded-md border border-border bg-secondary/50 px-2.5 py-1 text-sm font-normal text-muted-foreground transition-colors duration-300 hover:bg-secondary"
                        key={`linear-note-${note}-${i}`}
                      >
                        {!note.includes(MASK_CHAR) &&
                          note !== GENERIC_PLACEHOLDER.repeat(5) ? (
                          <span className="font-sans text-sm text-foreground">
                            {note}
                          </span>
                        ) : (
                          words.map((word, wIndex) => {
                            // Check if word contains masking chars
                            const hasMasking = word.includes(MASK_CHAR);
                            const isFullHidden =
                              word === GENERIC_PLACEHOLDER.repeat(5);
                            const showTooltip = hasMasking;

                            let innerContent: React.ReactNode;
                            if (isFullHidden) {
                              innerContent = (
                                <div className="group flex items-center justify-center px-1.5 py-0.5 opacity-80 transition-colors duration-300 hover:opacity-100">
                                  <Lock className="h-2.5 w-2.5 text-muted-foreground transition-colors group-hover:text-[oklch(0.75_0.15_60)]" />
                                </div>
                              );
                            } else if (hasMasking) {
                              // eslint-disable-next-line @typescript-eslint/no-misused-spread
                              innerContent = [...word].map((char, index) => {
                                const isSlot = char === MASK_CHAR;
                                if (isSlot) {
                                  return (
                                    <MaskSlot
                                      char={char}
                                      key={`linear-slot-${char}-${index}`}
                                    />
                                  );
                                }
                                return (
                                  <div
                                    className="mx-px flex h-5 w-2 items-center justify-center border-b border-transparent font-mono text-sm leading-none text-foreground"
                                    key={`linear-char-${char}-${index}`}
                                  >
                                    <span className="inline-block translate-y-px">
                                      {char}
                                    </span>
                                  </div>
                                );
                              });
                            } else {
                              innerContent = (
                                <span className="font-sans text-sm text-foreground">
                                  {word}
                                </span>
                              );
                            }

                            const content = (
                              <div
                                className="flex flex-nowrap"
                                key={`word-content-${word}-${wIndex}`}
                              >
                                {innerContent}
                              </div>
                            );

                            if (showTooltip) {
                              return (
                                <GameTooltip
                                  content={t("letters", { count: word.length })}
                                  key={`linear-tooltip-${word}-${wIndex}`}
                                >
                                  {({ isHovered }: { isHovered?: boolean }) => (
                                    <div className="flex flex-nowrap">
                                      {isFullHidden ? (
                                        <div className="flex items-center justify-center px-1.5 py-0.5 opacity-80 transition-colors duration-300 hover:opacity-100">
                                          <Lock
                                            className={cn(
                                              "h-2.5 w-2.5 transition-colors duration-300",
                                              isHovered
                                                ? "text-[oklch(0.75_0.15_60)]"
                                                : "text-muted-foreground",
                                            )}
                                          />
                                        </div>
                                      ) : (
                                        // eslint-disable-next-line @typescript-eslint/no-misused-spread, sonarjs/no-nested-functions
                                        [...word].map((char, index) => {
                                          const isSlot = char === MASK_CHAR;
                                          if (isSlot) {
                                            return (
                                              <MaskSlot
                                                char={char}
                                                isHovered={isHovered}
                                                key={`linear-slot-tt-${char}-${index}`}
                                              />
                                            );
                                          }
                                          return (
                                            <div
                                              className="mx-px flex h-5 w-2 items-center justify-center border-b border-transparent font-mono text-sm leading-none text-foreground"
                                              key={`linear-char-tt-${char}-${index}`}
                                            >
                                              <span className="inline-block translate-y-px">
                                                {char}
                                              </span>
                                            </div>
                                          );
                                        })
                                      )}
                                    </div>
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
                      </span>
                    );

                  if (isLast) {
                    return (
                      <div
                        className="flex min-w-0 flex-[1_1_0px] items-center gap-2"
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
      <div className="mb-4 flex w-fit cursor-default items-center">
        <GameTooltip content={t("pyramidTooltip")} sideOffset={6}>
          <div className="flex items-center gap-2">
            <span
              className="inline-flex transition-transform duration-300 hover:scale-[1.15] active:scale-[1.15]"
              // eslint-disable-next-line @typescript-eslint/no-empty-function
              onTouchStart={() => { }}
            >
              <Layers className="h-4 w-4 text-muted-foreground" />
            </span>
            <h2 className="font-[family-name:var(--font-playfair)] text-lg text-foreground lowercase">
              {t("pyramid")}
            </h2>
          </div>
        </GameTooltip>
      </div>

      <ul className="flex flex-col">
        {/* eslint-disable-next-line sonarjs/max-lines-per-function */}
        {levels.map((level) => (
          <li
            className="flex flex-col gap-2 border-b border-border/60 py-4 first:pt-0 last:border-b-0 last:pb-0"
            key={level.name}
          >
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${level.dotClass}`}
              />
              <span className="text-xs font-semibold tracking-widest text-muted-foreground/70 lowercase">
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
                <div className="flex flex-wrap items-center gap-1.5">
                  {/* eslint-disable-next-line sonarjs/max-lines-per-function */}
                  {level.notes.map((note, noteIndex, array) => {
                    const words = note.split(" ");
                    const isLast = noteIndex === array.length - 1;

                    // Check if it's the generic placeholder "??????" passed from GameProvider?
                    let badgeNode: React.ReactNode;
                    if (note === GENERIC_PLACEHOLDER.repeat(5)) {
                      badgeNode = (
                        <span
                          className="inline-flex min-h-[1.375rem] max-w-full cursor-default flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 rounded-md border border-border bg-secondary/50 bg-striped-pattern px-2.5 py-1 text-sm font-normal text-muted-foreground transition-colors duration-300 hover:bg-secondary"
                          key={`${level.name}-note-${noteIndex}-${note.charAt(0)}`}
                        >
                          <GameTooltip
                            content={t("hiddenNote", {
                              attempt: currentAttempt,
                            })}
                          >
                            <div className="group flex h-5 cursor-help items-center justify-center opacity-80 transition-colors duration-300 hover:opacity-100">
                              <Lock className="h-3 w-3 text-muted-foreground transition-colors group-hover:text-[oklch(0.75_0.15_60)]" />
                            </div>
                          </GameTooltip>
                        </span>
                      );
                    } else {
                      // if reveal level is not 1.
                      // GameProvider usually returns real notes. If masked, they contain MASK_CHAR.
                      // Let's assume standard logic: characters are masked.

                      return (
                        <span
                          className="group inline-flex min-h-[1.375rem] max-w-full cursor-default flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 rounded-md border border-border bg-secondary/50 px-2.5 py-1 text-sm font-normal text-muted-foreground transition-colors duration-300 hover:bg-secondary"
                          key={`${level.name}-note-${noteIndex}-${note.charAt(0)}`}
                        >
                          {!note.includes(MASK_CHAR) &&
                            note !== GENERIC_PLACEHOLDER.repeat(5) ? (
                            <span className="font-sans text-sm text-foreground">
                              {note}
                            </span>
                          ) : (
                            words.map((word, wIndex) => {
                              const hasMasking = word.includes(MASK_CHAR);
                              const isFullHidden =
                                word === GENERIC_PLACEHOLDER.repeat(5);
                              const showTooltip = hasMasking;

                              let innerContent: React.ReactNode;
                              if (isFullHidden) {
                                innerContent = (
                                  <div className="group flex items-center justify-center px-1.5 py-0.5 opacity-80 transition-colors duration-300 hover:opacity-100">
                                    <Lock className="h-2.5 w-2.5 text-muted-foreground transition-colors group-hover:text-[oklch(0.75_0.15_60)]" />
                                  </div>
                                );
                              } else if (hasMasking) {
                                // eslint-disable-next-line @typescript-eslint/no-misused-spread, sonarjs/no-nested-functions
                                innerContent = [...word].map((char, index) => {
                                  const isSlot = char === MASK_CHAR;
                                  if (isSlot) {
                                    return (
                                      <MaskSlot
                                        char={char}
                                        key={`${level.name}-note-${noteIndex}-slot-${index}`}
                                      />
                                    );
                                  }
                                  return (
                                    <div
                                      className="mx-px flex h-5 w-2 items-center justify-center border-b border-transparent font-mono text-sm leading-none text-foreground"
                                      key={`${level.name}-note-${noteIndex}-char-${index}`}
                                    >
                                      <span className="inline-block translate-y-px">
                                        {char}
                                      </span>
                                    </div>
                                  );
                                });
                              } else {
                                innerContent = (
                                  <span className="font-sans text-sm text-foreground">
                                    {word}
                                  </span>
                                );
                              }

                              const content = (
                                <div className="flex flex-nowrap">
                                  {innerContent}
                                </div>
                              );

                              if (showTooltip) {
                                return (
                                  <GameTooltip
                                    content={t("letters", {
                                      count: word.length,
                                    })}
                                    key={`${level.name}-note-${noteIndex}-word-${wIndex}`}
                                  >
                                    {({
                                      isHovered,
                                    }: {
                                      isHovered?: boolean;
                                      // eslint-disable-next-line sonarjs/no-nested-functions
                                    }) => (
                                      <div className="flex flex-nowrap">
                                        {isFullHidden ? (
                                          <div className="flex items-center justify-center px-1.5 py-0.5 opacity-80 transition-colors duration-300 hover:opacity-100">
                                            <Lock
                                              className={cn(
                                                "h-2.5 w-2.5 transition-colors duration-300",
                                                isHovered
                                                  ? "text-[oklch(0.75_0.15_60)]"
                                                  : "text-muted-foreground",
                                              )}
                                            />
                                          </div>
                                        ) : (
                                          // eslint-disable-next-line @typescript-eslint/no-misused-spread
                                          [...word].map((char, index) => {
                                            const isSlot = char === MASK_CHAR;
                                            if (isSlot) {
                                              return (
                                                <MaskSlot
                                                  char={char}
                                                  isHovered={isHovered}
                                                  key={`linear-slot-tt-${char}-${index}`}
                                                />
                                              );
                                            }
                                            return (
                                              <div
                                                className="mx-px flex h-5 w-2 items-center justify-center border-b border-transparent font-mono text-sm leading-none text-foreground"
                                                key={`linear-char-tt-${char}-${index}`}
                                              >
                                                <span className="inline-block translate-y-px">
                                                  {char}
                                                </span>
                                              </div>
                                            );
                                          })
                                        )}
                                      </div>
                                    )}
                                  </GameTooltip>
                                );
                              }
                              return <span key={wIndex}>{content}</span>;
                            })
                          )}
                        </span>
                      );
                    }

                    if (isLast) {
                      return (
                        <div
                          className="flex min-w-0 flex-[1_1_0px] items-center gap-2"
                          key={`wrapper-${noteIndex}`}
                        >
                          {badgeNode}
                          <DotFiller className="pr-2" />
                        </div>
                      );
                    }

                    return badgeNode;
                  })}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  <span className="inline-flex min-h-[1.375rem] max-w-full cursor-default flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 rounded-md border border-border bg-secondary/50 bg-striped-pattern px-2.5 py-1 text-sm font-normal text-muted-foreground transition-colors duration-300 hover:bg-secondary">
                    <GameTooltip
                      content={t("hiddenNotes", { attempt: currentAttempt })}
                    >
                      <div className="group flex h-5 cursor-help items-center justify-center opacity-80 transition-colors duration-300 hover:opacity-100">
                        <Lock className="h-3 w-3 text-muted-foreground transition-colors group-hover:text-[oklch(0.75_0.15_60)]" />
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
