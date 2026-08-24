#!/usr/bin/env node
/**
 * Fails CI when Supabase's Security Advisor reports ERROR-level findings
 * (missing RLS policies, SECURITY DEFINER views, exposed schemas, ...).
 *
 * The Supabase CLI has no `advisors` command yet (supabase/cli#3839), so this
 * calls the Management API directly. That endpoint is marked experimental —
 * if its shape changes, this script fails loudly rather than reporting a false pass.
 *
 * Required env:
 *   SUPABASE_ACCESS_TOKEN  personal access token with database:read
 *   SUPABASE_PROJECT_ID    project ref, e.g. abcdefghijklmnopqrst
 *
 * Exit codes: 0 clean, 1 ERROR-level findings, 2 configuration or API failure.
 */

const ENDPOINT = "https://api.supabase.com/v1/projects";
const BLOCKING_LEVEL = "ERROR";

const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = process.env.SUPABASE_PROJECT_ID;

/**
 * Prints a message and terminates with the given exit code.
 * @param {number} code
 * @param {string} message
 */
function fail(code, message) {
  console.error(`\n[advisors] ${message}\n`);
  process.exit(code);
}

if (!accessToken || !projectRef) {
  fail(
    2,
    "Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_ID. " +
      "Set both in .env.local locally, or as repository secrets in CI.",
  );
}

/**
 * Fetches security lints for the linked project.
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
async function fetchSecurityLints() {
  const response = await fetch(`${ENDPOINT}/${projectRef}/advisors/security`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const body = await response.text();
    fail(
      2,
      `Management API returned ${response.status} ${response.statusText}.\n${body.slice(0, 500)}`,
    );
  }

  const payload = await response.json();

  if (!Array.isArray(payload?.lints)) {
    fail(
      2,
      "Unexpected response shape — expected a `lints` array. " +
        "The experimental advisors endpoint may have changed.",
    );
  }

  return payload.lints;
}

/** Matches the backslash-escaped backticks the API embeds in its prose fields. */
const ESCAPED_BACKTICK = /\\+\x60/g;

/**
 * Strips the API's markdown escaping so identifiers read cleanly in CI logs.
 * @param {string} text
 * @returns {string}
 */
function unescapeBackticks(text) {
  return text.replace(ESCAPED_BACKTICK, String.fromCodePoint(96));
}

/**
 * Renders one lint as an indented, human-readable block.
 *
 * The API is inconsistent about which field carries the prose: most lints put it in
 * `detail` and a doc URL in `remediation`, while the 0012 family swaps them. Both
 * fields are printed under neutral indentation rather than guessing which is which.
 * @param {Record<string, any>} lint
 * @returns {string}
 */
function formatLint(lint) {
  const target = lint.metadata?.name ? ` (${lint.metadata.name})` : "";
  const body = [lint.detail, lint.description, lint.remediation]
    .filter((field) => typeof field === "string" && field.length > 0)
    .map((field) => `    ${unescapeBackticks(field)}`)
    .join("\n");

  return `  [${lint.level}] ${lint.title}${target}\n${body}`;
}

const lints = await fetchSecurityLints();
const blocking = lints.filter((lint) => lint.level === BLOCKING_LEVEL);
const advisory = lints.filter((lint) => lint.level !== BLOCKING_LEVEL);

if (advisory.length > 0) {
  console.warn(`\n[advisors] ${advisory.length} non-blocking finding(s):`);
  advisory.forEach((lint) => console.warn(formatLint(lint)));
}

if (blocking.length > 0) {
  console.error(
    `\n[advisors] ${blocking.length} ${BLOCKING_LEVEL}-level finding(s):`,
  );
  blocking.forEach((lint) => console.error(formatLint(lint)));
  fail(1, `Security Advisor found ${blocking.length} blocking issue(s).`);
}

console.log(
  `\n[advisors] No ${BLOCKING_LEVEL}-level security findings (${lints.length} lint(s) checked).\n`,
);
