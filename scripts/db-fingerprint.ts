/**
 * Compares a database's schema fingerprint with the expected one in
 * supabase/schema-fingerprint.txt. Reads the JSON output of
 * `supabase db query -f supabase/schema-fingerprint.sql --output-format json`
 * on stdin (see the `db:fingerprint` package script).
 *
 * Exit codes: 0 equal, 1 different, 2 unreadable input.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { z } from "zod";

const EXPECTED_FILE = "supabase/schema-fingerprint.txt";

const queryOutputSchema = z.object({
  rows: z.array(z.object({ fingerprint: z.string() })),
});

/** Result of reading the query output. */
export type ParseResult = { ok: true; value: string[] } | { ok: false; error: string };

/** Result of a comparison; lines in the same set but another order give empty lists. */
export type CompareResult = { ok: true } | { ok: false; missing: string[]; extra: string[] };

/**
 * Extracts the fingerprint lines from the Supabase CLI JSON output.
 * @param text - stdout of `supabase db query --output-format json`
 */
export function parseQueryOutput(text: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "the query output is not JSON" };
  }
  const parsed = queryOutputSchema.safeParse(json);
  return parsed.success
    ? { ok: true, value: parsed.data.rows.map((row) => row.fingerprint) }
    : { ok: false, error: `unexpected query output: ${parsed.error.message}` };
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
    ok: false,
    missing: expected.filter((line) => !actualSet.has(line)),
    extra: actual.filter((line) => !expectedSet.has(line)),
  };
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

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
