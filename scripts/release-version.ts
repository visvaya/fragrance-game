// How a pull request moves the version of the app, as pure functions. `version` in package.json is the one
// number: a pull request that changes what is deployed moves it by the step its title names (Conventional
// Commits), any other leaves it as it was. The git calls are in scripts/version.ts.
import { VERSION_PATTERN, type ChangelogEntry } from "../lib/changelog";
import { compareVersions as compareParsedVersions } from "./check-freshness";

export const CHANGELOG_FILE = "lib/changelog.json";

const TITLE_PATTERN = /^([a-z]+)(\([^)]+\))?(!)?: /;

type Bump = "major" | "minor" | "patch";
type PackageJson = { scripts?: Record<string, string>; version: string; } & Record<string, unknown>;

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
const TEST_FILE = /(?:^|\/)__tests__\/|\.(?:test|spec)\.[cm]?[jt]sx?$/;

/**
 * The numbers of a version.
 * @param text - `major.minor.patch`.
 */
function parseVersion(text: string): [number, number, number] {
  const match = VERSION_PATTERN.exec(text);
  if (match === null) throw new Error(`not a version: "${text}"`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * Orders two versions by their numbers, not as text.
 * @param a - First version.
 * @param b - Second version.
 */
export const compareVersions = (a: string, b: string): number =>
  compareParsedVersions(parseVersion(a), parseVersion(b));

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
    if (TEST_FILE.test(path)) return false;
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
 * What is wrong with a pull request's version; empty when it is right. A feature or a breaking change is
 * something players notice, so its changelog entry needs notes for them.
 * @param pr - Title, changed files, both package.json files and the pull request's changelog.
 */
export function versionProblems(pr: PullRequest & { headChangelog: readonly ChangelogEntry[] }): string[] {
  const expected = expectedVersion(pr);
  if (pr.headPackage.version !== expected) {
    const why = expected === pr.basePackage.version ? "does not change the app" : "changes the app";
    return [
      `the pull request ${why}, so package.json must say ${expected}, not ${pr.headPackage.version}: run \`pnpm version:bump "<title>"\``,
    ];
  }
  const notes = pr.headChangelog[0]?.notes ?? [];
  if (expected !== pr.basePackage.version && bumpOfTitle(pr.title) !== "patch" && notes.length === 0) {
    return [
      `a feature or breaking change needs notes for the players, in English and Polish, on version ${expected} in ${CHANGELOG_FILE}; if players notice nothing, the title is not feat`,
    ];
  }
  return [];
}

/**
 * The change list for a pull request that moves the base version to `version`. The branch's own entry is
 * the newest one when it is not the base's: it takes the new number and keeps its notes, or goes when the
 * version is back at the base's. A new entry is technical (no notes) until someone writes them.
 * @param entries - Change list of the working tree, newest first.
 * @param move - The move to make.
 * @param move.baseVersion - Version on the base.
 * @param move.date - Today.
 * @param move.version - Version of this branch.
 */
export function nextChangelog(
  entries: readonly ChangelogEntry[],
  move: { baseVersion: string; date: string; version: string },
): ChangelogEntry[] {
  const [top, ...rest] = entries;
  const own = top !== undefined && top.version !== move.baseVersion ? top : undefined;
  const published = own === undefined ? entries : rest;
  return move.version === move.baseVersion
    ? [...published]
    : [{ date: move.date, notes: own?.notes ?? [], version: move.version }, ...published];
}

/**
 * package.json text with another version, the rest of the text untouched.
 * @param text - Content of package.json.
 * @param version - New version.
 */
export function withVersion(text: string, version: string): string {
  return text.replace(/("version":\s*")[^"]*"/, `$1${version}"`);
}
