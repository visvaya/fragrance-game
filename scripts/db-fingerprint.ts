/**
 * Compares a database's schema fingerprint with the expected one in
 * supabase/schema-fingerprint.txt. Reads the JSON output of
 * `supabase db query --agent=no --read-only -f supabase/schema-fingerprint.sql --output-format json --remote`
 * on stdin (see the `db:fingerprint` package script): a bare array of rows. Without
 * --agent=no the CLI wraps the rows in an envelope when it detects an agent.
 *
 * Exit codes: 0 equal, 1 different, 2 unreadable input.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { z } from "zod";

const EXPECTED_FILE = "supabase/schema-fingerprint.txt";

const queryOutputSchema = z.array(z.object({ fingerprint: z.string() }));

/** Result of reading the query output. */
export type ParseResult = { ok: true; value: string[] } | { error: string; ok: false };

/** Result of a comparison; lines in the same set but another order give empty lists. */
export type CompareResult = { ok: true } | { extra: string[]; missing: string[]; ok: false };

/**
 * Extracts the fingerprint lines from the Supabase CLI JSON output.
 * @param text - stdout of `supabase db query --output-format json`
 */
export function parseQueryOutput(text: string): ParseResult {
  try {
    const parsed = queryOutputSchema.safeParse(JSON.parse(text));
    return parsed.success
      ? { ok: true, value: parsed.data.map((row) => row.fingerprint) }
      : { error: `unexpected query output: ${parsed.error.message}`, ok: false };
  } catch {
    return { error: "the query output is not JSON", ok: false };
  }
}

/**
 * Compares fingerprint lines with the expected file content, line by line and in order.
 * @param actual - lines from the database
 * @param expectedText - content of the expected fingerprint file
 */
export function compareFingerprint(actual: readonly string[], expectedText: string): CompareResult {
  const expected = expectedText.split(/\r?\n/).filter((line) => line !== "");
  if (actual.length === expected.length && actual.every((line, index) => line === expected[index])) {
    return { ok: true };
  }
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  return {
    extra: actual.filter((line) => !expectedSet.has(line)),
    missing: expected.filter((line) => !actualSet.has(line)),
    ok: false,
  };
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  const parsed = parseQueryOutput(readFileSync(0, "utf8"));
  if (!parsed.ok) {
    console.error(`[db-fingerprint] ${parsed.error}`);
    process.exit(2);
  }
  const result = compareFingerprint(parsed.value, readFileSync(EXPECTED_FILE, "utf8"));
  if (result.ok) {
    console.log(`[db-fingerprint] ${parsed.value.length} lines, equal to ${EXPECTED_FILE}`);
  } else {
    console.error(`[db-fingerprint] the database differs from ${EXPECTED_FILE}`);
    for (const line of result.missing) console.error(`- ${line}`);
    for (const line of result.extra) console.error(`+ ${line}`);
    if (result.missing.length === 0 && result.extra.length === 0) console.error("(same lines, different order)");
    process.exitCode = 1;
  }
}
