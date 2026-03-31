import fs from "fs";
import path from "path";
import type { FullConfig } from "@playwright/test";

// Primary user — for game-completion tests (tracks win/loss across 6 attempts).
const AUTH_FILE = path.join(__dirname, ".auth", "user.json");
// Secondary user — for game-flow and other tests that submit guesses.
// Separate user prevents interference with game-completion's attempt counter.
const AUTH_FILE_GAMEFLOW = path.join(__dirname, ".auth", "user-gameflow.json");
// A11y user — dedicated to accessibility tests; fresh game state, never played.
// Prevents interference from game-completion Defeat test changing the game page UI.
const AUTH_FILE_A11Y = path.join(__dirname, ".auth", "user-a11y.json");
const ENV_FILE = path.join(__dirname, "..", ".env.local");
// Persists test user IDs between globalSetup and globalTeardown for cleanup.
export const TEST_USER_IDS_FILE = path.join(__dirname, ".auth", "test-user-ids.json");
const MAX_CHUNK_SIZE = 3180; // @supabase/ssr cookie chunk size

/** Parse .env.local file since Playwright runs outside of Next.js env loading. */
function loadEnvFile(): Record<string, string> {
  if (!fs.existsSync(ENV_FILE)) return {};
  const lines = fs.readFileSync(ENV_FILE, "utf8").split("\n");
  const result: Record<string, string> = {};
  for (const line of lines) {
    const match = /^([A-Z_][A-Z0-9_]*)=(.+)/.exec(line.trim());
    if (match) {
      result[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  }
  return result;
}

/** Create an anonymous Supabase session via the Admin API (bypasses Turnstile captcha). */
async function createAnonymousSession(
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/signup`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      // is_test_user flag allows filtering test accounts out of player statistics.
      body: JSON.stringify({ data: { is_test_user: true } }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.warn(`[E2E globalSetup] Auth endpoint returned ${response.status}: ${body}`);
      return null;
    }

    const session = (await response.json()) as Record<string, unknown>;
    if (!session.access_token || !session.refresh_token) {
      console.warn("[E2E globalSetup] Session missing tokens:", Object.keys(session));
      return null;
    }
    return session;
  } catch (error) {
    console.warn("[E2E globalSetup] Failed to create session:", error);
    return null;
  }
}

/** Save a Supabase session as @supabase/ssr-compatible browser cookies. */
function saveStorageState(filePath: string, session: Record<string, unknown>, projectRef: string): void {
  const cookieName = `sb-${projectRef}-auth-token`;
  const sessionJson = JSON.stringify(session);
  const chunks: string[] = [];
  for (let i = 0; i < sessionJson.length; i += MAX_CHUNK_SIZE) {
    chunks.push(sessionJson.slice(i, i + MAX_CHUNK_SIZE));
  }

  const cookieBase = {
    domain: "localhost",
    path: "/",
    httpOnly: false,
    secure: false,
    sameSite: "Lax" as const,
    expires: Math.floor(Date.now() / 1000) + 3600,
  };

  const cookies =
    chunks.length === 1
      ? [{ ...cookieBase, name: cookieName, value: chunks[0] }]
      : chunks.map((chunk, i) => ({
          ...cookieBase,
          name: `${cookieName}.${i}`,
          value: chunk,
        }));

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify({ cookies, origins: [] }, null, 2));
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
 * @supabase/ssr-compatible cookies for tests to reuse.
 */
export default async function globalSetup(_config: FullConfig): Promise<void> {
  const env = { ...loadEnvFile(), ...process.env };
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn(
      "[E2E globalSetup] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — skipping auth setup",
    );
    return;
  }

  const projectRef = /https?:\/\/([^.]+)\./.exec(supabaseUrl)?.[1];
  if (!projectRef) {
    console.warn("[E2E globalSetup] Cannot parse project ref from Supabase URL");
    return;
  }

  // Create all three users in parallel — they're independent Supabase sign-ups.
  const [primarySession, gameflowSession, a11ySession] = await Promise.all([
    createAnonymousSession(supabaseUrl, serviceRoleKey),
    createAnonymousSession(supabaseUrl, serviceRoleKey),
    createAnonymousSession(supabaseUrl, serviceRoleKey),
  ]);

  if (primarySession) {
    saveStorageState(AUTH_FILE, primarySession, projectRef);
    const userId = (primarySession.user as Record<string, unknown> | undefined)?.id;
    console.log(`[E2E globalSetup] Primary user: ${userId}`);
  } else {
    console.warn("[E2E globalSetup] Primary session failed — game-completion/mobile tests may fail");
  }

  if (gameflowSession) {
    saveStorageState(AUTH_FILE_GAMEFLOW, gameflowSession, projectRef);
    const userId = (gameflowSession.user as Record<string, unknown> | undefined)?.id;
    console.log(`[E2E globalSetup] Game-flow user: ${userId}`);
  } else {
    console.warn("[E2E globalSetup] Game-flow session failed — game-flow test may fail");
  }

  if (a11ySession) {
    saveStorageState(AUTH_FILE_A11Y, a11ySession, projectRef);
    const userId = (a11ySession.user as Record<string, unknown> | undefined)?.id;
    console.log(`[E2E globalSetup] A11y user: ${userId}`);
  } else {
    console.warn("[E2E globalSetup] A11y session failed — a11y tests may fail");
  }

  // Persist user IDs for globalTeardown cleanup.
  const userIds = [primarySession, gameflowSession, a11ySession]
    .map((s) => (s?.user as Record<string, unknown> | undefined)?.id)
    .filter((id): id is string => typeof id === "string");

  if (userIds.length > 0) {
    fs.mkdirSync(path.dirname(TEST_USER_IDS_FILE), { recursive: true });
    fs.writeFileSync(TEST_USER_IDS_FILE, JSON.stringify({ supabaseUrl, serviceRoleKey, userIds }));
    console.log(`[E2E globalSetup] Saved ${userIds.length} test user IDs for teardown cleanup`);
  }
}
