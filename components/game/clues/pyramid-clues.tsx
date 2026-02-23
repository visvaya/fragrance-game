"use client";

import { Circle, Layers, Lock } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { useGameState } from "../contexts";
import { GameTooltip } from "../game-tooltip";

/**
 *
 */
export function PyramidClues() {
  const t = useTranslations("PyramidClues");
  const { currentAttempt, dailyPerfume, gameState, revealLevel, visibleNotes } =
    useGameState(); // isLinear is accessible via dailyPerfume.isLinear
  const notes = visibleNotes;
  const isLinear = dailyPerfume.isLinear;

  // LINEAR PERFUME LOGIC
  if (isLinear) {
    const mergedNotes = [
      ...(dailyPerfume.notes.top || []),
      ...(dailyPerfume.notes.heart || []),
      ...(dailyPerfume.notes.base || []),
    ].filter(Boolean);

    // Progressive reveal logic
    // Level 1: Generic placeholders (•••, •••, •••)
    // Level 2: Masked notes (all notes, but masked e.g. •••••)
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
          displayNotes = ["?????", "?????", "?????"];

          break;
        }
        case 2: {
          // All notes masked (0% reveal)
          displayNotes = mergedNotes.map((n) =>
            n.replaceAll(/[a-z0-9]/gi, "_"),
          );

          break;
        }
        case 3: {
          // 1/3 revealed from end, rest masked
          const count = Math.ceil(mergedNotes.length * (1 / 3));
          displayNotes = mergedNotes.map((n, i) => {
            // if index is in the last 'count', show it. Else mask it.
            if (i >= mergedNotes.length - count) return n;
            return n.replaceAll(/[a-z0-9]/gi, "_");
          });

          break;
        }
        case 4: {
          // 2/3 revealed from end
          const count = Math.ceil(mergedNotes.length * (2 / 3));
          displayNotes = mergedNotes.map((n, i) => {
            if (i >= mergedNotes.length - count) return n;
            return n.replaceAll(/[a-z0-9]/gi, "_");
          });

          break;
        }
        // No default
      }

    return (
      <div className="rounded-md border border-border/50 bg-background p-4">
        <div className="group mb-4 flex w-fit cursor-default items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground transition-transform duration-300 group-hover:scale-[1.15]" />
          <h2 className="font-[family-name:var(--font-playfair)] text-lg text-foreground lowercase">
            {t("olfactoryProfile")}
          </h2>
        </div>

        <ul className="flex flex-col">
          <li className="flex flex-col gap-2 border-b border-border/60 py-4 first:pt-0 last:border-b-0 last:pb-0">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
              <span className="text-xs font-semibold tracking-widest text-muted-foreground/70 lowercase">
                {t("linearProfile")}{" "}
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
              <div className="flex flex-wrap justify-start gap-x-4 gap-y-2 text-sm">
                {displayNotes.map((note, i) => {
                  const words = note.split(" ");

                  // Generic placeholder case (Level 1)
                  // Note: In linear logic above we normalized to ___, but verify whatever comes in.
                  // If it's a generic placeholder for "hidden note"
                  if (revealLevel === 1 && note === "?????") {
                    return (
                      <span
                        className="inline-flex min-h-[30px] max-w-full cursor-default flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-md border border-border bg-secondary/50 px-3 py-1 text-sm font-medium text-muted-foreground transition-colors duration-300 hover:bg-secondary"
                        key={`linear-note-${i}-${note.charAt(0)}`}
                      >
                        <GameTooltip
                          content={t("hiddenNote", { attempt: currentAttempt })}
                        >
                          <div className="group flex cursor-help items-center justify-center px-2 py-0.5 opacity-80 transition-colors duration-300 hover:opacity-100">
                            <Lock className="h-3 w-3 text-muted-foreground transition-colors group-hover:text-[oklch(0.75_0.15_60)]" />
                          </div>
                        </GameTooltip>
                      </span>
                    );
                  }

                  return (
                    <span
                      className="inline-flex min-h-[30px] max-w-full cursor-default flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-md border border-border bg-secondary/50 px-3 py-1 text-sm font-medium text-muted-foreground transition-colors duration-300 hover:bg-secondary"
                      key={`linear-note-${note}-${i}`}
                    >
                      {words.map((word, wIndex) => {
                        // Check if word contains masking chars
                        const hasMasking = word.includes("_");
                        const isFullHidden = word === "?????";
                        const showTooltip = hasMasking;

                        const content = (
                          <div
                            className="flex flex-nowrap"
                            key={`word-content-${word}-${wIndex}`}
                          >
                            {isFullHidden ? (
                              <div className="group flex items-center justify-center px-1.5 py-0.5 opacity-80 transition-colors duration-300 hover:opacity-100">
                                <Lock className="h-2.5 w-2.5 text-muted-foreground transition-colors group-hover:text-[oklch(0.75_0.15_60)]" />
                              </div>
                            ) : (
                              word.split("").map((char, index) => {
                                const isSlot = char === "_";
                                if (isSlot) {
                                  return (
                                    <div
                                      aria-hidden="true"
                                      className={`mx-[0.5px] h-5 w-2.5 border-b border-muted-foreground/30 transition-all duration-300 ${isFullHidden ? "opacity-50" : "opacity-70"}`}
                                      key={`linear-slot-${char}-${index}`}
                                    />
                                  );
                                }
                                return (
                                  <div
                                    className="mx-[0.5px] flex h-5 w-2.5 items-center justify-center border-b border-transparent font-mono text-sm leading-none text-foreground"
                                    key={`linear-char-${char}-${index}`}
                                  >
                                    {char}
                                  </div>
                                );
                              })
                            )}
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
                                    word.split("").map((char, index) => {
                                      const isSlot = char === "_";
                                      if (isSlot) {
                                        return (
                                          <div
                                            aria-hidden="true"
                                            className={`mx-[0.5px] h-5 w-2.5 transition-all duration-300 ${
                                              isHovered
                                                ? "border-b border-[oklch(0.75_0.15_60)]"
                                                : `border-b border-muted-foreground/30 ${isFullHidden ? "opacity-50" : "opacity-70"}`
                                            }`}
                                            key={`linear-slot-tt-${char}-${index}`}
                                          />
                                        );
                                      }
                                      return (
                                        <div
                                          className="mx-[0.5px] flex h-5 w-2.5 items-center justify-center border-b border-transparent font-mono text-sm leading-none text-foreground"
                                          key={`linear-char-tt-${char}-${index}`}
                                        >
                                          {char}
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
                      })}
                    </span>
                  );
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
    { dotClass: "bg-[#fcd34d]", name: "Top", notes: notes.top },
    { dotClass: "bg-primary", name: "Heart", notes: notes.heart },
    { dotClass: "bg-foreground/60", name: "Base", notes: notes.base },
  ];

  return (
    <div className="rounded-md border border-border/50 bg-background p-4">
      <div className="group mb-4 flex w-fit cursor-default items-center gap-2">
        <Layers className="h-4 w-4 text-muted-foreground transition-transform duration-300 group-hover:scale-[1.15]" />
        <h2 className="font-[family-name:var(--font-playfair)] text-lg text-foreground lowercase">
          {t("pyramid")}
        </h2>
      </div>

      <ul className="flex flex-col">
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
                <div className="flex flex-wrap gap-2">
                  {level.notes.map((note, noteIndex) => {
                    const words = note.split(" ");

                    // Check if it's the generic placeholder "??????" passed from GameProvider?
                    if (note === "?????") {
                      return (
                        <span
                          className="inline-flex min-h-[30px] max-w-full cursor-default flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-md border border-border bg-secondary/50 px-3 py-1 text-sm font-medium text-muted-foreground transition-colors duration-300 hover:bg-secondary"
                          key={`${level.name}-note-${noteIndex}-${note.charAt(0)}`}
                        >
                          <GameTooltip
                            content={t("hiddenNote", {
                              attempt: currentAttempt,
                            })}
                          >
                            <div className="group flex cursor-help items-center justify-center px-2 py-0.5 opacity-80 transition-colors duration-300 hover:opacity-100">
                              <Lock className="h-3 w-3 text-muted-foreground transition-colors group-hover:text-[oklch(0.75_0.15_60)]" />
                            </div>
                          </GameTooltip>
                        </span>
                      );
                    }
                    // GameProvider usually returns real notes. If masked, they contain '•' or '_' if we updated logic.
                    // But wait, getVisibleNotes in provider usually reveals words or hides them?
                    // Let's assume standard logic: characters are masked.

                    return (
                      <span
                        className="inline-flex min-h-[30px] max-w-full cursor-default flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-md border border-border bg-secondary/50 px-3 py-1 text-sm font-medium text-muted-foreground transition-colors duration-300 hover:bg-secondary"
                        key={`${level.name}-note-${noteIndex}-${note.charAt(0)}`}
                      >
                        {words.map((word, wIndex) => {
                          const hasMasking = word.includes("_");
                          const isFullHidden = word === "?????";
                          const showTooltip = hasMasking;

                          const content = (
                            <div className="flex flex-nowrap">
                              {isFullHidden ? (
                                <div className="group flex items-center justify-center px-1.5 py-0.5 opacity-80 transition-colors duration-300 hover:opacity-100">
                                  <Lock className="h-2.5 w-2.5 text-muted-foreground transition-colors group-hover:text-[oklch(0.75_0.15_60)]" />
                                </div>
                              ) : (
                                word.split("").map((char, index) => {
                                  const isSlot = char === "_";
                                  if (isSlot) {
                                    return (
                                      <div
                                        aria-hidden="true"
                                        className={`mx-[0.5px] h-5 w-2.5 border-b border-muted-foreground/30 transition-all duration-300 ${isFullHidden ? "opacity-50" : "opacity-70"}`}
                                        key={`${level.name}-note-${noteIndex}-slot-${index}`}
                                      />
                                    );
                                  }
                                  return (
                                    <div
                                      className="mx-[0.5px] flex h-5 w-2.5 items-center justify-center border-b border-transparent font-mono text-sm leading-none text-foreground"
                                      key={`${level.name}-note-${noteIndex}-char-${index}`}
                                    >
                                      {char}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          );

                          if (showTooltip) {
                            return (
                              <GameTooltip
                                content={t("letters", { count: word.length })}
                                key={`${level.name}-note-${noteIndex}-word-${wIndex}`}
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
                                      word.split("").map((char, index) => {
                                        const isSlot = char === "_";
                                        if (isSlot) {
                                          return (
                                            <div
                                              aria-hidden="true"
                                              className={`mx-[0.5px] h-5 w-2.5 transition-all duration-300 ${
                                                isHovered
                                                  ? "border-b border-[oklch(0.75_0.15_60)]"
                                                  : `border-b border-muted-foreground/30 ${isFullHidden ? "opacity-50" : "opacity-70"}`
                                              }`}
                                              key={`slot-${index}`}
                                            />
                                          );
                                        }
                                        return (
                                          <div
                                            className="mx-[0.5px] flex h-5 w-2.5 items-center justify-center border-b border-transparent font-mono text-sm leading-none text-foreground"
                                            key={index}
                                          >
                                            {char}
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
                        })}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex min-h-[30px] max-w-full cursor-default flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-md border border-border bg-secondary/50 px-3 py-1 text-sm font-medium text-muted-foreground transition-colors duration-300 hover:bg-secondary">
                    <GameTooltip
                      content={t("hiddenNotes", { attempt: currentAttempt })}
                    >
                      <div className="group flex cursor-help items-center justify-center px-2 py-0.5 opacity-80 transition-colors duration-300 hover:opacity-100">
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
}
