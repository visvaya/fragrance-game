#!/usr/bin/env node
// @ts-nocheck: untyped until it is rewritten in TypeScript.
/**
 * Fails CI when Supabase's Security Advisor reports ERROR-level findings
 * (missing RLS policies, SECURITY DEFINER views, exposed schemas, ...).
 *
 * It calls the Management API with an access token: `supabase db advisors` (CLI 3)
 * connects to Postgres directly, which needs the database password and IPv6 on the runner.
 * The API endpoint is marked experimental: if its shape changes, this script fails loudly
 * rather than reporting a false pass.
 *
 * Required env:
 *   SUPABASE_ACCESS_TOKEN  personal access token with database:read
 *   SUPABASE_PROJECT_ID    project ref, e.g. abcdefghijklmnopqrst
 *
 * Exit codes: 0 clean, 1 ERROR-level findings, 2 configuration or API failure.
 */

const ENDPOINT = "https://api.supabase.com/v1/projects";
const BLOCKING_LEVEL = "ERROR";

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
const isRecord = (value) => typeof value === "object" && value !== null;

/**
 * @param {unknown} value
 * @returns {string}
 */
const asString = (value) => (typeof value === "string" ? value : "");

const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = process.env.SUPABASE_PROJECT_ID;

/**
 * Prints a message and terminates with the given exit code.
 * @param {number} code
 * @param {string} message
 * @returns {never}
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
 * @param {Response} response
 * @returns {Promise<unknown>}
 */
const readJson = (response) => response.json();

/**
 * Narrows one API entry to the fields the report prints.
 * @param {unknown} raw
 * @returns {{ level: string, name: string, prose: string[], title: string }}
 */
function toLint(raw) {
  const lint = isRecord(raw) ? raw : {};
  const metadata = isRecord(lint.metadata) ? lint.metadata : {};
  return {
    level: asString(lint.level),
    name: asString(metadata.name),
    prose: [lint.detail, lint.description, lint.remediation].map((field) => asString(field)).filter((field) => field.length > 0),
    title: asString(lint.title),
  };
}

/**
 * Fetches security lints for the linked project.
 * @param {string} ref
 * @param {string} token
 * @returns {Promise<Array<ReturnType<typeof toLint>>>}
 */
async function fetchSecurityLints(ref, token) {
  const response = await fetch(`${ENDPOINT}/${ref}/advisors/security`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const body = await response.text();
    fail(
      2,
      `Management API returned ${String(response.status)} ${response.statusText}.\n${body.slice(0, 500)}`,
    );
  }

  const payload = await readJson(response);

  if (!isRecord(payload) || !Array.isArray(payload.lints)) {
    fail(
      2,
      "Unexpected response shape – expected a `lints` array. " +
        "The experimental advisors endpoint may have changed.",
    );
  }

  return payload.lints.map((entry) => toLint(entry));
}

/** Matches the backslash-escaped backticks the API embeds in its prose fields. */
const ESCAPED_BACKTICK = /\\+`/g;

/**
 * Strips the API's markdown escaping so identifiers read cleanly in CI logs.
 * @param {string} text
 * @returns {string}
 */
function unescapeBackticks(text) {
  return text.replaceAll(ESCAPED_BACKTICK, String.fromCodePoint(96));
}

/**
 * Renders one lint as an indented, human-readable block.
 *
 * The API is inconsistent about which field carries the prose: most lints put it in
 * `detail` and a doc URL in `remediation`, while the 0012 family swaps them. Both
 * fields are printed under neutral indentation rather than guessing which is which.
 * @param {ReturnType<typeof toLint>} lint
 * @returns {string}
 */
function formatLint(lint) {
  const target = lint.name ? ` (${lint.name})` : "";
  const body = lint.prose.map((field) => `    ${unescapeBackticks(field)}`).join("\n");

  return `  [${lint.level}] ${lint.title}${target}\n${body}`;
}

const lints = await fetchSecurityLints(projectRef, accessToken);
const blocking = lints.filter((lint) => lint.level === BLOCKING_LEVEL);
const advisory = lints.filter((lint) => lint.level !== BLOCKING_LEVEL);

if (advisory.length > 0) {
  console.warn(`\n[advisors] ${String(advisory.length)} non-blocking finding(s):`);
  for (const lint of advisory) console.warn(formatLint(lint));
}

if (blocking.length > 0) {
  console.error(`\n[advisors] ${String(blocking.length)} ${BLOCKING_LEVEL}-level finding(s):`);
  for (const lint of blocking) console.error(formatLint(lint));
  fail(1, `Security Advisor found ${String(blocking.length)} blocking issue(s).`);
}

console.log(
  `\n[advisors] No ${BLOCKING_LEVEL}-level security findings (${String(lints.length)} lint(s) checked).\n`,
);
