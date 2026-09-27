import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { FullConfig } from "@playwright/test";

const DIR = path.dirname(fileURLToPath(import.meta.url));
// Primary user — for game-completion tests (tracks win/loss across 6 attempts).
const AUTH_FILE = path.join(DIR, ".auth", "user.json");
// Secondary user — for game-flow and other tests that submit guesses.
// Separate user prevents interference with game-completion's attempt counter.
const AUTH_FILE_GAMEFLOW = path.join(DIR, ".auth", "user-gameflow.json");
// A11y user — dedicated to accessibility tests; fresh game state, never played.
// Prevents interference from game-completion Defeat test changing the game page UI.
const AUTH_FILE_A11Y = path.join(DIR, ".auth", "user-a11y.json");
const ENVIRONMENT_FILE = path.join(DIR, "..", ".env.local");
// Persists test user IDs between globalSetup and globalTeardown for cleanup.
export const TEST_USER_IDS_FILE = path.join(DIR, ".auth", "test-user-ids.json");
const MAX_CHUNK_SIZE = 3180; // `@supabase/ssr` cookie chunk size

type AuthSession = {
  access_token: string;
  refresh_token: string;
  user?: { id: string };
};

/** Parse .env.local file since Playwright runs outside of Next.js env loading. */
function loadEnvironmentFile(): Record<string, string> {
  if (!existsSync(ENVIRONMENT_FILE)) return {};
  const lines = readFileSync(ENVIRONMENT_FILE, "utf8").split("\n");
  const result: Record<string, string> = {};
  for (const line of lines) {
    const match = /^([A-Z_][A-Z0-9_]*)=(.+)/.exec(line.trim());
    if (match) {
      result[match[1]] = match[2].replaceAll(/^['"]|['"]$/g, "");
    }
  }
  return result;
}

/** Create an anonymous Supabase session via the Admin API (bypasses Turnstile captcha). */
async function createAnonymousSession(
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<AuthSession | null> {
  try {
    // eslint-disable-next-line no-restricted-syntax -- E2E Admin API call with service role key; response structure is known
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

    const session = (await response.json()) as AuthSession;
    if (!session.access_token || !session.refresh_token) {
      console.warn(
        "[E2E globalSetup] Session missing tokens:",
        Object.keys(session),
      );
      return null;
    }
    return session;
  } catch (error) {
    console.warn("[E2E globalSetup] Failed to create session:", error);
    return null;
  }
}

/** Save a Supabase session as `@supabase/ssr`-compatible browser cookies. */
function saveStorageState(
  filePath: string,
  session: AuthSession,
  projectReference: string,
): void {
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

  const cookies =
    chunks.length === 1
      ? [{ ...cookieBase, name: cookieName, value: chunks[0] }]
      : chunks.map((chunk, index) => ({
          ...cookieBase,
          name: `${cookieName}.${index}`,
          value: chunk,
        }));

  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify({ cookies, origins: [] }, null, 2));
}

/**
 * Playwright global setup — creates pre-authenticated anonymous Supabase sessions.
 *
 * Creates THREE separate users to prevent concurrent tests from sharing a game session:
 * - user.json         → game-completion, mobile tests
 * - user-gameflow.json → game-flow test (may submit guesses; separate session prevents
 *                        interference with game-completion's 6-attempt counter)
 * - user-a11y.json    → a11y tests (fresh game state; isolated from game-completion
 *                        Defeat test which exhausts 6 attempts on the primary user)
 *
 * Calls POST /auth/v1/signup with the service role key, which bypasses Turnstile
 * captcha (GoTrue skips captcha for admin requests). Saves sessions as
 * `@supabase/ssr`-compatible cookies for tests to reuse.
 */
// eslint-disable-next-line import-x/no-default-export -- Playwright requires default export for globalSetup
export default async function globalSetup(_config: FullConfig): Promise<void> {
  const env = { ...loadEnvironmentFile(), ...process.env };
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn(
      "[E2E globalSetup] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — skipping auth setup",
    );
    return;
  }

  const projectReference = /https?:\/\/([^.]+)\./.exec(supabaseUrl)?.[1];
  if (!projectReference) {
    console.warn(
      "[E2E globalSetup] Cannot parse project reference from Supabase URL",
    );
    return;
  }

  // Create all three users in parallel — they're independent Supabase sign-ups.
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
      "[E2E globalSetup] Primary session failed — game-completion/mobile tests may fail",
    );
  }

  if (gameflowSession) {
    saveStorageState(AUTH_FILE_GAMEFLOW, gameflowSession, projectReference);
    console.log(
      `[E2E globalSetup] Game-flow user: ${gameflowSession.user?.id ?? ""}`,
    );
  } else {
    console.warn(
      "[E2E globalSetup] Game-flow session failed — game-flow test may fail",
    );
  }

  if (a11ySession) {
    saveStorageState(AUTH_FILE_A11Y, a11ySession, projectReference);
    console.log(`[E2E globalSetup] A11y user: ${a11ySession.user?.id ?? ""}`);
  } else {
    console.warn("[E2E globalSetup] A11y session failed — a11y tests may fail");
  }

  // Persist user IDs for globalTeardown cleanup.
  const userIds = [primarySession, gameflowSession, a11ySession]
    .map((s) => s?.user?.id)
    .filter((id): id is string => typeof id === "string");

  if (userIds.length > 0) {
    mkdirSync(path.dirname(TEST_USER_IDS_FILE), { recursive: true });
    writeFileSync(
      TEST_USER_IDS_FILE,
      JSON.stringify({ serviceRoleKey, supabaseUrl, userIds }),
    );
    console.log(
      `[E2E globalSetup] Saved ${userIds.length} test user IDs for teardown cleanup`,
    );
  }
}
