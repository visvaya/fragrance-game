"use client";

import { Circle, Layers } from "lucide-react";
import { useTranslations } from "next-intl";

import { useGameState } from "../contexts";
import { GameTooltip } from "../game-tooltip";

/**
 *
 */
export function PyramidClues() {
  const t = useTranslations("PyramidClues");
  const { currentAttempt, dailyPerfume, gameState, visibleNotes, revealLevel } =
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
        <div className="mb-4 flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-[family-name:var(--font-playfair)] text-lg text-foreground">
            {t("olfactoryProfile")}
          </h2>
        </div>

        <ul className="space-y-4">
          <li className="relative flex flex-col gap-2 overflow-hidden rounded-sm border border-border/60 p-4">
            {/* Colored Strip for Linear (Cyberpunk/Mixed -> maybe primary color or purple?) */}
            {/* Using primary for consistency with Heart level or specific Linear color */}
            <div className="absolute top-0 bottom-0 left-0 w-1 bg-primary" />

            <div className="flex items-center gap-2 pl-2">
              <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
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

            <div className="pl-2">
              <div className="flex flex-wrap justify-start gap-x-4 gap-y-2 text-sm">
                {displayNotes.map((note, i) => {
                  const isFullHidden = /^_+$|^\?\?\?\?\?$/.test(note); // Check for full underscores or sentinel
                  const words = note.split(" ");

                  // Generic placeholder case (Level 1)
                  // Note: In linear logic above we normalized to ___, but verify whatever comes in.
                  // If it's a generic placeholder for "hidden note"
                  if (revealLevel === 1 && note === "?????") {
                    return (
                      <span
                        className="inline-flex min-h-[30px] cursor-default items-center gap-x-2 rounded-md border border-border bg-secondary/50 px-3 py-1 text-sm font-medium text-muted-foreground transition-colors duration-300 hover:bg-secondary"
                        key={i}
                      >
                        <GameTooltip
                          content={t("hiddenNote", { attempt: currentAttempt })}
                        >
                          <div className="flex cursor-help">
                            {/* Render 5 generic slots */}
                            {[1, 2, 3, 4, 5].map((_, idx) => (
                              <div
                                aria-hidden="true"
                                className="mx-[0.5px] h-5 w-2.5 border-b border-muted-foreground/30"
                                key={idx}
                              />
                            ))}
                          </div>
                        </GameTooltip>
                      </span>
                    );
                  }

                  return (
                    <span
                      className="inline-flex min-h-[30px] cursor-default items-center gap-x-2 rounded-md border border-border bg-secondary/50 px-3 py-1 text-sm font-medium text-muted-foreground transition-colors duration-300 hover:bg-secondary"
                      key={i}
                    >
                      {words.map((word, wIndex) => {
                        // Check if word contains masking chars
                        const hasMasking = word.includes("_");
                        const showTooltip = hasMasking;

                        const content = (
                          <div className="flex flex-wrap">
                            {word.split("").map((char, index) => {
                              const isSlot = char === "_";
                              if (isSlot) {
                                return (
                                  <div
                                    aria-hidden="true"
                                    className={`mx-[0.5px] h-5 w-2.5 border-b border-muted-foreground/30 transition-all duration-300 ${isFullHidden ? "opacity-50" : "opacity-70"}`}
                                    key={index}
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
                            })}
                          </div>
                        );

                        if (showTooltip) {
                          return (
                            <GameTooltip
                              content={t("letters", { count: word.length })}
                              key={wIndex}
                            >
                              {({ isHovered }: { isHovered?: boolean }) => (
                                <div className="flex flex-wrap">
                                  {word.split("").map((char, index) => {
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
                                          key={index}
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
                                  })}
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
            </div>
          </li>
        </ul>
      </div>
    );
  }

  // TRADITIONAL PYRAMID LOGIC
  const levels = [
    { color: "text-[#fcd34d]", name: "Top", notes: notes.top }, // Yellow (Valid Tailwind class for bg- replacement)
    { color: "text-primary", name: "Heart", notes: notes.heart }, // Amber
    { color: "text-foreground", name: "Base", notes: notes.base }, // Dark
  ];

  return (
    <div className="rounded-md border border-border/50 bg-background p-4">
      <div className="mb-4 flex items-center gap-2">
        <Layers className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-[family-name:var(--font-playfair)] text-lg text-foreground">
          {t("pyramid")}
        </h2>
      </div>

      <ul className="space-y-4">
        {levels.map((level) => (
          <li
            className="relative flex flex-col gap-2 overflow-hidden rounded-sm border border-border/60 p-4"
            key={level.name}
          >
            {/* Colored Strip */}
            {/* Direct style color injection for yellow to be safe, or use bg-yellow-400 */}
            <div
              className={`absolute top-0 bottom-0 left-0 w-1 ${level.name === "Top" ? "bg-[#fcd34d]" : level.color.replace("text-", "bg-")}`}
            />

            <div className="flex items-center gap-2 pl-2">
              <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
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

            <div className="pl-2">
              {level.notes && level.notes.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {level.notes.map((note, noteIndex) => {
                    const isFullHidden = /^_+$|^\?\?\?\?\?$/.test(note);
                    const words = note.split(" ");

                    // Check if it's the generic placeholder "??????" passed from GameProvider?
                    if (note === "?????") {
                      return (
                        <span
                          className="inline-flex min-h-[30px] cursor-default items-center gap-x-2 rounded-md border border-border bg-secondary/50 px-3 py-1 text-sm font-medium text-muted-foreground transition-colors duration-300 hover:bg-secondary"
                          key={noteIndex}
                        >
                          <GameTooltip
                            content={t("hiddenNote", {
                              attempt: currentAttempt,
                            })}
                          >
                            <div className="flex cursor-help">
                              {/* Render 5 generic slots */}
                              {[1, 2, 3, 4, 5].map((_, idx) => (
                                <div
                                  aria-hidden="true"
                                  className="mx-[0.5px] h-5 w-2.5 border-b border-muted-foreground/30"
                                  key={idx}
                                />
                              ))}
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
                        className="inline-flex min-h-[30px] cursor-default items-center gap-x-2 rounded-md border border-border bg-secondary/50 px-3 py-1 text-sm font-medium text-muted-foreground transition-colors duration-300 hover:bg-secondary"
                        key={noteIndex}
                      >
                        {words.map((word, wIndex) => {
                          const hasMasking = word.includes("_");
                          const showTooltip = hasMasking;

                          const content = (
                            <div className="flex flex-wrap">
                              {word.split("").map((char, index) => {
                                const isSlot = char === "_";
                                if (isSlot) {
                                  return (
                                    <div
                                      aria-hidden="true"
                                      className={`mx-[0.5px] h-5 w-2.5 border-b border-muted-foreground/30 transition-all duration-300 ${isFullHidden ? "opacity-50" : "opacity-70"}`}
                                      key={index}
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
                              })}
                            </div>
                          );

                          if (showTooltip) {
                            return (
                              <GameTooltip
                                content={t("letters", { count: word.length })}
                                key={wIndex}
                              >
                                {({ isHovered }: { isHovered?: boolean }) => (
                                  <div className="flex flex-wrap">
                                    {word.split("").map((char, index) => {
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
                                            key={index}
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
                                    })}
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
                  <span className="inline-flex min-h-[30px] cursor-default items-center gap-x-2 rounded-md border border-border bg-secondary/50 px-3 py-1 text-sm font-medium text-muted-foreground transition-colors duration-300 hover:bg-secondary">
                    <GameTooltip
                      content={t("hiddenNotes", { attempt: currentAttempt })}
                    >
                      <div className="flex cursor-help">
                        {/* Generic placeholder for unknown notes */}
                        {[1, 2, 3].map((_, idx) => (
                          <div
                            aria-hidden="true"
                            className="mx-[0.5px] h-5 w-2.5 border-b border-muted-foreground/30"
                            key={idx}
                          />
                        ))}
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
