import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { FullConfig } from "@playwright/test";
import { z } from "zod";

// Playwright runs from the project root and loads specs as CommonJS; import.meta
// would make Node parse the file as an ES module ("exports is not defined").
const DIR = path.join(process.cwd(), "e2e");
// Primary user – for game-completion tests (tracks win/loss across 6 attempts).
const AUTH_FILE = path.join(DIR, ".auth", "user.json");
// Secondary user – for the smoke guess test (e2e/smoke/guess.smoke.spec.ts), the only test that uses it:
// it must start at attempt 1, so no other test may guess with this user.
// Separate user prevents interference with game-completion's attempt counter.
const AUTH_FILE_GAMEFLOW = path.join(DIR, ".auth", "user-gameflow.json");
// A11y user – dedicated to accessibility tests; fresh game state, never played.
// Prevents interference from game-completion Defeat test changing the game page UI.
const AUTH_FILE_A11Y = path.join(DIR, ".auth", "user-a11y.json");
const ENVIRONMENT_FILE = path.join(DIR, "..", ".env.local");
// Persists test user IDs between globalSetup and globalTeardown for cleanup.
export const TEST_USER_IDS_FILE = path.join(DIR, ".auth", "test-user-ids.json");
const MAX_CHUNK_SIZE = 3180; // `@supabase/ssr` cookie chunk size

// Loose objects: the whole session (expiry, token type, full user) goes into the auth cookie,
// so unknown keys must survive the parse.
const authSessionSchema = z.looseObject({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  user: z.looseObject({ id: z.string() }).optional(),
});

export type AuthSession = z.infer<typeof authSessionSchema>;

