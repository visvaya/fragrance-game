/**
 * Points .env.local at a local Supabase stack, so `pnpm dev`, e2e and the challenge suite run
 * against it instead of production. Reads `supabase status -o env` on stdin:
 *
 *   pnpm exec supabase status -o env | pnpm env:local
 *
 * Only the Supabase URL and keys change; every other line of .env.local stays. Production values
 * belong in .env.remote.local, which only the tools that must reach production read (image
 * pipeline, ETL, type generation). The script refuses to overwrite production Supabase values in
 * .env.local until that file exists, so they are never lost.
 *
 * Exit codes: 0 written, 1 refused, 2 unreadable input.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { isMainModule } from "./is-main";

const ENV_FILE = ".env.local";
const REMOTE_ENV_FILE = ".env.remote.local";
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

/** URL and keys of a running local stack. */
export type LocalStack = { anonKey: string; apiUrl: string; serviceRoleKey: string };

/** Result of reading the status output. */
export type StackResult = { ok: true; value: LocalStack } | { error: string; ok: false };

function parseEnvLines(text: string): Map<string, string> {
  const entries = text.split(/\r?\n/).flatMap((line): [string, string][] => {
    const match = /^\s*([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line);
    if (!match?.[1] || match[2] === undefined) return [];
    return [[match[1], match[2].trim().replaceAll(/^["']|["']$/g, "")]];
  });
  return new Map(entries);
}

/** Whether a URL points at this machine. */
export function isLocalUrl(url: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * Extracts the stack's URL and keys from `supabase status -o env`.
 * @param text - stdout of the status command
 */
export function parseStatusEnv(text: string): StackResult {
  const values = parseEnvLines(text);
  const apiUrl = values.get("API_URL");
  const anonKey = values.get("ANON_KEY");
  const serviceRoleKey = values.get("SERVICE_ROLE_KEY");
  if (!apiUrl || !anonKey || !serviceRoleKey) {
    return { error: "the input has no API_URL, ANON_KEY and SERVICE_ROLE_KEY", ok: false };
  }
  if (!isLocalUrl(apiUrl)) {
    return { error: `API_URL ${apiUrl} is not a local stack`, ok: false };
  }
  return { ok: true, value: { anonKey, apiUrl, serviceRoleKey } };
}

/**
 * Returns .env.local content with the Supabase variables set to the local stack; the challenge
 * suite's TEST_* variables get the same values. Other lines keep their text and order.
 * @param envText - current .env.local content (empty when the file does not exist)
 * @param stack - the local stack
 */
export function applyLocalStack(envText: string, stack: LocalStack): string {
  const wanted = new Map([
    ["NEXT_PUBLIC_SUPABASE_URL", stack.apiUrl],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", stack.anonKey],
    ["SUPABASE_SERVICE_ROLE_KEY", stack.serviceRoleKey],
    ["TEST_SUPABASE_URL", stack.apiUrl],
    ["TEST_SUPABASE_SERVICE_ROLE_KEY", stack.serviceRoleKey],
  ]);
  const lines = envText === "" ? [] : envText.replace(/\r?\n$/, "").split(/\r?\n/);
  const replaced = lines.map((line) => {
    const key = /^\s*([A-Z_][A-Z0-9_]*)=/.exec(line)?.[1];
    const value = key === undefined ? undefined : wanted.get(key);
    if (key === undefined || value === undefined) return line;
    wanted.delete(key);
    return `${key}=${value}`;
  });
  const added = [...wanted].map(([key, value]) => `${key}=${value}`);
  return `${[...replaced, ...added].join("\n")}\n`;
}

/**
 * Whether writing would drop production Supabase values that are not saved elsewhere.
 * @param envText - current .env.local content
 * @param remoteFileExists - whether .env.remote.local exists
 */
export function wouldLoseRemoteValues(envText: string, remoteFileExists: boolean): boolean {
  const url = parseEnvLines(envText).get("NEXT_PUBLIC_SUPABASE_URL");
  return url !== undefined && url !== "" && !isLocalUrl(url) && !remoteFileExists;
}

// Read without checking first, so the file cannot change between the check and the read.
function readIfPresent(file: string): string {
  try {
    return readFileSync(file, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return "";
    throw error;
  }
}

function main(): void {
  const stack = parseStatusEnv(readFileSync(0, "utf8"));
  if (!stack.ok) {
    console.error(`Error: ${stack.error}. Pipe in: supabase status -o env`);
    process.exit(2);
  }
  const envText = readIfPresent(ENV_FILE);
  if (wouldLoseRemoteValues(envText, existsSync(REMOTE_ENV_FILE))) {
    console.error(
      `Error: ${ENV_FILE} points at a remote Supabase project. Copy it to ${REMOTE_ENV_FILE} first, then run this again.`,
    );
    process.exit(1);
  }
  writeFileSync(ENV_FILE, applyLocalStack(envText, stack.value));
  console.log(`${ENV_FILE} now points at ${stack.value.apiUrl}.`);
}

if (isMainModule(import.meta.url, process.argv[1])) main();
