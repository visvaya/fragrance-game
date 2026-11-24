// How a pull request moves the version of the app, as pure functions. `version` in package.json is the one
// number: a pull request that changes what is deployed moves it by the step its title names (Conventional
// Commits), any other leaves it as it was. The git calls are in scripts/version.ts.
import { z } from "zod";

import { VERSION_PATTERN, type ChangelogEntry } from "../lib/changelog";

export const CHANGELOG_FILE = "lib/changelog.json";

const TITLE_PATTERN = /^([a-z]+)(\([^)]+\))?(!)?: /;

type Bump = "major" | "minor" | "patch";

// package.json as far as the rules read it; the other fields are kept for the comparison of build inputs.
const packageSchema = z.looseObject({
  scripts: z.record(z.string(), z.string()).optional(),
  version: z.string().regex(VERSION_PATTERN),
});
type PackageJson = z.infer<typeof packageSchema>;

/**
 * package.json checked at the boundary.
 * @param raw - Parsed JSON of the file.
 */
export function parsePackage(raw: unknown): PackageJson {
  return packageSchema.parse(raw);
}

// What Vercel builds the app from. Tests, notes, CI, scripts and the database do not ship.
const SHIPPED_PREFIXES = ["app/", "components/", "hooks/", "i18n/", "lib/", "messages/", "public/"];
const SHIPPED_FILES = new Set([
  "instrumentation-client.ts",
  "instrumentation.ts",
  "next.config.ts",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "postcss.config.ts",
  "proxy.ts",
  "sentry.edge.config.ts",
  "sentry.server.config.ts",
  "sentry.shared.config.ts",
  "tsconfig.json",
  "vercel.json",
]);
const TEST_DIRECTORY = /(?:^|\/)__tests__\//;
const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/;

/**
 * The numbers of a version.
 * @param text - `major.minor.patch`.
 */
function parseVersion(text: string): [number, number, number] {
  if (!VERSION_PATTERN.test(text)) throw new Error(`not a version: "${text}"`);
  const [major = 0, minor = 0, patch = 0] = text.split(".").map(Number);
  return [major, minor, patch];
}

/**
 * The step a squashed pull request's title asks for: `!` a breaking change, `feat` a new capability.
 * @param title - Pull request title.
 */
export function bumpOfTitle(title: string): Bump {
  const match = TITLE_PATTERN.exec(title);
  if (match === null) throw new Error(`the title is not a Conventional Commit: "${title}"`);
  if (match[3] === "!") return "major";
  return match[1] === "feat" ? "minor" : "patch";
}

/**
 * The version after a step. Before 1.0 the first number stays at 0: a breaking change moves the middle one.
 * @param version - Current version.
 * @param bump - Step to take.
 */
export function nextVersion(version: string, bump: Bump): string {
  const [major, minor, patch] = parseVersion(version);
  if (bump === "major" && major > 0) return `${major + 1}.0.0`;
  if (bump === "patch") return `${major}.${minor}.${patch + 1}`;
  return `${major}.${minor + 1}.0`;
}

/** package.json as far as the build reads it: all but the version and the scripts other than `build`. */
const buildInputs = (pkg: PackageJson): string =>
  JSON.stringify({ ...pkg, scripts: pkg.scripts?.["build"], version: undefined });

/**
 * Whether these changed files change what is deployed.
 * @param changedPaths - Repository paths changed by the pull request.
 * @param basePackage - package.json of the base.
 * @param headPackage - package.json of the pull request.
 */
export function shipsTheApp(
  changedPaths: readonly string[],
  basePackage: PackageJson,
  headPackage: PackageJson,
): boolean {
  return changedPaths.some((path) => {
    if (path === "package.json") return buildInputs(basePackage) !== buildInputs(headPackage);
    if (TEST_DIRECTORY.test(path) || TEST_FILE.test(path)) return false;
    return SHIPPED_FILES.has(path) || SHIPPED_PREFIXES.some((prefix) => path.startsWith(prefix));
  });
}

type PullRequest = {
  basePackage: PackageJson;
  changedPaths: readonly string[];
  headPackage: PackageJson;
  title: string;
};

/**
 * The version a pull request must carry: the next one when it ships, the base one otherwise.
 * @param pr - Title, changed files and both package.json files.
 */
export function expectedVersion(pr: PullRequest): string {
  return shipsTheApp(pr.changedPaths, pr.basePackage, pr.headPackage)
    ? nextVersion(pr.basePackage.version, bumpOfTitle(pr.title))
    : pr.basePackage.version;
}

/**
 * Whether two change lists are the same, entry by entry.
 * @param a - First list.
 * @param b - Second list.
 */
const sameEntries = (a: readonly ChangelogEntry[], b: readonly ChangelogEntry[]): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

/**
 * What is wrong with a pull request's version, or undefined when it is right. The change list must be the
 * base's plus one new entry on top when the version moves, so an entry lost or doubled by an update from
 * main shows here. A feature or a breaking change is something players notice: its entry needs notes.
 * @param pr - Title, changed files, both package.json files and both change lists.
 */
export function versionProblems(
  pr: PullRequest & { baseChangelog: readonly ChangelogEntry[]; headChangelog: readonly ChangelogEntry[] },
): string | undefined {
  const expected = expectedVersion(pr);
  const fix = `update the branch from main, then run \`pnpm version:bump "<title>"\``;
  if (pr.headPackage.version !== expected) {
    const why = expected === pr.basePackage.version ? "does not change the app" : "changes the app";
    return `the pull request ${why}, so package.json must say ${expected}, not ${pr.headPackage.version}: ${fix}`;
  }
  const moved = expected !== pr.basePackage.version;
  const published = moved ? pr.headChangelog.slice(1) : pr.headChangelog;
  if (!sameEntries(published, pr.baseChangelog) || (moved && pr.headChangelog[0]?.version !== expected)) {
    return `${CHANGELOG_FILE} must be the base's list${moved ? ` with one new entry, ${expected}, on top` : ""}: ${fix}`;
  }
  if (moved && bumpOfTitle(pr.title) !== "patch" && pr.headChangelog[0]?.notes.length === 0) {
    return `a feature or breaking change needs notes for the players, in English and Polish, on version ${expected} in ${CHANGELOG_FILE}; if players notice nothing, the title is not feat`;
  }
  return undefined;
}

/**
 * The change list for a pull request that moves the base version to `version`: the base's list, with a new
 * entry on top. The branch's own entry is the first one of its list that the base does not have, whatever
 * its version; the new entry keeps its notes. A new entry is technical (no notes) until someone writes them.
 * @param head - Change list of the working tree, newest first.
 * @param base - Change list of the base, newest first.
 * @param move - The move to make.
 * @param move.date - Today.
 * @param move.version - Version of this branch.
 */
export function nextChangelog(
  head: readonly ChangelogEntry[],
  base: readonly ChangelogEntry[],
  move: { date: string; version: string },
): ChangelogEntry[] {
  const own = head.find((entry) => !base.some((published) => sameEntries([published], [entry])));
  return move.version === base[0]?.version
    ? [...base]
    : [{ date: move.date, notes: own?.notes ?? [], version: move.version }, ...base];
}

/**
 * package.json text with another version, the rest of the text untouched.
 * @param text - Content of package.json.
 * @param version - New version.
 */
export function withVersion(text: string, version: string): string {
  return text.replace(/("version":\s*")[^"]*"/, `$1${version}"`);
}
