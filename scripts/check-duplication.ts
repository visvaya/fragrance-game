// Ratchet on the number of code clones found by jscpd (.jscpd.json, run before this script).
// The limit only goes down: remove a clone and lower MAX_CLONES to the new count in the same change.
// Usage: tsx scripts/check-duplication.ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const MAX_CLONES = 11;
const REPORT_PATH = "reports/jscpd/jscpd-report.json";

/**
 * Why a clone count fails the ratchet, or undefined when it equals the limit.
 * @param count - Clones in the current jscpd report.
 * @param limit - Highest accepted count.
 */
export function cloneCountProblem(count: number, limit: number): string | undefined {
  if (count > limit) {
    return `jscpd found ${count} clones, limit ${limit}: extract the new copy into a shared function or component.`;
  }
  if (count < limit) {
    return `jscpd found ${count} clones, limit ${limit}: lower MAX_CLONES to ${count} in scripts/check-duplication.ts.`;
  }
  return undefined;
}

function main(): number {
  const report: unknown = JSON.parse(readFileSync(REPORT_PATH, "utf8"));
  const duplicates = (report as { duplicates?: unknown }).duplicates;
  if (!Array.isArray(duplicates)) throw new TypeError(`${REPORT_PATH} has no duplicates list`);
  const problem = cloneCountProblem(duplicates.length, MAX_CLONES);
  if (problem !== undefined) console.error(problem);
  return problem === undefined ? 0 : 1;
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) process.exitCode = main();