/** Parse .env.local file since Playwright runs outside of Next.js env loading. */
function loadEnvironmentFile(): Record<string, string> {
  if (!existsSync(ENVIRONMENT_FILE)) return {};
  const lines = readFileSync(ENVIRONMENT_FILE, "utf8").split("\n");
  const result: Record<string, string> = {};
  for (const line of lines) {
    const [, key, value] = /^([A-Z_][A-Z0-9_]*)=(.+)/.exec(line.trim()) ?? [];
    if (key && value) {
      result[key] = value.replaceAll(/^['"]|['"]$/g, "");
    }
  }
  return result;
}

/**
 * Supabase URL and service role key for the Admin API, from the environment or .env.local.
 * Shared with globalTeardown, so the key is never written to disk between the two.
 */
export function loadSupabaseAdminConfig(): {
  serviceRoleKey: string;
  supabaseUrl: string;
} | null {
  const env = { ...loadEnvironmentFile(), ...process.env };
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  return supabaseUrl && serviceRoleKey ? { serviceRoleKey, supabaseUrl } : null;
}

/** Create an anonymous Supabase session via the Admin API (bypasses Turnstile captcha). */
export async function createAnonymousSession(
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<AuthSession | null> {
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/signup`, {
      body: JSON.stringify({ data: { is_test_user: true } }),
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      const body = await response.text();
      console.warn(
        `[E2E globalSetup] Auth endpoint returned ${response.status}: ${body}`,
      );
      return null;
    }

    const parsed = authSessionSchema.safeParse(await response.json());
    if (!parsed.success) {
      console.warn(
        "[E2E globalSetup] Session missing tokens:",
        parsed.error.message,
      );
      return null;
    }
    return parsed.data;
  } catch (error) {
    console.warn("[E2E globalSetup] Failed to create session:", error);
    return null;
  }
}

/** Project reference (the subdomain) of a hosted Supabase URL, or undefined for another URL. */
export function parseProjectReference(supabaseUrl: string): string | undefined {
  return /https?:\/\/([^.]+)\./.exec(supabaseUrl)?.[1];
}

/** A Supabase session as `@supabase/ssr`-compatible browser cookies for localhost. */
export function buildSessionCookies(
  session: AuthSession,
  projectReference: string,
): {
  domain: string;
  expires: number;
  httpOnly: boolean;
  name: string;
  path: string;
  sameSite: "Lax";
  secure: boolean;
  value: string;
}[] {
  const cookieName = `sb-${projectReference}-auth-token`;
  const sessionJson = JSON.stringify(session);
  const chunks: string[] = [];
  for (let i = 0; i < sessionJson.length; i += MAX_CHUNK_SIZE) {
    chunks.push(sessionJson.slice(i, i + MAX_CHUNK_SIZE));
  }

  const cookieBase = {
    domain: "localhost",
    expires: Math.floor(Date.now() / 1000) + 3600,
    httpOnly: false,
    path: "/",
    sameSite: "Lax" as const,
    secure: false,
  };

  return chunks.length === 1
    ? [{ ...cookieBase, name: cookieName, value: chunks[0] ?? "" }]
    : chunks.map((chunk, index) => ({
        ...cookieBase,
        name: `${cookieName}.${index}`,
        value: chunk,
      }));
}

/** Save a Supabase session as a Playwright storage state file. */
function saveStorageState(
  filePath: string,
  session: AuthSession,
  projectReference: string,
): void {
  const cookies = buildSessionCookies(session, projectReference);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify({ cookies, origins: [] }, null, 2));
}

/**
 * Playwright global setup – creates pre-authenticated anonymous Supabase sessions.
 *
 * Creates THREE separate users to prevent concurrent tests from sharing a game session:
 * - user.json         → game-completion, mobile tests
 * - user-gameflow.json → the smoke guess test only (starts at attempt 1; separate session
 *                        prevents interference with game-completion's 6-attempt counter)
 * - user-a11y.json    → a11y tests (fresh game state; isolated from game-completion
 *                        Defeat test which exhausts 6 attempts on the primary user)
 *
 * Calls POST /auth/v1/signup with the service role key, which bypasses Turnstile
 * captcha (GoTrue skips captcha for admin requests). Saves sessions as
 * `@supabase/ssr`-compatible cookies for tests to reuse.
 */
// eslint-disable-next-line import-x/no-default-export -- Playwright requires default export for globalSetup
export default async function globalSetup(_config: FullConfig): Promise<void> {
  const config = loadSupabaseAdminConfig();
  if (!config) {
    console.warn(
      "[E2E globalSetup] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY: skipping auth setup",
    );
    return;
  }
  const { serviceRoleKey, supabaseUrl } = config;

  const projectReference = parseProjectReference(supabaseUrl);
  if (!projectReference) {
    console.warn(
      "[E2E globalSetup] Cannot parse project reference from Supabase URL",
    );
    return;
  }

  // Create all three users in parallel – they're independent Supabase sign-ups.
  const [primarySession, gameflowSession, a11ySession] = await Promise.all([
    createAnonymousSession(supabaseUrl, serviceRoleKey),
    createAnonymousSession(supabaseUrl, serviceRoleKey),
    createAnonymousSession(supabaseUrl, serviceRoleKey),
  ]);

  if (primarySession) {
    saveStorageState(AUTH_FILE, primarySession, projectReference);
    console.log(
      `[E2E globalSetup] Primary user: ${primarySession.user?.id ?? ""}`,
    );
  } else {
    console.warn(
      "[E2E globalSetup] Primary session failed – game-completion/mobile tests may fail",
    );
  }

  if (gameflowSession) {
    saveStorageState(AUTH_FILE_GAMEFLOW, gameflowSession, projectReference);
    console.log(
      `[E2E globalSetup] Game-flow user: ${gameflowSession.user?.id ?? ""}`,
    );
  } else {
    console.warn(
      "[E2E globalSetup] Game-flow session failed – the smoke guess test will fail",
    );
  }

  if (a11ySession) {
    saveStorageState(AUTH_FILE_A11Y, a11ySession, projectReference);
    console.log(`[E2E globalSetup] A11y user: ${a11ySession.user?.id ?? ""}`);
  } else {
    console.warn("[E2E globalSetup] A11y session failed – a11y tests may fail");
  }

  // Persist user IDs (not the key) for globalTeardown cleanup.
  const userIds = [primarySession, gameflowSession, a11ySession]
    .map((s) => s?.user?.id)
    .filter((id): id is string => typeof id === "string");

  if (userIds.length > 0) {
    mkdirSync(path.dirname(TEST_USER_IDS_FILE), { recursive: true });
    writeFileSync(TEST_USER_IDS_FILE, JSON.stringify({ userIds }));
    console.log(
      `[E2E globalSetup] Saved ${userIds.length} test user IDs for teardown cleanup`,
    );
  }
}
