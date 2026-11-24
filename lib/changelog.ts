import { z } from "zod";

import changelog from "./changelog.json";

/** The version as written in package.json and in the git tags (without the leading v). */
export const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/** One thing a player can notice, in both languages of the game. */
const noteSchema = z.object({ en: z.string().min(1), pl: z.string().min(1) });

/**
 * One version. `notes` are its player-facing changes; an empty list marks a technical version
 * (dependencies, refactors, CI) that the "What's new" list leaves out.
 */
const entrySchema = z.object({
  date: z.iso.date(),
  notes: z.array(noteSchema),
  version: z.string().regex(VERSION_PATTERN),
});

const changelogSchema = z.array(entrySchema).min(1);

export type ChangelogEntry = z.infer<typeof entrySchema>;

/**
 * The change list (lib/changelog.json), newest version first, checked at the boundary.
 * @param raw - Parsed JSON of the file.
 */
export function parseChangelog(raw: unknown): ChangelogEntry[] {
  return changelogSchema.parse(raw);
}

/** The change list of this build, newest version first; its first entry is the version being played. */
export const CHANGELOG = parseChangelog(changelog);
