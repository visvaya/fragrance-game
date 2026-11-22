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

import type { Attempt } from "./contexts";
import type { RevealedClues } from "@/lib/game/clue-reveal";

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

const CLUE_TOOLTIP_CLASS = "size-7 items-center justify-center sm:size-8";

/** Placeholder icon for a clue that the answer or the guess does not have. */
function MissingClue({ content }: Readonly<{ content: string }>) {
  return (
    <GameTooltip className={CLUE_TOOLTIP_CLASS} content={content}>
      <IconCell
        as="span"
        className="font-hand text-base leading-none text-muted-foreground"
        layout="icon"
        variant="muted"
      >
        <span className={cn(iconInnerVariants(), "-translate-x-0.5")}>
          {GENERIC_PLACEHOLDER}
        </span>
      </IconCell>
    </GameTooltip>
  );
}

/** Green check icon for a fully matched clue. */
function ClueCheck({
  content,
  iconClassName = "size-4",
}: Readonly<{ content: string; iconClassName?: string }>) {
  return (
    <GameTooltip className={CLUE_TOOLTIP_CLASS} content={content}>
      <IconCell cursor="default" variant="success">
        <Check
          className={cn(iconClassName, "text-success", iconInnerVariants())}
        />
      </IconCell>
    </GameTooltip>
  );
}

/** Muted cross icon for a clue that did not match. */
function ClueMiss({ content }: Readonly<{ content: string }>) {
  return (
    <GameTooltip className={CLUE_TOOLTIP_CLASS} content={content}>
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

type AttemptRowProperties = Readonly<{
  activeRowIndex: number | null;
  attempt: Attempt;
  clues: RevealedClues;
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
 * @param props.clues - Server clues; answerHas tells which answer fields exist.
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
  clues,
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
          <span className="block w-full text-center text-[0.8125rem] font-normal text-muted-foreground sm:pr-1">
            {index + 1}
          </span>
        </RowCell>

        <RowCell
          className="flex min-w-0 flex-row items-center gap-2 pr-0 pl-1 sm:pl-2"
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
          className="grid w-full grid-cols-5 pr-1.5 pl-0 sm:pr-2 sm:pl-1"
          isActive={isActive}
          isTouch={isTouch}
        >
          {showFlash ? (
            // eslint-disable-next-line better-tailwindcss/no-unknown-classes -- animate-flash-error is a custom CSS animation class defined in globals.css
            <div className="animate-flash-error pointer-events-none absolute inset-0 rounded-sm" />
          ) : null}
          <div className="col-span-5 grid grid-cols-5 opacity-20">
            {["brand", "perfumer", "year", "gender", "notes"].map(
              (colKey, i) => (
                <div
                  className={`flex h-full items-center justify-center ${i < 4 ? "border-r border-dotted border-muted/30" : ""}`}
                  key={`skipped-col-${colKey}`}
                >
                  <span className="font-hand text-base text-muted-foreground">
                    —
                  </span>
                </div>
              ),
            )}
          </div>
        </RowCell>
      </div>
    );
  }

  const flashClass = attempt.isCorrect
    ? "animate-flash-success"
    : "animate-flash-error";

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
        <span className="block w-full text-center text-[0.8125rem] font-normal text-muted-foreground sm:pr-1">
          {index + 1}
        </span>
      </RowCell>

      <RowCell
        className="flex min-w-0 flex-row items-center gap-2 pr-0 pl-1 sm:pl-2"
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
        className="grid w-full grid-cols-5 pr-1.5 pl-0 font-hand text-xl text-primary sm:pr-2 sm:pl-1"
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
            const targetMissing = !clues.answerHas.brand;
            const guessMissing = !attempt.brand || attempt.brand === "Unknown";

            if (targetMissing || guessMissing) {
              return <MissingClue content={t("tooltips.brandMissing")} />;
            }

            if (attempt.feedback.brandMatch) {
              return <ClueCheck content={t("tooltips.brandCorrect")} />;
            }

            return <ClueMiss content={t("tooltips.brandIncorrect")} />;
          })()}
        </div>

        {/* Perfumer */}
        <div className="flex h-full items-center justify-center">
          {(() => {
            const targetMissing = !clues.answerHas.perfumer;
            const guessMissing =
              !attempt.perfumers || attempt.perfumers.length === 0;
            if (targetMissing || guessMissing) {
              return <MissingClue content={t("tooltips.perfumerMissing")} />;
            }

            if (attempt.feedback.perfumerMatch === "full") {
              return <ClueCheck content={t("tooltips.perfumerFull")} />;
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
              return <ClueMiss content={t("tooltips.perfumerIncorrect")} />;
            }
          })()}
        </div>

        {/* Year */}
        <div className="flex h-full items-center justify-center">
          {(() => {
            const targetMissing = !clues.answerHas.year;
            const guessMissing = attempt.year === 0;
            if (targetMissing || guessMissing) {
              return <MissingClue content={t("tooltips.yearMissing")} />;
            }

            return attempt.feedback.yearMatch === "correct" ? (
              <ClueCheck content={t("tooltips.yearCorrect")} />
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
            const guessGender =
              attempt.gender?.trim().toLowerCase() || "unknown";
            const targetMissing = !clues.answerHas.gender;
            const guessMissing = guessGender === "unknown";

            if (targetMissing || guessMissing) {
              return <MissingClue content={t("tooltips.genderMissing")} />;
            }

            if (attempt.feedback.genderMatch) {
              return <ClueCheck content={t("tooltips.genderCorrect")} />;
            }

            return <ClueMiss content={t("tooltips.genderIncorrect")} />;
          })()}
        </div>

        {/* Notes */}
        <div className="flex h-full items-center justify-center">
          {(() => {
            const isMissing =
              !clues.answerHas.notes || attempt.hasGuessedNotes === false;

            if (isMissing) {
              return <MissingClue content={t("tooltips.notesMissing")} />;
            }

            return attempt.feedback.notesMatch >= 1 ? (
              <ClueCheck
                content={t("tooltips.notesCorrect")}
                iconClassName="size-5"
              />
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
