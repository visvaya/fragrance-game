// Rejects new em dashes and emoji in changed text, and attribution lines in commit messages.
// Only added lines count, so older text is cleaned up separately instead of blocking every edit.
// Usage: tsx scripts/check-text.ts staged          (pre-commit: lines added in the index)
//        tsx scripts/check-text.ts since <ref>     (CI: lines added since <ref>)
//        tsx scripts/check-text.ts commit-msg <file>
// Characters are built from code points, so this file passes its own check.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { isMainModule } from "./is-main";

const EM_DASH = String.fromCodePoint(0x20_14);
// Every pictographic character counts, except the text symbols (c), (R) and TM.
const EMOJI = new RegExp(
  String.raw`\p{Emoji_Presentation}|(?![${[0xa9, 0xae, 0x21_22].map((code) => String.fromCodePoint(code)).join("")}])\p{Extended_Pictographic}`,
  "u",
);
// Co-author, generated-by and session lines are rejected for everyone.
const ATTRIBUTION_LINES = [/^co-authored-by:/im, /^\W*generated (?:with|by)\s/im, /^[\w-]+-session:/im];
const SKIPPED_FILES = new Set(["pnpm-lock.yaml", "uv.lock"]);

/** One added line of a diff. */
export type AddedLine = { file: string; line: number; text: string };

/**
 * Names of the forbidden characters in a line of text.
 * @param text - Line to check.
 */
export function forbiddenIn(text: string): string[] {
  return [
    ...(text.includes(EM_DASH) ? ["em dash (U+2014); use an en dash (U+2013) or a middle dot (U+00B7)"] : []),
    ...(EMOJI.test(text) ? ["emoji"] : []),
  ];
}

/**
 * Added lines of a unified diff produced with `-U0`, with their new line numbers.
 * @param diff - Output of `git diff -U0`.
 */
export function addedLines(diff: string): AddedLine[] {
  return diff
    .split(/^\+\+\+ /m)
    .slice(1)
    .flatMap((section) => {
      const [header = "", ...body] = section.split("\n");
      const file = header.replace(/^b\//, "");
      if (file === "/dev/null" || SKIPPED_FILES.has(file)) return [];
      // Splitting on the hunk header leaves [text before the first hunk, start, rows, start, rows, ...].
      const [, ...hunks] = body.join("\n").split(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@.*$/m);
      return Array.from({ length: Math.floor(hunks.length / 2) }, (_, index) => {
        const start = Number(hunks[index * 2]);
        const rows = (hunks[index * 2 + 1] ?? "").split("\n").filter((row) => row.startsWith("+"));
        return rows.map((row, offset): AddedLine => ({ file, line: start + offset, text: row.slice(1) }));
      }).flat();
    });
}

/**
 * Problems of a commit message: attribution lines, em dashes, emoji. Comment lines and the
 * part below the scissors line of `git commit -v` do not count.
 * @param message - Content of the commit message file.
 */
export function commitMessageProblems(message: string): string[] {
  const body = message.split(/^# -+ >8 -+$/m)[0] ?? "";
  const text = body
    .split("\n")
    .filter((row) => !row.startsWith("#"))
    .join("\n");
  return [
    ...(ATTRIBUTION_LINES.some((pattern) => pattern.test(text))
      ? ["remove co-author, generated-by and session lines"]
      : []),
    ...forbiddenIn(text),
  ];
}

const git = (args: string[]): string => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

function main(argv: string[]): number {
  const [mode, argument] = argv;
  if (mode === "commit-msg" && argument) {
    const problems = commitMessageProblems(readFileSync(argument, "utf8"));
    for (const problem of problems) console.error(`commit message: ${problem}`);
    return problems.length > 0 ? 1 : 0;
  }
  const diffArgs =
    mode === "staged" ? ["diff", "--cached", "-U0", "--no-color"] : mode === "since" && argument ? ["diff", "-U0", "--no-color", `${argument}...HEAD`] : null;
  if (!diffArgs) {
    console.error("usage: check-text.ts staged | since <ref> | commit-msg <file>");
    return 2;
  }
  const problems = addedLines(git(diffArgs)).flatMap(({ file, line, text }) =>
    forbiddenIn(text).map((name) => `${file}:${line}: ${name}`),
  );
  if (problems.length > 0) console.error(`Forbidden characters in added lines:\n${problems.join("\n")}`);
  return problems.length > 0 ? 1 : 0;
}

if (isMainModule(import.meta.url, process.argv[1])) process.exitCode = main(process.argv.slice(2));
