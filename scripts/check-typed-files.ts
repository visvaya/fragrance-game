// Keeps every code file under the type check: a tracked JavaScript file must be listed in ALLOWED_JS.
// Usage: tsx scripts/check-typed-files.ts
import { execFileSync } from "node:child_process";

import { isMainModule } from "./is-main";

/** Tracked JavaScript files that stay JavaScript, each with the reason. They are checked by tsc (checkJs). */
const ALLOWED_JS: Readonly<Record<string, string>> = {
  "lint/eauxle-plugin.mjs": "oxlint JS plugin format; the plugin API has no usable types for TypeScript",
  "scripts/check-node-version.mjs": "preinstall guard: must run on a Node release too old for TypeScript",
};

const JS_FILE = /\.(?:js|mjs|cjs|jsx)$/;

/**
 * Tracked JavaScript files (outside public/) that are not in the allowlist.
 * @param files - Paths from `git ls-files`.
 * @param allowed - Allowed paths mapped to their reasons.
 */
export function untypedFileProblems(files: readonly string[], allowed: Readonly<Record<string, string>>): string[] {
  return files
    .filter((file) => JS_FILE.test(file) && !file.startsWith("public/") && !Object.hasOwn(allowed, file))
    .map((file) => `${file} is JavaScript: rewrite it in TypeScript, or add it to ALLOWED_JS in scripts/check-typed-files.ts with the reason.`);
}

function main(): number {
  const files = execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n");
  const problems = untypedFileProblems(files, ALLOWED_JS);
  for (const problem of problems) console.error(problem);
  return problems.length === 0 ? 0 : 1;
}

if (isMainModule(import.meta.url, process.argv[1])) process.exitCode = main();
