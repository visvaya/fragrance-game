/**
 * Judges the output of the Supabase database linter (splinter) for a database built from the
 * migrations. Reads psql CSV output on stdin (supabase/checks/splinter-run.sql in the CI job
 * "Database from migrations") and the exceptions in supabase/checks/splinter-exceptions.json,
 * a map from a finding's cache_key to the reason it is accepted.
 *
 * Fails on a WARN or ERROR finding without an exception, and on an exception whose finding is
 * gone (the list only shrinks). INFO findings are printed only.
 *
 * Exit codes: 0 clean, 1 findings or stale exceptions, 2 unreadable input.
 */
import { readFileSync } from "node:fs";

import { z } from "zod";

import { isMainModule } from "./is-main";

const EXCEPTIONS_FILE = "supabase/checks/splinter-exceptions.json";
const BLOCKING_LEVELS = new Set(["ERROR", "WARN"]);

/** One linter finding, reduced to what the report needs. */
export type Finding = { cacheKey: string; detail: string; level: string; name: string };

type ParseResult = { error: string; ok: false } | { ok: true; value: Finding[] };

/**
 * Parses RFC 4180 CSV as psql --csv writes it.
 * @param text - CSV text
 */
export function parseCsv(text: string): string[][] {
  /* eslint-disable fp/no-mutation, fp/no-mutating-methods -- a character state machine; immutable copies per character would be quadratic and unreadable */
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text.charAt(index);
    if (quoted) {
      if (char === '"' && text.charAt(index + 1) === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text.charAt(index + 1) === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) rows.push([...row, field]);
  /* eslint-enable fp/no-mutation, fp/no-mutating-methods */
  return rows;
}

const findingSchema = z.object({
  cache_key: z.string().min(1),
  detail: z.string(),
  level: z.string(),
  name: z.string(),
});

/**
 * Turns the linter's CSV output into findings.
 * @param text - psql --csv output of splinter.sql
 */
export function parseFindings(text: string): ParseResult {
  const [header, ...rows] = parseCsv(text);
  if (header === undefined) return { error: "empty linter output", ok: false };
  const results = rows.map((cells) =>
    findingSchema.safeParse(Object.fromEntries(header.map((column, index) => [column, cells[index]]))),
  );
  for (const result of results) {
    if (!result.success) return { error: `unexpected linter row: ${result.error.message}`, ok: false };
  }
  const findings = results.flatMap((result) =>
    result.success
      ? [{ cacheKey: result.data.cache_key, detail: result.data.detail, level: result.data.level, name: result.data.name }]
      : [],
  );
  return { ok: true, value: findings };
}

/**
 * Splits findings into new blocking ones, informational ones and exceptions that no longer match.
 * @param findings - linter findings
 * @param exceptions - accepted findings: cache_key to reason
 */
export function judgeFindings(
  findings: readonly Finding[],
  exceptions: Readonly<Record<string, string>>,
): { fresh: Finding[]; info: Finding[]; stale: string[] } {
  const keys = new Set(findings.map((finding) => finding.cacheKey));
  return {
    fresh: findings.filter((finding) => BLOCKING_LEVELS.has(finding.level) && !(finding.cacheKey in exceptions)),
    info: findings.filter((finding) => !BLOCKING_LEVELS.has(finding.level)),
    stale: Object.keys(exceptions).filter((key) => !keys.has(key)),
  };
}

if (isMainModule(import.meta.url, process.argv[1])) {
  const parsed = parseFindings(readFileSync(0, "utf8"));
  const exceptions = z.record(z.string(), z.string().min(1)).safeParse(JSON.parse(readFileSync(EXCEPTIONS_FILE, "utf8")));
  if (!parsed.ok || !exceptions.success) {
    console.error(`[db-lint] ${parsed.ok ? `${EXCEPTIONS_FILE}: each value must be a reason` : parsed.error}`);
    process.exit(2);
  }
  const { fresh, info, stale } = judgeFindings(parsed.value, exceptions.data);
  for (const finding of info) console.log(`[db-lint] INFO ${finding.name}: ${finding.detail}`);
  for (const finding of fresh) {
    console.error(`[db-lint] ${finding.level} ${finding.name}: ${finding.detail}\n  cache_key: ${finding.cacheKey}`);
  }
  for (const key of stale) console.error(`[db-lint] exception no longer needed, remove it from ${EXCEPTIONS_FILE}: ${key}`);
  const accepted = parsed.value.length - fresh.length - info.length;
  console.log(`[db-lint] ${parsed.value.length} findings: ${fresh.length} new, ${accepted} accepted, ${info.length} info`);
  if (fresh.length > 0) {
    console.error("[db-lint] fix each new finding, or add its cache_key with the reason to the exceptions file");
  }
  if (fresh.length > 0 || stale.length > 0) process.exitCode = 1;
}
