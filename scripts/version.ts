// pnpm version:bump "<pull request title>" [--base <ref>]
//   Sets the version of a pull request by the rules in scripts/release-version.ts: package.json and the
//   newest entry of lib/changelog.json. Run it again after the branch is updated from main or the title
//   changes. Uncommitted changes count.
// pnpm version:check "<pull request title>" --base <ref>
//   The same rules as a check (CI): the version and the change list must already be as `bump` would write
//   them. CI passes the first parent of the merge commit, so the comparison is what the change brings.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

import { parseChangelog } from "../lib/changelog";
import { isMainModule } from "./is-main";
import {
  CHANGELOG_FILE,
  expectedVersion,
  nextChangelog,
  versionProblems,
  withVersion,
} from "./release-version";

const git = (...args: string[]): string => execFileSync("git", args, { encoding: "utf8" });
const lines = (text: string): string[] => text.split("\n").filter(Boolean);
const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));

/** The files of the working tree against the fork point with the base, new files included. */
function compareWithBase(base: string) {
  const fork = git("merge-base", base, "HEAD").trim();
  return {
    basePackage: JSON.parse(git("show", `${fork}:package.json`)) as { version: string },
    changedPaths: [
      ...lines(git("diff", "--name-only", fork)),
      ...lines(git("ls-files", "--others", "--exclude-standard")),
    ],
    headPackage: readJson("package.json") as { version: string },
  };
}

function run(command: string, base: string, title: string): string {
  const pr = { title, ...compareWithBase(base) };
  const changelog = parseChangelog(readJson(CHANGELOG_FILE));
  if (command === "check") {
    const problems = versionProblems({ ...pr, headChangelog: changelog });
    if (problems.length > 0) throw new Error(problems.join("\n"));
    return `version:check: ${pr.headPackage.version}, as the title and the changes require`;
  }
  const version = expectedVersion(pr);
  writeFileSync("package.json", withVersion(readFileSync("package.json", "utf8"), version));
  const date = new Date().toISOString().slice(0, 10);
  const next = nextChangelog(changelog, { baseVersion: pr.basePackage.version, date, version });
  writeFileSync(CHANGELOG_FILE, `${JSON.stringify(next, null, 2)}\n`);
  return `version:bump: ${pr.basePackage.version} on ${base}, ${version} here; a feat or breaking change needs notes in ${CHANGELOG_FILE}`;
}

function main(): void {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { base: { default: "origin/main", type: "string" } },
  });
  const [command, title] = positionals;
  if ((command !== "bump" && command !== "check") || title === undefined) {
    throw new Error('usage: version.ts bump|check "<pull request title>" [--base <ref>]');
  }
  process.stdout.write(`${run(command, values.base, title)}\n`);
}

if (isMainModule(import.meta.url, process.argv[1])) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
