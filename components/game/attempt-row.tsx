import type {
  HTMLAttributes,
  KeyboardEvent,
  MouseEvent,
  PointerEvent,
} from "react";

import { ArrowDown, ArrowUp, Check, Waves, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { GENERIC_PLACEHOLDER, MIDDLE_DOT_CHAR } from "@/lib/constants";
import { cn } from "@/lib/utils";

import { TruncatedCell } from "./attempt-log-truncated-cell";
import { DotFiller } from "./dot-filler";
import { GameTooltip } from "./game-tooltip";
import { IconCell, iconInnerVariants } from "./icon-cell";

import type { Attempt, DailyPerfume } from "./contexts";

type RowCellProperties = HTMLAttributes<HTMLDivElement> & {
  isActive: boolean;
  isTouch: boolean;
};

function RowCell({
  children,
  className,
  isActive,
  isTouch,
  ...props
}: RowCellProperties) {
  return (
    <div
      className={cn(
        "relative z-10 border-b border-muted/30 py-3 transition-all duration-300 group-last:border-0",
        isTouch && isActive ? "bg-muted/10" : "group-hover:bg-muted/10",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

type AttemptRowProperties = Readonly<{
  activeRowIndex: number | null;
  attempt: Attempt;
  dailyPerfume: DailyPerfume;
  handleClick: (e: MouseEvent) => void;
  handlePointerDown: (e: PointerEvent) => void;
  index: number;
  isNew: boolean;
  isTouch: boolean;
  totalAttempts: number;
}>;

/**
 * Represents a single row in the player's attempt log.
 * @param props - Component properties.
 * @param props.activeRowIndex - Index of the currently active row.
 * @param props.attempt - The attempt data to display.
 * @param props.dailyPerfume - The target perfume data.
 * @param props.handleClick - Mouse click handler.
 * @param props.handlePointerDown - Pointer down handler.
 * @param props.index - Index of the row.
 * @param props.isNew - Whether this is a new attempt.
 * @param props.isTouch - Whether the device is touch-enabled.
 * @param props.totalAttempts - Total number of attempts.
 */
export function AttemptRow({
  activeRowIndex,
  attempt,
  dailyPerfume,
  handleClick,
  handlePointerDown,
  index,
  isNew,
  isTouch,
  totalAttempts,
}: AttemptRowProperties) {
  const t = useTranslations("AttemptLog");
  const isActive = activeRowIndex === index;

  const interactiveProperties = {
    onClick: handleClick,
    onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleClick(e as unknown as MouseEvent);
      }
    },
    onPointerDown: handlePointerDown,
    role: "button" as const,
    tabIndex: 0,
  };

  if (attempt.isSkipped) {
    const showFlash = isNew && index === totalAttempts - 1;
    return (
      <div className="group contents" data-attempt-row>
        <RowCell
          className="flex items-center justify-center"
          id={`attempt-${index}`}
          isActive={isActive}
          isTouch={isTouch}
        >
          {showFlash ? (
            // eslint-disable-next-line better-tailwindcss/no-unknown-classes -- animate-flash-error is a custom CSS animation class defined in globals.css
            <div className="animate-flash-error pointer-events-none absolute inset-0 rounded-sm" />
          ) : null}
          <span className="block w-full pr-1 text-center text-[0.8125rem] font-normal text-muted-foreground">
            {index + 1}
          </span>
        </RowCell>

        <RowCell
          className="flex min-w-0 flex-row items-center gap-2 pr-0 pl-2"
          isActive={isActive}
          isTouch={isTouch}
        >
          {showFlash ? (
            // eslint-disable-next-line better-tailwindcss/no-unknown-classes -- animate-flash-error is a custom CSS animation class defined in globals.css
            <div className="animate-flash-error pointer-events-none absolute inset-0 rounded-sm" />
          ) : null}
          <span className="shrink-0 text-[0.8125rem] text-foreground/75 lowercase">
            {t("skipped")}
          </span>
          <DotFiller />
        </RowCell>

        <RowCell
          className="grid w-full grid-cols-5 pr-0.5 pl-1"
          isActive={isActive}
          isTouch={isTouch}
        >
          {showFlash ? (
            // eslint-disable-next-line better-tailwindcss/no-unknown-classes -- animate-flash-error is a custom CSS animation class defined in globals.css
            <div className="animate-flash-error pointer-events-none absolute inset-0 rounded-sm" />
          ) : null}
          <div className="col-span-5 grid grid-cols-5 opacity-20">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                className={`flex h-full items-center justify-center ${i < 4 ? "border-r border-dotted border-muted/30" : ""}`}
                key={i}
              >
                <span className="font-hand text-base text-muted-foreground">
                  —
                </span>
              </div>
            ))}
          </div>
        </RowCell>
      </div>
    );
  }

  const flashClass = attempt.isCorrect ? "animate-flash-success" : "animate-flash-error";

  return (
    <div className="group contents" data-attempt-row>
      <RowCell
        className="flex items-center justify-center"
        id={`attempt-${index}`}
        isActive={isActive}
        isTouch={isTouch}
        {...interactiveProperties}
      >
        {isNew && index === totalAttempts - 1 ? (
          <div
            className={cn(
              "pointer-events-none absolute inset-0 rounded-sm",
              flashClass,
            )}
          />
        ) : null}
        <span className="block w-full pr-1 text-center text-[0.8125rem] font-normal text-muted-foreground">
          {index + 1}
        </span>
      </RowCell>

      <RowCell
        className="flex min-w-0 flex-row items-center gap-2 pr-0 pl-2"
        isActive={isActive}
        isTouch={isTouch}
        {...interactiveProperties}
      >
        {isNew && index === totalAttempts - 1 ? (
          <div
            className={cn(
              "pointer-events-none absolute inset-0 rounded-sm",
              flashClass,
            )}
          />
        ) : null}
        {(() => {
          const concentration = attempt.concentration || "";
          const displayName =
            concentration &&
            attempt.guess.toLowerCase().endsWith(concentration.toLowerCase())
              ? attempt.guess
                  .slice(
                    0,
                    Math.max(0, attempt.guess.length - concentration.length),
                  )
                  .trim()
              : attempt.guess;

          return (
            <>
              <div className="flex min-w-0 shrink flex-col gap-y-0.5 text-left">
                {/* Row 1: Name & Concentration */}
                {/* Mobile: stacked (each piece on its own line) */}
                <div className="flex flex-col gap-y-0.5 lg:hidden">
                  <TruncatedCell
                    className="min-w-0 shrink"
                    content={displayName}
                  />
                  {concentration && concentration !== "Unknown" ? (
                    <TruncatedCell
                      className="min-w-0 shrink-[5]"
                      content={concentration}
                      textClassName="text-muted-foreground/80 text-xs font-normal truncate tracking-normal"
                    />
                  ) : null}
                </div>
                {/* Desktop: inline with separator */}
                <TruncatedCell
                  className="hidden min-w-0 lg:block"
                  content={
                    concentration && concentration !== "Unknown"
                      ? `${displayName} ${MIDDLE_DOT_CHAR} ${concentration}`
                      : displayName
                  }
                  textClassName="text-sm truncate tracking-normal"
                >
                  <span className="font-semibold text-foreground">
                    {displayName}
                  </span>
                  {concentration && concentration !== "Unknown" ? (
                    <>
                      <span className="mx-1.5 text-xs text-muted-foreground/30">
                        {MIDDLE_DOT_CHAR}
                      </span>
                      <span className="text-xs font-normal text-muted-foreground/80">
                        {concentration}
                      </span>
                    </>
                  ) : null}
                </TruncatedCell>

                {/* Row 2: Brand & Year */}
                {/* Mobile: stacked (year always fully visible) */}
                <div className="flex flex-col gap-y-0.5 text-muted-foreground/80 lg:hidden">
                  <TruncatedCell
                    className="min-w-[1.875rem] shrink"
                    content={attempt.brand}
                    textClassName="text-xs font-medium truncate tracking-normal"
                  />
                  {attempt.year != null && attempt.year !== 0 ? (
                    <span className="text-xs font-medium whitespace-nowrap">
                      {attempt.year}
                    </span>
                  ) : null}
                </div>
                {/* Desktop: inline with separator */}
                <TruncatedCell
                  className="hidden min-w-0 lg:block"
                  content={
                    attempt.year != null && attempt.year !== 0
                      ? `${attempt.brand} ${MIDDLE_DOT_CHAR} ${attempt.year}`
                      : attempt.brand
                  }
                  textClassName="text-xs font-medium truncate tracking-normal text-muted-foreground/80"
                >
                  <span className="text-muted-foreground/80">
                    {attempt.brand}
                  </span>
                  {attempt.year != null && attempt.year !== 0 ? (
                    <>
                      <span className="mx-1.5 font-normal text-muted-foreground/30">
                        {MIDDLE_DOT_CHAR}
                      </span>
                      <span className="text-muted-foreground/80">
                        {attempt.year}
                      </span>
                    </>
                  ) : null}
                </TruncatedCell>
              </div>
              <DotFiller />
            </>
          );
        })()}
      </RowCell>

      <RowCell
        className="grid w-full grid-cols-5 pr-0.5 pl-1 font-hand text-xl text-primary"
        isActive={isActive}
        isTouch={isTouch}
        {...interactiveProperties}
      >
        {isNew && index === totalAttempts - 1 ? (
          <div
            className={cn(
              "pointer-events-none absolute inset-0 rounded-sm",
              flashClass,
            )}
          />
        ) : null}
        {/* Brand */}
        <div className="flex h-full items-center justify-center">
          {(() => {
            const targetMissing =
              !dailyPerfume.brand || dailyPerfume.brand === "Unknown";
            const guessMissing = !attempt.brand || attempt.brand === "Unknown";

            if (targetMissing || guessMissing) {
              return (
                <GameTooltip
                  className="size-7 items-center justify-center sm:size-8"
                  content={t("tooltips.brandMissing")}
                >
                  <IconCell
                    as="span"
                    className="font-hand text-base leading-none text-muted-foreground"
                    layout="icon"
                    variant="muted"
                  >
                    <span
                      className={cn(iconInnerVariants(), "-translate-x-0.5")}
                    >
                      {GENERIC_PLACEHOLDER}
                    </span>
                  </IconCell>
                </GameTooltip>
              );
            }

            if (attempt.feedback.brandMatch) {
              return (
                <GameTooltip
                  className="size-7 items-center justify-center sm:size-8"
                  content={t("tooltips.brandCorrect")}
                >
                  <IconCell cursor="default" variant="success">
                    <Check
                      className={cn("size-4 text-success", iconInnerVariants())}
                    />
                  </IconCell>
                </GameTooltip>
              );
            }

            return (
              <GameTooltip
                className="size-7 items-center justify-center sm:size-8"
                content={t("tooltips.brandIncorrect")}
              >
                <IconCell as="span" layout="pad" variant="muted">
                  <X
                    className={cn(
                      "size-4 text-muted-foreground",
                      iconInnerVariants({ skewed: true }),
                    )}
                    strokeWidth={1.5}
                  />
                </IconCell>
              </GameTooltip>
            );
          })()}
        </div>

        {/* Perfumer */}
        <div className="flex h-full items-center justify-center">
          {(() => {
            const targetMissing =
              !dailyPerfume.perfumer || dailyPerfume.perfumer === "Unknown";
            const guessMissing =
              !attempt.perfumers || attempt.perfumers.length === 0;
            if (targetMissing || guessMissing) {
              return (
                <GameTooltip
                  className="size-7 items-center justify-center sm:size-8"
                  content={t("tooltips.perfumerMissing")}
                >
                  <IconCell
                    as="span"
                    className="font-hand text-base leading-none text-muted-foreground"
                    layout="icon"
                    variant="muted"
                  >
                    <span
                      className={cn(iconInnerVariants(), "-translate-x-0.5")}
                    >
                      {GENERIC_PLACEHOLDER}
                    </span>
                  </IconCell>
                </GameTooltip>
              );
            }

            if (attempt.feedback.perfumerMatch === "full") {
              return (
                <GameTooltip
                  className="size-7 items-center justify-center sm:size-8"
                  content={t("tooltips.perfumerFull")}
                >
                  <IconCell cursor="default" variant="success">
                    <Check
                      className={cn("size-4 text-success", iconInnerVariants())}
                    />
                  </IconCell>
                </GameTooltip>
              );
            } else if (attempt.feedback.perfumerMatch === "partial") {
              return (
                <GameTooltip
                  className="size-7 items-center justify-center sm:size-8"
                  content={t("tooltips.perfumerPartial")}
                >
                  <IconCell as="span" layout="pad" variant="warning">
                    <Waves
                      className={cn(
                        "size-4 text-warning",
                        iconInnerVariants({ skewed: true }),
                      )}
                      strokeWidth={1.5}
                    />
                  </IconCell>
                </GameTooltip>
              );
            } else {
              return (
                <GameTooltip
                  className="size-7 items-center justify-center sm:size-8"
                  content={t("tooltips.perfumerIncorrect")}
                >
                  <IconCell as="span" layout="pad" variant="muted">
                    <X
                      className={cn(
                        "size-4 text-muted-foreground",
                        iconInnerVariants({ skewed: true }),
                      )}
                      strokeWidth={1.5}
                    />
                  </IconCell>
                </GameTooltip>
              );
            }
          })()}
        </div>

        {/* Year */}
        <div className="flex h-full items-center justify-center">
          {(() => {
            const targetMissing = dailyPerfume.year === 0;
            const guessMissing = attempt.year === 0;
            if (targetMissing || guessMissing) {
              return (
                <GameTooltip
                  className="size-7 items-center justify-center sm:size-8"
                  content={t("tooltips.yearMissing")}
                >
                  <IconCell
                    as="span"
                    className="font-hand text-base leading-none text-muted-foreground"
                    layout="icon"
                    variant="muted"
                  >
                    <span
                      className={cn(iconInnerVariants(), "-translate-x-0.5")}
                    >
                      {GENERIC_PLACEHOLDER}
                    </span>
                  </IconCell>
                </GameTooltip>
              );
            }

            return attempt.feedback.yearMatch === "correct" ? (
              <GameTooltip
                className="size-7 items-center justify-center sm:size-8"
                content={t("tooltips.yearCorrect")}
              >
                <IconCell cursor="default" variant="success">
                  <Check
                    className={cn("size-4 text-success", iconInnerVariants())}
                  />
                </IconCell>
              </GameTooltip>
            ) : (
              <div className="flex size-full flex-col items-center justify-center">
                <GameTooltip
                  className="size-7 items-center justify-center sm:size-8"
                  content={(() => {
                    if (attempt.feedback.yearMatch === "close") {
                      return attempt.feedback.yearDirection === "higher"
                        ? t("tooltips.yearCloseHigher")
                        : t("tooltips.yearCloseLower");
                    }
                    return attempt.feedback.yearDirection === "higher"
                      ? t("tooltips.yearWrongHigher")
                      : t("tooltips.yearWrongLower");
                  })()}
                >
                  <IconCell
                    as="span"
                    className={
                      attempt.feedback.yearMatch === "close"
                        ? "text-warning"
                        : "text-muted-foreground"
                    }
                    variant={
                      attempt.feedback.yearMatch === "close"
                        ? "warning"
                        : "muted"
                    }
                  >
                    {attempt.feedback.yearDirection === "higher" ? (
                      <ArrowUp
                        className={cn(
                          "size-4",
                          iconInnerVariants({ skewed: true }),
                        )}
                        strokeWidth={1.5}
                      />
                    ) : (
                      <ArrowDown
                        className={cn(
                          "size-4",
                          iconInnerVariants({ skewed: true }),
                        )}
                        strokeWidth={1.5}
                      />
                    )}
                  </IconCell>
                </GameTooltip>
              </div>
            );
          })()}
        </div>

        {/* Gender */}
        <div className="flex h-full items-center justify-center">
          {(() => {
            const guessGender = attempt.gender?.toLowerCase() || "unknown";
            const targetGender = dailyPerfume.gender.toLowerCase() || "unknown";

            const targetMissing = targetGender === "unknown";
            const guessMissing = guessGender === "unknown";

            if (targetMissing || guessMissing) {
              return (
                <GameTooltip
                  className="size-7 items-center justify-center sm:size-8"
                  content={t("tooltips.genderMissing")}
                >
                  <IconCell
                    as="span"
                    className="font-hand text-base leading-none text-muted-foreground"
                    layout="icon"
                    variant="muted"
                  >
                    <span
                      className={cn(iconInnerVariants(), "-translate-x-0.5")}
                    >
                      {GENERIC_PLACEHOLDER}
                    </span>
                  </IconCell>
                </GameTooltip>
              );
            }

            if (guessGender === targetGender) {
              return (
                <GameTooltip
                  className="size-7 items-center justify-center sm:size-8"
                  content={t("tooltips.genderCorrect")}
                >
                  <IconCell cursor="default" variant="success">
                    <Check
                      className={cn("size-4 text-success", iconInnerVariants())}
                    />
                  </IconCell>
                </GameTooltip>
              );
            }

            return (
              <GameTooltip
                className="size-7 items-center justify-center sm:size-8"
                content={t("tooltips.genderIncorrect")}
              >
                <IconCell as="span" layout="pad" variant="muted">
                  <X
                    className={cn(
                      "size-4 text-muted-foreground",
                      iconInnerVariants({ skewed: true }),
                    )}
                    strokeWidth={1.5}
                  />
                </IconCell>
              </GameTooltip>
            );
          })()}
        </div>

        {/* Notes */}
        <div className="flex h-full items-center justify-center">
          {(() => {
            const answerHasNotes =
              dailyPerfume.notes.top.length > 0 ||
              dailyPerfume.notes.heart.length > 0 ||
              dailyPerfume.notes.base.length > 0;

            const isMissing =
              !answerHasNotes || attempt.hasGuessedNotes === false;

            if (isMissing) {
              return (
                <GameTooltip
                  className="size-7 items-center justify-center sm:size-8"
                  content={t("tooltips.notesMissing")}
                >
                  <IconCell
                    as="span"
                    className="font-hand text-base leading-none text-muted-foreground"
                    layout="icon"
                    variant="muted"
                  >
                    <span
                      className={cn(iconInnerVariants(), "-translate-x-0.5")}
                    >
                      {GENERIC_PLACEHOLDER}
                    </span>
                  </IconCell>
                </GameTooltip>
              );
            }

            return attempt.feedback.notesMatch >= 1 ? (
              <GameTooltip
                className="size-7 items-center justify-center sm:size-8"
                content={t("tooltips.notesCorrect")}
              >
                <IconCell cursor="default" variant="success">
                  <Check
                    className={cn("size-5 text-success", iconInnerVariants())}
                  />
                </IconCell>
              </GameTooltip>
            ) : (
              <GameTooltip
                className="size-7 items-center justify-center sm:size-8"
                content={t("tooltips.notesPercentage", {
                  percent: Math.round(attempt.feedback.notesMatch * 100),
                })}
              >
                <IconCell
                  as="span"
                  className={cn(
                    "font-hand text-sm leading-none sm:text-base",
                    attempt.feedback.notesMatch >= 0.4
                      ? "text-warning"
                      : "text-muted-foreground",
                  )}
                  layout="text"
                  variant={
                    attempt.feedback.notesMatch >= 0.4 ? "warning" : "muted"
                  }
                >
                  <span className={iconInnerVariants()}>
                    {Math.round(attempt.feedback.notesMatch * 100)}%
                  </span>
                </IconCell>
              </GameTooltip>
            );
          })()}
        </div>
      </RowCell>
    </div>
  );
}
