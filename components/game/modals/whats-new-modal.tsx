"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";

import { CHANGELOG } from "@/lib/changelog";
import { BULLET_CHAR } from "@/lib/constants";

import { ModalFrame } from "./modal-header";

type WhatsNewModalProperties = {
  onClose: () => void;
  open: boolean;
};

/**
 * Lists what changed in the game, as written for players: the versions with notes, newest first, in the
 * page language. Technical versions (no notes) are left out; the version being played is shown at the end.
 * @param props - Dialog state.
 * @param props.onClose - Called when the dialog asks to close.
 * @param props.open - Whether the dialog is shown.
 */
export function WhatsNewModal({
  onClose,
  open,
}: Readonly<WhatsNewModalProperties>) {
  const t = useTranslations("WhatsNewModal");
  const format = useFormatter();
  const language = useLocale() === "pl" ? "pl" : "en";
  const entries = CHANGELOG.filter((entry) => entry.notes.length > 0);

  return (
    <ModalFrame
      closeLabel={t("ariaClose")}
      description={t("description")}
      onClose={onClose}
      open={open}
      title={t("title")}
    >
      {/* Versions with notes, newest first */}
      <div
        className="space-y-6 overflow-y-auto p-6 pt-4 text-sm leading-relaxed text-foreground"
        data-lenis-prevent
      >
        {entries.length === 0 ? (
          <p className="text-muted-foreground">{t("empty")}</p>
        ) : (
          entries.map((entry) => (
            <section key={entry.version}>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h3 className="font-semibold">{entry.version}</h3>
                <time
                  className="text-xs text-muted-foreground"
                  dateTime={entry.date}
                >
                  {format.dateTime(new Date(`${entry.date}T00:00:00Z`), {
                    dateStyle: "long",
                    timeZone: "UTC",
                  })}
                </time>
              </div>
              <ul className="space-y-2">
                {entry.notes.map((note) => (
                  <li className="flex gap-2" key={note.en}>
                    <span aria-hidden="true" className="text-primary">
                      {BULLET_CHAR}
                    </span>
                    <span>{note[language]}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}

        <p className="border-t border-border pt-4 text-xs text-muted-foreground">
          {t("version", { version: CHANGELOG[0]?.version ?? "" })}
        </p>
      </div>
    </ModalFrame>
  );
}
